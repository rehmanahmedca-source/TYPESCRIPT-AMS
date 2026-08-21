import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../components/ui";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

type StockRow = {
  name: string;
  category: string;
  inn: number;
  out: number;
  stock: number;
  unit: string;
  rate: number;
};

type Dash = {
  totalStock: number;
  totalInventoryValue: number;
  clientCount: number;
  totalOutstanding: number;
  dailyCash: number;
  dailyCredit: number;
  companyMoney: number;
  stock: StockRow[];
};

type KpiProps = {
  to: string;
  tone: string;
  label: string;
  value: string;
  description: string;
  action: string;
  icon: string;
};

function Kpi({ to, tone, label, value, description, action, icon }: KpiProps) {
  return (
    <Link to={to} className={`dash-kpi ${tone}`}>
      <div className="dash-kpi-label">{label}</div>
      <div className="dash-kpi-value">{value}</div>
      <div className="dash-kpi-description">{description}</div>
      <span className="dash-kpi-action"><i className="bi bi-arrow-right-circle" /> {action}</span>
      <i className={`bi ${icon} dash-kpi-icon`} />
    </Link>
  );
}

const quickActions = [
  ["/stock", "bi-graph-up", "Stock Summary"],
  ["/daily", "bi-list-check", "Daily Breakdown"],
  ["/sales", "bi-cart-plus", "New Sale"],
  ["/bookings", "bi-bookmark-plus", "New Booking"],
  ["/payments", "bi-wallet2", "Payments"],
  ["/cash-flow-differences", "bi-clipboard-data", "Cash Flow Differences"],
  ["/clients", "bi-journal-text", "Client Ledger"]
] as const;

export default function Dashboard() {
  const { data } = useApi<Dash>("/dashboard");
  const due = useApi<{ id: number; remind_at: string; note: string; client: string; bill_no: string }[]>("/notifications/due");
  const [hideDue, setHideDue] = useState(false);
  const d = data || ({} as Dash);
  const stock = d.stock || [];
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date());
  const dueItems = due.data || [];

  return (
    <div className="system-dashboard">
      <Modal open={!hideDue && dueItems.length > 0} title="Deadline Reminder" onClose={() => setHideDue(true)} footer={<Link to="/notifications/upcoming" className="btn btn-warning" onClick={() => setHideDue(true)}>Open reminders</Link>}>
        <p className="mb-3">These follow-ups are due now.</p>
        <ul className="list-unstyled mb-0">
          {dueItems.map((item) => (
            <li key={item.id} className="mb-2 pb-2 border-bottom">
              <div className="fw-bold">{item.client || "Client"} {item.bill_no ? `· ${item.bill_no}` : ""}</div>
              <div className="small text-muted">{ymd(item.remind_at)} — {item.note || "Follow up"}</div>
            </li>
          ))}
        </ul>
      </Modal>
      <section className="dash-heading">
        <div>
          <h1><i className="bi bi-speedometer2" /> System Dashboard</h1>
          <p>{date}</p>
        </div>
        <div className="dash-heading-actions">
          <Link to="/stock" className="btn btn-warning btn-sm"><i className="bi bi-graph-up" /> Stock Summary</Link>
          <Link to="/clients" className="btn btn-light btn-sm"><i className="bi bi-people" /> Clients</Link>
        </div>
      </section>

      <section className="dash-kpi-grid">
        <Kpi to="/stock" tone="orange" label="Total Inventory" value={num(d.totalStock)} description="Current stock units" action="Open stock summary" icon="bi-box-seam" />
        <Kpi to="/clients" tone="indigo" label="Registered Clients" value={num(d.clientCount)} description="Active customer base" action="Open clients" icon="bi-people" />
        <Kpi to="/financial-details" tone="green" label="Daily Cash Received" value={money(d.dailyCash)} description="Today, August data" action="See cash breakdown" icon="bi-cash-stack" />
        <Kpi to="/financial-details" tone="pink" label="Daily Due Amount" value={money(d.dailyCredit)} description="Credit posted today" action="See credit breakdown" icon="bi-receipt" />
        <Kpi to="/current_payables" tone="red" label="Total Outstanding" value={money(d.totalOutstanding)} description="Across all open bills" action="Review unpaid bills" icon="bi-exclamation-circle" />
        <Kpi to="/accounts" tone="violet" label="Accounts Hub" value="Open" description="Cash • bank • transfers" action="Go to accounts" icon="bi-calculator" />
        <Kpi to="/cash-flow" tone="blue" label="Cash Flow" value="View" description="Receipts & payments report" action="Open cash flow" icon="bi-water" />
        <Kpi to="/cash-flow-differences" tone="amber" label="Cash Flow Differences" value="Audit" description="Physical cash reconciliation history" action="Review differences" icon="bi-shield-check" />
      </section>

      <section className="dash-panel dash-quick-panel">
        <div className="dash-panel-title"><i className="bi bi-lightning-charge-fill" /> Quick Actions</div>
        <div className="dash-quick-grid">
          {quickActions.map(([to, icon, label]) => (
            <Link to={to} className="dash-quick-action" key={label}>
              <i className={`bi ${icon}`} /> <span>{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dash-panel dash-stock-panel">
        <div className="dash-stock-header">
          <div className="dash-panel-title"><i className="bi bi-box-seam" /> Current Stock by Brand</div>
          <Link to="/materials" className="btn btn-outline-secondary btn-sm"><i className="bi bi-pencil-square" /> Manage Brands</Link>
        </div>
        <div className="table-responsive">
          <table className="dash-stock-table">
            <thead>
              <tr>
                <th>Brand Name</th>
                <th className="text-end">In (Total)</th>
                <th className="text-end">Out (Total)</th>
                <th className="text-end">Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td className="text-end stock-in">+{num(s.inn)}</td>
                  <td className="text-end stock-out">−{num(s.out)}</td>
                  <td className="text-end stock-current">{num(s.stock)} <small>{s.unit}</small></td>
                </tr>
              ))}
              {!stock.length && <tr><td colSpan={4} className="text-center text-muted py-4">No stock records available</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
