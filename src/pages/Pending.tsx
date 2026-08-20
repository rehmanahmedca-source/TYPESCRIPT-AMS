import { FormEvent, useState } from "react";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

type Bill = {
  id: number; bill_no: string; client_name: string; client_code: string;
  amount: number; reason: string; is_paid: number; is_void: number;
  created_at: string; note: string;
};

export default function Pending() {
  const { data, reload } = useApi<{
    bills: Bill[];
    clients: { id: number; name: string; code: string }[];
  }>("/pending-bills");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [filter, setFilter] = useState<"unpaid" | "paid" | "all">("unpaid");

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/pending-bills", {
      method: "POST",
      body: JSON.stringify({
        bill_no: fd.get("bill_no"),
        client_name: fd.get("client_name"),
        amount: fd.get("amount"),
        reason: fd.get("reason"),
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
    await api(`/pending-bills/${editing.id}`, {
      method: "POST",
      body: JSON.stringify({
        bill_no: fd.get("bill_no"),
        client_name: fd.get("client_name"),
        amount: fd.get("amount"),
        reason: fd.get("reason"),
        note: fd.get("note")
      })
    });
    setEditing(null);
    reload();
  }

  async function markPaid(bill: Bill) {
    if (!confirm(`Mark bill ${bill.bill_no} as paid?`)) return;
    await api(`/pending-bills/${bill.id}/paid`, { method: "POST" });
    reload();
  }

  async function voidBill(bill: Bill) {
    if (!confirm(`Void bill ${bill.bill_no}?`)) return;
    await api(`/pending-bills/${bill.id}/void`, { method: "POST" });
    reload();
  }

  const filtered = (data?.bills || []).filter(b => {
    if (filter === "unpaid") return !b.is_paid && !b.is_void;
    if (filter === "paid") return b.is_paid && !b.is_void;
    if (filter === "all") return !b.is_void;
    return true;
  });

  const totalPending = filtered.filter(b => !b.is_paid).reduce((a, b) => a + Number(b.amount || 0), 0);

  return (
    <div>
      <PageHeader icon="bi-receipt" title="Pending Bills" subtitle="Track outstanding and unpaid bills">
        <div className="d-flex gap-2">
          <div className="btn-group btn-group-sm">
            <button className={`btn ${filter === "unpaid" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("unpaid")}>Unpaid</button>
            <button className={`btn ${filter === "paid" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("paid")}>Paid</button>
            <button className={`btn ${filter === "all" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("all")}>All</button>
          </div>
          <button className="btn btn-warning btn-pill" onClick={() => setShowAdd(true)}>
            <i className="bi bi-plus-circle me-1" /> Add Bill
          </button>
        </div>
      </PageHeader>

      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-red"><div className="ui-tile-label">Total Pending</div><div className="ui-tile-value">{filtered.filter(b => !b.is_paid).length}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Total Amount</div><div className="ui-tile-value">{money(totalPending)}</div></div>
        <div className="ui-tile border-green"><div className="ui-tile-label">Paid</div><div className="ui-tile-value">{filtered.filter(b => b.is_paid).length}</div></div>
      </div>

      <Card title={`All Bills — ${filtered.length} records`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Bill</th><th>Client</th><th>Reason</th><th className="text-end">Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id}>
                <td className="text-warning">{b.bill_no}</td>
                <td>{b.client_name}</td>
                <td>{b.reason || "—"}</td>
                <td className="text-end fw-bold">{money(b.amount)}</td>
                <td>{b.is_paid ? <span className="badge bg-success">Paid</span> : <span className="badge bg-danger">Unpaid</span>}</td>
                <td>
                  {!b.is_paid ? (
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-success" onClick={() => markPaid(b)} title="Mark Paid"><i className="bi bi-check-circle" /></button>
                      <button className="btn btn-outline-warning" onClick={() => setEditing(b)} title="Edit"><i className="bi bi-pencil" /></button>
                      <button className="btn btn-outline-danger" onClick={() => voidBill(b)} title="Void"><i className="bi bi-x-circle" /></button>
                    </div>
                  ) : (
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-warning" onClick={() => setEditing(b)} title="Edit"><i className="bi bi-pencil" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Add Bill Modal */}
      <Modal open={showAdd} title="Add Pending Bill" onClose={() => setShowAdd(false)} footer={<button type="submit" form="addBillForm" className="btn btn-warning">Save Bill</button>}>
        <form id="addBillForm" onSubmit={onAdd}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label text-white-50">Client *</label>
              <select name="client_name" className="form-select" required>
                <option value="">Select client</option>
                {(data?.clients || []).map((c) => <option key={c.id} value={c.name}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Bill Number</label>
              <input name="bill_no" className="form-control" />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Amount *</label>
              <input name="amount" type="number" step="0.01" className="form-control" required />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Reason</label>
              <input name="reason" className="form-control" />
            </div>
            <div className="col-12">
              <label className="form-label text-white-50">Note</label>
              <textarea name="note" className="form-control" rows={2} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Bill Modal */}
      <Modal open={!!editing} title={`Edit Bill: ${editing?.bill_no || ""}`} onClose={() => setEditing(null)} footer={<button type="submit" form="editBillForm" className="btn btn-warning">Update Bill</button>}>
        {editing && (
          <form id="editBillForm" onSubmit={onEdit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label text-white-50">Client Name</label>
                <input name="client_name" className="form-control" defaultValue={editing.client_name} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Bill Number</label>
                <input name="bill_no" className="form-control" defaultValue={editing.bill_no} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Amount</label>
                <input name="amount" type="number" step="0.01" className="form-control" defaultValue={editing.amount} required />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Reason</label>
                <input name="reason" className="form-control" defaultValue={editing.reason || ""} />
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
