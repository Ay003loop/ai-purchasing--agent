import * as repo from "../db/repository";
import { checkPurchaseConstraints, AUTO_APPROVE_MAX_COST } from "./validate";
import { approvePurchaseOrderAction } from "./approvalService";

export interface ToolContext {
  runId: string;
  period: string; // e.g. "2026-09"
}

// ---------------------------------------------------------------------------
// Tool schemas — passed to the Anthropic Messages API `tools` parameter.
// Investigation tools are read-only. Action tools mutate the mock database
// and are intentionally limited to what a buyer's agent should be allowed to
// do: create/modify/cancel a PO, or escalate to a human. Nothing lets the
// model touch inventory, budgets or storage ledgers directly - those only
// change as a *consequence* of an approved purchase order.
// ---------------------------------------------------------------------------
export const TOOLS = [
  {
    name: "get_product_info",
    description:
      "Look up a product's catalog info: category, unit cost, and how much storage space one unit occupies.",
    input_schema: {
      type: "object",
      properties: { productId: { type: "string", description: "Product id or SKU" } },
      required: ["productId"],
    },
  },
  {
    name: "get_inventory",
    description: "Get current on-hand inventory quantity for a product at a fulfillment node.",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        nodeId: { type: "string" },
      },
      required: ["productId", "nodeId"],
    },
  },
  {
    name: "get_demand_forecast",
    description:
      "Get the latest demand forecast for a product at a node, including actual sales so far this period, the implied daily run-rate, and a run-rate-projected total for the full period (useful for detecting demand spikes vs. the original forecast).",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        nodeId: { type: "string" },
      },
      required: ["productId", "nodeId"],
    },
  },
  {
    name: "get_open_purchase_orders",
    description: "List open (not yet fulfilled/cancelled) purchase orders for a product at a node.",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        nodeId: { type: "string" },
      },
      required: ["productId", "nodeId"],
    },
  },
  {
    name: "get_purchase_order",
    description: "Fetch a single purchase order by id.",
    input_schema: {
      type: "object",
      properties: { poId: { type: "string" } },
      required: ["poId"],
    },
  },
  {
    name: "get_supplier_terms",
    description:
      "List all suppliers who can provide a product, with unit price, minimum order quantity, lead time, and reliability score. Sorted with the preferred supplier first.",
    input_schema: {
      type: "object",
      properties: { productId: { type: "string" } },
      required: ["productId"],
    },
  },
  {
    name: "get_budget",
    description: "Get remaining purchasing budget for a category at a node for the given period (YYYY-MM).",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        category: { type: "string" },
        period: { type: "string", description: "e.g. 2026-09. Defaults to the current period if omitted." },
      },
      required: ["nodeId", "category"],
    },
  },
  {
    name: "get_storage_capacity",
    description: "Get remaining storage capacity (in storage units) for a category at a node.",
    input_schema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        category: { type: "string" },
      },
      required: ["nodeId", "category"],
    },
  },
  {
    name: "check_purchase_constraints",
    description:
      "Dry-run a proposed purchase (product, node, supplier, quantity, unit price) against supplier minimum order quantity, remaining budget, and remaining storage capacity WITHOUT creating anything. Always call this before create_purchase_order or modify_purchase_order to confirm the numbers work; call it again after changing the quantity/supplier to re-check.",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        nodeId: { type: "string" },
        supplierId: { type: "string" },
        quantity: { type: "number" },
        unitPrice: { type: "number" },
      },
      required: ["productId", "nodeId", "supplierId", "quantity", "unitPrice"],
    },
  },
  {
    name: "create_purchase_order",
    description:
      "Create a new purchase order. The order is automatically validated against supplier terms, budget, and storage after creation - the tool result tells you whether it passed. Orders under the auto-approval cost threshold that pass validation are approved immediately; larger or invalid ones are queued for human approval and you should factor that into your final decision.",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        nodeId: { type: "string" },
        supplierId: { type: "string" },
        quantity: { type: "number" },
        unitPrice: { type: "number" },
        leadTimeDays: { type: "number" },
        notes: { type: "string" },
      },
      required: ["productId", "nodeId", "supplierId", "quantity", "unitPrice", "leadTimeDays"],
    },
  },
  {
    name: "modify_purchase_order",
    description:
      "Modify an existing purchase order's quantity and/or supplier. Re-validated automatically after the change, same as create_purchase_order.",
    input_schema: {
      type: "object",
      properties: {
        poId: { type: "string" },
        newQuantity: { type: "number" },
        newSupplierId: { type: "string" },
        newUnitPrice: { type: "number" },
        notes: { type: "string" },
      },
      required: ["poId", "newQuantity"],
    },
  },
  {
    name: "cancel_purchase_order",
    description: "Cancel an existing purchase order (e.g. no longer needed, or unrecoverable supplier failure).",
    input_schema: {
      type: "object",
      properties: {
        poId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["poId", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Raise the situation to a human buyer instead of (or in addition to) taking an automated action. Use this when constraints genuinely conflict, information is missing/ambiguous, or the risk of an automated action is too high to take without sign-off.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        context: { type: "string", description: "Concise summary of the situation for the human reviewer." },
      },
      required: ["reason", "context"],
    },
  },
  {
    name: "final_decision",
    description:
      "Call this exactly once, as your LAST tool call, to record your final decision and end your turn. Do not call any other tool after this one.",
    input_schema: {
      type: "object",
      properties: {
        decision: {
          type: "string",
          enum: ["accepted", "modified", "rejected", "investigate", "escalated"],
          description:
            "accepted = recommendation executed as-is; modified = executed with different quantity/supplier/etc; rejected = no purchase made; investigate = more information/human input is needed before any action; escalated = handed to a human buyer.",
        },
        summary: { type: "string", description: "1-3 sentence plain-language summary of the decision." },
        keyFactors: {
          type: "array",
          description: "The important factors that drove the decision, most important first.",
          items: {
            type: "object",
            properties: {
              factor: { type: "string" },
              detail: { type: "string" },
            },
            required: ["factor", "detail"],
          },
        },
        actionsTaken: {
          type: "array",
          description: "Short descriptions of any tool actions actually taken (POs created/modified/cancelled, escalations raised).",
          items: { type: "string" },
        },
        confidence: { type: "number", description: "0 to 1" },
      },
      required: ["decision", "summary", "keyFactors", "confidence"],
    },
  },
];

