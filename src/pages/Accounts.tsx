import { FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function Accounts() {
  const { data, reload } = useApi<{
    accounts: { id: number; name: string; category: string; account_type: string; live_balance: number }[];
    transactions: { id: number; date_posted: string; transaction_type: string; amount: number; description: string; from_name: string; to_name: string }[];
    totalCash: number;
    totalBank: number;
    totalCompanyMoney: number;
  }>("/accounts");

  async function transfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/accounts/transfer", {
      method: "POST",
      body: JSON.stringify({
        from_account_id: fd.get("from_account_id"),
        to_account_id: fd.get("to_account_id"),
        amount: fd.get("amount"),
        description: fd.get("description")
      })
    });
    e.currentTarget.reset();
    reload();
  }

  async function expense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/accounts/expense", {
      method: "POST",
      body: JSON.stringify({
        account_id: fd.get("account_id"),
        amount: fd.get("amount"),
        category: fd.get("category"),
        description: fd.get("description")
      })
    });
    e.currentTarget.reset();
    reload();
  }

  async function addAcc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/accounts", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        category: fd.get("category"),
        account_type: "company",
        opening_balance: fd.get("opening_balance"),
        bank_name: fd.get("bank_name")
      })
    });
    e.currentTarget.reset();
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-calculator" title="Accounts Hub" subtitle="Cash, bank, transfers and expenses">
        <span className="badge bg-warning text-dark">Company {money(data?.totalCompanyMoney)}</span>
      </PageHeader>
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-green"><div className="ui-tile-label">Cash</div><div className="ui-tile-value">{money(data?.totalCash)}</div></div>
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Bank</div><div className="ui-tile-value">{money(data?.totalBank)}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Total</div><div className="ui-tile-value">{money(data?.totalCompanyMoney)}</div></div>
      </div>
      <div className="row">
        <div className="col-lg-6">
          <Card title="Transfer">
            <form className="row g-2" onSubmit={transfer}>
              <div className="col-6">
                <select name="from_account_id" className="form-select" required>
                  <option value="">From</option>
                  {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="col-6">
                <select name="to_account_id" className="form-select" required>
                  <option value="">To</option>
                  {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="col-6"><input name="amount" type="number" className="form-control" placeholder="Amount" required /></div>
              <div className="col-6"><input name="description" className="form-control" placeholder="Note" /></div>
              <div className="col-12"><button className="btn btn-info">Transfer</button></div>
            </form>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Expense">
            <form className="row g-2" onSubmit={expense}>
              <div className="col-6">
                <select name="account_id" className="form-select" required>
                  <option value="">Pay from</option>
                  {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="col-6"><input name="category" className="form-control" placeholder="Category" defaultValue="Yard Expense" /></div>
              <div className="col-6"><input name="amount" type="number" className="form-control" placeholder="Amount" required /></div>
              <div className="col-6"><input name="description" className="form-control" placeholder="Description" /></div>
              <div className="col-12"><button className="btn btn-danger">Record expense</button></div>
            </form>
          </Card>
        </div>
      </div>
      <Card title="New account">
        <form className="row g-2" onSubmit={addAcc}>
          <div className="col-md-4"><input name="name" className="form-control" placeholder="Name" required /></div>
          <div className="col-md-2">
            <select name="category" className="form-select"><option value="cash">Cash</option><option value="bank">Bank</option></select>
          </div>
          <div className="col-md-3"><input name="opening_balance" type="number" className="form-control" placeholder="Opening" defaultValue={0} /></div>
          <div className="col-md-3"><button className="btn btn-warning">Add account</button></div>
        </form>
      </Card>
      <Card title="Accounts" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Name</th><th>Type</th><th className="text-end">Balance</th><th>Actions</th></tr></thead>
          <tbody>
            {(data?.accounts || []).map((a) => (
              <tr key={a.id}>
                <td className="fw-bold">{a.name}</td>
                <td>{a.category} / {a.account_type}</td>
                <td className="text-end">{money(a.live_balance)}</td>
                <td><Link to={`/accounts/${a.id}/ledger`} className="btn btn-sm btn-outline-info">View Ledger</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Recent movements" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Description</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {(data?.transactions || []).map((t) => (
              <tr key={t.id}>
                <td>{ymd(t.date_posted)}</td>
                <td>{t.transaction_type}</td>
                <td>{t.from_name || "—"}</td>
                <td>{t.to_name || "—"}</td>
                <td>{t.description}</td>
                <td className="text-end">{money(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
