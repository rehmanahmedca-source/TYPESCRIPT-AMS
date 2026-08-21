import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../useApi";
import { api } from "../api";
import { rs, ymd } from "../format";

type Rec = { id: number; reconciliation_date: string; expected_balance: number; actual_balance: number; difference: number; difference_type: string };

export default function ReconcileAccount() {
  const { id } = useParams<{ id: string }>();
  const { data, reload, error } = useApi<{
    account: { id: number; name: string; balance: number; live_balance: number; opening_balance: number };
    expected: number;
    recent: Rec[];
    today: string;
  }>(`/accounts/${id}/reconcile`);
  const [actual, setActual] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const expected = Number(data?.expected || 0);
  const actualN = actual === "" ? NaN : Number(actual);
  const diff = Number.isNaN(actualN) ? 0 : actualN - expected;
  const abs = Math.abs(diff);
  const verdict = abs < 0.005 ? "Matched — no difference" : diff < 0
    ? `Loss / Shortage — actual is lower than expected by Rs. ${abs.toFixed(2)}`
    : `Profit / Excess — actual is higher than expected by Rs. ${abs.toFixed(2)}`;
  const pill = abs < 0.005 ? "matched" : diff < 0 ? "loss" : "excess";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api(`/accounts/${id}/reconcile`, {
        method: "POST",
        body: JSON.stringify({ actual_balance: actual, reconciliation_date: date || data?.today, note })
      });
      setActual("");
      setNote("");
      reload();
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  return (
    <div className="container-fluid">
      <div className="acc-page-header">
        <div>
          <h2><i className="bi bi-check2-square me-2 text-success" />Reconcile Account</h2>
          <div className="subtitle">{data?.account.name} — compare expected (ledger) vs actual (physical) balance.</div>
        </div>
        <div className="acc-toolbar">
          <Link to={`/accounts/${id}/ledger`} className="btn btn-outline-secondary btn-sm"><i className="bi bi-journal-text me-1" />Ledger</Link>
          <Link to="/accounts/reconciliations" className="btn btn-outline-info btn-sm"><i className="bi bi-clock-history me-1" />All Reconciliations</Link>
        </div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="row g-3 mb-3">
        <div className="col-md-3"><div className="card kpi-card kpi-slate" style={{ background: "linear-gradient(135deg,#64748b,#334155)", color: "#fff" }}><div className="card-body"><div className="kpi-label">Previous Final</div><div className="kpi-value">{rs(data?.recent?.[0]?.actual_balance ?? data?.account.opening_balance)}</div></div></div></div>
        <div className="col-md-3"><div className="card kpi-card kpi-slate" style={{ background: "linear-gradient(135deg,#64748b,#334155)", color: "#fff" }}><div className="card-body"><div className="kpi-label">Stored Balance</div><div className="kpi-value">{rs(data?.account.balance)}</div></div></div></div>
        <div className="col-md-3"><div className="card kpi-card kpi-cyan"><div className="card-body"><div className="kpi-label">Expected Closing</div><div className="kpi-value">{rs(expected)}</div></div></div></div>
        <div className="col-md-3"><div className="card kpi-card kpi-green"><div className="card-body"><div className="kpi-label">Actual − Expected</div><div className="kpi-value">{rs(diff)}</div></div></div></div>
      </div>
      <div className="alert alert-info py-2 small mb-4"><strong>Carry chain:</strong> previous final reconciled balance → opening balance → period transactions → expected closing → entered actual → transparent loss/excess adjustment → final reconciled balance. Historical transactions are never rewritten.</div>
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="acc-section-card">
            <div className="card-header"><h5><i className="bi bi-pencil-square me-2 text-success" />Reconciliation Entry</h5></div>
            <div className="card-body">
              {err && <div className="alert alert-danger py-2">{err}</div>}
              <form onSubmit={submit} className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Actual / Physical Balance *</label>
                  <div className="input-group"><span className="input-group-text">Rs.</span><input type="number" step="0.01" className="form-control" required value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Counted / bank statement balance" /></div>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Reconciliation Date</label>
                  <input type="date" className="form-control" value={date || data?.today || ""} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="col-12"><label className="form-label fw-semibold">Note</label><textarea className="form-control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for any difference" /></div>
                <div className="col-12"><div className={`diff-pill ${pill}`}>{verdict}</div></div>
                <div className="col-12"><button className="btn btn-success" type="submit"><i className="bi bi-check-lg me-1" />Reconcile Account</button></div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="acc-section-card">
            <div className="card-header"><h5><i className="bi bi-clock-history me-2 text-info" />Recent Reconciliations</h5></div>
            <table className="table acc-table align-middle mb-0">
              <thead><tr><th>Date</th><th className="text-end">Expected</th><th className="text-end">Actual</th><th className="text-end">Diff</th><th>Type</th></tr></thead>
              <tbody>
                {(data?.recent || []).map((r) => (
                  <tr key={r.id}>
                    <td className="small">{ymd(r.reconciliation_date)}</td>
                    <td className="text-end">{Number(r.expected_balance).toFixed(2)}</td>
                    <td className="text-end">{Number(r.actual_balance).toFixed(2)}</td>
                    <td className={`text-end fw-bold ${r.difference < 0 ? "text-danger" : r.difference > 0 ? "text-warning" : "text-success"}`}>{r.difference > 0 ? "+" : ""}{Number(r.difference).toFixed(2)}</td>
                    <td><span className="badge bg-secondary">{r.difference_type}</span></td>
                  </tr>
                ))}
                {!data?.recent?.length && <tr><td colSpan={5} className="text-center text-muted py-3">No reconciliations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
