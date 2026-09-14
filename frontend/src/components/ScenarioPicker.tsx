import { useState } from "react";
import type { AgentRunSummary, ScenarioListItem } from "../types";

export default function ScenarioPicker({
  scenarios,
  runs,
  running,
  onRun,
  onRunCustom,
  onSelectRun,
}: {
  scenarios: ScenarioListItem[];
  runs: AgentRunSummary[];
  running: string | null;
  onRun: (key: string) => void;
  onRunCustom: (title: string, description: string) => void;
  onSelectRun: (id: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div>
      <div className="scenario-grid">
        {scenarios.map((s, i) => (
          <div className="scenario-card" key={s.key}>
            <span className="idx">{String(i + 1).padStart(2, "0")}</span>
            <h3>{s.label.replace(/^Scenario \d+ — /, "")}</h3>
            <button className="run-btn" disabled={!!running} onClick={() => onRun(s.key)}>
              {running === s.key ? "Running…" : "Run agent"}
            </button>
          </div>
        ))}
      </div>

      <button className="run-btn secondary" onClick={() => setShowCustom((v) => !v)}>
        {showCustom ? "Cancel custom situation" : "+ Describe a custom situation"}
      </button>

      {showCustom && (
        <div className="custom-form" style={{ marginTop: 14 }}>
          <input
            placeholder="Short title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Describe the purchasing situation in plain language. The agent will use its tools against the same mock dataset the seeded scenarios use, so referencing a product/node from that data (e.g. Cola 500ml at Bogota DC) will get the most sensible results."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            className="run-btn"
            disabled={!!running || !title || !description}
            onClick={() => onRunCustom(title, description)}
            style={{ alignSelf: "flex-start" }}
          >
            {running === "custom" ? "Running…" : "Run agent on this situation"}
          </button>
        </div>
      )}

      {runs.length > 0 && (
        <div className="run-history">
          <div className="section-title">recent runs</div>
          {runs.slice(0, 8).map((r) => (
            <div className="run-history-row" key={r.id} onClick={() => onSelectRun(r.id)}>
              <span>
                {r.scenario_type} — {r.decision ?? r.status}
              </span>
              <span className="mono">{new Date(r.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
