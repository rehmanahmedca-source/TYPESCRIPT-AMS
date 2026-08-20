import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money, num } from "../format";
import { useApi } from "../useApi";

type Dash = {
  totalStock: number;
  totalInventoryValue: number;
  totalInventoryRetailValue: number;
  clientCount: number;
  totalOutstanding: number;
  dailyCash: number;
  dailyCredit: number;
  recentSalesTotal: number;
  recentSalesPaid: number;
  recentSalesDue: number;
  recentSalesCount: number;
  avgOrderValue: number;
  pendingDispatchesCount: number;
  pendingBookingUnits: number;
  activeDriversOnTrip: number;
  totalDrivers: number;
  stock: { name: string; category: string; inn: number; out: number; stock: number; unit: string; rate: number }[];
  recentSales: { auto_bill_no?: string; manual_bill_no?: string; date_posted: string; client_name: string; amount: number; paid_amount: number; discount?: number }[];
};

export default function Dashboard() {
  const { data } = useApi<Dash>("/dashboard");
  const d = data || ({} as Dash);
  const stock = d.stock || [];
  const sales = d.recentSales || [];

  return (
    <div>
      <PageHeader icon="bi-speedometer2" title="System Dashboard" subtitle="Centralized executive control — no blocking overlays">
        <Link to="/stock" className="btn btn-warning btn-pill fw-bold">
          <i className="bi bi-graph-up me-1" /> Stock Summary
        </Link>
        <Link to="/sales" className="btn btn-outline-secondary btn-pill fw-bold">
          <i className="bi bi-cart-plus me-1" /> New Sale
        </Link>
      </PageHeader>

      <div className="ui-card mb-4">
        <div className="ui-card-header">
          <h5>Executive Summary</h5>
        </div>
        <div className="ui-card-body">
          <div className="row g-4">
            <div className="col-lg-4">
              <div className="p-3 rounded-3 h-100" style={{ background: "var(--ui-surface-3)", border: "1px solid var(--ui-border)" }}>
                <span className="text-uppercase text-muted small fw-semibold">Total Inventory Value</span>
                <div className="fs-2 fw-bold text-warning mt-1">{money(d.totalInventoryValue)}</div>
                <div className="small mt-2 d-flex justify-content-between">
                  <span className="text-muted">Units on hand</span>
                  <strong>{num(d.totalStock)}</strong>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="p-3 rounded-3 h-100" style={{ background: "var(--ui-surface-3)", border: "1px solid var(--ui-border)" }}>
                <span className="text-uppercase text-muted small fw-semibold">Open Bookings</span>
                <div className="fs-2 fw-bold text-info mt-1">{d.pendingDispatchesCount || 0} <span className="fs-5 text-muted">orders</span></div>
                <div className="small mt-2 d-flex justify-content-between">
                  <span className="text-muted">Drivers</span>
                  <strong>{d.totalDrivers || 0}</strong>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="p-3 rounded-3 h-100" style={{ background: "var(--ui-surface-3)", border: "1px solid var(--ui-border)" }}>
                <span className="text-uppercase text-muted small fw-semibold">Recent Sales</span>
                <div className="fs-2 fw-bold text-success mt-1">{money(d.recentSalesTotal)}</div>
                <div className="small mt-2 d-flex justify-content-between">
                  <span className="text-success">Paid {money(d.recentSalesPaid)}</span>
                  <span className="text-danger">Due {money(d.recentSalesDue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-kpi-grid mb-4">
        <Link to="/stock" className="text-decoration-none"><div className="ui-tile border-amber"><div className="ui-tile-label">Total Inventory</div><div className="ui-tile-value">{num(d.totalStock)}</div></div></Link>
        <Link to="/clients" className="text-decoration-none"><div className="ui-tile border-indigo"><div className="ui-tile-label">Registered Clients</div><div className="ui-tile-value">{num(d.clientCount)}</div></div></Link>
        <Link to="/financial-details" className="text-decoration-none"><div className="ui-tile border-green"><div className="ui-tile-label">Daily Cash</div><div className="ui-tile-value text-success">{money(d.dailyCash)}</div></div></Link>
        <Link to="/financial-details" className="text-decoration-none"><div className="ui-tile border-rose"><div className="ui-tile-label">Daily Due</div><div className="ui-tile-value text-danger">{money(d.dailyCredit)}</div></div></Link>
        <Link to="/clients" className="text-decoration-none"><div className="ui-tile border-red"><div className="ui-tile-label">Outstanding</div><div className="ui-tile-value text-danger">{money(d.totalOutstanding)}</div></div></Link>
        <Link to="/accounts" className="text-decoration-none"><div className="ui-tile border-violet"><div className="ui-tile-label">Accounts Hub</div><div className="ui-tile-value">Open</div></div></Link>
      </div>

      <Card title="Quick Actions" icon="bi-lightning-charge-fill">
        <div className="ui-quick-grid">
          <Link to="/sales" className="ui-quick"><i className="bi bi-cart-check" /> New Sale</Link>
          <Link to="/bookings" className="ui-quick"><i className="bi bi-bookmark-plus" /> New Booking</Link>
          <Link to="/grn" className="ui-quick"><i className="bi bi-box-arrow-in-down" /> Stock Intake</Link>
          <Link to="/clients" className="ui-quick"><i className="bi bi-people" /> Add Client</Link>
          <Link to="/accounts" className="ui-quick"><i className="bi bi-cash-stack" /> Record Expense</Link>
          <Link to="/import-export" className="ui-quick"><i className="bi bi-file-earmark-excel" /> XLSX Import</Link>
        </div>
      </Card>

      <Card title="Recent Sales" icon="bi-receipt" extra={<Link to="/sales" className="btn btn-sm btn-outline-warning">All invoices</Link>} flush>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead>
              <tr><th>Bill</th><th>Date</th><th>Customer</th><th className="text-end">Amount</th><th className="text-end">Paid</th><th className="text-end">Due</th></tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <tr key={i}>
                  <td className="text-warning fw-bold">{s.manual_bill_no || s.auto_bill_no}</td>
                  <td>{String(s.date_posted || "").slice(0, 10)}</td>
                  <td>{s.client_name}</td>
                  <td className="text-end">{money(s.amount)}</td>
                  <td className="text-end text-success">{money(s.paid_amount)}</td>
                  <td className="text-end text-danger">{money(Number(s.amount || 0) - Number(s.discount || 0) - Number(s.paid_amount || 0))}</td>
                </tr>
              ))}
              {!sales.length && <tr><td colSpan={6} className="ui-empty">No sales yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Current Stock by Brand" icon="bi-tags" extra={<Link to="/materials" className="btn btn-sm btn-outline-secondary">Manage brands</Link>} flush>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead>
              <tr><th>Brand</th><th>Category</th><th className="text-center">In</th><th className="text-center">Out</th><th className="text-end">Stock</th><th className="text-end">Rate</th></tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.name}>
                  <td className="fw-bold">{s.name}</td>
                  <td><span className="badge bg-secondary bg-opacity-25">{s.category}</span></td>
                  <td className="text-center text-success">+{num(s.inn)}</td>
                  <td className="text-center text-danger">−{num(s.out)}</td>
                  <td className="text-end text-warning fw-bold">{num(s.stock)} <small className="text-muted">{s.unit}</small></td>
                  <td className="text-end">{money(s.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
