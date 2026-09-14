import * as repo from "../db/repository";

/**
 * Approving a purchase-order action commits its cost/storage footprint to the
 * budget and storage ledgers and moves the PO to 'approved'. This is the
 * single place where a proposed action actually becomes "real" - whether the
 * approval was granted automatically by policy (see validate.ts) or by a
 * human via the approvals queue.
 */
export function approvePurchaseOrderAction(poId: string, period: string) {
  const po = repo.getPurchaseOrder(poId);
  if (!po) throw new Error(`PO ${poId} not found`);
  const product = repo.getProductBySkuOrId(po.product_id);
  const cost = Number((po.quantity * po.unit_price).toFixed(2));
  const storageUnits = Number((po.quantity * product.storage_units_per_unit).toFixed(2));

  repo.commitBudgetSpend(po.node_id, product.category, period, cost);
  repo.commitStorageUsage(po.node_id, product.category, storageUnits);
  return repo.setPurchaseOrderStatus(poId, "approved", po.notes);
}

export function rejectPurchaseOrderAction(poId: string, reason: string) {
  return repo.setPurchaseOrderStatus(poId, "rejected", reason);
}

export function resolveApproval(approvalId: string, decision: "approved" | "rejected", period: string) {
  const approval = repo.getApproval(approvalId);
  if (!approval) throw new Error(`Approval ${approvalId} not found`);
  const payload = JSON.parse(approval.action_payload);

  repo.decideApproval(approvalId, decision);

  if (approval.action_type === "create_purchase_order" || approval.action_type === "modify_purchase_order") {
    if (decision === "approved") {
      approvePurchaseOrderAction(payload.poId, period);
    } else {
      rejectPurchaseOrderAction(payload.poId, "Rejected by human reviewer.");
    }
  }

  // If this was the last open approval for the run, mark the run completed.
  const remaining = repo
    .listApprovals("pending")
    .filter((a: any) => a.run_id === approval.run_id);
  if (remaining.length === 0) {
    repo.updateAgentRun(approval.run_id, { status: "completed" });
  }

  return repo.getApproval(approvalId);
}
