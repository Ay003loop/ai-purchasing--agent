import type { WorldSnapshot } from "../types";

function name(list: any[], id: string, field = "name") {
  return list.find((x) => x.id === id)?.[field] ?? id;
}

export default function WorldDataBrowser({ world }: { world: WorldSnapshot }) {
  return (
    <div>
      <div className="section-title">purchase orders</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>id</th>
            <th>product</th>
            <th>node</th>
            <th>supplier</th>
            <th>qty</th>
            <th>unit price</th>
            <th>status</th>
            <th>delivery</th>
          </tr>
        </thead>
        <tbody>
          {world.purchaseOrders.map((po) => (
            <tr key={po.id}>
              <td className="mono">{po.id}</td>
              <td>{name(world.products, po.product_id)}</td>
              <td>{name(world.nodes, po.node_id)}</td>
              <td>{name(world.suppliers, po.supplier_id)}</td>
              <td>
                {po.quantity}
                {po.quantity !== po.original_quantity ? ` (was ${po.original_quantity})` : ""}
              </td>
              <td>${po.unit_price}</td>
              <td>
                <span className={`status-tag ${po.status}`}>{po.status}</span>
              </td>
              <td className="mono">{po.expected_delivery_date}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">inventory</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>product</th>
            <th>node</th>
            <th>on hand</th>
          </tr>
        </thead>
        <tbody>
          {world.inventory.map((inv) => (
            <tr key={inv.id}>
              <td>{name(world.products, inv.product_id)}</td>
              <td>{name(world.nodes, inv.node_id)}</td>
              <td>{inv.on_hand_qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">budgets</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>node</th>
            <th>category</th>
            <th>period</th>
            <th>budget</th>
            <th>spent</th>
            <th>remaining</th>
          </tr>
        </thead>
        <tbody>
          {world.budgets.map((b) => (
            <tr key={b.id}>
              <td>{name(world.nodes, b.node_id)}</td>
              <td>{b.category}</td>
              <td className="mono">{b.period}</td>
              <td>${b.budget_amount}</td>
              <td>${b.spent_amount.toFixed(2)}</td>
              <td>${(b.budget_amount - b.spent_amount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">storage capacity</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>node</th>
            <th>category</th>
            <th>capacity</th>
            <th>used</th>
            <th>remaining</th>
          </tr>
        </thead>
        <tbody>
          {world.storage.map((s) => (
            <tr key={s.id}>
              <td>{name(world.nodes, s.node_id)}</td>
              <td>{s.category}</td>
              <td>{s.capacity_units}</td>
              <td>{s.used_units}</td>
              <td>{(s.capacity_units - s.used_units).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
