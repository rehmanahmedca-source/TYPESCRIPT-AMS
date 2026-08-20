import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";

export default function AddAccount() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [category, setCategory] = useState("cash");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    try {
      await api("/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          source_category: fd.get("source_category"),
          account_type: fd.get("account_type"),
          category,
          bank_name: fd.get("bank_name"),
          account_holder_name: fd.get("account_holder_name"),
          account_number: fd.get("account_number"),
          branch_code: fd.get("branch_code"),
          opening_balance: fd.get("initial_balance"),
          note: fd.get("note")
        })
      });
      nav("/accounts/accounts");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <PageHeader icon="bi-plus-circle" title="Add New Account" subtitle="Create a cash drawer or bank account">
        <Link to="/accounts/accounts" className="btn btn-outline-secondary btn-sm">Cancel</Link>
      </PageHeader>
      <Card>
        {err && <div className="alert alert-danger">{err}</div>}
        <form className="row g-3" onSubmit={submit}>
          <div className="col-md-6">
            <label className="form-label">Account Name</label>
            <input name="name" className="form-control" placeholder="e.g. Main Cash Drawer, HBL Business 1234" required />
          </div>
          <div className="col-md-3">
            <label className="form-label">Source Category</label>
            <select name="source_category" className="form-select">
              <option value="Company">Company</option>
              <option value="Own Funds">Own Funds</option>
              <option value="Clients">Clients</option>
              <option value="External">External</option>
              <option value="Loan">Loan</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Account Type</label>
            <select name="account_type" className="form-select" defaultValue="company">
              <option value="company">company</option>
              <option value="cash">cash</option>
              <option value="personal">Personal Account</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label d-block">Channel</label>
            <label className="me-3"><input type="radio" checked={category === "cash"} onChange={() => setCategory("cash")} /> Cash</label>
            <label><input type="radio" checked={category === "bank"} onChange={() => setCategory("bank")} /> Bank</label>
          </div>
          {category === "bank" && (
            <>
              <div className="col-md-4"><label className="form-label">Bank Name</label><input name="bank_name" className="form-control" placeholder="e.g. HBL, Meezan, Allied" /></div>
              <div className="col-md-4"><label className="form-label">Account Holder</label><input name="account_holder_name" className="form-control" placeholder="As printed on the cheque book" /></div>
              <div className="col-md-4"><label className="form-label">Account Number</label><input name="account_number" className="form-control" placeholder="e.g. 0123-4567890-01" /></div>
              <div className="col-md-4"><label className="form-label">Branch Code</label><input name="branch_code" className="form-control" placeholder="Optional" /></div>
            </>
          )}
          <div className="col-md-4">
            <label className="form-label">Initial Balance</label>
            <input name="initial_balance" type="number" step="0.01" className="form-control" defaultValue={0} />
          </div>
          <div className="col-12">
            <label className="form-label">Note</label>
            <textarea name="note" className="form-control" placeholder="Anything useful to remember about this account..." />
          </div>
          <div className="col-12"><button className="btn btn-warning fw-bold">Save Account</button></div>
        </form>
      </Card>
    </div>
  );
}
