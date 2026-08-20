import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Modal, Empty } from "../components/ui";
import { api } from "../api";

/* ---------------- types ---------------- */

type SettingsRow = {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  currency?: string;
  tax_rate?: number;
  ui_theme?: string;
  allow_global_negative_stock?: number;
};

type LoginSession = {
  id: number;
  username: string;
  role: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  ended_at: string | null;
  state: string;
};

type ReconIssue = {
  salesWithoutItems: number;
  bookingsWithoutItems: number;
  orphanedPayments: number;
  orphanedEntries: number;
  paymentAccountsMissing: number;
  negativeStock: number;
};

type ReconScanResult = {
  issues: ReconIssue;
  negativeStockMaterials: { material: string; balance: number }[];
  totalIssues: number;
  scannedAt: string;
};

type MaterialCategory = {
  id: number;
  name: string;
  is_active: number | boolean;
  materials_count: number;
  total_stock: number;
};

type PermissionUser = {
  id: number;
  username: string;
  role: string | null;
  status: string | null;
  [key: string]: unknown;
};

type BackupInfo = {
  dbPath: string;
  dbSize: number;
  backupDir: string;
  backups: { name: string; size: number; mtime: string }[];
  createdAt: string;
};

const PERMISSION_MATRIX: { key: string; label: string; defaultLabel?: string }[] = [
  { key: "can_view_dashboard", label: "Dashboard" },
  { key: "can_view_stock", label: "Stock Summary" },
  { key: "can_view_daily", label: "Daily Breakdown" },
  { key: "can_manage_grn", label: "GRN" },
  { key: "can_manage_sales", label: "Direct Sales" },
  { key: "can_manage_bookings", label: "Bookings" },
  { key: "can_manage_payments", label: "Payments" },
  { key: "can_view_client_ledger", label: "Client Ledger" },
  { key: "can_view_supplier_ledger", label: "Supplier Ledger" },
  { key: "can_view_delivery_rent", label: "Delivery Rents" },
  { key: "can_view_reports", label: "Reports" },
  { key: "can_manage_accounts", label: "Accounts Hub" },
  { key: "can_view_cash_flow", label: "Cash Flow" },
  { key: "can_manage_pending_bills", label: "Pending Bills" },
  { key: "can_manage_clients", label: "Clients" },
  { key: "can_manage_suppliers", label: "Suppliers" },
  { key: "can_manage_materials", label: "Materials" },
  { key: "can_manage_delivery_persons", label: "Drivers" },
  { key: "can_import_export", label: "Import & Export" },
  { key: "can_access_settings", label: "Settings" }
];

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

function formatStamp(s?: string | null): string {
  if (!s) return "—";
  const raw = String(s).replace(" ", "T");
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString("en-GB", { timeZone: "Asia/Karachi", hour12: false }).replace(",", "");
}

/* ---------------- component ---------------- */

