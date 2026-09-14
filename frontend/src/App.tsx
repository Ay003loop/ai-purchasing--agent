import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { api } from "./api";
import type { AgentRunSummary, Approval, ScenarioListItem, WorldSnapshot } from "./types";
import ScenarioPicker from "./components/ScenarioPicker";
import RunTrace from "./components/RunTrace";
import DecisionPanel from "./components/DecisionPanel";
import ApprovalsQueue from "./components/ApprovalsQueue";
import WorldDataBrowser from "./components/WorldDataBrowser";

type Tab = "scenarios" | "approvals" | "world";

function App() {
  const [tab, setTab] = useState<Tab>("scenarios");
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);
  const [activeRun, setActiveRun] = useState<any | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [world, setWorld] = useState<WorldSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshRuns = useCallback(() => {
    api.listRuns().then(setRuns).catch(() => {});
  }, []);

  const refreshApprovals = useCallback(() => {
    api.listApprovals().then(setApprovals).catch(() => {});
  }, []);

  const refreshWorld = useCallback(() => {
    api.world().then(setWorld).catch(() => {});
  }, []);

  useEffect(() => {
    api.listScenarios().then(setScenarios).catch((e) => setError(e.message));
    refreshRuns();
    refreshApprovals();
    refreshWorld();
  }, [refreshRuns, refreshApprovals, refreshWorld]);

  async function runScenario(key: string) {
    setRunning(key);
    setError(null);
    try {
      const result = await api.runScenario(key);
      const full = await api.getRun(result.runId);
      setActiveRun(full);
      refreshRuns();
      refreshApprovals();
      refreshWorld();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(null);
    }
  }

  async function runCustom(title: string, description: string) {
    setRunning("custom");
    setError(null);
    try {
      const result = await api.runCustom({ scenarioType: "custom", title, description });
      const full = await api.getRun(result.runId);
      setActiveRun(full);
      refreshRuns();
      refreshApprovals();
      refreshWorld();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(null);
    }
  }

  async function selectRun(id: string) {
    const full = await api.getRun(id);
    setActiveRun(full);
  }

  async function approve(id: string) {
    await api.approve(id);
    refreshApprovals();
    refreshWorld();
    if (activeRun) selectRun(activeRun.id);
  }

  async function reject(id: string) {
    await api.reject(id);
    refreshApprovals();
    refreshWorld();
    if (activeRun) selectRun(activeRun.id);
  }

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">LEDGER-01</span>
          <h1>Buyer's Agent</h1>
        </div>
        <nav className="nav">
          <button className={tab === "scenarios" ? "active" : ""} onClick={() => setTab("scenarios")}>
            Scenarios
          </button>
          <button className={tab === "approvals" ? "active" : ""} onClick={() => setTab("approvals")}>
            <span>Approvals</span>
            {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
          </button>
          <button className={tab === "world" ? "active" : ""} onClick={() => setTab("world")}>
            World data
          </button>
        </nav>
        <div className="sidebar-footer">
          AI Purchasing Agent
          <br />
          mock data · no real suppliers
        </div>
      </aside>

      <main className="main">
        {error && (
          <div className="empty-state" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 20 }}>
            {error}
          </div>
        )}

        {tab === "scenarios" && (
          <>
            <div className="page-header">
              <h2>Purchasing situations</h2>
              <p>
                Trigger one of the seeded scenarios, or describe your own. The agent investigates using
                its tools against the mock dataset, decides what should happen, and takes action where
                appropriate.
              </p>
            </div>
            <ScenarioPicker
              scenarios={scenarios}
              runs={runs}
              running={running}
              onRun={runScenario}
              onRunCustom={runCustom}
              onSelectRun={selectRun}
            />

            {activeRun && (
              <div className="run-panel" style={{ marginTop: 28 }}>
                <div className="panel">
                  <div className="panel-header">
                    <span>Agent trace — {activeRun.id}</span>
                    <span className={`status-tag ${activeRun.status}`}>{activeRun.status}</span>
                  </div>
                  <RunTrace steps={activeRun.steps} />
                </div>
                <div className="panel">
                  <div className="panel-header">Decision</div>
                  <DecisionPanel
                    decision={JSON.parse(
                      activeRun.steps.find((s: any) => s.type === "decision")?.payload ?? "null"
                    )}
                    status={activeRun.status}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {tab === "approvals" && (
          <>
            <div className="page-header">
              <h2>Human approval queue</h2>
              <p>
                Purchase orders above the auto-approval threshold, or that failed automatic validation,
                land here instead of executing automatically. Approving commits the spend/storage; rejecting
                cancels the order.
              </p>
            </div>
            <ApprovalsQueue approvals={approvals} onApprove={approve} onReject={reject} />
          </>
        )}

        {tab === "world" && (
          <>
            <div className="page-header">
              <h2>World data</h2>
              <p>Live snapshot of the mock database the agent reads from and writes to.</p>
            </div>
            {world ? <WorldDataBrowser world={world} /> : <div className="empty-state">Loading…</div>}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
