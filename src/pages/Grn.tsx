import { FormEvent, useState } from "react";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

type Grn = {
  id: number; supplier: string; auto_bill_no: string; manual_bill_no: string;
  date_posted: string; note: string; itemTotal: number; paid_amount: number;
  discount: number; loading_cost: number; freight_cost: number; other_expense: number;
  is_void: number;
  items: { id: number; mat_name: string; qty: number; price_at_time: number }[];
};

export default function Grn() {
  const { data, reload } = useApi<{
    grns: Grn[];
    suppliers: { id: number; name: string }[];
    materials: { id: number; name: string; unit_price: number; unit: string }[];
    accounts: { id: number; name: string }[];
  }>("/grn");
  const [lines, setLines] = useState([{ name: "", qty: "", rate: "" }]);
  const [editing, setEditing] = useState<Grn | null>(null);
  const [editLines, setEditLines] = useState([{ name: "", qty: "", rate: "" }]);
  const [paying, setPaying] = useState<Grn | null>(null);
  const [filter, setFilter] = useState<"active" | "void" | "all">("active");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/grn", {
      method: "POST",
      body: JSON.stringify({
        supplier_id: fd.get("supplier_id"),
        manual_bill_no: fd.get("manual_bill_no"),
        paid_amount: fd.get("paid_amount"),
        payment_account_id: fd.get("payment_account_id"),
        loading_cost: fd.get("loading_cost"),
        freight_cost: fd.get("freight_cost"),
        other_expense: fd.get("other_expense"),
        discount: fd.get("discount"),
        note: fd.get("note"),
        items: lines
      })
    });
    setLines([{ name: "", qty: "", rate: "" }]);
    e.currentTarget.reset();
    reload();
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    await api(`/grn/${editing.id}`, {
      method: "POST",
      body: JSON.stringify({
        manual_bill_no: fd.get("manual_bill_no"),
        paid_amount: fd.get("paid_amount"),
        discount: fd.get("discount"),
        loading_cost: fd.get("loading_cost"),
        freight_cost: fd.get("freight_cost"),
        other_expense: fd.get("other_expense"),
        note: fd.get("note"),
        items: editLines
      })
    });
    setEditing(null);
    setEditLines([{ name: "", qty: "", rate: "" }]);
    reload();
  }

  async function onPayGrn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paying) return;
    const fd = new FormData(e.currentTarget);
    await api(`/grn/${paying.id}/payment`, {
      method: "POST",
      body: JSON.stringify({
        amount: fd.get("amount"),
        payment_account_id: fd.get("payment_account_id"),
        note: fd.get("note")
      })
    });
    setPaying(null);
    reload();
  }

  async function voidGrn(grn: Grn) {
    if (!confirm(`Void GRN ${grn.auto_bill_no}? This will reverse all stock entries.`)) return;
    await api(`/grn/${grn.id}/void`, { method: "POST" });
    reload();
  }

  function startEdit(grn: Grn) {
    setEditing(grn);
    setEditLines(grn.items.map(i => ({ name: i.mat_name, qty: String(i.qty), rate: String(i.price_at_time) })));
  }

  const filtered = (data?.grns || []).filter(g => {
    if (filter === "active") return !g.is_void;
    if (filter === "void") return !!g.is_void;
    return true;
  });

  return (
    <div>
      <PageHeader icon="bi-box-arrow-in-down" title="GRN Receiving" subtitle="Stock intake — posts stock IN immediately">
        <div className="btn-group btn-group-sm">
          <button className={`btn ${filter === "active" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("active")}>Active</button>
          <button className={`btn ${filter === "all" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("all")}>All</button>
          <button className={`btn ${filter === "void" ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setFilter("void")}>Voided</button>
        </div>
      </PageHeader>

      <Card title="New GRN">
        <form onSubmit={onSubmit}>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="ui-label">Supplier</label>
              <select name="supplier_id" className="form-select" required>
                <option value="">Select</option>
                {(data?.suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-md-2"><label className="ui-label">Manual bill</label><input name="manual_bill_no" className="form-control" /></div>
            <div className="col-md-2"><label className="ui-label">Paid</label><input name="paid_amount" type="number" className="form-control" defaultValue={0} /></div>
            <div className="col-md-2"><label className="ui-label">Discount</label><input name="discount" type="number" className="form-control" defaultValue={0} /></div>
            <div className="col-md-2">
              <label className="ui-label">Pay from</label>
              <select name="payment_account_id" className="form-select">
                <option value="">None</option>
                {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-md-3"><label className="ui-label">Loading</label><input name="loading_cost" type="number" className="form-control" defaultValue={0} /></div>
            <div className="col-md-3"><label className="ui-label">Freight</label><input name="freight_cost" type="number" className="form-control" defaultValue={0} /></div>
            <div className="col-md-3"><label className="ui-label">Other</label><input name="other_expense" type="number" className="form-control" defaultValue={0} /></div>
          </div>
          {lines.map((l, i) => (
            <div className="row g-2 mb-2" key={i}>
              <div className="col-md-5">
                <select className="form-select" value={l.name} onChange={(e) => {
                  const n = [...lines]; n[i].name = e.target.value;
                  const m = (data?.materials || []).find((x) => x.name === e.target.value);
                  if (m) n[i].rate = String(m.unit_price);
                  setLines(n);
                }}>
                  <option value="">Material</option>
                  {(data?.materials || []).map((m) => <option key={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div className="col-md-2"><input className="form-control" placeholder="Qty" value={l.qty} onChange={(e) => { const n = [...lines]; n[i].qty = e.target.value; setLines(n); }} /></div>
              <div className="col-md-2"><input className="form-control" placeholder="Rate" value={l.rate} onChange={(e) => { const n = [...lines]; n[i].rate = e.target.value; setLines(n); }} /></div>
              <div className="col-md-3">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setLines([...lines, { name: "", qty: "", rate: "" }])}>+</button>
                {lines.length > 1 && <button type="button" className="btn btn-outline-danger ms-2" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>−</button>}
              </div>
            </div>
          ))}
          <div className="mt-2">
            <input name="note" className="form-control mb-2" placeholder="Note" />
            <button className="btn btn-warning">Save GRN</button>
          </div>
        </form>
      </Card>

      <Card title={`GRNs — ${filtered.length} records`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Supplier</th><th>Items</th><th className="text-end">Total</th><th className="text-end">Paid</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.id} className={g.is_void ? "text-muted" : ""}>
                <td className="text-warning">{g.auto_bill_no || g.manual_bill_no}</td>
                <td>{ymd(g.date_posted)}</td>
                <td>{g.supplier}</td>
                <td>{(g.items || []).map((i) => `${i.mat_name} (${num(i.qty)})`).join(", ")}</td>
                <td className="text-end">{money(g.itemTotal)}</td>
                <td className="text-end text-success">{money(g.paid_amount)}</td>
                <td>
                  {!g.is_void ? (
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-success" onClick={() => setPaying(g)} title="Pay"><i className="bi bi-cash" /></button>
                      <button className="btn btn-outline-warning" onClick={() => startEdit(g)} title="Edit"><i className="bi bi-pencil" /></button>
                      <button className="btn btn-outline-danger" onClick={() => voidGrn(g)} title="Void"><i className="bi bi-x-circle" /></button>
                    </div>
                  ) : <span className="badge bg-secondary">Voided</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Edit GRN Modal */}
      <Modal open={!!editing} title={`Edit GRN: ${editing?.auto_bill_no || ""}`} onClose={() => setEditing(null)} footer={<button type="submit" form="editGrnForm" className="btn btn-warning">Update GRN</button>} size="xl">
        {editing && (
          <form id="editGrnForm" onSubmit={onEdit}>
            <div className="row g-3 mb-3">
              <div className="col-md-4"><label className="form-label text-white-50">Manual Bill</label><input name="manual_bill_no" className="form-control" defaultValue={editing.manual_bill_no || ""} /></div>
              <div className="col-md-2"><label className="form-label text-white-50">Paid</label><input name="paid_amount" type="number" className="form-control" defaultValue={editing.paid_amount} /></div>
              <div className="col-md-2"><label className="form-label text-white-50">Discount</label><input name="discount" type="number" className="form-control" defaultValue={editing.discount} /></div>
              <div className="col-md-2"><label className="form-label text-white-50">Loading</label><input name="loading_cost" type="number" className="form-control" defaultValue={editing.loading_cost} /></div>
              <div className="col-md-2"><label className="form-label text-white-50">Freight</label><input name="freight_cost" type="number" className="form-control" defaultValue={editing.freight_cost} /></div>
            </div>
            <h6 className="text-warning mb-3">Items</h6>
            {editLines.map((l, i) => (
              <div className="row g-2 mb-2" key={i}>
                <div className="col-md-5">
                  <select className="form-select" value={l.name} onChange={(e) => {
                    const n = [...editLines]; n[i].name = e.target.value;
                    const m = (data?.materials || []).find((x) => x.name === e.target.value);
                    if (m) n[i].rate = String(m.unit_price);
                    setEditLines(n);
                  }}>
                    <option value="">Material</option>
                    {(data?.materials || []).map((m) => <option key={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div className="col-md-2"><input className="form-control" placeholder="Qty" value={l.qty} onChange={(e) => { const n = [...editLines]; n[i].qty = e.target.value; setEditLines(n); }} /></div>
                <div className="col-md-2"><input className="form-control" placeholder="Rate" value={l.rate} onChange={(e) => { const n = [...editLines]; n[i].rate = e.target.value; setEditLines(n); }} /></div>
                <div className="col-md-3">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setEditLines([...editLines, { name: "", qty: "", rate: "" }])}>+</button>
                  {editLines.length > 1 && <button type="button" className="btn btn-outline-danger ms-2" onClick={() => setEditLines(editLines.filter((_, j) => j !== i))}>−</button>}
                </div>
              </div>
            ))}
            <div className="mt-3"><label className="form-label text-white-50">Note</label><input name="note" className="form-control" defaultValue={editing.note || ""} /></div>
          </form>
        )}
      </Modal>

      {/* Pay GRN Modal */}
      <Modal open={!!paying} title={`Pay GRN: ${paying?.auto_bill_no || ""}`} onClose={() => setPaying(null)} footer={<button type="submit" form="payGrnForm" className="btn btn-success">Record Payment</button>}>
        {paying && (
          <form id="payGrnForm" onSubmit={onPayGrn}>
            <div className="mb-3">
              <label className="form-label text-white-50">Amount *</label>
              <input name="amount" type="number" step="0.01" className="form-control" required />
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Pay From Account</label>
              <select name="payment_account_id" className="form-select">
                <option value="">Select account</option>
                {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Note</label>
              <textarea name="note" className="form-control" rows={2} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
