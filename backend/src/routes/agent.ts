import { Router } from "express";
import { runAgent } from "../agent/orchestrator";
import { getScenario, SCENARIO_LIST } from "../scenarios";
import * as repo from "../db/repository";

const router = Router();

router.get("/scenarios", (_req, res) => {
  res.json(SCENARIO_LIST);
});

// Run a canned scenario by key
router.post("/run/:scenarioKey", async (req, res) => {
  try {
    const situation = getScenario(req.params.scenarioKey);
    const result = await runAgent(situation);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// Run a custom / freeform situation
router.post("/run-custom", async (req, res) => {
  try {
    const { scenarioType, title, description, context } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "title and description are required" });
    }
    const result = await runAgent({
      scenarioType: scenarioType || "custom",
      title,
      description,
      context: context || {},
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

router.get("/runs", (_req, res) => {
  res.json(repo.listAgentRuns());
});

router.get("/runs/:id", (req, res) => {
  const run = repo.getAgentRun(req.params.id);
  if (!run) return res.status(404).json({ error: "not found" });
  const steps = repo.getAgentRunSteps(req.params.id);
  const approvals = repo.listApprovals().filter((a: any) => a.run_id === req.params.id);
  res.json({ ...run, situation_payload: JSON.parse(run.situation_payload), steps, approvals });
});

export default router;
