export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_cost REAL NOT NULL,
  storage_units_per_unit REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  reliability_score REAL NOT NULL DEFAULT 0.9,
  default_lead_time_days INTEGER NOT NULL DEFAULT 7
);

CREATE TABLE IF NOT EXISTS supplier_products (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  unit_price REAL NOT NULL,
  min_order_qty INTEGER NOT NULL DEFAULT 1,
  lead_time_days INTEGER NOT NULL,
  is_preferred INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  node_id TEXT NOT NULL REFERENCES nodes(id),
  on_hand_qty INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(product_id, node_id)
);

CREATE TABLE IF NOT EXISTS demand_forecast (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  node_id TEXT NOT NULL REFERENCES nodes(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  forecast_units INTEGER NOT NULL,
  actual_units_to_date INTEGER NOT NULL DEFAULT 0,
  days_elapsed_in_period INTEGER NOT NULL DEFAULT 0,
  total_days_in_period INTEGER NOT NULL DEFAULT 30,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  node_id TEXT NOT NULL REFERENCES nodes(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  quantity INTEGER NOT NULL,
  original_quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  status TEXT NOT NULL, -- draft, pending_approval, approved, sent, partially_fulfilled, fulfilled, cancelled, rejected
  expected_delivery_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id),
  category TEXT NOT NULL,
  period TEXT NOT NULL, -- e.g. 2026-09
  budget_amount REAL NOT NULL,
  spent_amount REAL NOT NULL DEFAULT 0,
  UNIQUE(node_id, category, period)
);

CREATE TABLE IF NOT EXISTS storage_capacity (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id),
  category TEXT NOT NULL,
  capacity_units REAL NOT NULL,
  used_units REAL NOT NULL DEFAULT 0,
  UNIQUE(node_id, category)
);

-- Audit trail of every agent invocation, for explainability + evaluation
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  scenario_type TEXT NOT NULL,
  situation_payload TEXT NOT NULL, -- JSON
  status TEXT NOT NULL, -- running, completed, failed, awaiting_approval
  decision TEXT, -- accepted / modified / rejected / investigate / escalate / ...
  final_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id),
  step_index INTEGER NOT NULL,
  type TEXT NOT NULL, -- reasoning, tool_call, tool_result, decision, action, validation, retry
  payload TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id),
  action_type TEXT NOT NULL,
  action_payload TEXT NOT NULL, -- JSON
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at TEXT NOT NULL,
  decided_at TEXT
);
`;
