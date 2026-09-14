/**
 * Verifies (without calling the LLM) that the seeded mock data actually
 * produces the constraint situations each scenario is designed to test.
 * Run with: npm run verify-data
 */
import * as repo from "../db/repository";
import { checkPurchaseConstraints } from "../agent/validate";

function section(title: string) {
  console.log("\n=== " + title + " ===");
}

function assert(cond: boolean, msg: string) {
  console.log((cond ? "  [PASS] " : "  [FAIL] ") + msg);
  if (!cond) process.exitCode = 1;
}

const period = new Date().toISOString().slice(0, 7);

section("Scenario 1 — Cola recommendation of 800 units @ Bogota DC");
{
  const inv = repo.getInventory("prod-cola", "node-bog");
  const fc = repo.getDemandForecast("prod-cola", "node-bog")!;
  const openPOs = repo.getOpenPurchaseOrders("prod-cola", "node-bog") as any[];
  const incoming = openPOs.reduce((s, po) => s + po.quantity, 0);
  const budget = repo.getBudget("node-bog", "beverages", period)!;
  const storage = repo.getStorageCapacity("node-bog", "beverages")!;
  const check = checkPurchaseConstraints({
    productId: "prod-cola",
    nodeId: "node-bog",
    supplierId: "sup-andina",
    quantity: 800,
    unitPrice: 0.85,
    period,
  });

  console.log(`  on_hand=${inv.on_hand_qty} incoming=${incoming} forecast=${fc.forecast_units} projected=${fc.projected_total_for_period}`);
  console.log(`  budget remaining=$${budget.remaining_amount} storage remaining=${storage.remaining_units}`);
  console.log(`  check(qty=800): ok=${check.ok} issues=${JSON.stringify(check.issues)}`);

  assert(inv.on_hand_qty + incoming < fc.forecast_units, "on-hand + incoming is short of forecast (a purchase is genuinely warranted)");
  assert(!check.ok, "the recommended 800 units should FAIL validation (over budget and/or storage)");
  assert(storage.remaining_units < 800, "storage capacity should be the binding constraint below 800 units");

  const modQty = Math.floor(storage.remaining_units);
  const modCheck = checkPurchaseConstraints({ productId: "prod-cola", nodeId: "node-bog", supplierId: "sup-andina", quantity: modQty, unitPrice: 0.85, period });
  assert(modCheck.ok, `a modified quantity of ${modQty} (storage-bound) should pass validation`);
}

section("Scenario 2 — Chips supplier shortfall @ Mexico City DC");
{
  const terms = repo.getSupplierTerms("prod-chips") as any[];
  const alt = terms.find((t) => t.supplier_id !== "sup-snackco");
  assert(!!alt, "an alternate supplier for chips should exist");
  const check = checkPurchaseConstraints({
    productId: "prod-chips",
    nodeId: "node-mex",
    supplierId: alt.supplier_id,
    quantity: 250,
    unitPrice: alt.unit_price,
    period,
  });
  console.log(`  alternate supplier=${alt.supplier_name} price=${alt.unit_price} minOrder=${alt.min_order_qty}`);
  console.log(`  check(alt, qty=250): ok=${check.ok} issues=${JSON.stringify(check.issues)}`);
  assert(check.ok, "sourcing the 250-unit shortfall from the alternate supplier should pass validation");
}

section("Scenario 3 — Energy drink demand spike @ Bogota DC");
{
  const fc = repo.getDemandForecast("prod-energy", "node-bog")!;
  const inv = repo.getInventory("prod-energy", "node-bog");
  const openPOs = repo.getOpenPurchaseOrders("prod-energy", "node-bog") as any[];
  const incoming = openPOs.reduce((s, po) => s + po.quantity, 0);
  console.log(`  forecast=${fc.forecast_units} run_rate/day=${fc.run_rate_per_day} projected=${fc.projected_total_for_period} variance=${fc.variance_vs_forecast_pct}%`);
  console.log(`  on_hand=${inv.on_hand_qty} incoming=${incoming}`);
  assert(fc.variance_vs_forecast_pct > 30, "projected run-rate should be well above the original forecast (a real spike)");
  assert(inv.on_hand_qty + incoming < fc.projected_total_for_period, "on-hand + incoming should be insufficient for the revised (spiked) outlook");
}

section("Scenario 4 — Shampoo purchasing constraint @ Mexico City DC");
{
  const terms = (repo.getSupplierTerms("prod-shampoo") as any[])[0];
  const budget = repo.getBudget("node-mex", "personal_care", period)!;
  const maxAffordable = Math.floor(budget.remaining_amount / terms.unit_price);
  console.log(`  supplier=${terms.supplier_name} minOrder=${terms.min_order_qty} price=${terms.unit_price}`);
  console.log(`  budget remaining=$${budget.remaining_amount} => max affordable ~${maxAffordable} units`);
  assert(maxAffordable < terms.min_order_qty, "max affordable quantity should be BELOW the supplier's minimum order — a genuine conflict");

  const check = checkPurchaseConstraints({
    productId: "prod-shampoo",
    nodeId: "node-mex",
    supplierId: terms.supplier_id,
    quantity: terms.min_order_qty,
    unitPrice: terms.unit_price,
    period,
  });
  assert(!check.ok, "ordering exactly the supplier minimum should fail budget validation — the agent must not blindly place this order");
}

console.log("\nDone.");
