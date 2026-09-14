import type { FinalDecision } from "../types";

export default function DecisionPanel({
  decision,
  status,
}: {
  decision: FinalDecision | null;
  status: string;
}) {
  if (!decision) {
    return <div className="empty-state">Waiting on the agent's decision…</div>;
  }

  return (
    <div className="decision-body">
      <span className={`decision-badge ${decision.decision}`}>{decision.decision}</span>
      {status === "awaiting_approval" && (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--warn)" }}>
          One or more actions from this run are queued in the Approvals tab.
        </p>
      )}
      <p style={{ marginTop: 12, fontSize: 14 }}>{decision.summary}</p>

      <div className="section-title">key factors</div>
      {decision.keyFactors.map((f, i) => (
        <div className="factor" key={i}>
          <div className="factor-title">{f.factor}</div>
          <div className="factor-detail">{f.detail}</div>
        </div>
      ))}

      {decision.actionsTaken && decision.actionsTaken.length > 0 && (
        <>
          <div className="section-title">actions taken</div>
          <ul className="kv-list" style={{ listStyle: "disc", paddingLeft: 18 }}>
            {decision.actionsTaken.map((a, i) => (
              <li key={i} style={{ display: "list-item" }}>
                {a}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="section-title">confidence</div>
      <div className="confidence-bar">
        <div style={{ width: `${Math.round(decision.confidence * 100)}%` }} />
      </div>
    </div>
  );
}
