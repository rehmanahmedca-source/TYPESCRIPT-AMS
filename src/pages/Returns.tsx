import { FormEvent, useState } from "react";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

type Return = {
  id: number; client_name: string; auto_bill_no: string; date_posted: string;
  amount: number; is_void: number; note: string;
  items: { material_name: string; qty: number; rate: number }[];
};

export default function Returns() {
  const { data, reload } = useApi<{
    returns: Return[];
    clients: { id: number; name: string }[];
    materials: { id: number; name: string; unit_price: number }[];
    accounts: { id: number; name: string }[];
  }>("/returns");
  const [lines, setLines] = useState([{ name: "", qty: "", rate: "" }]);
  const [editing, setEditing] = useState<Return | null>(null);
  const [editLines, setEditLines] = useState([{ name: "", qty: "", rate: "" }]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/returns", {
      method: "POST",
      body: JSON.stringify({
        client_id: fd.get("client_id"),
        refund_amount: fd.get("refund_amount"),
        refund_account_id: fd.get("refund_account_id"),
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
    await api(`/returns/${editing.id}`, {
      method: "POST",
      body: JSON.stringify({
        client_name: fd.get("client_name"),
        refund_amount: fd.get("refund_amount"),
        note: fd.get("note"),
        items: editLines
      })
    });
    setEditing(null);
    reload();
  }

  async function voidReturn(ret: Return) {
    if (!confirm(`Void return ${ret.auto_bill_no}?`)) return;
    await api(`/returns/${ret.id}/void`, { method: "POST" });
    reload();
  }

  function startEdit(ret: Return) {
    setEditing(ret);
    setEditLines(ret.items.map(i => ({ name: i.material_name, qty: String(i.qty), rate: String(i.rate) })));
  }

  const filtered = (data?.returns || []).filter(r => !r.is_void);

  return (
    <div>
      <PageHeader icon="bi-arrow-counterclockwise" title="Material Returns" subtitle="Process client returns — stock moves back IN">
        <button className="btn btn-warning btn-pill" onClick={() => setLines([{ name: "", qty: "", rate: "" }])}>
          <i className="bi bi-plus-circle me-1" /> New Return
        </button>
      </PageHeader>

      <Card title="New return">
        <form onSubmit={onSubmit}>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="ui-label">Client</label>
              <select name="client_id" className="form-select" required>
                <option value="">Select</option>
                {(data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="ui-label">Refund amount</label>
              <input name="refund_amount" type="number" className="form-control" defaultValue={0} />
            </div>
            <div className="col-md-3">
              <label className="ui-label">Refund from account</label>
              <select name="refund_account_id" className="form-select">
                <option value="">None</option>
                {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
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
            <button className="btn btn-warning">Save return</button>
          </div>
        </form>
      </Card>

      <Card title={`Returns — ${filtered.length} records`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Client</th><th>Items</th><th className="text-end">Amount</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="text-warning">{r.auto_bill_no}</td>
                <td>{ymd(r.date_posted)}</td>
                <td>{r.client_name}</td>
                <td>{(r.items || []).map((i) => `${i.material_name} (${num(i.qty)})`).join(", ")}</td>
                <td className="text-end">{money(r.amount)}</td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-warning" onClick={() => startEdit(r)} title="Edit"><i className="bi bi-pencil" /></button>
                    <button className="btn btn-outline-danger" onClick={() => voidReturn(r)} title="Void"><i className="bi bi-x-circle" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Edit Return Modal */}
      <Modal open={!!editing} title={`Edit Return: ${editing?.auto_bill_no || ""}`} onClose={() => setEditing(null)} footer={<button type="submit" form="editReturnForm" className="btn btn-warning">Update Return</button>} size="lg">
        {editing && (
          <form id="editReturnForm" onSubmit={onEdit}>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label text-white-50">Client Name</label>
                <input name="client_name" className="form-control" defaultValue={editing.client_name} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Refund Amount</label>
                <input name="refund_amount" type="number" className="form-control" defaultValue={editing.amount} />
              </div>
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
    </div>
  );
}
