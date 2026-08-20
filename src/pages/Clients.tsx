import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

type Client = {
  id: number;
  code: string;
  name: string;
  phone: string;
  address: string;
  category: string;
  opening_balance: number;
  balance: number;
  is_active: number;
  page_notes: string;
};

export default function Clients() {
  const { data, reload } = useApi<{
    clients: Client[];
    totalReceivables: number;
  }>("/clients");

  const [showAdd, setShowAdd] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [transferringClient, setTransferringClient] = useState<Client | null>(null);
  const [payingClient, setPayingClient] = useState<Client | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const clients = (data?.clients || []).filter(
    (c) =>
      (c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.code.toLowerCase().includes(q.toLowerCase())) &&
      (!catFilter || c.category === catFilter)
  );
  const categories = [...new Set((data?.clients || []).map((c) => c.category))].sort();

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/clients", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        code: fd.get("code"),
        phone: fd.get("phone"),
        address: fd.get("address"),
        category: fd.get("category"),
        opening_balance: fd.get("opening_balance"),
        page_notes: fd.get("page_notes")
      })
    });
    setShowAdd(false);
    reload();
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingClient) return;
    const fd = new FormData(e.currentTarget);
    await api(`/clients/${editingClient.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone"),
        address: fd.get("address"),
        category: fd.get("category"),
        is_active: fd.get("is_active") === "1" ? 1 : 0,
        page_notes: fd.get("page_notes")
      })
    });
    setEditingClient(null);
    reload();
  }

  async function onTransfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!transferringClient) return;
    const fd = new FormData(e.currentTarget);
    await api(`/clients/${transferringClient.id}/transfer`, {
      method: "POST",
      body: JSON.stringify({
        target_client_id: fd.get("target_client_id"),
        transfer_sales: fd.get("transfer_sales") === "on",
        transfer_payments: fd.get("transfer_payments") === "on",
        transfer_bookings: fd.get("transfer_bookings") === "on"
      })
    });
    setTransferringClient(null);
    reload();
  }

  async function onPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payingClient) return;
    const fd = new FormData(e.currentTarget);
    await api(`/clients/${payingClient.id}/payment`, {
      method: "POST",
      body: JSON.stringify({
        amount: fd.get("amount"),
        method: fd.get("method"),
        payment_account_id: fd.get("payment_account_id"),
        note: fd.get("note")
      })
    });
    setPayingClient(null);
    reload();
  }

  async function toggleActive(client: Client) {
    await api(`/clients/${client.id}`, {
      method: "POST",
      body: JSON.stringify({
        name: client.name,
        phone: client.phone,
        address: client.address,
        category: client.category,
        is_active: client.is_active ? 0 : 1,
        page_notes: client.page_notes
      })
    });
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-people" title="Clients & Ledgers" subtitle="Manage clients, track balances, record payments">
        <button className="btn btn-warning btn-pill fw-bold" onClick={() => setShowAdd(true)}>
          <i className="bi bi-plus-circle me-1" /> New Client
        </button>
      </PageHeader>

      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-indigo">
          <div className="ui-tile-label">Total Clients</div>
          <div className="ui-tile-value">{num(clients.length)}</div>
        </div>
        <div className="ui-tile border-green">
          <div className="ui-tile-label">Active</div>
          <div className="ui-tile-value">{num(clients.filter(c => c.is_active).length)}</div>
        </div>
        <div className="ui-tile border-red">
          <div className="ui-tile-label">Total Receivables</div>
          <div className="ui-tile-value">{money(data?.totalReceivables)}</div>
        </div>
      </div>

      <Card title={`All Clients — ${clients.length} records`}>
        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <input className="form-control" placeholder="Search clients..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="col-md-3">
            <select className="form-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Phone</th>
                <th className="text-end">Opening</th>
                <th className="text-end">Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td><span className="badge bg-dark border border-secondary text-warning">{c.code}</span></td>
                  <td>
                    <Link to={`/clients/${c.id}`} className="text-decoration-none fw-bold text-info">{c.name}</Link>
                  </td>
                  <td><span className="badge bg-secondary">{c.category}</span></td>
                  <td>{c.phone || "—"}</td>
                  <td className="text-end">{money(c.opening_balance)}</td>
                  <td className="text-end fw-bold">
                    <span className={c.balance > 0 ? "text-danger" : c.balance < 0 ? "text-success" : ""}>
                      {money(c.balance)}
                    </span>
                  </td>
                  <td>{c.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-info" onClick={() => setPayingClient(c)} title="Receive Payment">
                        <i className="bi bi-cash" />
                      </button>
                      <button className="btn btn-outline-warning" onClick={() => setEditingClient(c)} title="Edit">
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-outline-secondary" onClick={() => setTransferringClient(c)} title="Transfer">
                        <i className="bi bi-arrow-right-circle" />
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => toggleActive(c)} title={c.is_active ? "Deactivate" : "Activate"}>
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

      {/* Add Client Modal */}
      <Modal open={showAdd} title="New Client" onClose={() => setShowAdd(false)} footer={<button type="submit" form="addClientForm" className="btn btn-warning">Save Client</button>}>
        <form id="addClientForm" onSubmit={onAdd}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label text-white-50">Client Name *</label>
              <input name="name" className="form-control" required />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Client Code</label>
              <input name="code" className="form-control" placeholder="Auto-generated if empty" />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Phone</label>
              <input name="phone" className="form-control" />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Category</label>
              <input name="category" className="form-control" defaultValue="General" list="catList" />
              <datalist id="catList">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="col-12">
              <label className="form-label text-white-50">Address</label>
              <textarea name="address" className="form-control" rows={2} />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Opening Balance</label>
              <input name="opening_balance" type="number" className="form-control" defaultValue={0} />
            </div>
            <div className="col-md-6">
              <label className="form-label text-white-50">Page Notes</label>
              <input name="page_notes" className="form-control" placeholder="e.g. Steel Page 5, Cement Page 12" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Client Modal */}
      <Modal open={!!editingClient} title={`Edit Client: ${editingClient?.name || ""}`} onClose={() => setEditingClient(null)} footer={<button type="submit" form="editClientForm" className="btn btn-warning">Update Client</button>}>
        {editingClient && (
          <form id="editClientForm" onSubmit={onEdit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label text-white-50">Client Name</label>
                <input name="name" className="form-control" defaultValue={editingClient.name} required />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Phone</label>
                <input name="phone" className="form-control" defaultValue={editingClient.phone || ""} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Category</label>
                <input name="category" className="form-control" defaultValue={editingClient.category} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-white-50">Status</label>
                <select name="is_active" className="form-select" defaultValue={editingClient.is_active ? "1" : "0"}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label text-white-50">Address</label>
                <textarea name="address" className="form-control" rows={2} defaultValue={editingClient.address || ""} />
              </div>
              <div className="col-12">
                <label className="form-label text-white-50">Page Notes</label>
                <input name="page_notes" className="form-control" defaultValue={editingClient.page_notes || ""} />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Transfer Client Modal */}
      <Modal open={!!transferringClient} title={`Transfer Data: ${transferringClient?.name || ""}`} onClose={() => setTransferringClient(null)} footer={<button type="submit" form="transferForm" className="btn btn-warning">Transfer Data</button>}>
        {transferringClient && (
          <form id="transferForm" onSubmit={onTransfer}>
            <div className="alert alert-warning">
              <i className="bi bi-exclamation-triangle me-2" />
              Transfer all transactions from <strong>{transferringClient.name}</strong> to another client.
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Target Client *</label>
              <select name="target_client_id" className="form-select" required>
                <option value="">Select target client</option>
                {(data?.clients || []).filter(c => c.id !== transferringClient.id && c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label text-white-50">Transfer Options</label>
              <div className="form-check">
                <input name="transfer_sales" type="checkbox" className="form-check-input" id="transferSales" defaultChecked />
                <label className="form-check-label text-white-50" htmlFor="transferSales">Sales & Invoices</label>
              </div>
              <div className="form-check">
                <input name="transfer_payments" type="checkbox" className="form-check-input" id="transferPayments" defaultChecked />
                <label className="form-check-label text-white-50" htmlFor="transferPayments">Payments</label>
              </div>
              <div className="form-check">
                <input name="transfer_bookings" type="checkbox" className="form-check-input" id="transferBookings" defaultChecked />
                <label className="form-check-label text-white-50" htmlFor="transferBookings">Bookings</label>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal open={!!payingClient} title={`Receive Payment: ${payingClient?.name || ""}`} onClose={() => setPayingClient(null)} footer={<button type="submit" form="paymentForm" className="btn btn-success">Record Payment</button>}>
        {payingClient && (
          <form id="paymentForm" onSubmit={onPayment}>
            <div className="alert alert-info">
              <strong>Current Balance:</strong> <span className={payingClient.balance > 0 ? "text-danger" : "text-success"}>{money(payingClient.balance)}</span>
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
              <label className="form-label text-white-50">Receive In Account</label>
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
