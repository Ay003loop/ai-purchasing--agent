import * as repo from "../db/repository";

export interface ConstraintCheckResult {
  ok: boolean;
  quantity: number;
  totalCost: number;
  storageUnitsNeeded: number;
  issues: string[];
  details: {
    minOrderQty: number | null;
    budgetRemainingBefore: number | null;
    budgetRemainingAfter: number | null;
    storageRemainingBefore: number | null;
    storageRemainingAfter: number | null;
  };
}

/**
 * Deterministic, code-based (non-LLM) check of a proposed purchase against
 * supplier terms, budget, and storage capacity. This is the core of the
 * "feedback loop": the agent proposes an action, this function tells it
 * (truthfully, from the database) whether that action is actually viable,
 * and the agent must react to the result rather than assume success.
 */
export function checkPurchaseConstraints(params: {
  productId: string;
  nodeId: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  period: string;
  excludePoId?: string; // when re-checking a modified PO, don't double count its own prior reservation
}): ConstraintCheckResult {
  const product = repo.getProductBySkuOrId(params.productId);
  const issues: string[] = [];

  if (!product) {
    return {
      ok: false,
      quantity: params.quantity,
      totalCost: 0,
      storageUnitsNeeded: 0,
      issues: [`Unknown product: ${params.productId}`],
      details: { minOrderQty: null, budgetRemainingBefore: null, budgetRemainingAfter: null, storageRemainingBefore: null, storageRemainingAfter: null },
    };
  }

  const supplierTerms = repo
    .getSupplierTerms(product.id)
    .find((s: any) => s.supplier_id === params.supplierId) as any;

  const minOrderQty = supplierTerms?.min_order_qty ?? null;
  if (minOrderQty !== null && params.quantity < minOrderQty) {
    issues.push(
      `Quantity ${params.quantity} is below the supplier's minimum order quantity of ${minOrderQty}.`
    );
  }
  if (params.quantity <= 0) {
    issues.push(`Quantity must be greater than zero.`);
  }

  const totalCost = Number((params.quantity * params.unitPrice).toFixed(2));
  const budget = repo.getBudget(params.nodeId, product.category, params.period);
  let budgetRemainingBefore: number | null = null;
  let budgetRemainingAfter: number | null = null;
  if (budget) {
    budgetRemainingBefore = budget.remaining_amount;
    budgetRemainingAfter = Number((budget.remaining_amount - totalCost).toFixed(2));
    if (budgetRemainingAfter < 0) {
      issues.push(
        `Estimated cost $${totalCost} exceeds remaining budget of $${budget.remaining_amount} for ${product.category} at this node/period.`
      );
    }
  } else {
    issues.push(`No budget record found for node=${params.nodeId} category=${product.category} period=${params.period}.`);
  }

  const storageUnitsNeeded = Number((params.quantity * product.storage_units_per_unit).toFixed(2));
  const storage = repo.getStorageCapacity(params.nodeId, product.category);
  let storageRemainingBefore: number | null = null;
  let storageRemainingAfter: number | null = null;
  if (storage) {
    storageRemainingBefore = storage.remaining_units;
    storageRemainingAfter = Number((storage.remaining_units - storageUnitsNeeded).toFixed(2));
    if (storageRemainingAfter < 0) {
      issues.push(
        `Requires ${storageUnitsNeeded} storage units but only ${storage.remaining_units} are available for ${product.category} at this node.`
      );
    }
  } else {
    issues.push(`No storage capacity record found for node=${params.nodeId} category=${product.category}.`);
  }

  return {
    ok: issues.length === 0,
    quantity: params.quantity,
    totalCost,
    storageUnitsNeeded,
    issues,
    details: {
      minOrderQty,
      budgetRemainingBefore,
      budgetRemainingAfter,
      storageRemainingBefore,
      storageRemainingAfter,
    },
  };
}

/** Maximum PO value ($) that can be auto-approved without a human in the loop. */
export const AUTO_APPROVE_MAX_COST = 300;

/** Maximum number of propose -> validate -> correct cycles before we force an escalation. */
export const MAX_CORRECTION_ATTEMPTS = 2;
