import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { useApi } from "../useApi";

export default function NewTransfer() {
  const nav = useNavigate();
  const { data } = useApi<{ accounts: { id: number; name: string }[] }>("/accounts");
  const [err, setErr] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api("/accounts/transfer", {
        method: "POST",
        body: JSON.stringify({
          from_account_id: fd.get("from_account"),
          to_account_id: fd.get("to_account"),
          amount: fd.get("amount"),
          description: fd.get("description"),
          note: fd.get("note")
        })
      });
      nav("/accounts/transfers");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <PageHeader icon="bi-shuffle" title="New Transfer" subtitle="Move money between accounts">
        <Link to="/accounts/transfers" className="btn btn-outline-secondary btn-sm">Cancel</Link>
      </PageHeader>
      <Card>
        {err && <div className="alert alert-danger">{err}</div>}
        <form className="row g-3" onSubmit={submit}>
          <div className="col-md-6">
            <label className="form-label">Source Account</label>
            <select name="from_account" className="form-select" required>
              <option value="">Search source account…</option>
              {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">Destination Account</label>
            <select name="to_account" className="form-select" required>
              <option value="">Search destination account…</option>
              {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Amount</label>
            <input name="amount" type="number" step="0.01" className="form-control" required />
          </div>
          <div className="col-md-8">
            <label className="form-label">Description</label>
            <input name="description" className="form-control" placeholder="e.g. Cash deposit to bank" />
          </div>
          <div className="col-12">
            <label className="form-label">Note</label>
            <textarea name="note" className="form-control" placeholder="Any additional details..." />
          </div>
          <div className="col-12"><button className="btn btn-warning fw-bold">Save Transfer</button></div>
        </form>
      </Card>
    </div>
  );
}
