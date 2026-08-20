import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { rs, ymd } from "../format";
import { useApi } from "../useApi";

type Pay = {
  id: number;
  supplier_name?: string;
  amount: number;
  method: string;
  auto_bill_no: string;
  manual_bill_no: string;
  date_posted: string;
  note: string;
  is_void: number;
  account_name?: string;
};

export default function SupplierPayments() {
  const { data, reload } = useApi<{ payments: Pay[]; suppliers: { id: number; name: string }[]; accounts: { id: number; name: string }[] }>("/accounts/supplier-payments");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/accounts/payments/suppliers/save", { method: "POST", body: JSON.stringify(Object.fromEntries(fd.entries())) });
    setOpen(false);
    reload();
  }

  async function remove(id: number) {
    if (!confirm("Delete this supplier payment?")) return;
    await api(`/accounts/payments/suppliers/${id}/delete`, { method: "POST" });
    reload();
  }

  const rows = (data?.payments || []).filter((p) =>
    `${p.supplier_name} ${p.auto_bill_no} ${p.manual_bill_no} ${p.note}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader icon="bi-truck" title="Supplier Payments" subtitle="Money paid to suppliers">
        <Link to="/accounts" className="btn btn-outline-secondary btn-sm">Accounts</Link>
        <button className="btn btn-danger btn-sm fw-bold" onClick={() => setOpen(true)}>New Supplier Payment</button>
      </PageHeader>
      <Card>
        <input className="form-control mb-3" placeholder="Name, bill, reference, account, note…" value={q} onChange={(e) => setQ(e.target.value)} />
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Supplier</th><th>Bill</th><th>Method</th><th className="text-end">Amount</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={p.is_void ? "opacity-50" : ""}>
                <td>{ymd(p.date_posted)}</td>
                <td className="fw-bold">{p.supplier_name}</td>
                <td>{p.manual_bill_no || p.auto_bill_no}</td>
                <td>{p.method}</td>
                <td className="text-end text-danger fw-bold">{rs(p.amount)}</td>
                <td className="text-end">{!p.is_void && <button className="btn btn-sm btn-outline-danger" onClick={() => remove(p.id)}>Delete</button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="text-center text-muted py-4">No supplier payments.</td></tr>}
          </tbody>
        </table>
      </Card>
      <Modal open={open} title="New Supplier Payment" onClose={() => setOpen(false)} footer={<button form="spForm" className="btn btn-danger" type="submit">Save Payment</button>}>
        <form id="spForm" onSubmit={save}>
          <label className="form-label">Supplier</label>
          <select name="supplier_id" className="form-select mb-2" required>
            <option value="">Search by name…</option>
            {(data?.suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="form-label">Amount</label>
          <input name="amount" type="number" step="0.01" className="form-control mb-2" placeholder="0.00" required />
          <label className="form-label">Method</label>
          <select name="method" className="form-select mb-2"><option>Cash</option><option>Bank</option><option>Check</option><option>Online</option></select>
          <label className="form-label">Account</label>
          <select name="payment_account_id" className="form-select mb-2">
            <option value="">Search by account, bank, or number…</option>
            {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <label className="form-label">Manual Bill No</label>
          <input name="manual_bill_no" className="form-control mb-2" placeholder="e.g. PV-1234" />
          <label className="form-label">Date</label>
          <input name="date" type="date" className="form-control mb-2" />
          <label className="form-label">Note</label>
          <textarea name="note" className="form-control" />
        </form>
      </Modal>
    </div>
  );
}
