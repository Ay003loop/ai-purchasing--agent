import Anthropic from "@anthropic-ai/sdk";
import * as repo from "../db/repository";
import { TOOLS, executeTool, ToolContext } from "./tools";
import { SYSTEM_PROMPT, buildInitialUserMessage, Situation } from "./prompts";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const MAX_ITERATIONS = 14;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AgentRunResult {
  runId: string;
  status: string;
  decision: any;
  steps: any[];
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function runAgent(situation: Situation): Promise<AgentRunResult> {
  const period = currentPeriod();
  const runId = repo.createAgentRun(situation.scenarioType, situation);
  const ctx: ToolContext = { runId, period };

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildInitialUserMessage(situation, period) },
  ];

  let stepIndex = 0;
  let finalDecision: any = null;

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS && !finalDecision; iteration++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: TOOLS as Anthropic.Tool[],
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "text" && block.text.trim()) {
          repo.addAgentRunStep(runId, stepIndex++, "reasoning", { text: block.text });
        } else if (block.type === "tool_use") {
          if (block.name === "final_decision") {
            finalDecision = block.input;
            repo.addAgentRunStep(runId, stepIndex++, "decision", block.input);
            // No tool_result needed - we stop the loop after this.
            continue;
          }

          repo.addAgentRunStep(runId, stepIndex++, "tool_call", { name: block.name, input: block.input });
          let result: any;
          try {
            result = executeTool(block.name, block.input, ctx);
          } catch (err: any) {
            result = { error: err?.message ?? String(err) };
          }
          repo.addAgentRunStep(runId, stepIndex++, "tool_result", { name: block.name, result });

          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      if (finalDecision) break;

      if (toolResultBlocks.length === 0) {
        // Model produced only text with no tool calls and no final_decision -
        // nudge it to conclude rather than looping forever.
        messages.push({
          role: "user",
          content:
            "Please continue investigating with tool calls, or call final_decision if you have enough information.",
        });
        continue;
      }

      messages.push({ role: "user", content: toolResultBlocks });
    }
  } catch (err: any) {
    repo.addAgentRunStep(runId, stepIndex++, "error", { message: err?.message ?? String(err) });
    repo.updateAgentRun(runId, {
      status: "failed",
      final_summary: `Agent run failed: ${err?.message ?? String(err)}`,
    });
    return { runId, status: "failed", decision: null, steps: repo.getAgentRunSteps(runId) };
  }

  if (!finalDecision) {
    // Ran out of iterations without concluding - fail safe to escalation
    // rather than silently doing nothing or guessing.
    const approvalId = repo.createApproval(
      runId,
      "escalation",
      {},
      "Agent did not reach a conclusion within its iteration budget - needs human review."
    );
    finalDecision = {
      decision: "escalated",
      summary: "The agent could not reach a confident conclusion within its step budget and has escalated to a human buyer.",
      keyFactors: [{ factor: "Iteration budget exceeded", detail: `Stopped after ${MAX_ITERATIONS} tool-use iterations.` }],
      actionsTaken: [`Created escalation ${approvalId}`],
      confidence: 0,
    };
    repo.addAgentRunStep(runId, stepIndex++, "decision", finalDecision);
  }

  const pendingApprovals = repo.listApprovals("pending").filter((a: any) => a.run_id === runId);
  const status = pendingApprovals.length > 0 ? "awaiting_approval" : "completed";

  repo.updateAgentRun(runId, {
    status,
    decision: finalDecision.decision,
    final_summary: finalDecision.summary,
  });

  return { runId, status, decision: finalDecision, steps: repo.getAgentRunSteps(runId) };
}
