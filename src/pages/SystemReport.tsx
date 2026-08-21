import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { useApi } from "../useApi";

export default function SystemReport() {
  const { data, reload } = useApi<{
    tables: { name: string; rows: number }[];
    users: number; clients: number; materials: number; sales: number; bookings: number; payments: number; accounts: number;
    report: { sync_issues: { type: string; desc: string }[]; stock_issues: { material: string; db_stock: number; calc_stock: number; diff: number }[]; unpaid_count: number; zero_amount_bills: number };
  }>("/system-report");
  const r = data?.report;
  return (
    <div>
      <PageHeader icon="bi-clipboard2-pulse" title="System Report" subtitle="Data integrity and consistency diagnostics.">
        <button className="btn btn-outline-warning btn-sm fw-bold" onClick={async () => { await api("/settings/reconciliation/fix", { method: "POST" }); reload(); }}><i className="bi bi-wrench me-1" /> Auto-Fix Issues</button>
        <Link to="/settings" className="btn btn-outline-light btn-sm fw-bold"><i className="bi bi-arrow-left me-1" /> Back</Link>
      </PageHeader>
      <div className="row g-3 mb-3">
        <div className="col-md-3"><div className="ui-card text-center py-3"><div className={`fs-2 fw-bold ${r?.sync_issues?.length ? "text-danger" : "text-success"}`}>{r?.sync_issues?.length || 0}</div><div className="small text-muted">Sync Issues</div></div></div>
        <div className="col-md-3"><div className="ui-card text-center py-3"><div className={`fs-2 fw-bold ${r?.stock_issues?.length ? "text-danger" : "text-success"}`}>{r?.stock_issues?.length || 0}</div><div className="small text-muted">Stock Discrepancies</div></div></div>
        <div className="col-md-3"><div className="ui-card text-center py-3"><div className="fs-2 fw-bold text-warning">{r?.unpaid_count || 0}</div><div className="small text-muted">Unpaid Bills</div></div></div>
        <div className="col-md-3"><div className="ui-card text-center py-3"><div className={`fs-2 fw-bold ${r?.zero_amount_bills ? "text-danger" : "text-success"}`}>{r?.zero_amount_bills || 0}</div><div className="small text-muted">Zero-Amount Bills</div></div></div>
      </div>
      {r?.sync_issues?.length ? (
        <Card title={`Sync Issues (${r.sync_issues.length})`} flush>
          <table className="ui-table mb-0"><thead><tr><th>Type</th><th>Description</th></tr></thead>
            <tbody>{r.sync_issues.map((i, n) => <tr key={n}><td><span className="badge bg-danger">{i.type}</span></td><td>{i.desc}</td></tr>)}</tbody>
          </table>
        </Card>
      ) : <div className="alert alert-success">No sync issues found. Bills and dispatch entries are consistent.</div>}
      {r?.stock_issues?.length ? (
        <Card title={`Stock Discrepancies (${r.stock_issues.length})`} flush>
          <table className="ui-table mb-0"><thead><tr><th>Material</th><th>DB Stock</th><th>Calculated</th><th>Diff</th></tr></thead>
            <tbody>{r.stock_issues.map((i) => <tr key={i.material}><td className="fw-bold">{i.material}</td><td>{i.db_stock}</td><td>{i.calc_stock}</td><td className={i.diff ? "text-danger" : "text-success"}>{i.diff}</td></tr>)}</tbody>
          </table>
        </Card>
      ) : <div className="alert alert-success">No stock discrepancies found. All material balances match.</div>}
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile"><div className="ui-tile-label">Users</div><div className="ui-tile-value">{data?.users || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Clients</div><div className="ui-tile-value">{data?.clients || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Materials</div><div className="ui-tile-value">{data?.materials || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Sales</div><div className="ui-tile-value">{data?.sales || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Bookings</div><div className="ui-tile-value">{data?.bookings || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Payments</div><div className="ui-tile-value">{data?.payments || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Accounts</div><div className="ui-tile-value">{data?.accounts || 0}</div></div>
      </div>
      <Card title="Tables" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Table</th><th className="text-end">Rows</th></tr></thead>
          <tbody>
            {(data?.tables || []).map((t) => (
              <tr key={t.name}><td>{t.name}</td><td className="text-end">{t.rows}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
