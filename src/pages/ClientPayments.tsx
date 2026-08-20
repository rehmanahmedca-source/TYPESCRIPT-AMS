import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { rs, ymd } from "../format";
import { useApi } from "../useApi";

type Pay = {
  id: number;
  client_name: string;
  amount: number;
  discount?: number;
  method: string;
  auto_bill_no: string;
  manual_bill_no: string;
  date_posted: string;
  note: string;
  is_void: number;
  account_name?: string;
};

export default function ClientPayments() {
  const { data, reload } = useApi<{ payments: Pay[]; clients: { code: string; name: string }[]; accounts: { id: number; name: string }[] }>("/accounts/client-payments");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/accounts/payments/clients/save", { method: "POST", body: JSON.stringify(Object.fromEntries(fd.entries())) });
    setOpen(false);
    reload();
  }

  async function voidPay(id: number) {
    if (!confirm("Void this client payment?")) return;
    await api(`/accounts/payments/clients/void/${id}`, { method: "POST" });
    reload();
  }

  const rows = (data?.payments || []).filter((p) =>
    `${p.client_name} ${p.auto_bill_no} ${p.manual_bill_no} ${p.note}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader icon="bi-people" title="Client Payments" subtitle="Money received from clients">
        <Link to="/accounts" className="btn btn-outline-secondary btn-sm">Accounts</Link>
        <button className="btn btn-warning btn-sm fw-bold" onClick={() => setOpen(true)}>New Client Payment</button>
      </PageHeader>
      <Card>
        <input className="form-control mb-3" placeholder="Name, bill, reference, account, note…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead><tr><th>Date</th><th>Client</th><th>Bill</th><th>Method</th><th>Account</th><th className="text-end">Amount</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={p.is_void ? "opacity-50" : ""}>
                  <td>{ymd(p.date_posted)}</td>
                  <td className="fw-bold">{p.client_name}</td>
                  <td>{p.manual_bill_no || p.auto_bill_no}</td>
                  <td>{p.method}</td>
                  <td>{p.account_name || "—"}</td>
                  <td className="text-end text-success fw-bold">{rs(p.amount)}</td>
                  <td className="text-end">{!p.is_void && <button className="btn btn-sm btn-outline-danger" onClick={() => voidPay(p.id)}>Void</button>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="text-center text-muted py-4">No client payments.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={open} title="New Client Payment" onClose={() => setOpen(false)} footer={<button form="cpForm" className="btn btn-warning" type="submit">Save Payment</button>}>
        <form id="cpForm" onSubmit={save}>
          <label className="form-label">Client</label>
          <input name="client_code" className="form-control mb-2" list="cpClients" placeholder="Search by name or code…" required />
          <datalist id="cpClients">{(data?.clients || []).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</datalist>
          <label className="form-label">Payment Type</label>
          <select name="payment_type" className="form-select mb-2"><option>Receipt</option><option>Refund</option><option>Adjustment</option></select>
          <label className="form-label">Amount</label>
          <input name="amount" type="number" step="0.01" className="form-control mb-2" placeholder="0.00" required />
          <label className="form-label">Discount</label>
          <input name="discount" type="number" step="0.01" className="form-control mb-2" defaultValue={0} />
          <label className="form-label">Discount Reason</label>
          <input name="discount_reason" className="form-control mb-2" placeholder="Required if discount > 0" />
          <label className="form-label">Method</label>
          <select name="method" className="form-select mb-2"><option>Cash</option><option>Bank</option><option>Check</option><option>Online</option></select>
          <label className="form-label">Account</label>
          <select name="payment_account_id" className="form-select mb-2">
            <option value="">Search by account, bank, or number…</option>
            {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <label className="form-label">Manual Bill No</label>
          <input name="manual_bill_no" className="form-control mb-2" placeholder="e.g. CP-1234" />
          <label className="form-label">Date</label>
          <input name="date" type="date" className="form-control mb-2" />
          <label className="form-label">Note</label>
          <textarea name="note" className="form-control" />
        </form>
      </Modal>
    </div>
  );
}
