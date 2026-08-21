import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { rs } from "../format";
import { useApi } from "../useApi";

type Account = {
  id: number;
  name: string;
  category: string;
  account_type: string;
  source_category?: string;
  live_balance?: number;
  balance?: number;
  bank_name?: string;
  account_holder_name?: string;
  account_number?: string;
  branch_code?: string;
  note?: string;
  is_active?: number;
};

export default function ManageAccounts() {
  const { data, reload } = useApi<{ accounts: Account[]; categories: { id: number; name: string }[] }>("/accounts");
  const [groupOpen, setGroupOpen] = useState(false);
  const [edit, setEdit] = useState<Account | null>(null);

  async function addGroup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/accounts/categories", { method: "POST", body: JSON.stringify({ name: fd.get("name"), note: fd.get("note") }) });
    setGroupOpen(false);
    reload();
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;
    const fd = new FormData(e.currentTarget);
    await api(`/accounts/${edit.id}/update`, {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(fd.entries()))
    });
    setEdit(null);
    reload();
  }

  async function toggle(id: number) {
    await api(`/accounts/${id}/toggle`, { method: "POST" });
    reload();
  }

  async function remove(id: number) {
    if (!confirm("Delete this account? Only unused accounts can be removed.")) return;
    await api(`/accounts/${id}/delete`, { method: "POST" });
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-gear" title="Manage Accounts" subtitle="Create, edit, activate and group cash and bank accounts">
        <Link to="/accounts" className="btn btn-outline-secondary btn-sm">Back</Link>
        <Link to="/accounts/accounts/add" className="btn btn-warning btn-sm fw-bold">Add Account</Link>
        <button className="btn btn-primary btn-sm" onClick={() => setGroupOpen(true)}>Create Transaction Group</button>
      </PageHeader>
      <Card title="Accounts" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Name</th><th>Type</th><th>Channel</th><th className="text-end">Balance</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
          <tbody>
            {(data?.accounts || []).map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="fw-bold">{a.name}</div>
                  <div className="small text-muted">{a.source_category || a.bank_name || ""}</div>
                </td>
                <td>{a.account_type}</td>
                <td>{a.category}</td>
                <td className="text-end">{rs(a.live_balance ?? a.balance)}</td>
                <td>{a.is_active === 0 ? <span className="badge bg-secondary">Inactive</span> : <span className="badge bg-success">Active</span>}</td>
                <td className="text-end">
                  <Link className="btn btn-sm btn-outline-success me-1" to={`/accounts/${a.id}/reconcile`}>Reconcile</Link>
                  <button className="btn btn-sm btn-outline-warning me-1" onClick={() => setEdit(a)}>Edit</button>
                  <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => toggle(a.id)}>Toggle</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(a.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal open={groupOpen} title="Create Transaction Group" onClose={() => setGroupOpen(false)} footer={<button form="grpForm" className="btn btn-primary" type="submit">Save</button>}>
        <form id="grpForm" onSubmit={addGroup}>
          <label className="form-label">Name</label>
          <input name="name" className="form-control mb-3" placeholder="e.g. Company, Own Funds, Clients, External, Loan" required />
          <label className="form-label">Note</label>
          <textarea name="note" className="form-control" placeholder="What this group is used for..." />
        </form>
      </Modal>
      <Modal open={!!edit} title="Edit Account" onClose={() => setEdit(null)} footer={<button form="editAcc" className="btn btn-warning" type="submit">Save</button>}>
        {edit && (
          <form id="editAcc" onSubmit={saveEdit}>
            <label className="form-label">Name</label>
            <input name="name" className="form-control mb-2" defaultValue={edit.name} required />
            <label className="form-label">Category</label>
            <select name="category" className="form-select mb-2" defaultValue={edit.category}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
            <label className="form-label">Account Type</label>
            <input name="account_type" className="form-control mb-2" defaultValue={edit.account_type} />
            <label className="form-label">Source Category</label>
            <input name="source_category" className="form-control mb-2" defaultValue={edit.source_category || ""} />
            <label className="form-label">Balance</label>
            <input name="balance" type="number" step="0.01" className="form-control mb-2" defaultValue={edit.live_balance ?? edit.balance} />
            <label className="form-label">Bank Name</label>
            <input name="bank_name" className="form-control mb-2" defaultValue={edit.bank_name || ""} />
            <label className="form-label">Account Holder</label>
            <input name="account_holder_name" className="form-control mb-2" defaultValue={edit.account_holder_name || ""} />
            <label className="form-label">Account Number</label>
            <input name="account_number" className="form-control mb-2" defaultValue={edit.account_number || ""} />
            <label className="form-label">Branch Code</label>
            <input name="branch_code" className="form-control mb-2" defaultValue={edit.branch_code || ""} />
            <label className="form-label">Note</label>
            <textarea name="note" className="form-control" defaultValue={edit.note || ""} />
          </form>
        )}
      </Modal>
    </div>
  );
}
