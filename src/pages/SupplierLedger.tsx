import { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function SupplierLedger() {
  const { id } = useParams();
  const { data, reload } = useApi<{
    supplier: { name: string; balance: number; phone: string };
    entries: { date: string; type: string; description: string; debit: number; credit: number; balance: number; ref: string }[];
    totalDebit: number;
    totalCredit: number;
  }>(id ? `/suppliers/${id}/ledger` : null);
  const accounts = useApi<{ accounts: { id: number; name: string }[] }>("/accounts");

  async function onPay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api(`/suppliers/${id}/payment`, {
      method: "POST",
      body: JSON.stringify({ amount: fd.get("amount"), method: fd.get("method"), account_id: fd.get("account_id"), note: fd.get("note") })
    });
    e.currentTarget.reset();
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-journal-richtext" title={`Supplier — ${data?.supplier.name || ""}`} subtitle={data?.supplier.phone}>
        <span className="badge bg-danger fs-6">{money(data?.supplier.balance)}</span>
      </PageHeader>
      <Card title="Pay supplier">
        <form className="row g-3" onSubmit={onPay}>
          <div className="col-md-2"><label className="ui-label">Amount</label><input name="amount" type="number" className="form-control" required /></div>
          <div className="col-md-2"><label className="ui-label">Method</label><input name="method" className="form-control" defaultValue="Bank" /></div>
          <div className="col-md-4">
            <label className="ui-label">From account</label>
            <select name="account_id" className="form-select">
              <option value="">None</option>
              {(accounts.data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="col-md-2"><label className="ui-label">Note</label><input name="note" className="form-control" /></div>
          <div className="col-md-2 d-flex align-items-end"><button className="btn btn-danger w-100">Pay</button></div>
        </form>
      </Card>
      <Card title="Ledger" extra={<span>Dr {money(data?.totalDebit)} · Cr {money(data?.totalCredit)}</span>} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Ref</th><th className="text-end">Debit</th><th className="text-end">Credit</th><th className="text-end">Balance</th></tr></thead>
          <tbody>
            {(data?.entries || []).map((e, i) => (
              <tr key={i}>
                <td>{ymd(e.date)}</td>
                <td>{e.type}</td>
                <td>{e.description}</td>
                <td className="text-warning">{e.ref}</td>
                <td className="text-end">{e.debit ? money(e.debit) : ""}</td>
                <td className="text-end">{e.credit ? money(e.credit) : ""}</td>
                <td className="text-end fw-bold">{money(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
