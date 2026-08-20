import { useState, useEffect, FormEvent } from "react";
import { api } from "../../api";
import { UserRow } from "./types";
import { Modal } from "../../components/ui";

const ALL_PERMISSIONS: { key: keyof UserRow; label: string; group: string }[] = [
  // Dashboards & Visualizations
  { key: "can_view_dashboard", label: "Executive Dashboard", group: "Dashboards & Views" },
  { key: "can_view_daily", label: "Daily Summary & Breakdown", group: "Dashboards & Views" },
  { key: "can_view_history", label: "Historical Activity Trail", group: "Dashboards & Views" },
  { key: "can_view_reports", label: "Analytics & Reports", group: "Dashboards & Views" },
  { key: "can_view_cash_flow", label: "Cash Flow & Bank Ledger", group: "Dashboards & Views" },

  // Stock & Inventory
  { key: "can_view_stock", label: "View Material Stock", group: "Inventory & Materials" },
  { key: "can_manage_materials", label: "Manage Materials Catalog", group: "Inventory & Materials" },
  { key: "can_manage_grn", label: "GRN & Inward Shipments", group: "Inventory & Materials" },
  { key: "can_manage_bookings", label: "Client Bookings Management", group: "Sales & Operations" },
  { key: "can_manage_sales", label: "Direct Sales & Invoices", group: "Sales & Operations" },
  { key: "can_view_delivery_rent", label: "Delivery Rents & Drivers", group: "Sales & Operations" },

  // Finance & Ledgers
  { key: "can_manage_payments", label: "Customer & Supplier Payments", group: "Finance & Accounting" },
  { key: "can_manage_pending_bills", label: "Pending Bills Reconciliation", group: "Finance & Accounting" },
  { key: "can_view_client_ledger", label: "Client Financial Ledger", group: "Finance & Accounting" },
  { key: "can_view_supplier_ledger", label: "Supplier Financial Ledger", group: "Finance & Accounting" },
  { key: "can_view_decision_ledger", label: "Decision & Audit Matrix", group: "Finance & Accounting" },
  { key: "can_manage_accounts", label: "Chart of Accounts / Banking", group: "Finance & Accounting" },

  // Directory & Administration
  { key: "can_manage_clients", label: "Clients Directory", group: "Directory & Master Data" },
  { key: "can_manage_suppliers", label: "Suppliers Directory", group: "Directory & Master Data" },
  { key: "can_manage_delivery_persons", label: "Drivers / Transport List", group: "Directory & Master Data" },
  { key: "can_manage_directory", label: "General Directory Access", group: "Directory & Master Data" },
  { key: "can_import_export", label: "Excel XLSX Import / Export", group: "System Administration" },
  { key: "can_manage_notifications", label: "Manage System Alerts", group: "System Administration" },
  { key: "can_access_settings", label: "Access System Settings", group: "System Administration" },
  { key: "restrict_backdated_edit", label: "Restrict Backdated Edits", group: "System Administration" }
];

