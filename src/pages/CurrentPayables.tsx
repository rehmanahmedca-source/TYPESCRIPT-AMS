import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money2, ymd } from "../format";
import { useApi } from "../useApi";

type Row = {
  client_id: number;
  client_name: string;
  client_code: string;
  outstanding: number;
  last_transaction_date?: string;
  last_payment_date?: string;
  status: string;
};

export default function CurrentPayables() {
  const [client, setClient] = useState("");
  const [status, setStatus] = useState("outstanding");
  const { data } = useApi<{ rows: Row[]; total_outstanding: number; total_records: number }>(
    `/current-payables?client=${encodeURIComponent(client)}&status=${status}`
  );

  return (
    <div>
      <PageHeader icon="bi-wallet2" title="Current Payables" subtitle="One consolidated record per client. Underlying bills and payments remain available in the ledger.">
        <span className="badge bg-warning text-dark">{data?.total_records || 0} clients</span>
        <Link to="/pending_bills" className="btn btn-outline-light btn-sm">Pending bills</Link>
      </PageHeader>
      <div className="card payables-hero mb-4">
        <div className="card-body p-4">
          <div className="text-uppercase small fw-bold" style={{ color: "var(--text-muted)" }}>Total Outstanding Payables</div>
          <div className="payables-total text-warning fw-bold">{money2(data?.total_outstanding)}</div>
          <div className="small mt-1" style={{ color: "var(--text-muted)" }}>Calculated from the shared client ledger projection, including partial payments, returns, credits and adjustments.</div>
        </div>
      </div>
      <Card title="Payable filters">
        <div className="row g-3">
          <div className="col-md-4"><label className="ui-label">Client</label><input className="form-control" placeholder="Search name or code…" value={client} onChange={(e) => setClient(e.target.value)} /></div>
          <div className="col-md-3">
            <label className="ui-label">Status</label>
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="outstanding">Outstanding only</option>
              <option value="all">All balances</option>
              <option value="settled">Settled only</option>
              <option value="credit">Credit balances</option>
            </select>
          </div>
        </div>
      </Card>
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Client</th><th>Account / Code</th><th className="text-end">Outstanding</th><th>Last transaction</th><th>Last payment</th><th className="text-center">Status</th><th className="text-end">Actions</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.client_id}>
                <td><Link to={`/clients/${r.client_id}`} className="fw-bold text-warning text-decoration-none">{r.client_name}</Link></td>
                <td><span className="badge bg-dark border">{r.client_code || "—"}</span></td>
                <td className={`text-end fw-bold ${r.outstanding > 0 ? "text-warning" : "text-success"}`}>{money2(r.outstanding)}</td>
                <td>{ymd(r.last_transaction_date)}</td>
                <td>{ymd(r.last_payment_date)}</td>
                <td className="text-center"><span className="badge bg-danger-subtle text-danger">{r.status}</span></td>
                <td className="text-end">
                  <Link to={`/clients/${r.client_id}`} className="btn btn-sm btn-outline-info me-1"><i className="bi bi-journal-text" /></Link>
                  {r.outstanding > 0 && <Link to="/accounts/payments/clients" className="btn btn-sm btn-outline-success"><i className="bi bi-cash-stack" /></Link>}
                </td>
              </tr>
            ))}
            {!(data?.rows || []).length && <tr><td colSpan={7} className="text-center py-5 text-muted">No clients match the current payable filters.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
