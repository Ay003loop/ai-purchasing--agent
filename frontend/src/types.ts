export interface ScenarioListItem {
  key: string;
  label: string;
}

export interface KeyFactor {
  factor: string;
  detail: string;
}

export interface FinalDecision {
  decision: "accepted" | "modified" | "rejected" | "investigate" | "escalated";
  summary: string;
  keyFactors: KeyFactor[];
  actionsTaken?: string[];
  confidence: number;
}

export interface RunStep {
  id: string;
  run_id: string;
  step_index: number;
  type: "reasoning" | "tool_call" | "tool_result" | "decision" | "error";
  payload: string; // JSON string
  created_at: string;
}

export interface AgentRunResult {
  runId: string;
  status: string;
  decision: FinalDecision | null;
  steps: RunStep[];
}

export interface AgentRunSummary {
  id: string;
  scenario_type: string;
  situation_payload: string;
  status: string;
  decision: string | null;
  final_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: string;
  run_id: string;
  action_type: string;
  action_payload: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
}

export interface WorldSnapshot {
  products: any[];
  nodes: any[];
  inventory: any[];
  purchaseOrders: any[];
  budgets: any[];
  storage: any[];
  suppliers: any[];
}
