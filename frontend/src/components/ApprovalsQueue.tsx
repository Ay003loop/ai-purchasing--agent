import type { Approval } from "../types";

export default function ApprovalsQueue({
  approvals,
  onApprove,
  onReject,
}: {
  approvals: Approval[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (approvals.length === 0) {
    return <div className="empty-state">Nothing waiting on human review right now.</div>;
  }

  return (
    <div className="panel">
      {approvals.map((a) => {
        const payload = JSON.parse(a.action_payload);
        return (
          <div className="approval-row" key={a.id}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {a.action_type}
                {payload.poId ? ` · ${payload.poId}` : ""}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{a.reason}</div>
              <div className="mono" style={{ fontSize: 11, color: "#9a9a92", marginTop: 4 }}>
                run {a.run_id} · {new Date(a.created_at).toLocaleString()}
              </div>
            </div>
            {a.status === "pending" ? (
              <div className="approval-actions">
                <button className="approve-btn" onClick={() => onApprove(a.id)}>
                  Approve
                </button>
                <button className="reject-btn" onClick={() => onReject(a.id)}>
                  Reject
                </button>
              </div>
            ) : (
              <span className={`status-tag ${a.status}`}>{a.status}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
