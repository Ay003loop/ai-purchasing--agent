import { nanoid } from "nanoid";
import db from "./client";

function now() {
  return new Date().toISOString();
}

// ---------- Reference data ----------

export function getProductBySkuOrId(idOrSku: string) {
  return db
    .prepare(`SELECT * FROM products WHERE id = ? OR sku = ?`)
    .get(idOrSku, idOrSku) as any;
}

export function getNode(idOrName: string) {
  return db
    .prepare(`SELECT * FROM nodes WHERE id = ? OR name = ?`)
    .get(idOrName, idOrName) as any;
}

export function listProducts() {
  return db.prepare(`SELECT * FROM products ORDER BY name`).all();
}

export function listNodes() {
  return db.prepare(`SELECT * FROM nodes ORDER BY name`).all();
}

// ---------- Investigation tools (read-only) ----------

export function getInventory(productId: string, nodeId: string) {
  const row = db
    .prepare(`SELECT * FROM inventory WHERE product_id = ? AND node_id = ?`)
    .get(productId, nodeId) as any;
  return row ?? { product_id: productId, node_id: nodeId, on_hand_qty: 0 };
}

export function getDemandForecast(productId: string, nodeId: string) {
  const row = db
    .prepare(
      `SELECT * FROM demand_forecast WHERE product_id = ? AND node_id = ? ORDER BY period_start DESC LIMIT 1`
    )
    .get(productId, nodeId) as any;
  if (!row) return null;
  const runRatePerDay = row.days_elapsed_in_period > 0 ? row.actual_units_to_date / row.days_elapsed_in_period : 0;
  const projectedTotal = Math.round(runRatePerDay * row.total_days_in_period);
  return {
    ...row,
    run_rate_per_day: Number(runRatePerDay.toFixed(2)),
    projected_total_for_period: projectedTotal,
    variance_vs_forecast_pct: row.forecast_units > 0
      ? Number((((projectedTotal - row.forecast_units) / row.forecast_units) * 100).toFixed(1))
      : 0,
  };
}

export function getOpenPurchaseOrders(productId: string, nodeId: string) {
  return db
    .prepare(
      `SELECT * FROM purchase_orders WHERE product_id = ? AND node_id = ? AND status IN ('draft','pending_approval','approved','sent','partially_fulfilled') ORDER BY created_at`
    )
    .all(productId, nodeId);
}

export function getPurchaseOrder(id: string) {
  return db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as any;
}

export function getSupplierTerms(productId: string) {
  return db
    .prepare(
      `SELECT sp.*, s.name as supplier_name, s.reliability_score, s.default_lead_time_days
       FROM supplier_products sp
       JOIN suppliers s ON s.id = sp.supplier_id
       WHERE sp.product_id = ?
       ORDER BY sp.is_preferred DESC, sp.unit_price ASC`
    )
    .all(productId);
}

export function getBudget(nodeId: string, category: string, period: string) {
  const row = db
    .prepare(`SELECT * FROM budgets WHERE node_id = ? AND category = ? AND period = ?`)
    .get(nodeId, category, period) as any;
  if (!row) return null;
  return { ...row, remaining_amount: Number((row.budget_amount - row.spent_amount).toFixed(2)) };
}

export function getStorageCapacity(nodeId: string, category: string) {
  const row = db
    .prepare(`SELECT * FROM storage_capacity WHERE node_id = ? AND category = ?`)
    .get(nodeId, category) as any;
  if (!row) return null;
  return { ...row, remaining_units: Number((row.capacity_units - row.used_units).toFixed(2)) };
}

// ---------- Action tools (write) ----------

