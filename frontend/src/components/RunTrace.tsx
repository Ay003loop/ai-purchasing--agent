import type { RunStep } from "../types";

function ToolCallLine({ payload }: { payload: any }) {
  const entries = Object.entries(payload.input || {});
  return (
    <div className="trace-body">
      <span className="chip tool_call">tool call</span>
      <strong>{payload.name}</strong>
      {entries.length > 0 && (
        <ul className="kv-list">
          {entries.map(([k, v]) => (
            <li key={k}>
              <span className="k">{k}</span>
              <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summarizeResult(result: any): { ok: boolean | null; lines: [string, string][] } {
  if (result == null) return { ok: null, lines: [] };
  if (result.error) return { ok: false, lines: [["error", result.error]] };

  const lines: [string, string][] = [];
  let ok: boolean | null = null;

  if ("validation" in result) {
    ok = result.validation.ok && result.approvalOutcome === "auto_approved";
    lines.push(["outcome", result.approvalOutcome]);
    lines.push(["quantity", String(result.validation.quantity)]);
    lines.push(["total cost", `$${result.validation.totalCost}`]);
    if (result.validation.issues?.length) {
      lines.push(["issues", result.validation.issues.join(" ")]);
    }
  } else if ("ok" in result) {
    ok = result.ok;
    if ("totalCost" in result) lines.push(["total cost", `$${result.totalCost}`]);
    if ("storageUnitsNeeded" in result) lines.push(["storage needed", String(result.storageUnitsNeeded)]);
    if (result.issues?.length) lines.push(["issues", result.issues.join(" ")]);
  } else if ("on_hand_qty" in result) {
    lines.push(["on hand", String(result.on_hand_qty)]);
  } else if ("forecast_units" in result) {
    lines.push(["forecast", String(result.forecast_units)]);
    lines.push(["run-rate/day", String(result.run_rate_per_day)]);
    lines.push(["projected total", String(result.projected_total_for_period)]);
    lines.push(["variance vs forecast", `${result.variance_vs_forecast_pct}%`]);
  } else if ("remaining_amount" in result) {
    lines.push(["budget remaining", `$${result.remaining_amount}`]);
  } else if ("remaining_units" in result) {
    lines.push(["storage remaining", String(result.remaining_units)]);
  } else if ("suppliers" in result) {
    for (const s of result.suppliers.slice(0, 3)) {
      lines.push([s.supplier_name, `$${s.unit_price} · min ${s.min_order_qty} · ${s.lead_time_days}d lead`]);
    }
  } else if ("escalated" in result) {
    ok = true;
    lines.push(["escalated", "true"]);
    lines.push(["approval id", result.approvalId]);
  } else if ("purchaseOrder" in result && result.purchaseOrder) {
    lines.push(["po id", result.purchaseOrder.id]);
    lines.push(["quantity", String(result.purchaseOrder.quantity)]);
    lines.push(["status", result.purchaseOrder.status]);
  }

  return { ok, lines };
}

function ToolResultLine({ payload }: { payload: any }) {
  const { ok, lines } = summarizeResult(payload.result);
  const chipClass = ok === false ? "tool_result-issue" : "tool_result-ok";
  return (
    <div className="trace-body">
      <span className={`chip ${chipClass}`}>result</span>
      <strong>{payload.name}</strong>
      {lines.length > 0 && (
        <ul className="kv-list">
          {lines.map(([k, v]) => (
            <li key={k}>
              <span className="k">{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RunTrace({ steps }: { steps: RunStep[] }) {
  if (steps.length === 0) {
    return <div className="empty-state">No steps yet.</div>;
  }
  return (
    <div className="trace">
      {steps.map((step) => {
        const payload = JSON.parse(step.payload);
        return (
          <div className="trace-line" key={step.id}>
            <div className="step-no">{String(step.step_index + 1).padStart(2, "0")}</div>
            <div>
              {step.type === "reasoning" && (
                <div className="trace-body">
                  <span className="chip reasoning">thinking</span>
                  <span className="reasoning-text">{payload.text}</span>
                </div>
              )}
              {step.type === "tool_call" && <ToolCallLine payload={payload} />}
              {step.type === "tool_result" && <ToolResultLine payload={payload} />}
              {step.type === "error" && (
                <div className="trace-body">
                  <span className="chip error">error</span>
                  {payload.message}
                </div>
              )}
              {step.type === "decision" && null /* rendered in DecisionPanel */}
            </div>
          </div>
        );
      })}
    </div>
  );
}
