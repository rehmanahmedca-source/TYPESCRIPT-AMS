import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money } from "../format";
import { useApi } from "../useApi";

type Material = {
  id: number;
  code: string;
  name: string;
  category_id: number | null;
  category_name: string;
  unit: string;
  unit_price: number;
  is_active: number;
  inn: number;
  out: number;
  stock: number;
};

export default function Materials() {
  const { data, reload } = useApi<{
    materials: Material[];
    categories: { id: number; name: string }[];
  }>("/materials");

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [q, setQ] = useState("");

  const materials = (data?.materials || []).filter(
    (m) =>
      m.name.toLowerCase().includes(q.toLowerCase()) ||
      m.code.toLowerCase().includes(q.toLowerCase())
  );

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/materials", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        code: fd.get("code"),
        category: fd.get("category"),
        unit: fd.get("unit"),
        unit_price: fd.get("unit_price")
      })
    });
    setShowAdd(false);
    reload();
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    await api(`/materials/${editing.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        code: fd.get("code"),
        category_id: fd.get("category_id") || null,
        unit: fd.get("unit"),
        unit_price: fd.get("unit_price"),
        is_active: fd.get("is_active") === "1" ? 1 : 0
      })
    });
    setEditing(null);
    reload();
  }

  async function toggleActive(mat: Material) {
    await api(`/materials/${mat.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: mat.name,
        code: mat.code,
        category_id: mat.category_id,
        unit: mat.unit,
        unit_price: mat.unit_price,
        is_active: mat.is_active ? 0 : 1
      })
    });
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-tags" title="Brand Master" subtitle="Manage materials, brands, rates and categories">
        <button className="btn btn-warning btn-pill fw-bold" onClick={() => setShowAdd(true)}>
          <i className="bi bi-plus-circle me-1" /> New Brand
        </button>
      </PageHeader>

      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Total Materials</div><div className="ui-tile-value">{materials.length}</div></div>
        <div className="ui-tile border-green"><div className="ui-tile-label">Active</div><div className="ui-tile-value">{materials.filter(m => m.is_active).length}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Categories</div><div className="ui-tile-value">{(data?.categories || []).length}</div></div>
      </div>

      <Card title="Brands">
        <div className="mb-3">
          <input className="form-control" placeholder="Search materials..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th className="text-end">Rate</th><th className="text-end">Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>{m.code}</td>
                  <td className="fw-bold">{m.name}</td>
                  <td>{m.category_name}</td>
                  <td>{m.unit}</td>
                  <td className="text-end">{money(m.unit_price)}</td>
                  <td className="text-end">{m.stock}</td>
                  <td>{m.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Off</span>}</td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-warning" onClick={() => setEditing(m)} title="Edit"><i className="bi bi-pencil" /></button>
                      <button className="btn btn-outline-danger" onClick={() => toggleActive(m)} title={m.is_active ? "Deactivate" : "Activate"}><i className="bi bi-power" /></button>
                      <Link to={`/materials/${m.id}/ledger`} className="btn btn-outline-info" title="View Ledger"><i className="bi bi-journal-text" /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Material Modal */}
      <Modal open={showAdd} title="New Material" onClose={() => setShowAdd(false)} footer={<button type="submit" form="addMatForm" className="btn btn-warning">Save Material</button>}>
        <form id="addMatForm" onSubmit={onAdd}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label text-white-50">Material Name *</label>
              <input name="name" className="form-control" required />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Code</label>
              <input name="code" className="form-control" placeholder="Auto-generated if empty" />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Category</label>
              <input name="category" className="form-control" list="cats" defaultValue="Cement" />
              <datalist id="cats">{(data?.categories || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div className="col-md-3">
              <label className="form-label text-white-50">Unit</label>
              <input name="unit" className="form-control" defaultValue="Bags" />
            </div>
            <div className="col-md-3">
              <label className="form-label text-white-50">Rate</label>
              <input name="unit_price" type="number" step="0.01" className="form-control" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Material Modal */}
      <Modal open={!!editing} title={`Edit Material: ${editing?.name || ""}`} onClose={() => setEditing(null)} footer={<button type="submit" form="editMatForm" className="btn btn-warning">Update Material</button>}>
        {editing && (
          <form id="editMatForm" onSubmit={onEdit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label text-white-50">Material Name</label>
                <input name="name" className="form-control" defaultValue={editing.name} required />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Code</label>
                <input name="code" className="form-control" defaultValue={editing.code} />
              </div>
              <div className="col-md-4">
                <label className="form-label text-white-50">Category</label>
                <select name="category_id" className="form-select" defaultValue={editing.category_id || ""}>
                  <option value="">None</option>
                  {(data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label text-white-50">Unit</label>
                <input name="unit" className="form-control" defaultValue={editing.unit} />
              </div>
              <div className="col-md-4">
                <label className="form-label text-white-50">Rate</label>
                <input name="unit_price" type="number" step="0.01" className="form-control" defaultValue={editing.unit_price} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Status</label>
                <select name="is_active" className="form-select" defaultValue={editing.is_active ? "1" : "0"}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
