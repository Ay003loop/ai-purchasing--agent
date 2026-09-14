import { nanoid } from "nanoid";
import db from "./client";

function now() {
  return new Date().toISOString();
}

function clearAll() {
  const tables = [
    "approvals",
    "agent_run_steps",
    "agent_runs",
    "purchase_orders",
    "demand_forecast",
    "inventory",
    "storage_capacity",
    "budgets",
    "supplier_products",
    "suppliers",
    "products",
    "nodes",
  ];
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
}

function insertNode(id: string, name: string, city: string) {
  db.prepare(`INSERT INTO nodes (id, name, city) VALUES (?, ?, ?)`).run(id, name, city);
}

function insertProduct(id: string, sku: string, name: string, category: string, unitCost: number, storageUnits = 1) {
  db.prepare(
    `INSERT INTO products (id, sku, name, category, unit_cost, storage_units_per_unit) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, sku, name, category, unitCost, storageUnits);
}

function insertSupplier(id: string, name: string, reliability: number, leadTime: number) {
  db.prepare(
    `INSERT INTO suppliers (id, name, reliability_score, default_lead_time_days) VALUES (?, ?, ?, ?)`
  ).run(id, name, reliability, leadTime);
}

function insertSupplierProduct(
  supplierId: string,
  productId: string,
  unitPrice: number,
  minOrderQty: number,
  leadTimeDays: number,
  preferred = false
) {
  db.prepare(
    `INSERT INTO supplier_products (id, supplier_id, product_id, unit_price, min_order_qty, lead_time_days, is_preferred)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), supplierId, productId, unitPrice, minOrderQty, leadTimeDays, preferred ? 1 : 0);
}

function insertInventory(productId: string, nodeId: string, qty: number) {
  db.prepare(
    `INSERT INTO inventory (id, product_id, node_id, on_hand_qty, updated_at) VALUES (?, ?, ?, ?, ?)`
  ).run(nanoid(), productId, nodeId, qty, now());
}

