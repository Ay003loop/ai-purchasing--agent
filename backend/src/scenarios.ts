import { Situation } from "./agent/prompts";
import db from "./db/client";

/** Finds the seeded scenario-2 PO (chips at node-mex) by product/node instead
 * of a hardcoded id, since seed.ts generates a random suffix each run. */
function findOpenPO(productId: string, nodeId: string): string {
  const row = db
    .prepare(
      `SELECT id FROM purchase_orders WHERE product_id = ? AND node_id = ? AND status NOT IN ('cancelled','rejected') ORDER BY created_at DESC LIMIT 1`
    )
    .get(productId, nodeId) as any;
  return row?.id ?? "";
}

export function getScenario(key: string): Situation {
  switch (key) {
    case "scenario1_recommendation_review":
      return {
        scenarioType: "recommendation_review",
        title: "Purchasing system recommends buying 800 units of Cola 500ml",
        description:
          "The automated purchase-recommendation system suggests creating a purchase order for 800 units of Cola 500ml (SKU-COLA-500) at Bogota DC, from the preferred supplier. Decide whether to accept, modify, reject, or investigate further.",
        context: {
          productId: "prod-cola",
          nodeId: "node-bog",
          recommendedSupplierId: "sup-andina",
          recommendedQuantity: 800,
        },
      };

    case "scenario2_supplier_shortfall": {
      const poId = findOpenPO("prod-chips", "node-mex");
      return {
        scenarioType: "supplier_shortfall",
        title: "Supplier can only fulfil half of an open purchase order",
        description:
          `Purchase order ${poId} was created for 500 units of Potato Chips 150g (SKU-CHIPS-150) at Mexico City DC from Snack Foods Co. The supplier has just confirmed they can currently only supply 250 of the 500 units. Decide what should happen to cover the shortfall, if anything.`,
        context: {
          poId,
          productId: "prod-chips",
          nodeId: "node-mex",
          originalSupplierId: "sup-snackco",
          orderedQuantity: 500,
          confirmedAvailableQuantity: 250,
          shortfallQuantity: 250,
        },
      };
    }

    case "scenario3_demand_spike":
      return {
        scenarioType: "demand_spike",
        title: "Energy Drink demand is running well above forecast",
        description:
          "Energy Drink 250ml (SKU-ENERGY-250) at Bogota DC was forecast at roughly normal demand for this period. Early sales data suggests actual demand is running well above that forecast. There is an existing open purchase order sized for the original forecast. Investigate whether the purchasing plan needs to change.",
        context: {
          productId: "prod-energy",
          nodeId: "node-bog",
        },
      };

    case "scenario4_purchasing_constraint":
      return {
        scenarioType: "purchasing_constraint",
        title: "Recommended shampoo purchase conflicts with budget and supplier minimums",
        description:
          "Based on current inventory and demand, additional Shampoo 400ml (SKU-SHAMP-400) should be purchased at Mexico City DC. Determine the appropriate course of action, taking into account that constraints may prevent the naive recommendation from being executed as-is.",
        context: {
          productId: "prod-shampoo",
          nodeId: "node-mex",
        },
      };

    default:
      throw new Error(`Unknown scenario key: ${key}`);
  }
}

export const SCENARIO_LIST = [
  {
    key: "scenario1_recommendation_review",
    label: "Scenario 1 — Purchase Recommendation Review",
  },
  {
    key: "scenario2_supplier_shortfall",
    label: "Scenario 2 — Supplier Cannot Fulfil the Purchase",
  },
  {
    key: "scenario3_demand_spike",
    label: "Scenario 3 — Demand / Forecast Has Changed",
  },
  {
    key: "scenario4_purchasing_constraint",
    label: "Scenario 4 — Purchasing Constraint",
  },
];
