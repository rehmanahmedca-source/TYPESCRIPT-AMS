import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

type Payment = {
  id: number; client_name: string; auto_bill_no: string; manual_bill_no: string;
  date_posted: string; amount: number; method: string; note: string;
  payment_type: string; is_void: number; payment_account_id: number;
};

export default function Payments() {
  const { data, reload } = useApi<{
    payments: Payment[];
    clients: { id: number; name: string }[];
    accounts: { id: number; name: string }[];
  }>("/payments");
  const [params] = useSearchParams();
  const prefillClient = params.get("client") || "";
  const [showAdd, setShowAdd] = useState(!!prefillClient);
  const defaultClientId = useMemo(() => {
    const list = data?.clients || [];
    const hit = list.find((c) => String((c as { code?: string }).code || c.name) === prefillClient || c.name === prefillClient);
    return hit ? String(hit.id) : "";
  }, [data, prefillClient]);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [filter, setFilter] = useState<"all" | "void" | "active">("active");

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/payments", {
      method: "POST",
      body: JSON.stringify({
        client_id: fd.get("client_id"),
        amount: fd.get("amount"),
        method: fd.get("method"),
        payment_account_id: fd.get("payment_account_id"),
        note: fd.get("note")
      })
    });
    setShowAdd(false);
    reload();
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    await api(`/payments/${editing.id}`, {
      method: "POST",
      body: JSON.stringify({
        client_name: fd.get("client_name"),
        amount: fd.get("amount"),
        method: fd.get("method"),
        note: fd.get("note")
      })
    });
    setEditing(null);
    reload();
  }

  async function voidPayment(payment: Payment) {
    if (!confirm(`Void payment ${payment.auto_bill_no}?`)) return;
    await api(`/payments/${payment.id}/void`, { method: "POST" });
    reload();
  }

  const filtered = (data?.payments || []).filter(p => {
    if (filter === "active") return !p.is_void;
    if (filter === "void") return !!p.is_void;
    return true;
  });

  const totalCollected = filtered.reduce((a, p) => a + Number(p.amount || 0), 0);

  return (
    <div>
      <PageHeader icon="bi-cash-stack" title="Payments" subtitle="Record and manage client payments">
        <div className="d-flex gap-2">
          <div className="btn-group btn-group-sm">
            <button className={`btn ${filter === "active" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("active")}>Active</button>
            <button className={`btn ${filter === "all" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("all")}>All</button>
            <button className={`btn ${filter === "void" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("void")}>Voided</button>
          </div>
          <button className="btn btn-warning btn-pill" onClick={() => setShowAdd(true)}>
            <i className="bi bi-plus-circle me-1" /> Record Payment
          </button>
        </div>
      </PageHeader>

      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-green"><div className="ui-tile-label">Total Payments</div><div className="ui-tile-value">{filtered.length}</div></div>
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Total Collected</div><div className="ui-tile-value">{money(totalCollected)}</div></div>
      </div>

      <Card title={`All Payments — ${filtered.length} records`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Client</th><th>Method</th><th>Type</th><th className="text-end">Amount</th><th>Account</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={p.is_void ? "text-muted" : ""}>
                <td className="text-warning">{p.auto_bill_no || p.manual_bill_no}</td>
                <td>{ymd(p.date_posted)}</td>
                <td>{p.client_name}</td>
                <td><span className="badge bg-info">{p.method}</span></td>
                <td>{p.payment_type}</td>
                <td className="text-end fw-bold">{money(p.amount)}</td>
                <td><small className="text-muted">{p.payment_account_id || "—"}</small></td>
                <td>
                  {!p.is_void ? (
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-warning" onClick={() => setEditing(p)} title="Edit"><i className="bi bi-pencil" /></button>
                      <button className="btn btn-outline-danger" onClick={() => voidPayment(p)} title="Void"><i className="bi bi-x-circle" /></button>
                    </div>
                  ) : <span className="badge bg-secondary">Voided</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Add Payment Modal */}
      <Modal open={showAdd} title="Record Payment" onClose={() => setShowAdd(false)} footer={<button type="submit" form="addPaymentForm" className="btn btn-success">Save Payment</button>}>
        <form id="addPaymentForm" onSubmit={onAdd}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label text-white-50">Client *</label>
              <select name="client_id" className="form-select" required defaultValue={defaultClientId}>
                <option value="">Select client</option>
                {(data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Amount *</label>
              <input name="amount" type="number" step="0.01" className="form-control" required />
            </div>
            <div className="col-md-4">
              <label className="form-label text-white-50">Method</label>
              <select name="method" className="form-select" defaultValue="Cash">
                <option>Cash</option><option>Bank</option><option>Cheque</option><option>Online Transfer</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label text-white-50">Receive In Account</label>
              <select name="payment_account_id" className="form-select">
                <option value="">Select account</option>
                {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label text-white-50">Payment Type</label>
              <select name="payment_type" className="form-select" defaultValue="Receipt">
                <option>Receipt</option><option>Refund</option><option>Adjustment</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label text-white-50">Note</label>
              <textarea name="note" className="form-control" rows={2} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal open={!!editing} title={`Edit Payment: ${editing?.auto_bill_no || ""}`} onClose={() => setEditing(null)} footer={<button type="submit" form="editPaymentForm" className="btn btn-warning">Update Payment</button>}>
        {editing && (
          <form id="editPaymentForm" onSubmit={onEdit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label text-white-50">Client Name</label>
                <input name="client_name" className="form-control" defaultValue={editing.client_name} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Amount</label>
                <input name="amount" type="number" step="0.01" className="form-control" defaultValue={editing.amount} required />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Method</label>
                <select name="method" className="form-select" defaultValue={editing.method}>
                  <option>Cash</option><option>Bank</option><option>Cheque</option><option>Online Transfer</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label text-white-50">Note</label>
                <textarea name="note" className="form-control" rows={2} defaultValue={editing.note || ""} />
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