export function createPurchaseOrder(params: {
  productId: string;
  nodeId: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  leadTimeDays: number;
  notes?: string;
  status?: string;
}) {
  const id = "po_" + nanoid(8);
  const delivery = new Date();
  delivery.setDate(delivery.getDate() + params.leadTimeDays);
  db.prepare(
    `INSERT INTO purchase_orders
     (id, product_id, node_id, supplier_id, quantity, original_quantity, unit_price, status, expected_delivery_date, created_at, updated_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.productId,
    params.nodeId,
    params.supplierId,
    params.quantity,
    params.quantity,
    params.unitPrice,
    params.status ?? "pending_approval",
    delivery.toISOString().slice(0, 10),
    now(),
    now(),
    params.notes ?? null
  );
  return getPurchaseOrder(id);
}

export function modifyPurchaseOrder(
  poId: string,
  newQuantity: number,
  notes?: string,
  newSupplierId?: string,
  newUnitPrice?: number
) {
  const existing = getPurchaseOrder(poId);
  if (!existing) throw new Error(`Purchase order ${poId} not found`);
  db.prepare(
    `UPDATE purchase_orders SET quantity = ?, supplier_id = COALESCE(?, supplier_id), unit_price = COALESCE(?, unit_price), notes = ?, updated_at = ? WHERE id = ?`
  ).run(newQuantity, newSupplierId ?? null, newUnitPrice ?? null, notes ?? existing.notes, now(), poId);
  return getPurchaseOrder(poId);
}

export function cancelPurchaseOrder(poId: string, reason: string) {
  db.prepare(`UPDATE purchase_orders SET status = 'cancelled', notes = ?, updated_at = ? WHERE id = ?`).run(
    reason,
    now(),
    poId
  );
  return getPurchaseOrder(poId);
}

export function commitBudgetSpend(nodeId: string, category: string, period: string, amount: number) {
  db.prepare(
    `UPDATE budgets SET spent_amount = spent_amount + ? WHERE node_id = ? AND category = ? AND period = ?`
  ).run(amount, nodeId, category, period);
  return getBudget(nodeId, category, period);
}

export function commitStorageUsage(nodeId: string, category: string, units: number) {
  db.prepare(
    `UPDATE storage_capacity SET used_units = used_units + ? WHERE node_id = ? AND category = ?`
  ).run(units, nodeId, category);
  return getStorageCapacity(nodeId, category);
}

export function setPurchaseOrderStatus(poId: string, status: string, notes?: string) {
  db.prepare(`UPDATE purchase_orders SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?`).run(
    status,
    notes ?? null,
    now(),
    poId
  );
  return getPurchaseOrder(poId);
}

// ---------- Agent run / audit trail ----------

export function createAgentRun(scenarioType: string, situationPayload: any) {
  const id = "run_" + nanoid(10);
  db.prepare(
    `INSERT INTO agent_runs (id, scenario_type, situation_payload, status, created_at, updated_at) VALUES (?, ?, ?, 'running', ?, ?)`
  ).run(id, scenarioType, JSON.stringify(situationPayload), now(), now());
  return id;
}

export function addAgentRunStep(runId: string, stepIndex: number, type: string, payload: any) {
  db.prepare(
    `INSERT INTO agent_run_steps (id, run_id, step_index, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), runId, stepIndex, type, JSON.stringify(payload), now());
}

export function updateAgentRun(runId: string, fields: { status?: string; decision?: string; final_summary?: string }) {
  const current = getAgentRun(runId);
  db.prepare(
    `UPDATE agent_runs SET status = ?, decision = ?, final_summary = ?, updated_at = ? WHERE id = ?`
  ).run(
    fields.status ?? current.status,
    fields.decision ?? current.decision,
    fields.final_summary ?? current.final_summary,
    now(),
    runId
  );
}

export function getAgentRun(runId: string) {
  return db.prepare(`SELECT * FROM agent_runs WHERE id = ?`).get(runId) as any;
}

export function getAgentRunSteps(runId: string) {
  return db
    .prepare(`SELECT * FROM agent_run_steps WHERE run_id = ? ORDER BY step_index ASC`)
    .all(runId);
}

export function listAgentRuns() {
  return db.prepare(`SELECT * FROM agent_runs ORDER BY created_at DESC`).all();
}

// ---------- Approvals (human-in-the-loop) ----------

export function createApproval(runId: string, actionType: string, actionPayload: any, reason: string) {
  const id = "appr_" + nanoid(8);
  db.prepare(
    `INSERT INTO approvals (id, run_id, action_type, action_payload, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, runId, actionType, JSON.stringify(actionPayload), reason, now());
  return id;
}

export function getApproval(id: string) {
  return db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(id) as any;
}

export function listApprovals(status?: string) {
  if (status) {
    return db.prepare(`SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC`).all(status);
  }
  return db.prepare(`SELECT * FROM approvals ORDER BY created_at DESC`).all();
}

export function decideApproval(id: string, status: "approved" | "rejected") {
  db.prepare(`UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?`).run(status, now(), id);
  return getApproval(id);
}

// ---------- Data browser helpers (for the frontend "world state" views) ----------

export function getWorldSnapshot() {
  const products = listProducts();
  const nodes = listNodes();
  const inventory = db.prepare(`SELECT * FROM inventory`).all();
  const purchaseOrders = db.prepare(`SELECT * FROM purchase_orders ORDER BY created_at DESC`).all();
  const budgets = db.prepare(`SELECT * FROM budgets`).all();
  const storage = db.prepare(`SELECT * FROM storage_capacity`).all();
  const suppliers = db.prepare(`SELECT * FROM suppliers`).all();
  return { products, nodes, inventory, purchaseOrders, budgets, storage, suppliers };
}
