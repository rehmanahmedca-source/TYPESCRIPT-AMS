import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

type Supplier = {
  id: number;
  code: string;
  name: string;
  phone: string;
  address: string;
  opening_balance: number;
  balance: number;
  is_active: number;
};

export default function Suppliers() {
  const { data, reload } = useApi<{
    suppliers: Supplier[];
    totalPayables: number;
  }>("/suppliers");

  const [showAdd, setShowAdd] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [q, setQ] = useState("");

  const suppliers = (data?.suppliers || []).filter(
    (s) =>
      s.name.toLowerCase().includes(q.toLowerCase()) ||
      s.code.toLowerCase().includes(q.toLowerCase())
  );

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/suppliers", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone"),
        address: fd.get("address"),
        opening_balance: fd.get("opening_balance")
      })
    });
    setShowAdd(false);
    reload();
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSupplier) return;
    const fd = new FormData(e.currentTarget);
    await api(`/suppliers/${editingSupplier.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone"),
        address: fd.get("address"),
        is_active: fd.get("is_active") === "1" ? 1 : 0
      })
    });
    setEditingSupplier(null);
    reload();
  }

  async function onPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payingSupplier) return;
    const fd = new FormData(e.currentTarget);
    await api(`/suppliers/${payingSupplier.id}/payment`, {
      method: "POST",
      body: JSON.stringify({
        amount: fd.get("amount"),
        method: fd.get("method"),
        payment_account_id: fd.get("payment_account_id"),
        note: fd.get("note")
      })
    });
    setPayingSupplier(null);
    reload();
  }

  async function toggleActive(supplier: Supplier) {
    await api(`/suppliers/${supplier.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: supplier.name,
        phone: supplier.phone,
        address: supplier.address,
        is_active: supplier.is_active ? 0 : 1
      })
    });
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-building" title="Suppliers & Ledgers" subtitle="Manage suppliers, track payables, record payments">
        <button className="btn btn-warning btn-pill fw-bold" onClick={() => setShowAdd(true)}>
          <i className="bi bi-plus-circle me-1" /> New Supplier
        </button>
      </PageHeader>

      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-indigo">
          <div className="ui-tile-label">Total Suppliers</div>
          <div className="ui-tile-value">{num(suppliers.length)}</div>
        </div>
        <div className="ui-tile border-green">
          <div className="ui-tile-label">Active</div>
          <div className="ui-tile-value">{num(suppliers.filter(s => s.is_active).length)}</div>
        </div>
        <div className="ui-tile border-red">
          <div className="ui-tile-label">Total Payables</div>
          <div className="ui-tile-value">{money(data?.totalPayables)}</div>
        </div>
      </div>

      <Card title={`All Suppliers — ${suppliers.length} records`}>
        <div className="mb-3">
          <input className="form-control" placeholder="Search suppliers..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Phone</th>
                <th className="text-end">Opening</th>
                <th className="text-end">Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td><span className="badge bg-dark border border-secondary text-warning">{s.code}</span></td>
                  <td>
                    <Link to={`/suppliers/${s.id}`} className="text-decoration-none fw-bold text-info">{s.name}</Link>
                  </td>
                  <td>{s.phone || "—"}</td>
                  <td className="text-end">{money(s.opening_balance)}</td>
                  <td className="text-end fw-bold">
                    <span className={s.balance > 0 ? "text-danger" : s.balance < 0 ? "text-success" : ""}>
                      {money(s.balance)}
                    </span>
                  </td>
                  <td>{s.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-success" onClick={() => setPayingSupplier(s)} title="Pay Supplier">
                        <i className="bi bi-cash" />
                      </button>
                      <button className="btn btn-outline-warning" onClick={() => setEditingSupplier(s)} title="Edit">
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => toggleActive(s)} title={s.is_active ? "Deactivate" : "Activate"}>
                        <i className="bi bi-power" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Supplier Modal */}
      <Modal open={showAdd} title="New Supplier" onClose={() => setShowAdd(false)} footer={<button type="submit" form="addSupplierForm" className="btn btn-warning">Save Supplier</button>}>
        <form id="addSupplierForm" onSubmit={onAdd}>
          <div className="row g-3">
            <div className="col-md-12">
              <label className="form-label text-white-50">Supplier Name *</label>
              <input name="name" className="form-control" required />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Phone</label>
              <input name="phone" className="form-control" />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Opening Balance</label>
              <input name="opening_balance" type="number" className="form-control" defaultValue={0} />
            </div>
            <div className="col-12">
              <label className="form-label text-white-50">Address</label>
              <textarea name="address" className="form-control" rows={2} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal open={!!editingSupplier} title={`Edit Supplier: ${editingSupplier?.name || ""}`} onClose={() => setEditingSupplier(null)} footer={<button type="submit" form="editSupplierForm" className="btn btn-warning">Update Supplier</button>}>
        {editingSupplier && (
          <form id="editSupplierForm" onSubmit={onEdit}>
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label text-white-50">Supplier Name</label>
                <input name="name" className="form-control" defaultValue={editingSupplier.name} required />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Phone</label>
                <input name="phone" className="form-control" defaultValue={editingSupplier.phone || ""} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Status</label>
                <select name="is_active" className="form-select" defaultValue={editingSupplier.is_active ? "1" : "0"}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label text-white-50">Address</label>
                <textarea name="address" className="form-control" rows={2} defaultValue={editingSupplier.address || ""} />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal open={!!payingSupplier} title={`Pay Supplier: ${payingSupplier?.name || ""}`} onClose={() => setPayingSupplier(null)} footer={<button type="submit" form="paymentForm" className="btn btn-success">Record Payment</button>}>
        {payingSupplier && (
          <form id="paymentForm" onSubmit={onPayment}>
            <div className="alert alert-info">
              <strong>Current Balance:</strong> <span className={payingSupplier.balance > 0 ? "text-danger" : "text-success"}>{money(payingSupplier.balance)}</span>
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Amount *</label>
              <input name="amount" type="number" step="0.01" className="form-control" required />
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Payment Method</label>
              <select name="method" className="form-select" defaultValue="Cash">
                <option>Cash</option>
                <option>Bank</option>
                <option>Cheque</option>
                <option>Online Transfer</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Pay From Account</label>
              <select name="payment_account_id" className="form-select">
                <option value="">Select account</option>
                {/* Will be populated from API */}
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
