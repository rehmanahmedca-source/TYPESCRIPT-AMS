import { FormEvent, useState } from "react";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, num } from "../format";
import { useApi } from "../useApi";

type Driver = {
  id: number;
  name: string;
  phone: string;
  opening_balance: number;
  balance: number;
  deliveriesCount: number;
  is_active: number;
};

export default function Drivers() {
  const { data, reload } = useApi<{ drivers: Driver[] }>("/drivers");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [paying, setPaying] = useState<Driver | null>(null);

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/drivers", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone"),
        opening_balance: fd.get("opening_balance")
      })
    });
    setShowAdd(false);
    reload();
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    await api(`/drivers/${editing.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone"),
        opening_balance: fd.get("opening_balance"),
        is_active: fd.get("is_active") === "1" ? 1 : 0
      })
    });
    setEditing(null);
    reload();
  }

  async function onPay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paying) return;
    const fd = new FormData(e.currentTarget);
    await api(`/drivers/${paying.id}/payment`, {
      method: "POST",
      body: JSON.stringify({
        amount: fd.get("amount"),
        waive_off: fd.get("waive_off") || 0,
        note: fd.get("note")
      })
    });
    setPaying(null);
    reload();
  }

  async function toggleActive(driver: Driver) {
    await api(`/drivers/${driver.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: driver.name,
        phone: driver.phone,
        opening_balance: driver.opening_balance,
        is_active: driver.is_active ? 0 : 1
      })
    });
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-person-badge" title="Drivers & Fleet" subtitle="Manage delivery drivers, track balances, record payments">
        <button className="btn btn-warning btn-pill fw-bold" onClick={() => setShowAdd(true)}>
          <i className="bi bi-plus-circle me-1" /> New Driver
        </button>
      </PageHeader>

      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Total Drivers</div><div className="ui-tile-value">{(data?.drivers || []).length}</div></div>
        <div className="ui-tile border-green"><div className="ui-tile-label">Active</div><div className="ui-tile-value">{(data?.drivers || []).filter(d => d.is_active).length}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Total Deliveries</div><div className="ui-tile-value">{(data?.drivers || []).reduce((a, d) => a + d.deliveriesCount, 0)}</div></div>
      </div>

      <Card title={`All Drivers — ${(data?.drivers || []).length} records`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Name</th><th>Phone</th><th className="text-end">Opening</th><th className="text-end">Balance</th><th className="text-end">Deliveries</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {(data?.drivers || []).map((d) => (
              <tr key={d.id}>
                <td className="fw-bold">{d.name}</td>
                <td>{d.phone || "—"}</td>
                <td className="text-end">{money(d.opening_balance)}</td>
                <td className="text-end fw-bold text-danger">{money(d.balance)}</td>
                <td className="text-end">{num(d.deliveriesCount)}</td>
                <td>{d.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-success" onClick={() => setPaying(d)} title="Pay Driver"><i className="bi bi-cash" /></button>
                    <button className="btn btn-outline-warning" onClick={() => setEditing(d)} title="Edit"><i className="bi bi-pencil" /></button>
                    <button className="btn btn-outline-danger" onClick={() => toggleActive(d)} title={d.is_active ? "Deactivate" : "Activate"}><i className="bi bi-power" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Add Driver Modal */}
      <Modal open={showAdd} title="New Driver" onClose={() => setShowAdd(false)} footer={<button type="submit" form="addDriverForm" className="btn btn-warning">Save Driver</button>}>
        <form id="addDriverForm" onSubmit={onAdd}>
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label text-white-50">Driver Name *</label>
              <input name="name" className="form-control" required />
            </div>
            <div className="col-md-4">
              <label className="form-label text-white-50">Phone</label>
              <input name="phone" className="form-control" />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Opening Balance</label>
              <input name="opening_balance" type="number" className="form-control" defaultValue={0} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Driver Modal */}
      <Modal open={!!editing} title={`Edit Driver: ${editing?.name || ""}`} onClose={() => setEditing(null)} footer={<button type="submit" form="editDriverForm" className="btn btn-warning">Update Driver</button>}>
        {editing && (
          <form id="editDriverForm" onSubmit={onEdit}>
            <div className="row g-3">
              <div className="col-md-8">
                <label className="form-label text-white-50">Driver Name</label>
                <input name="name" className="form-control" defaultValue={editing.name} required />
              </div>
              <div className="col-md-4">
                <label className="form-label text-white-50">Phone</label>
                <input name="phone" className="form-control" defaultValue={editing.phone || ""} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Opening Balance</label>
                <input name="opening_balance" type="number" className="form-control" defaultValue={editing.opening_balance} />
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

      {/* Pay Driver Modal */}
      <Modal open={!!paying} title={`Pay Driver: ${paying?.name || ""}`} onClose={() => setPaying(null)} footer={<button type="submit" form="payDriverForm" className="btn btn-success">Record Payment</button>}>
        {paying && (
          <form id="payDriverForm" onSubmit={onPay}>
            <div className="alert alert-info">
              <strong>Current Balance:</strong> <span className="text-danger">{money(paying.balance)}</span>
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Payment Amount *</label>
              <input name="amount" type="number" step="0.01" className="form-control" required />
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Waive Off</label>
              <input name="waive_off" type="number" step="0.01" className="form-control" defaultValue={0} />
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
