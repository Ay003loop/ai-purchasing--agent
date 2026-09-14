import type { AgentRunResult, AgentRunSummary, Approval, ScenarioListItem, WorldSnapshot } from "./types";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listScenarios: () => req<ScenarioListItem[]>("/api/agent/scenarios"),
  runScenario: (key: string) => req<AgentRunResult>(`/api/agent/run/${key}`, { method: "POST" }),
  runCustom: (body: { scenarioType: string; title: string; description: string; context?: any }) =>
    req<AgentRunResult>(`/api/agent/run-custom`, { method: "POST", body: JSON.stringify(body) }),
  listRuns: () => req<AgentRunSummary[]>("/api/agent/runs"),
  getRun: (id: string) => req<any>(`/api/agent/runs/${id}`),
  listApprovals: (status?: string) => req<Approval[]>(`/api/approvals${status ? `?status=${status}` : ""}`),
  approve: (id: string) => req(`/api/approvals/${id}/approve`, { method: "POST" }),
  reject: (id: string) => req(`/api/approvals/${id}/reject`, { method: "POST" }),
  world: () => req<WorldSnapshot>("/api/data/world"),
};