export function UsersTab({ currentUsername }: { currentUsername?: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");

  // Add User Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newStatus, setNewStatus] = useState<"active" | "inactive">("active");
  const [newPermissions, setNewPermissions] = useState<Record<string, number>>({});
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit User Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [editPermissions, setEditPermissions] = useState<Record<string, number>>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete User Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; users: UserRow[] }>("/settings/users");
      if (res.ok && res.users) {
        setUsers(res.users);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to load users." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleSelectAllNew(val: number) {
    const updated: Record<string, number> = {};
    ALL_PERMISSIONS.forEach((p) => {
      updated[p.key] = val;
    });
    setNewPermissions(updated);
  }

  function handleSelectAllEdit(val: number) {
    const updated: Record<string, number> = {};
    ALL_PERMISSIONS.forEach((p) => {
      updated[p.key] = val;
    });
    setEditPermissions(updated);
  }

  async function handleAddUser(e: FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    setSubmittingAdd(true);
    try {
      const body = {
        username: newUsername.trim(),
        password: newPassword.trim(),
        role: newRole,
        status: newStatus,
        ...newPermissions
      };
      const res = await api<{ ok: boolean; id: number; username: string; error?: string }>("/settings/users", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setAddModalOpen(false);
        setNewUsername("");
        setNewPassword("");
        setNewPermissions({});
        setFeedback({ type: "success", text: `User "${res.username}" created successfully.` });
        loadUsers();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to create user." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to create user." });
    } finally {
      setSubmittingAdd(false);
    }
  }

  function openEditModal(user: UserRow) {
    setEditingUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPassword("");
    const perms: Record<string, number> = {};
    ALL_PERMISSIONS.forEach((p) => {
      perms[p.key] = Number(user[p.key] || 0);
    });
    setEditPermissions(perms);
    setEditModalOpen(true);
  }

  async function handleEditUser(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSubmittingEdit(true);
    try {
      const body: any = {
        role: editRole,
        status: editStatus,
        ...editPermissions
      };
      if (editPassword.trim()) {
        body.password = editPassword.trim();
      }
      const res = await api<{ ok: boolean; id: number; username: string; error?: string }>(
        `/settings/users/${editingUser.id}`,
        {
          method: "POST",
          body: JSON.stringify(body)
        }
      );
      if (res.ok) {
        setEditModalOpen(false);
        setEditingUser(null);
        setFeedback({ type: "success", text: `User "${res.username}" updated successfully.` });
        loadUsers();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to update user." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update user." });
    } finally {
      setSubmittingEdit(false);
    }
  }

  async function handleToggleStatus(user: UserRow) {
    if (user.username === "Admin") {
      setFeedback({ type: "error", text: "Root Admin cannot be deactivated." });
      return;
    }
    try {
      const res = await api<{ ok: boolean; status: "active" | "inactive"; error?: string }>(
        `/settings/users/${user.id}/toggle`,
        { method: "POST" }
      );
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: res.status } : u))
        );
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to toggle status." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to toggle status." });
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;
    setSubmittingDelete(true);
    try {
      const res = await api<{ ok: boolean; message?: string; error?: string }>(
        `/settings/users/${userToDelete.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDeleteModalOpen(false);
        setUserToDelete(null);
        setFeedback({ type: "success", text: `User "${userToDelete.username}" deleted successfully.` });
        loadUsers();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to delete user." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to delete user." });
    } finally {
      setSubmittingDelete(false);
    }
  }

  const filtered = users.filter((u) => {
    const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" ? true : u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Group permissions by category for modal
  const groups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));

  return (
    <div>
      <div className="ui-card">
        <div className="ui-card-header">
          <div className="d-flex align-items-center gap-2">
            <h5>
              <i className="bi bi-people-fill text-warning" /> User Accounts & Role-Based Permissions
            </h5>
            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
              {users.length} accounts
            </span>
          </div>
          <button
            type="button"
            className="btn btn-warning btn-sm fw-bold d-flex align-items-center gap-2"
            onClick={() => {
              handleSelectAllNew(1);
              setAddModalOpen(true);
            }}
          >
            <i className="bi bi-person-plus-fill" /> Create User Account
          </button>
        </div>

        <div className="ui-card-body">
          {feedback && (
            <div
              className={`alert ${
                feedback.type === "success" ? "alert-success" : "alert-danger"
              } py-2 px-3 mb-3 d-flex align-items-center justify-content-between`}
            >
              <div className="d-flex align-items-center gap-2">
                <i className={`bi ${feedback.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white small"
                onClick={() => setFeedback(null)}
              />
            </div>
          )}

          {/* Search & Filter */}
          <div className="row g-2 mb-3">
            <div className="col-md-7">
              <div className="input-group">
                <span className="input-group-text bg-body-tertiary border-secondary border-opacity-25 text-secondary">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search user accounts by username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-outline-secondary" onClick={() => setSearch("")}>
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
            </div>
            <div className="col-md-5 d-flex gap-2 justify-content-md-end">
              <select
                className="form-select w-auto"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="user">Operator / User</option>
              </select>
              <button className="btn btn-outline-secondary" title="Reload list" onClick={loadUsers}>
                <i className="bi bi-arrow-clockwise" />
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="table-responsive border border-secondary border-opacity-25 rounded-3">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-dark text-secondary small text-uppercase">
                <tr>
                  <th style={{ width: "70px" }}>ID</th>
                  <th>Username</th>
                  <th style={{ width: "130px" }}>Role</th>
                  <th style={{ width: "120px" }}>Status</th>
                  <th>Granted Capabilities</th>
                  <th style={{ width: "160px" }} className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-secondary">
                      <span className="spinner-border spinner-border-sm me-2 text-warning" /> Loading accounts...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-secondary">
                      {search ? "No user accounts matched your search criteria." : "No accounts found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const grantedCount = ALL_PERMISSIONS.filter((p) => u[p.key] === 1).length;
                    const isRootAdmin = u.username === "Admin";
                    const isSelf = u.username === currentUsername;

                    return (
                      <tr key={u.id}>
                        <td className="text-secondary fw-bold">#{u.id}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="rounded-circle bg-warning bg-opacity-10 text-warning d-flex align-items-center justify-content-center fw-bold"
                              style={{ width: "32px", height: "32px", fontSize: "0.85rem" }}
                            >
                              {u.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="fw-bold text-light d-flex align-items-center gap-2">
                                {u.username}
                                {isSelf && (
                                  <span className="badge bg-warning-subtle text-warning border border-warning-subtle py-0 px-1 small">
                                    You
                                  </span>
                                )}
                              </div>
                              {u.created_at && (
                                <div className="text-secondary small" style={{ fontSize: "0.72rem" }}>
                                  Created {u.created_at.split("T")[0]}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              u.role === "admin"
                                ? "bg-warning-subtle text-warning border border-warning-subtle"
                                : "bg-info-subtle text-info border border-info-subtle"
                            } px-2 py-1 text-capitalize`}
                          >
                            <i className={`bi ${u.role === "admin" ? "bi-shield-shaded" : "bi-person"} me-1`} />
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              u.status === "active"
                                ? "bg-success-subtle text-success border border-success-subtle"
                                : "bg-danger-subtle text-danger border border-danger-subtle"
                            } px-2 py-1 text-capitalize`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: "6px", maxWidth: "120px" }}>
                              <div
                                className="progress-bar bg-warning"
                                style={{ width: `${(grantedCount / ALL_PERMISSIONS.length) * 100}%` }}
                              />
                            </div>
                            <span className="text-secondary small">
                              {grantedCount} / {ALL_PERMISSIONS.length} modules
                            </span>
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              title="Edit Permissions / Password"
                              onClick={() => openEditModal(u)}
                            >
                              <i className="bi bi-sliders" />
                            </button>
                            {!isRootAdmin && (
                              <>
                                <button
                                  type="button"
                                  className={`btn ${
                                    u.status === "active" ? "btn-outline-warning" : "btn-outline-success"
                                  }`}
                                  title={u.status === "active" ? "Deactivate User" : "Activate User"}
                                  onClick={() => handleToggleStatus(u)}
                                >
                                  <i className={`bi ${u.status === "active" ? "bi-person-slash" : "bi-person-check"}`} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger"
                                  title="Delete User"
                                  onClick={() => {
                                    setUserToDelete(u);
                                    setDeleteModalOpen(true);
                                  }}
                                >
                                  <i className="bi bi-trash" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Create User */}
      <Modal open={addModalOpen} size="lg" title="Create New System User" onClose={() => setAddModalOpen(false)}>
        <form onSubmit={handleAddUser}>
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label fw-bold small text-secondary">
                Username <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. manager1, sales_clerk"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-bold small text-secondary">
                Initial Password <span className="text-danger">*</span>
              </label>
              <input
                type="password"
                required
                minLength={4}
                className="form-control"
                placeholder="Min 4 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-bold small text-secondary">Account Role</label>
              <select
                className="form-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
              >
                <option value="user">Operator / User (Restricted to granted modules)</option>
                <option value="admin">Administrator (Superuser access)</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-bold small text-secondary">Account Initial Status</label>
              <select
                className="form-select"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
              >
                <option value="active">Active (Permit immediate login)</option>
                <option value="inactive">Inactive / Suspended</option>
              </select>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between mb-3 border-top pt-3 border-secondary border-opacity-25">
            <h6 className="mb-0 text-warning fw-bold">
              <i className="bi bi-shield-lock me-2" /> Granular Permission Matrix
            </h6>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => handleSelectAllNew(1)}
              >
                Grant All
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => handleSelectAllNew(0)}
              >
                Revoke All
              </button>
            </div>
          </div>

          <div className="row g-3">
            {groups.map((group) => {
              const permsInGroup = ALL_PERMISSIONS.filter((p) => p.group === group);
              return (
                <div key={group} className="col-md-6">
                  <div className="p-3 rounded-3 bg-body-tertiary border border-secondary border-opacity-25 h-100">
                    <div className="fw-bold small text-warning mb-2 border-bottom pb-1 border-secondary border-opacity-25">
                      {group}
                    </div>
                    <div className="d-flex flex-column gap-2">
                      {permsInGroup.map((p) => (
                        <div key={p.key} className="form-check form-switch small">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id={`add_perm_${p.key}`}
                            checked={!!newPermissions[p.key]}
                            onChange={(e) =>
                              setNewPermissions({ ...newPermissions, [p.key]: e.target.checked ? 1 : 0 })
                            }
                          />
                          <label className="form-check-label text-light" htmlFor={`add_perm_${p.key}`}>
                            {p.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="d-flex justify-content-end gap-2 pt-4 border-top mt-4 border-secondary border-opacity-25">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setAddModalOpen(false)}
              disabled={submittingAdd}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-warning fw-bold px-4"
              disabled={submittingAdd || !newUsername.trim() || !newPassword.trim()}
            >
              {submittingAdd ? "Creating Account..." : "Create User"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit User */}
      <Modal open={editModalOpen} size="lg" title={`Configure User: ${editingUser?.username}`} onClose={() => setEditModalOpen(false)}>
        {editingUser && (
          <form onSubmit={handleEditUser}>
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <label className="form-label fw-bold small text-secondary">Username</label>
                <input type="text" disabled className="form-control bg-body-tertiary" value={editingUser.username} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-bold small text-secondary">Role</label>
                <select
                  className="form-select"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                >
                  <option value="user">Operator / User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-bold small text-secondary">Status</label>
                <select
                  className="form-select"
                  disabled={editingUser.username === "Admin"}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Suspended</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label fw-bold small text-secondary">
                  Reset Password <span className="text-muted fw-normal">(Leave blank to keep unchanged)</span>
                </label>
                <input
                  type="password"
                  minLength={4}
                  className="form-control"
                  placeholder="Enter new password if changing..."
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-3 border-top pt-3 border-secondary border-opacity-25">
              <h6 className="mb-0 text-warning fw-bold">
                <i className="bi bi-shield-lock me-2" /> Granular Permission Matrix
              </h6>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handleSelectAllEdit(1)}
                >
                  Grant All
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => handleSelectAllEdit(0)}
                >
                  Revoke All
                </button>
              </div>
            </div>

            <div className="row g-3">
              {groups.map((group) => {
                const permsInGroup = ALL_PERMISSIONS.filter((p) => p.group === group);
                return (
                  <div key={group} className="col-md-6">
                    <div className="p-3 rounded-3 bg-body-tertiary border border-secondary border-opacity-25 h-100">
                      <div className="fw-bold small text-warning mb-2 border-bottom pb-1 border-secondary border-opacity-25">
                        {group}
                      </div>
                      <div className="d-flex flex-column gap-2">
                        {permsInGroup.map((p) => (
                          <div key={p.key} className="form-check form-switch small">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              id={`edit_perm_${p.key}`}
                              checked={!!editPermissions[p.key]}
                              onChange={(e) =>
                                setEditPermissions({ ...editPermissions, [p.key]: e.target.checked ? 1 : 0 })
                              }
                            />
                            <label className="form-check-label text-light" htmlFor={`edit_perm_${p.key}`}>
                              {p.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="d-flex justify-content-end gap-2 pt-4 border-top mt-4 border-secondary border-opacity-25">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setEditModalOpen(false)}
                disabled={submittingEdit}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-warning fw-bold px-4" disabled={submittingEdit}>
                {submittingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Confirm Delete User */}
      <Modal open={deleteModalOpen} title="Confirm Account Deletion" onClose={() => setDeleteModalOpen(false)}>
        {userToDelete && (
          <div>
            <p className="text-light">
              Are you sure you want to permanently delete the user account{" "}
              <strong className="text-warning">{userToDelete.username}</strong>?
            </p>
            <p className="text-secondary small">
              This action cannot be undone. All sessions for this account will be invalidated.
            </p>
            <div className="d-flex justify-content-end gap-2 pt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setDeleteModalOpen(false)}
                disabled={submittingDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger fw-bold"
                onClick={handleDeleteUser}
                disabled={submittingDelete}
              >
                {submittingDelete ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