export default function Settings() {
  const [s, setS] = useState<SettingsRow>({});
  const [msg, setMsg] = useState("");

  // security
  const [newPassword, setNewPassword] = useState("");
  const [securityMsg, setSecurityMsg] = useState("");
  const [loginUser, setLoginUser] = useState("Admin");
  const [liveLoginMsg, setLiveLoginMsg] = useState("");
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [sessionMeta, setSessionMeta] = useState({ activeCount: 0, todayCount: 0, totalCount: 0 });

  // backup
  const [backup, setBackup] = useState<BackupInfo | null>(null);
  const [backupMsg, setBackupMsg] = useState("");
  const [restoreMsg, setRestoreMsg] = useState("");
  const [restoring, setRestoring] = useState(false);

  // reconciliation
  const [scan, setScan] = useState<ReconScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [purgingKind, setPurgingKind] = useState<string | null>(null);

  // material categories
  const [cats, setCats] = useState<MaterialCategory[]>([]);
  const [showCat, setShowCat] = useState(false);
  const [editingCat, setEditingCat] = useState<MaterialCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", is_active: 1 });
  const [catMsg, setCatMsg] = useState("");

  // users
  const [users, setUsers] = useState<PermissionUser[]>([]);
  const [userStats, setUserStats] = useState({ active: 0, admins: 0, total: 0 });
  const [editingUser, setEditingUser] = useState<PermissionUser | null>(null);
  const [userMsg, setUserMsg] = useState("");

  /* --------------- initial loads --------------- */
  useEffect(() => {
    api<{ settings: SettingsRow }>("/bootstrap").then((d) => setS(d.settings || {}));
  }, []);

  function reloadSessions() {
    api<{ sessions: LoginSession[]; activeCount: number; todayCount: number; totalCount: number }>(
      "/security/login-history"
    ).then((d) => {
      setSessions(d.sessions || []);
      setSessionMeta({
        activeCount: d.activeCount || 0,
        todayCount: d.todayCount || 0,
        totalCount: d.totalCount || 0
      });
    });
  }

  function reloadBackup() {
    api<BackupInfo>("/backup/info").then(setBackup);
  }

  function reloadCats() {
    api<{ categories: MaterialCategory[] }>("/material-categories").then((d) => setCats(d.categories || []));
  }

  function reloadUsers() {
    api<{ users: PermissionUser[]; active: number; admins: number; total: number }>("/users").then((d) => {
      setUsers(d.users || []);
      setUserStats({ active: d.active || 0, admins: d.admins || 0, total: d.total || 0 });
    });
  }

  useEffect(() => {
    reloadSessions();
    reloadBackup();
    reloadCats();
    reloadUsers();
  }, []);

  /* --------------- handlers --------------- */
  async function onSaveGeneral(e: FormEvent) {
    e.preventDefault();
    try {
      const out = await api<{ settings: SettingsRow }>("/settings", {
        method: "POST",
        body: JSON.stringify(s)
      });
      setS(out.settings || s);
      setMsg("Settings saved");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onUpdatePassword() {
    if (!newPassword) {
      setSecurityMsg("Enter a new password first");
      return;
    }
    try {
      await api("/users/1/reset-password", {
        method: "POST",
        body: JSON.stringify({ password: newPassword })
      });
      setSecurityMsg("Password updated");
      setNewPassword("");
      setTimeout(() => setSecurityMsg(""), 3000);
    } catch (err) {
      setSecurityMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onLiveLogin() {
    if (!loginUser) return;
    try {
      const out = await api<{ message: string; timestamp: string }>("/security/live-login", {
        method: "POST",
        body: JSON.stringify({ username: loginUser })
      });
      setLiveLoginMsg(out.message || "Live login refreshed");
      setTimeout(() => setLiveLoginMsg(""), 4000);
      reloadSessions();
    } catch (err) {
      setLiveLoginMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onDownloadBackup() {
    try {
      const out = await api<{ filename: string; size: number }>("/backup/db", { method: "POST" });
      setBackupMsg(`Snapshot saved: ${out.filename} (${formatBytes(out.size || 0)})`);
      reloadBackup();
      setTimeout(() => setBackupMsg(""), 5000);
    } catch (err) {
      setBackupMsg(err instanceof Error ? err.message : "Backup failed");
    }
  }

  async function onRestoreBackup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRestoring(true);
    setRestoreMsg("");
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch("/api/backup/restore", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      setRestoreMsg(`${data.message}. The page will reload to apply.`);
      setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
      setRestoreMsg(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  async function onScan() {
    setScanning(true);
    try {
      const out = await api<ReconScanResult>("/reconciliation/scan");
      setScan(out);
    } catch (err) {
      setScan(null);
      alert(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function onPurge(kind: string) {
    const map: Record<string, string> = {
      "sales-without-items": "sales without line items",
      "bookings-without-items": "bookings without line items",
      "orphaned-payments": "orphaned payments",
      "orphaned-entries": "orphan ledger entries",
      "payment-accounts-missing": "broken payment→account links"
    };
    if (!confirm(`Purge all ${map[kind] || kind}? This will void the affected records.`)) return;
    setPurgingKind(kind);
    try {
      await api(`/reconciliation/purge/${kind}`, { method: "POST" });
      await onScan();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Purge failed");
    } finally {
      setPurgingKind(null);
    }
  }

  function openAddCategory() {
    setEditingCat(null);
    setCatForm({ name: "", is_active: 1 });
    setShowCat(true);
  }
  function openEditCategory(c: MaterialCategory) {
    setEditingCat(c);
    setCatForm({ name: c.name, is_active: c.is_active ? 1 : 0 });
    setShowCat(true);
  }
  async function saveCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    try {
      if (editingCat) {
        await api(`/material-categories/${editingCat.id}`, {
          method: "POST",
          body: JSON.stringify({ name: catForm.name, is_active: catForm.is_active })
        });
        setCatMsg("Category updated");
      } else {
        await api("/material-categories", {
          method: "POST",
          body: JSON.stringify({ name: catForm.name, is_active: catForm.is_active })
        });
        setCatMsg("Category added");
      }
      setShowCat(false);
      reloadCats();
      setTimeout(() => setCatMsg(""), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    }
  }
  async function toggleCategory(c: MaterialCategory) {
    try {
      await api(`/material-categories/${c.id}/toggle`, { method: "POST" });
      reloadCats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  async function toggleUserStatus(u: PermissionUser) {
    try {
      await api(`/users/${u.id}/toggle-active`, { method: "POST" });
      reloadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  async function saveUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingUser) return;
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      username: fd.get("username"),
      role: fd.get("role"),
      status: fd.get("status")
    };
    for (const col of PERMISSION_MATRIX) {
      body[col.key] = fd.get(col.key) === "1" ? 1 : 0;
    }
    try {
      await api(`/users/${editingUser.id}`, { method: "POST", body: JSON.stringify(body) });
      setEditingUser(null);
      setUserMsg("User updated");
      reloadUsers();
      setTimeout(() => setUserMsg(""), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    }
  }

  /* --------------- derived helpers --------------- */

  const reconRows = useMemo(() => {
    if (!scan) return [] as { key: string; category: string; description: string; issues: number; purgeable: boolean }[];
    const issues = scan.issues;
    return [
      {
        key: "sales-without-items",
        category: "Sales",
        description: "Direct sales that exist but have no line items",
        issues: issues.salesWithoutItems,
        purgeable: true
      },
      {
        key: "bookings-without-items",
        category: "Bookings",
        description: "Bookings missing their material line items",
        issues: issues.bookingsWithoutItems,
        purgeable: true
      },
      {
        key: "orphaned-payments",
        category: "Payments",
        description: "Payments without a resolvable client link",
        issues: issues.orphanedPayments,
        purgeable: true
      },
      {
        key: "orphaned-entries",
        category: "Ledger",
        description: "Stock entries pointing to deleted source records",
        issues: issues.orphanedEntries,
        purgeable: true
      },
      {
        key: "payment-accounts-missing",
        category: "Accounts",
        description: "Payments linked to accounts that no longer exist",
        issues: issues.paymentAccountsMissing,
        purgeable: true
      },
      {
        key: "negative-stock",
        category: "Stock",
        description: "Materials whose IN/OUT balance is negative",
        issues: issues.negativeStock,
        purgeable: false
      }
    ];
  }, [scan]);

  /* --------------- render --------------- */

  return (
    <div>
      <PageHeader icon="bi-gear" title="Settings" subtitle="Company identity and user management">
        <button className="btn btn-outline-warning" onClick={() => api<{ settings: SettingsRow }>("/bootstrap").then((d) => setS(d.settings || {}))}>
          <i className="bi bi-arrow-clockwise me-1" /> Refresh
        </button>
      </PageHeader>

      {/* ============================ GENERAL ============================ */}
      <Card title="General Settings" icon="bi-sliders">
        <form className="row g-3" onSubmit={onSaveGeneral}>
          <div className="col-md-3">
            <label className="ui-label">Company Name</label>
            <input className="form-control" value={s.company_name || ""} onChange={(e) => setS({ ...s, company_name: e.target.value })} />
          </div>
          <div className="col-md-6">
            <label className="ui-label">Company Address</label>
            <input className="form-control" value={s.company_address || ""} onChange={(e) => setS({ ...s, company_address: e.target.value })} />
          </div>
          <div className="col-md-3">
            <label className="ui-label">Company Phone</label>
            <input className="form-control" value={s.company_phone || ""} onChange={(e) => setS({ ...s, company_phone: e.target.value })} />
          </div>
          <div className="col-md-3">
            <label className="ui-label">Currency Symbol</label>
            <input className="form-control" value={s.currency || "PKR"} onChange={(e) => setS({ ...s, currency: e.target.value })} />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <label className="d-flex align-items-center gap-2 mb-0">
              <input type="checkbox" checked={!!s.allow_global_negative_stock} onChange={(e) => setS({ ...s, allow_global_negative_stock: e.target.checked ? 1 : 0 })} />
              Allow global negative stock
            </label>
          </div>
          <div className="col-md-6 d-flex align-items-end justify-content-end gap-3">
            {msg && <span className="text-success small fw-bold">{msg}</span>}
            <button type="submit" className="btn btn-warning fw-bold">
              <i className="bi bi-save me-1" /> Save General Settings
            </button>
          </div>
        </form>
      </Card>

      {/* ============================ SECURITY ============================ */}
      <Card title="Security" icon="bi-shield-lock">
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <label className="ui-label">Username</label>
            <input className="form-control" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="ui-label">New Password</label>
            <input className="form-control" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="col-md-3 d-flex align-items-end gap-2">
            <button type="button" className="btn btn-warning fw-bold" onClick={onUpdatePassword}>
              <i className="bi bi-key me-1" /> Update
            </button>
            {securityMsg && <span className="small text-success align-self-center">{securityMsg}</span>}
          </div>
          <div className="col-md-3 d-flex align-items-end gap-2 justify-content-end">
            <select className="form-select" style={{ maxWidth: 160 }} value={loginUser} onChange={(e) => setLoginUser(e.target.value)}>
              {Array.from(new Set([loginUser, "Admin", ...users.map((u) => String(u.username || ""))])).filter(Boolean).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-outline-success fw-bold" onClick={onLiveLogin}>
              <i className="bi bi-broadcast me-1" /> Live Login
            </button>
            {liveLoginMsg && <span className="small text-success align-self-center">{liveLoginMsg}</span>}
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">
            <i className="bi bi-clock-history me-1 text-warning" />
            When Did Login ({sessionMeta.totalCount} total • {sessionMeta.todayCount} today • {sessionMeta.activeCount} active)
          </h6>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={reloadSessions}>
            <i className="bi bi-arrow-clockwise" />
          </button>
        </div>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead>
              <tr>
                <th>Username</th>
                <th>When</th>
                <th>IP</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <Empty text="No login history yet" />
                  </td>
                </tr>
              ) : (
                sessions.slice(0, 30).map((sess) => (
                  <tr key={sess.id}>
                    <td className="fw-bold">{sess.username || "—"}</td>
                    <td>{formatStamp(sess.created_at)}</td>
                    <td className="text-muted">{sess.ip || "—"}</td>
                    <td>
                      {sess.ended_at ? (
                        <span className="badge bg-secondary">Ended</span>
                      ) : (
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={async () => {
                          if (!confirm(`End session for ${sess.username}?`)) return;
                          try {
                            await api("/auth/logout", { method: "POST" });
                          } catch {
                            /* no-op; session will expire naturally */
                          }
                          reloadSessions();
                        }}>
                          <i className="bi bi-box-arrow-right" /> logout
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ============================ DATA BACKUP ============================ */}
      <Card title="Data Backup & Restore" icon="bi-cloud-download">
        <div className="row g-3 align-items-end">
          <div className="col-md-3">
            <label className="ui-label">Database Size</label>
            <div className="form-control bg-transparent">{backup ? formatBytes(backup.dbSize) : "—"}</div>
          </div>
          <div className="col-md-3">
            <label className="ui-label">Database Path</label>
            <div className="form-control bg-transparent text-truncate" title={backup?.dbPath}>{backup?.dbPath || "—"}</div>
          </div>
          <div className="col-md-6 d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-warning fw-bold" onClick={onDownloadBackup}>
              <i className="bi bi-cloud-download me-1" /> Download Backup & Excel Server
            </button>
            {backupMsg && <span className="small text-success align-self-center">{backupMsg}</span>}
          </div>
        </div>

        <div className="mt-3">
          <form onSubmit={onRestoreBackup} className="row g-2 align-items-end">
            <div className="col-md-6">
              <label className="ui-label">Restore from .db file</label>
              <input type="file" name="file" accept=".db,.sqlite" className="form-control" required />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-outline-warning" disabled={restoring}>
                {restoring ? "Restoring…" : "Restore database"}
              </button>
              {restoreMsg && <span className="small text-warning align-self-center">{restoreMsg}</span>}
            </div>
          </form>
        </div>

        {backup && backup.backups.length > 0 && (
          <div className="mt-3">
            <h6 className="mb-2">
              <i className="bi bi-archive me-1 text-warning" /> Local Snapshots ({backup.backups.length})
            </h6>
            <div className="table-responsive">
              <table className="ui-table mb-0">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Size</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {backup.backups.map((b) => (
                    <tr key={b.name}>
                      <td className="fw-bold">{b.name}</td>
                      <td>{formatBytes(b.size)}</td>
                      <td>{formatStamp(b.mtime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* ============================ DATA RECONCILIATION ============================ */}
      <Card title="Data Reconciliation" icon="bi-clipboard-data">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <p className="mb-1 text-muted small">
              Scan bill, booking and ledger records to surface duplicates, orphans, missing-line items and broken account links.
            </p>
            {scan && (
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge bg-secondary">Scanned at: {formatStamp(scan.scannedAt)}</span>
                <span className={`badge ${scan.totalIssues > 0 ? "bg-danger" : "bg-success"}`}>
                  {scan.totalIssues} issues found
                </span>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-warning fw-bold" onClick={onScan} disabled={scanning}>
            <i className="bi bi-search me-1" /> {scanning ? "Scanning…" : "Scan All Datasets"}
          </button>
        </div>

        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Issue Details</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {!scan ? (
                <tr>
                  <td colSpan={4}>
                    <Empty text="Run a scan to inspect the dataset" />
                  </td>
                </tr>
              ) : (
                reconRows.map((row) => (
                  <tr key={row.key}>
                    <td className="fw-bold">{row.category}</td>
                    <td>{row.description}</td>
                    <td>
                      {row.issues > 0 ? (
                        <span className="badge bg-danger">{row.issues} records</span>
                      ) : (
                        <span className="badge bg-success">Clean</span>
                      )}
                    </td>
                    <td className="text-end">
                      {row.purgeable && row.issues > 0 ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={purgingKind === row.key}
                          onClick={() => onPurge(row.key)}
                        >
                          {purgingKind === row.key ? "Purging…" : "Purge"}
                        </button>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {scan && scan.negativeStockMaterials.length > 0 && (
          <div className="mt-3">
            <h6 className="mb-2">
              <i className="bi bi-exclamation-triangle me-1 text-warning" /> Negative-stock materials
            </h6>
            <div className="d-flex gap-2 flex-wrap">
              {scan.negativeStockMaterials.map((m) => (
                <span key={m.material} className="badge bg-warning text-dark">
                  {m.material}: {m.balance}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ============================ MATERIAL CATEGORIES ============================ */}
      <Card title="Material Categories" icon="bi-tags" extra={
        <button type="button" className="btn btn-warning btn-sm fw-bold" onClick={openAddCategory}>
          <i className="bi bi-plus-lg me-1" /> Add
        </button>
      }>
        {catMsg && <div className="text-success small fw-bold mb-2">{catMsg}</div>}
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Materials</th>
                <th>Total Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cats.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <Empty text="No material categories yet" />
                  </td>
                </tr>
              ) : (
                cats.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-bold">{c.name}</td>
                    <td>{c.materials_count || 0}</td>
                    <td>{c.total_stock || 0}</td>
                    <td>
                      {c.is_active ? (
                        <span className="badge bg-success">Active</span>
                      ) : (
                        <span className="badge bg-secondary">Inactive</span>
                      )}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-warning" onClick={() => openEditCategory(c)} title="Rename">
                          <i className="bi bi-pencil" />
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => toggleCategory(c)} title={c.is_active ? "Deactivate" : "Activate"}>
                          <i className="bi bi-power" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ============================ USER PERMISSIONS ============================ */}
      <Card title="User Permissions" icon="bi-person-check" extra={
        <span className="small text-muted">
          {userStats.total} users • {userStats.active} active • {userStats.admins} admin
        </span>
      }>
        {userMsg && <div className="text-success small fw-bold mb-2">{userMsg}</div>}
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <Empty text="No users found" />
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const granted = PERMISSION_MATRIX.filter((p) => Number((u as Record<string, unknown>)[p.key]) === 1).length;
                  return (
                    <tr key={u.id}>
                      <td className="fw-bold">{u.username}</td>
                      <td>
                        <span className={`badge ${String(u.role || "").toLowerCase() === "admin" ? "bg-warning text-dark" : "bg-info text-dark"}`}>
                          {String(u.role || "user").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {String(u.status || "").toLowerCase() === "active" ? (
                          <span className="badge bg-success">Active</span>
                        ) : (
                          <span className="badge bg-secondary">Suspended</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {PERMISSION_MATRIX.slice(0, 6).map((p) => {
                            const ok = Number((u as Record<string, unknown>)[p.key]) === 1;
                            return (
                              <span
                                key={p.key}
                                className={`badge ${ok ? "bg-success" : "bg-secondary opacity-50"}`}
                                title={p.label}
                              >
                                {ok ? "✓" : "✕"} {p.label}
                              </span>
                            );
                          })}
                          <span className="badge bg-info text-dark">
                            +{Math.max(0, granted - 6)} more
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-warning" onClick={() => setEditingUser(u)} title="Edit">
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => toggleUserStatus(u)}
                            title={String(u.status || "").toLowerCase() === "active" ? "Suspend" : "Reactivate"}
                          >
                            <i className="bi bi-power" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ============================ FEATURE ACCESS MATRIX ============================ */}
      <Card title="Feature Access Matrix" icon="bi-grid-3x3-gap">
        <p className="text-muted small mb-3">
          Per-feature access across every account. Administrators always see ✓ — non-admin staff inherit only the permissions ticked in <strong>User Permissions</strong>.
        </p>
        <div className="table-responsive">
          <table className="ui-table mb-0 feature-matrix">
            <thead>
              <tr>
                <th>Feature</th>
                {users.map((u) => (
                  <th key={u.id} className="text-center">{u.username}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((p) => (
                <tr key={p.key}>
                  <td className="fw-bold">{p.label}</td>
                  {users.map((u) => {
                    const ok = String(u.role || "").toLowerCase() === "admin" || Number((u as Record<string, unknown>)[p.key]) === 1;
                    return (
                      <td key={u.id} className="text-center">
                        <span className={`badge ${ok ? "bg-success" : "bg-secondary"}`}>{ok ? "YES" : "NO"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ============================ MODAL: CATEGORY ============================ */}
      <Modal
        open={showCat}
        title={editingCat ? `Rename: ${editingCat.name}` : "New material category"}
        onClose={() => setShowCat(false)}
        footer={<button type="submit" form="catForm" className="btn btn-warning fw-bold">{editingCat ? "Save" : "Add"}</button>}
      >
        <form id="catForm" onSubmit={saveCategory}>
          <div className="mb-3">
            <label className="ui-label">Category name</label>
            <input className="form-control" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="catActive"
              checked={!!catForm.is_active}
              onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked ? 1 : 0 })}
            />
            <label className="form-check-label" htmlFor="catActive">Active</label>
          </div>
        </form>
      </Modal>

      {/* ============================ MODAL: USER EDIT ============================ */}
      <Modal
        open={!!editingUser}
        title={editingUser ? `Edit user: ${editingUser.username}` : ""}
        size="lg"
        onClose={() => setEditingUser(null)}
        footer={<button type="submit" form="userForm" className="btn btn-warning fw-bold">Save user</button>}
      >
        {editingUser && (
          <form id="userForm" onSubmit={saveUser}>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="ui-label">Username</label>
                <input className="form-control" name="username" defaultValue={String(editingUser.username || "")} required />
              </div>
              <div className="col-md-3">
                <label className="ui-label">Role</label>
                <select className="form-select" name="role" defaultValue={String(editingUser.role || "user")}>
                  <option value="admin">admin</option>
                  <option value="user">user</option>
                  <option value="viewer">viewer</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="ui-label">Status</label>
                <select className="form-select" name="status" defaultValue={String(editingUser.status || "active")}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>
            </div>
            <h6 className="mt-2 mb-2">
              <i className="bi bi-shield-check me-1 text-warning" />
              Permissions
            </h6>
            <div className="row g-2">
              {PERMISSION_MATRIX.map((p) => {
                const checked = Number((editingUser as Record<string, unknown>)[p.key]) === 1;
                return (
                  <div className="col-md-4" key={p.key}>
                    <label className="form-check d-flex align-items-center gap-2 mb-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name={p.key}
                        value="1"
                        defaultChecked={checked}
                      />
                      <span className="form-check-label">{p.label}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