export interface ToolExecutionRecord {
  poId?: string;
  autoApproved?: boolean;
  requiresApproval?: boolean;
  approvalId?: string;
}

/** Executes a single tool call and returns a JSON-serialisable result to send back to the model. */
export function executeTool(name: string, input: any, ctx: ToolContext): any {
  switch (name) {
    case "get_product_info": {
      const p = repo.getProductBySkuOrId(input.productId);
      if (!p) return { error: `Unknown product ${input.productId}` };
      return p;
    }
    case "get_inventory":
      return repo.getInventory(input.productId, input.nodeId);

    case "get_demand_forecast": {
      const f = repo.getDemandForecast(input.productId, input.nodeId);
      return f ?? { error: "No forecast on file for this product/node." };
    }

    case "get_open_purchase_orders":
      return { openPurchaseOrders: repo.getOpenPurchaseOrders(input.productId, input.nodeId) };

    case "get_purchase_order": {
      const po = repo.getPurchaseOrder(input.poId);
      return po ?? { error: `No purchase order ${input.poId}` };
    }

    case "get_supplier_terms":
      return { suppliers: repo.getSupplierTerms(input.productId) };

    case "get_budget": {
      const b = repo.getBudget(input.nodeId, input.category, input.period ?? ctx.period);
      return b ?? { error: "No budget record found." };
    }

    case "get_storage_capacity": {
      const s = repo.getStorageCapacity(input.nodeId, input.category);
      return s ?? { error: "No storage capacity record found." };
    }

    case "check_purchase_constraints":
      return checkPurchaseConstraints({ ...input, period: ctx.period });

    case "create_purchase_order": {
      const check = checkPurchaseConstraints({ ...input, period: ctx.period });
      const po = repo.createPurchaseOrder({
        productId: input.productId,
        nodeId: input.nodeId,
        supplierId: input.supplierId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        leadTimeDays: input.leadTimeDays,
        notes: input.notes,
        status: "pending_approval",
      });
      return finalizeAction(po.id, "create_purchase_order", check, ctx);
    }

    case "modify_purchase_order": {
      const existing = repo.getPurchaseOrder(input.poId);
      if (!existing) return { error: `No purchase order ${input.poId}` };
      const check = checkPurchaseConstraints({
        productId: existing.product_id,
        nodeId: existing.node_id,
        supplierId: input.newSupplierId ?? existing.supplier_id,
        quantity: input.newQuantity,
        unitPrice: input.newUnitPrice ?? existing.unit_price,
        period: ctx.period,
      });
      repo.setPurchaseOrderStatus(input.poId, "pending_approval");
      const po = repo.modifyPurchaseOrder(
        input.poId,
        input.newQuantity,
        input.notes,
        input.newSupplierId,
        input.newUnitPrice
      );
      return finalizeAction(po.id, "modify_purchase_order", check, ctx);
    }

    case "cancel_purchase_order": {
      const po = repo.cancelPurchaseOrder(input.poId, input.reason);
      return { purchaseOrder: po, status: "cancelled" };
    }

    case "escalate_to_human": {
      const approvalId = repo.createApproval(ctx.runId, "escalation", { reason: input.reason }, input.context);
      return { escalated: true, approvalId };
    }

    case "final_decision":
      // Handled by the orchestrator loop, not executed here.
      return { recorded: true };

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Shared post-write logic for create/modify PO: run the deterministic
 * validator, then either auto-approve (small, valid orders) or route to the
 * human approval queue (large or invalid ones). Returns everything the model
 * needs to see to know what actually happened.
 */
function finalizeAction(poId: string, actionType: string, check: ReturnType<typeof checkPurchaseConstraints>, ctx: ToolContext) {
  if (check.ok && check.totalCost <= AUTO_APPROVE_MAX_COST) {
    const po = approvePurchaseOrderAction(poId, ctx.period);
    return {
      purchaseOrder: po,
      validation: check,
      approvalOutcome: "auto_approved",
      note: `Validated and auto-approved (cost $${check.totalCost} is within the $${AUTO_APPROVE_MAX_COST} auto-approval threshold).`,
    };
  }

  const reason = check.ok
    ? `Cost $${check.totalCost} exceeds the $${AUTO_APPROVE_MAX_COST} auto-approval threshold; human sign-off required.`
    : `Validation found issues: ${check.issues.join(" ")}`;
  const approvalId = repo.createApproval(ctx.runId, actionType, { poId }, reason);
  return {
    purchaseOrder: repo.getPurchaseOrder(poId),
    validation: check,
    approvalOutcome: check.ok ? "pending_human_approval" : "pending_human_approval_validation_failed",
    approvalId,
    note: reason,
  };
}