function insertForecast(
  productId: string,
  nodeId: string,
  forecastUnits: number,
  actualToDate: number,
  daysElapsed: number,
  totalDays: number,
  notes: string
) {
  const start = new Date();
  start.setDate(start.getDate() - daysElapsed);
  const end = new Date(start);
  end.setDate(start.getDate() + totalDays);
  db.prepare(
    `INSERT INTO demand_forecast
     (id, product_id, node_id, period_start, period_end, forecast_units, actual_units_to_date, days_elapsed_in_period, total_days_in_period, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    nanoid(),
    productId,
    nodeId,
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
    forecastUnits,
    actualToDate,
    daysElapsed,
    totalDays,
    notes
  );
}

function insertPO(
  productId: string,
  nodeId: string,
  supplierId: string,
  quantity: number,
  originalQuantity: number,
  unitPrice: number,
  status: string,
  deliveryInDays: number,
  notes: string
) {
  const id = "po_" + nanoid(8);
  const delivery = new Date();
  delivery.setDate(delivery.getDate() + deliveryInDays);
  db.prepare(
    `INSERT INTO purchase_orders
     (id, product_id, node_id, supplier_id, quantity, original_quantity, unit_price, status, expected_delivery_date, created_at, updated_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, productId, nodeId, supplierId, quantity, originalQuantity, unitPrice, status, delivery.toISOString().slice(0, 10), now(), now(), notes);
  return id;
}

function insertBudget(nodeId: string, category: string, period: string, amount: number, spent: number) {
  db.prepare(
    `INSERT INTO budgets (id, node_id, category, period, budget_amount, spent_amount) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), nodeId, category, period, amount, spent);
}

function insertStorage(nodeId: string, category: string, capacity: number, used: number) {
  db.prepare(
    `INSERT INTO storage_capacity (id, node_id, category, capacity_units, used_units) VALUES (?, ?, ?, ?, ?)`
  ).run(nanoid(), nodeId, category, capacity, used);
}

function seed() {
  clearAll();
  const period = new Date().toISOString().slice(0, 7); // e.g. 2026-09

  // --- Nodes ---
  insertNode("node-bog", "Bogota DC", "Bogota");
  insertNode("node-mex", "Mexico City DC", "Mexico City");

  // --- Products ---
  insertProduct("prod-cola", "SKU-COLA-500", "Cola 500ml", "beverages", 0.65, 1);
  insertProduct("prod-water", "SKU-WATER-1L", "Bottled Water 1L", "beverages", 0.4, 1.2);
  insertProduct("prod-energy", "SKU-ENERGY-250", "Energy Drink 250ml", "beverages", 0.85, 1);
  insertProduct("prod-chips", "SKU-CHIPS-150", "Potato Chips 150g", "snacks", 1.0, 1.5);
  insertProduct("prod-shampoo", "SKU-SHAMP-400", "Shampoo 400ml", "personal_care", 2.1, 1);

  // --- Suppliers ---
  insertSupplier("sup-andina", "Andina Beverages", 0.95, 5);
  insertSupplier("sup-andina-backup", "Andina Beverages (Backup Line)", 0.8, 3);
  insertSupplier("sup-snackco", "Snack Foods Co", 0.85, 10);
  insertSupplier("sup-globalsnacks", "Global Snacks Ltd", 0.75, 15);
  insertSupplier("sup-belleza", "Belleza SA", 0.9, 12);

  // --- Supplier <-> Product pricing/terms ---
  insertSupplierProduct("sup-andina", "prod-cola", 0.85, 100, 5, true);
  insertSupplierProduct("sup-andina-backup", "prod-cola", 0.95, 50, 3, false);
  insertSupplierProduct("sup-andina", "prod-water", 0.55, 200, 5, true);
  insertSupplierProduct("sup-andina", "prod-energy", 1.15, 100, 6, true);
  insertSupplierProduct("sup-snackco", "prod-chips", 1.2, 300, 10, true);
  insertSupplierProduct("sup-globalsnacks", "prod-chips", 1.5, 50, 15, false);
  insertSupplierProduct("sup-belleza", "prod-shampoo", 2.6, 500, 12, true);

  // ======================================================================
  // SCENARIO 1 — Purchase Recommendation Review
  // Product: Cola 500ml @ Bogota DC. System recommends buying 800 units.
  // Storage is the tightest constraint (~250 units of headroom), budget is
  // the secondary constraint (~588 units affordable), true net need is ~400.
  // Expected: MODIFY the recommendation down (storage-bound), not accept as-is.
  // ======================================================================
  insertInventory("prod-cola", "node-bog", 300);
  insertForecast("prod-cola", "node-bog", 900, 580, 20, 30, "Normal seasonal demand, no anomalies observed.");
  insertPO("prod-cola", "node-bog", "sup-andina", 200, 200, 0.85, "sent", 4, "Existing open PO, in transit.");
  insertBudget("node-bog", "beverages", period, 2000, 1500); // 500 remaining
  insertStorage("node-bog", "beverages", 2000, 1750); // 250 units headroom

  // Baseline inventory/budget/storage for water at same node (not directly
  // used by scenario 1 but keeps the beverages category numbers coherent
  // for anyone browsing the data).
  insertInventory("prod-water", "node-bog", 500);

  // ======================================================================
  // SCENARIO 2 — Supplier Cannot Fulfil the Purchase
  // Product: Potato Chips @ Mexico City DC. PO for 500 units created with
  // Snack Foods Co, but supplier confirms only 250 units available.
  // An alternate supplier (Global Snacks Ltd) exists at a higher price and
  // longer lead time, with a low minimum order (50 units) - viable for topping
  // up the shortfall.
  // ======================================================================
  insertInventory("prod-chips", "node-mex", 90);
  insertForecast("prod-chips", "node-mex", 600, 380, 18, 30, "Normal demand trend.");
  const scenario2PoId = insertPO("prod-chips", "node-mex", "sup-snackco", 500, 500, 1.2, "sent", 10, "Supplier just confirmed partial fulfilment: only 250 of 500 units available.");
  insertBudget("node-mex", "snacks", period, 1500, 500); // 1000 remaining - budget is not the binding constraint here
  insertStorage("node-mex", "snacks", 1200, 400); // plenty of headroom

  // ======================================================================
  // SCENARIO 3 — Demand / Forecast Has Changed
  // Product: Energy Drink @ Bogota DC. Forecast was "normal" (500 units /
  // 30 days) but actual sales run-rate is far above forecast (480 units in
  // just 12 days => run-rate ~1200/month). Existing PO + on-hand will not
  // cover the revised outlook.
  // ======================================================================
  insertInventory("prod-energy", "node-bog", 150);
  insertForecast(
    "prod-energy",
    "node-bog",
    500,
    480,
    12,
    30,
    "Sales spiked after a social-media mention; run-rate is far above the original forecast."
  );
  insertPO("prod-energy", "node-bog", "sup-andina", 300, 300, 1.15, "sent", 6, "Existing open PO, sized for the original (now stale) forecast.");
  // Note: shares the same node-bog/beverages budget & storage records seeded
  // for Scenario 1 above (both products are in the "beverages" category at
  // the same node), so no separate insertBudget/insertStorage call here.

  // ======================================================================
  // SCENARIO 4 — Purchasing Constraint (conflicting constraints)
  // Product: Shampoo @ Mexico City DC. Net need is modest (~300 units) but
  // the supplier's minimum order (500 units) would blow through the
  // remaining budget (~346 units affordable). No alternate supplier is
  // configured. The agent must not blindly place a 500-unit order - it
  // should recognise the conflict and escalate / investigate instead.
  // ======================================================================
  insertInventory("prod-shampoo", "node-mex", 20);
  insertForecast("prod-shampoo", "node-mex", 320, 210, 20, 30, "Steady demand, no anomalies.");
  insertBudget("node-mex", "personal_care", period, 900, 0); // 900 remaining => max ~346 units at $2.6
  insertStorage("node-mex", "personal_care", 1000, 100); // storage is not the binding constraint

  console.log("Seed complete.");
  console.log("Scenario 2 existing PO id:", scenario2PoId);
}

seed();
