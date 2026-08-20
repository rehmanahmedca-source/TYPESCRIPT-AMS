import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { all, db, one, run, tx } from "./db.ts";
import { money, pkDate, pkNow, pkTime, todayLabel, toMinor, ymd } from "./money.ts";
import { nextAutoBill, normalizeManualBill, parseBillKind } from "./bills.ts";
import {
  accountNet,
  clientBalance,
  driverBalance,
  getClient,
  nextCode,
  postAccountTx,
  postStockEntry,
  refreshAccountBalance,
  stockMap,
  supplierBalance,
  type AnyRow
} from "./services.ts";
import { buildFullRawWorkbook, buildMasterWorkbook, importWorkbook, sendWorkbook, xlsxFilename } from "./xlsx.ts";
import { applyBookingCancel, buildClientLedger, revertCancel } from "./clientLedger.ts";
import { clientBookingStatus, clientFinancialSummary, createDirectSale, saleListExtras } from "./salesCore.ts";
import {
  createBooking,
  getBookings,
  getBookingDetail,
  hardDeleteBooking,
  setBookingVoid,
  updateBooking
} from "./bookingsCore.ts";

const maxUploadMb = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 256));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadMb * 1024 * 1024 } });
export const api = Router();

function actor(req: { authUser?: { username: string } }) {
  return req.authUser?.username || "system";
}

function logAudit(username: string, action: string, details?: string) {
  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    run(
      `INSERT INTO audit_log (id, username, action, details, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [id, username, action, details || "", pkNow()]
    );
  } catch (e) {
    console.error("Failed to log audit:", e);
  }
}

/* ---------------- bootstrap / settings ---------------- */
api.get("/bootstrap", (req, res) => {
  const settings = one("SELECT * FROM settings ORDER BY id LIMIT 1") || {};
  const user = one("SELECT id, username, role, status FROM user WHERE username = ?", [actor(req)]) || {
    username: "Admin",
    role: "admin"
  };
  res.json({
    settings,
    user,
    today: todayLabel(),
    todayIso: pkDate()
  });
});

api.get("/settings", (_req, res) => {
  const settings = one("SELECT * FROM settings ORDER BY id LIMIT 1") || {};
  res.json({ ok: true, settings });
});

api.post("/settings", (req, res) => {
  const b = req.body || {};
  const existing = one<AnyRow>("SELECT * FROM settings ORDER BY id LIMIT 1");
  if (existing) {
    run(
      `UPDATE settings SET company_name=?, company_address=?, company_phone=?, company_email=?, currency=?, tax_rate=?, ui_theme=?, allow_global_negative_stock=? WHERE id=?`,
      [
        b.company_name ?? existing.company_name ?? "",
        b.company_address ?? existing.company_address ?? "",
        b.company_phone ?? existing.company_phone ?? "",
        b.company_email ?? existing.company_email ?? null,
        b.currency ?? existing.currency ?? "PKR",
        Number(b.tax_rate ?? existing.tax_rate ?? 0),
        b.ui_theme ?? existing.ui_theme ?? "dark",
        b.allow_global_negative_stock === undefined ? Number(existing.allow_global_negative_stock || 0) : (b.allow_global_negative_stock ? 1 : 0),
        existing.id
      ]
    );
  } else {
    run(
      `INSERT INTO settings (company_name, company_address, company_phone, company_email, currency, tax_rate, ui_theme, allow_global_negative_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.company_name || "",
        b.company_address || "",
        b.company_phone || "",
        b.company_email || null,
        b.currency || "PKR",
        Number(b.tax_rate || 0),
        b.ui_theme || "dark",
        b.allow_global_negative_stock ? 1 : 0
      ]
    );
  }
  logAudit(actor(req), "http.post.settings.update_general", "Updated general company settings");
  res.json({ ok: true, settings: one("SELECT * FROM settings ORDER BY id LIMIT 1") });
});

api.post(["/settings/password", "/settings/change-password", "/auth/change-password"], (req, res) => {
  const { newPassword, password, targetUsername } = req.body || {};
  const pass = String(newPassword || password || "").trim();
  if (!pass || pass.length < 4) {
    return res.status(400).json({ ok: false, error: "Password must be at least 4 characters long" });
  }
  const currentActor = actor(req);
  const targetUser = (targetUsername ? String(targetUsername).trim() : currentActor) || currentActor;
  const hash = bcrypt.hashSync(pass, 10);
  run("UPDATE user SET password_hash = ? WHERE username = ? COLLATE NOCASE", [hash, targetUser]);
  logAudit(currentActor, "http.post.auth.change_password", `Password updated for user ${targetUser}`);
  res.json({ ok: true, message: `Password updated successfully for ${targetUser}` });
});

/* ---------------- Material Categories Management ---------------- */
api.get(["/settings/categories", "/material_categories"], (_req, res) => {
  const categories = all<AnyRow>(
    `SELECT c.*, (SELECT COUNT(*) FROM material m WHERE m.category_id = c.id) AS materials_count
       FROM material_category c
      ORDER BY c.name COLLATE NOCASE ASC`
  );
  res.json({ ok: true, categories });
});

api.post(["/settings/categories", "/material_categories"], (req, res) => {
  const { name } = req.body || {};
  const catName = String(name || "").trim();
  if (!catName) return res.status(400).json({ ok: false, error: "Category name is required" });
  const existing = one<{ id: number }>("SELECT id FROM material_category WHERE name = ? COLLATE NOCASE", [catName]);
  if (existing) {
    return res.status(400).json({ ok: false, error: "A category with this name already exists" });
  }
  const info = run("INSERT INTO material_category (name, is_active, created_at) VALUES (?, 1, ?)", [catName, pkNow()]);
  logAudit(actor(req), "http.post.masters.add_material_category", `Created category ${catName}`);
  res.json({ ok: true, id: Number(info.lastInsertRowid), name: catName, is_active: 1 });
});

api.all(["/settings/categories/:id", "/material_categories/:id"], (req, res, next) => {
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") return next();
  const id = Number(req.params.id);
  const { name, is_active } = req.body || {};
  const current = one<AnyRow>("SELECT * FROM material_category WHERE id = ?", [id]);
  if (!current) return res.status(404).json({ ok: false, error: "Category not found" });

  const newName = name !== undefined ? String(name).trim() : current.name;
  if (!newName) return res.status(400).json({ ok: false, error: "Category name cannot be empty" });

  const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : Number(current.is_active || 1);
  run("UPDATE material_category SET name = ?, is_active = ? WHERE id = ?", [newName, activeVal, id]);
  logAudit(actor(req), "http.post.masters.update_material_category", `Updated category #${id} to ${newName} (Active: ${activeVal})`);
  res.json({ ok: true, id, name: newName, is_active: activeVal });
});

api.post(["/settings/categories/:id/toggle", "/material_categories/:id/toggle"], (req, res) => {
  const id = Number(req.params.id);
  const current = one<AnyRow>("SELECT * FROM material_category WHERE id = ?", [id]);
  if (!current) return res.status(404).json({ ok: false, error: "Category not found" });
  const nextStatus = current.is_active ? 0 : 1;
  run("UPDATE material_category SET is_active = ? WHERE id = ?", [nextStatus, id]);
  logAudit(actor(req), "http.post.masters.toggle_material_category", `Toggled category #${id} ${current.name} to ${nextStatus ? 'Active' : 'Inactive'}`);
  res.json({ ok: true, id, name: current.name, is_active: nextStatus });
});

/* ---------------- User Management & Permissions ---------------- */
api.get(["/settings/users", "/users"], (_req, res) => {
  const users = all<AnyRow>(
    `SELECT id, username, role, status, created_at,
            can_view_stock, can_view_daily, can_view_history, can_import_export,
            can_manage_directory, can_view_dashboard, can_manage_grn, can_manage_bookings,
            can_manage_payments, can_manage_sales, can_view_delivery_rent, can_manage_pending_bills,
            can_view_reports, can_manage_notifications, can_view_client_ledger, can_view_supplier_ledger,
            can_view_decision_ledger, can_manage_clients, can_manage_suppliers, can_manage_materials,
            can_manage_delivery_persons, can_access_settings, restrict_backdated_edit,
            can_manage_accounts, can_view_cash_flow
       FROM user
      ORDER BY id ASC`
  );
  res.json({ ok: true, users });
});

api.post(["/settings/users", "/users"], (req, res) => {
  const b = req.body || {};
  const username = String(b.username || "").trim();
  const password = String(b.password || "").trim();
  const role = String(b.role || "admin").toLowerCase() === "user" ? "user" : "admin";
  const status = String(b.status || "active").toLowerCase() === "inactive" ? "inactive" : "active";

  if (!username) return res.status(400).json({ ok: false, error: "Username is required" });
  if (!password) return res.status(400).json({ ok: false, error: "Password is required" });

  const existing = one<{ id: number }>("SELECT id FROM user WHERE username = ? COLLATE NOCASE", [username]);
  if (existing) return res.status(400).json({ ok: false, error: "Username already exists" });

  const hash = bcrypt.hashSync(password, 10);
  const info = run(
    `INSERT INTO user (
      username, password_hash, role, status,
      can_view_stock, can_view_daily, can_view_history, can_import_export,
      can_manage_directory, can_view_dashboard, can_manage_grn, can_manage_bookings,
      can_manage_payments, can_manage_sales, can_view_delivery_rent, can_manage_pending_bills,
      can_view_reports, can_manage_notifications, can_view_client_ledger, can_view_supplier_ledger,
      can_view_decision_ledger, can_manage_clients, can_manage_suppliers, can_manage_materials,
      can_manage_delivery_persons, can_access_settings, restrict_backdated_edit,
      can_manage_accounts, can_view_cash_flow, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      username,
      hash,
      role,
      status,
      b.can_view_stock ? 1 : 0,
      b.can_view_daily ? 1 : 0,
      b.can_view_history ? 1 : 0,
      b.can_import_export ? 1 : 0,
      b.can_manage_directory ? 1 : 0,
      b.can_view_dashboard !== undefined ? (b.can_view_dashboard ? 1 : 0) : 1,
      b.can_manage_grn ? 1 : 0,
      b.can_manage_bookings ? 1 : 0,
      b.can_manage_payments ? 1 : 0,
      b.can_manage_sales ? 1 : 0,
      b.can_view_delivery_rent ? 1 : 0,
      b.can_manage_pending_bills ? 1 : 0,
      b.can_view_reports ? 1 : 0,
      b.can_manage_notifications ? 1 : 0,
      b.can_view_client_ledger ? 1 : 0,
      b.can_view_supplier_ledger ? 1 : 0,
      b.can_view_decision_ledger ? 1 : 0,
      b.can_manage_clients ? 1 : 0,
      b.can_manage_suppliers ? 1 : 0,
      b.can_manage_materials ? 1 : 0,
      b.can_manage_delivery_persons ? 1 : 0,
      b.can_access_settings ? 1 : 0,
      b.restrict_backdated_edit ? 1 : 0,
      b.can_manage_accounts ? 1 : 0,
      b.can_view_cash_flow ? 1 : 0,
      pkNow()
    ]
  );
  logAudit(actor(req), "http.post.users.create_user", `Created user ${username} with role ${role}`);
  res.json({ ok: true, id: Number(info.lastInsertRowid), username, role, status });
});

api.all(["/settings/users/:id", "/users/:id"], (req, res, next) => {
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") return next();
  const id = Number(req.params.id);
  const user = one<AnyRow>("SELECT * FROM user WHERE id = ?", [id]);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });

  const b = req.body || {};
  const role = b.role ? (String(b.role).toLowerCase() === "user" ? "user" : "admin") : user.role;
  const status = b.status ? (String(b.status).toLowerCase() === "inactive" ? "inactive" : "active") : user.status;

  let hash = user.password_hash;
  if (b.password && String(b.password).trim().length >= 4) {
    hash = bcrypt.hashSync(String(b.password).trim(), 10);
  }

  run(
    `UPDATE user SET
      role = ?,
      status = ?,
      password_hash = ?,
      can_view_stock = ?,
      can_view_daily = ?,
      can_view_history = ?,
      can_import_export = ?,
      can_manage_directory = ?,
      can_view_dashboard = ?,
      can_manage_grn = ?,
      can_manage_bookings = ?,
      can_manage_payments = ?,
      can_manage_sales = ?,
      can_view_delivery_rent = ?,
      can_manage_pending_bills = ?,
      can_view_reports = ?,
      can_manage_notifications = ?,
      can_view_client_ledger = ?,
      can_view_supplier_ledger = ?,
      can_view_decision_ledger = ?,
      can_manage_clients = ?,
      can_manage_suppliers = ?,
      can_manage_materials = ?,
      can_manage_delivery_persons = ?,
      can_access_settings = ?,
      restrict_backdated_edit = ?,
      can_manage_accounts = ?,
      can_view_cash_flow = ?
     WHERE id = ?`,
    [
      role,
      status,
      hash,
      b.can_view_stock !== undefined ? (b.can_view_stock ? 1 : 0) : user.can_view_stock,
      b.can_view_daily !== undefined ? (b.can_view_daily ? 1 : 0) : user.can_view_daily,
      b.can_view_history !== undefined ? (b.can_view_history ? 1 : 0) : user.can_view_history,
      b.can_import_export !== undefined ? (b.can_import_export ? 1 : 0) : user.can_import_export,
      b.can_manage_directory !== undefined ? (b.can_manage_directory ? 1 : 0) : user.can_manage_directory,
      b.can_view_dashboard !== undefined ? (b.can_view_dashboard ? 1 : 0) : user.can_view_dashboard,
      b.can_manage_grn !== undefined ? (b.can_manage_grn ? 1 : 0) : user.can_manage_grn,
      b.can_manage_bookings !== undefined ? (b.can_manage_bookings ? 1 : 0) : user.can_manage_bookings,
      b.can_manage_payments !== undefined ? (b.can_manage_payments ? 1 : 0) : user.can_manage_payments,
      b.can_manage_sales !== undefined ? (b.can_manage_sales ? 1 : 0) : user.can_manage_sales,
      b.can_view_delivery_rent !== undefined ? (b.can_view_delivery_rent ? 1 : 0) : user.can_view_delivery_rent,
      b.can_manage_pending_bills !== undefined ? (b.can_manage_pending_bills ? 1 : 0) : user.can_manage_pending_bills,
      b.can_view_reports !== undefined ? (b.can_view_reports ? 1 : 0) : user.can_view_reports,
      b.can_manage_notifications !== undefined ? (b.can_manage_notifications ? 1 : 0) : user.can_manage_notifications,
      b.can_view_client_ledger !== undefined ? (b.can_view_client_ledger ? 1 : 0) : user.can_view_client_ledger,
      b.can_view_supplier_ledger !== undefined ? (b.can_view_supplier_ledger ? 1 : 0) : user.can_view_supplier_ledger,
      b.can_view_decision_ledger !== undefined ? (b.can_view_decision_ledger ? 1 : 0) : user.can_view_decision_ledger,
      b.can_manage_clients !== undefined ? (b.can_manage_clients ? 1 : 0) : user.can_manage_clients,
      b.can_manage_suppliers !== undefined ? (b.can_manage_suppliers ? 1 : 0) : user.can_manage_suppliers,
      b.can_manage_materials !== undefined ? (b.can_manage_materials ? 1 : 0) : user.can_manage_materials,
      b.can_manage_delivery_persons !== undefined ? (b.can_manage_delivery_persons ? 1 : 0) : user.can_manage_delivery_persons,
      b.can_access_settings !== undefined ? (b.can_access_settings ? 1 : 0) : user.can_access_settings,
      b.restrict_backdated_edit !== undefined ? (b.restrict_backdated_edit ? 1 : 0) : user.restrict_backdated_edit,
      b.can_manage_accounts !== undefined ? (b.can_manage_accounts ? 1 : 0) : user.can_manage_accounts,
      b.can_view_cash_flow !== undefined ? (b.can_view_cash_flow ? 1 : 0) : user.can_view_cash_flow,
      id
    ]
  );
  logAudit(actor(req), "http.post.users.update_user", `Updated user #${id} ${user.username}`);
  res.json({ ok: true, id, username: user.username });
});

api.post(["/settings/users/:id/toggle", "/users/:id/toggle"], (req, res) => {
  const id = Number(req.params.id);
  const user = one<AnyRow>("SELECT * FROM user WHERE id = ?", [id]);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });
  if (user.username === "Admin") {
    return res.status(400).json({ ok: false, error: "Cannot suspend built-in root Admin" });
  }
  const nextStatus = user.status === "active" ? "inactive" : "active";
  run("UPDATE user SET status = ? WHERE id = ?", [nextStatus, id]);
  logAudit(actor(req), "http.post.users.toggle_status", `Changed status of user #${id} ${user.username} to ${nextStatus}`);
  res.json({ ok: true, id, username: user.username, status: nextStatus });
});

api.delete(["/settings/users/:id", "/users/:id"], (req, res) => {
  const id = Number(req.params.id);
  const user = one<AnyRow>("SELECT * FROM user WHERE id = ?", [id]);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });
  if (user.username === "Admin") {
    return res.status(400).json({ ok: false, error: "Cannot delete built-in root Admin" });
  }
  run("DELETE FROM user WHERE id = ?", [id]);
  logAudit(actor(req), "http.post.users.delete_user", `Deleted user #${id} ${user.username}`);
  res.json({ ok: true, id, message: "User deleted" });
});

/* ---------------- Audit Logs & Live Sessions ---------------- */
api.get("/settings/audit-logs", (_req, res) => {
  const logs = all<AnyRow>("SELECT * FROM audit_log ORDER BY timestamp DESC, id DESC LIMIT 50");
  const sessions = all<AnyRow>(
    `SELECT s.*, u.username, u.role
       FROM user_login_session s
       JOIN user u ON u.id = s.user_id
      ORDER BY s.last_seen_at DESC, s.id DESC LIMIT 30`
  );
  res.json({ ok: true, logs, sessions });
});

/* ---------------- Data Reconciliation ---------------- */
api.post("/settings/reconciliation/scan", (_req, res) => {
  // Check orphaned entries, mismatched totals, void consistency
  const unlinkedEntries = all<AnyRow>(
    `SELECT e.id, e.material, e.type, e.qty, e.source_table, e.source_id
       FROM entry e
      WHERE e.source_table IS NOT NULL AND e.source_id IS NOT NULL AND e.is_void = 0
        AND (
          (e.source_table = 'direct_sale' AND NOT EXISTS (SELECT 1 FROM direct_sale s WHERE s.id = e.source_id AND s.is_void = 0)) OR
          (e.source_table = 'grn' AND NOT EXISTS (SELECT 1 FROM grn g WHERE g.id = e.source_id AND g.is_void = 0)) OR
          (e.source_table = 'material_return' AND NOT EXISTS (SELECT 1 FROM material_return r WHERE r.id = e.source_id AND r.is_void = 0))
        )`
  );

  const pendingBillsDiscrepancies = all<AnyRow>(
    `SELECT pb.id, pb.bill_no, pb.amount, pb.source_table, pb.source_id
       FROM pending_bill pb
      WHERE pb.is_void = 0 AND pb.source_table IS NOT NULL AND pb.source_id IS NOT NULL
        AND (
          (pb.source_table = 'direct_sale' AND NOT EXISTS (SELECT 1 FROM direct_sale s WHERE s.id = pb.source_id AND s.is_void = 0)) OR
          (pb.source_table = 'booking' AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.id = pb.source_id AND b.is_void = 0))
        )`
  );

  const totalEntries = one<{ n: number }>("SELECT COUNT(*) AS n FROM entry")?.n || 0;
  const totalSales = one<{ n: number }>("SELECT COUNT(*) AS n FROM direct_sale")?.n || 0;
  const totalBookings = one<{ n: number }>("SELECT COUNT(*) AS n FROM booking")?.n || 0;
  const totalPayments = one<{ n: number }>("SELECT COUNT(*) AS n FROM payment")?.n || 0;
  const totalGrns = one<{ n: number }>("SELECT COUNT(*) AS n FROM grn")?.n || 0;
  const totalPendingBills = one<{ n: number }>("SELECT COUNT(*) AS n FROM pending_bill")?.n || 0;
  const totalDeliveryRents = one<{ n: number }>("SELECT COUNT(*) AS n FROM delivery_rent")?.n || 0;

  const totalScanned = totalEntries + totalSales + totalBookings + totalPayments + totalGrns + totalPendingBills + totalDeliveryRents;
  const discrepanciesCount = unlinkedEntries.length + pendingBillsDiscrepancies.length;

  res.json({
    ok: true,
    scanned: totalScanned,
    discrepanciesCount,
    details: {
      unlinkedEntries: unlinkedEntries.length,
      pendingBillsDiscrepancies: pendingBillsDiscrepancies.length,
      totalEntries,
      totalSales,
      totalBookings,
      totalPayments,
      totalGrns,
      totalPendingBills,
      totalDeliveryRents
    },
    message: discrepanciesCount === 0
      ? `Data scan clean! Checked ${totalScanned} records across Entries, Sales, Bookings, Payments, GRNs, Pending Bills, and Delivery Rent.`
      : `Found ${discrepanciesCount} consistency issues across ${totalScanned} scanned records.`
  });
});

api.post("/settings/reconciliation/fix", (req, res) => {
  let fixedCount = 0;
  tx(() => {
    // 1. Fix void status sync between direct_sale and entries
    const voidSales = all<AnyRow>("SELECT id FROM direct_sale WHERE is_void = 1");
    for (const s of voidSales) {
      const info = run("UPDATE entry SET is_void = 1 WHERE source_table = 'direct_sale' AND source_id = ? AND is_void = 0", [s.id]);
      fixedCount += Number(info.changes || 0);
      const pbInfo = run("UPDATE pending_bill SET is_void = 1 WHERE source_table = 'direct_sale' AND source_id = ? AND is_void = 0", [s.id]);
      fixedCount += Number(pbInfo.changes || 0);
    }

    // 2. Fix void status sync between grn and entries
    const voidGrns = all<AnyRow>("SELECT id FROM grn WHERE is_void = 1");
    for (const g of voidGrns) {
      const info = run("UPDATE entry SET is_void = 1 WHERE source_table = 'grn' AND source_id = ? AND is_void = 0", [g.id]);
      fixedCount += Number(info.changes || 0);
    }

    // 3. Fix void status sync between booking and pending bills
    const voidBookings = all<AnyRow>("SELECT id FROM booking WHERE is_void = 1");
    for (const b of voidBookings) {
      const info = run("UPDATE pending_bill SET is_void = 1 WHERE source_table = 'booking' AND source_id = ? AND is_void = 0", [b.id]);
      fixedCount += Number(info.changes || 0);
    }

    // 4. Fix void status sync between material_return and entries
    const voidReturns = all<AnyRow>("SELECT id FROM material_return WHERE is_void = 1");
    for (const r of voidReturns) {
      const info = run("UPDATE entry SET is_void = 1 WHERE source_table = 'material_return' AND source_id = ? AND is_void = 0", [r.id]);
      fixedCount += Number(info.changes || 0);
    }
  });

  logAudit(actor(req), "http.post.maintenance.reconciliation_fix", `Ran reconciliation auto-fix. Repaired ${fixedCount} linked records.`);
  res.json({
    ok: true,
    fixedCount,
    message: `Auto-fix completed successfully. Synchronized and repaired ${fixedCount} records.`
  });
});

/* ---------------- Granular Data Wipe ---------------- */
api.post("/settings/wipe", (req, res) => {
  const { datasets } = req.body || {};
  if (!Array.isArray(datasets) || datasets.length === 0) {
    return res.status(400).json({ ok: false, error: "Please select at least one dataset to wipe" });
  }

  const selected = new Set(datasets.map((s: string) => String(s).toLowerCase().trim()));
  const wipedTables: string[] = [];

  tx(() => {
    if (selected.has("clients")) {
      run("DELETE FROM client");
      wipedTables.push("client");
    }
    if (selected.has("suppliers")) {
      run("DELETE FROM supplier");
      wipedTables.push("supplier");
    }
    if (selected.has("supplier_payments") || selected.has("supplierpayments")) {
      run("DELETE FROM supplier_payment");
      wipedTables.push("supplier_payment");
    }
    if (selected.has("pending_bills") || selected.has("pendingbills")) {
      run("DELETE FROM pending_bill");
      wipedTables.push("pending_bill");
    }
    if (selected.has("notifications_data") || selected.has("notifications")) {
      run("DELETE FROM notification");
      wipedTables.push("notification");
    }
    if (selected.has("dispatch") || selected.has("dispatch_out")) {
      run("DELETE FROM entry WHERE type = 'OUT'");
      wipedTables.push("entry (OUT)");
    }
    if (selected.has("receive") || selected.has("receive_in")) {
      run("DELETE FROM entry WHERE type = 'IN'");
      wipedTables.push("entry (IN)");
    }
    if (selected.has("grn")) {
      run("DELETE FROM grn_allocation");
      run("DELETE FROM grn_item");
      run("DELETE FROM grn");
      run("DELETE FROM entry WHERE source_table = 'grn'");
      wipedTables.push("grn");
    }
    if (selected.has("materials")) {
      run("DELETE FROM material");
      wipedTables.push("material");
    }
    if (selected.has("material_categories") || selected.has("materialcategories")) {
      run("DELETE FROM material_category");
      wipedTables.push("material_category");
    }
    if (selected.has("direct_sales") || selected.has("directsales")) {
      run("DELETE FROM direct_sale_item");
      run("DELETE FROM direct_sale");
      run("DELETE FROM entry WHERE source_table = 'direct_sale'");
      wipedTables.push("direct_sale");
    }
    if (selected.has("material_returns") || selected.has("materialreturns")) {
      run("DELETE FROM material_return_item");
      run("DELETE FROM material_return");
      run("DELETE FROM entry WHERE source_table = 'material_return'");
      wipedTables.push("material_return");
    }
    if (selected.has("delivery_rents") || selected.has("deliveryrents")) {
      run("DELETE FROM delivery_rent");
      wipedTables.push("delivery_rent");
    }
    if (selected.has("delivery_persons") || selected.has("deliverypersons")) {
      run("DELETE FROM delivery_person");
      wipedTables.push("delivery_person");
    }
    if (selected.has("invoices")) {
      run("DELETE FROM invoice_item");
      run("DELETE FROM invoice");
      wipedTables.push("invoice");
    }
    if (selected.has("payments")) {
      run("DELETE FROM payment");
      run("DELETE FROM waive_off");
      wipedTables.push("payment");
    }
    if (selected.has("bookings")) {
      run("DELETE FROM booking_item");
      run("DELETE FROM booking");
      run("DELETE FROM entry WHERE source_table = 'booking'");
      wipedTables.push("booking");
    }
    if (selected.has("financial_accounts") || selected.has("accounts")) {
      run("DELETE FROM account_transaction");
      run("DELETE FROM account");
      wipedTables.push("account");
    }
    if (selected.has("account_categories") || selected.has("accountcategories")) {
      run("DELETE FROM account_category");
      wipedTables.push("account_category");
    }
    if (selected.has("account_transactions") || selected.has("accounttransactions")) {
      run("DELETE FROM account_transaction");
      wipedTables.push("account_transaction");
    }
    if (selected.has("cash_reconciliation_data") || selected.has("reconciliations")) {
      run("DELETE FROM account_reconciliation");
      wipedTables.push("account_reconciliation");
    }
    if (selected.has("cash_audit_trail") || selected.has("cash_flow_entry_audit")) {
      run("DELETE FROM cash_flow_entry_audit");
      wipedTables.push("cash_flow_entry_audit");
    }
    if (selected.has("driver_payments") || selected.has("driverpayments")) {
      run("DELETE FROM driver_payment");
      wipedTables.push("driver_payment");
    }
    if (selected.has("unsaved_sales_drafts") || selected.has("drafts")) {
      try { run("DELETE FROM draft_sales_cart"); } catch {}
      wipedTables.push("drafts");
    }

    // Record wipe history
    run(
      `INSERT INTO tenant_wipe_backup_history (tenant_name, performed_by, targets, wipe_status, note, created_at)
       VALUES (?, ?, ?, 'COMPLETED', ?, ?)`,
      ["AMS Main Yard", actor(req), Array.from(selected).join(", "), `Wiped ${wipedTables.length} datasets safely`, pkNow()]
    );
  });

  logAudit(actor(req), "http.post.maintenance.granular_wipe", `Granular wipe performed for: ${wipedTables.join(", ")}`);
  res.json({
    ok: true,
    wipedTables,
    message: `Granular wipe completed successfully for ${wipedTables.length} datasets.`
  });
});

/* ---------------- dashboard ---------------- */
api.get("/dashboard", (_req, res) => {
  const stock = Object.values(stockMap());
  const totalStock = stock.reduce((a, m) => a + m.stock, 0);
  const totalInventoryValue = stock.reduce((a, m) => a + m.stock * m.rate, 0);
  const clients = all<AnyRow>("SELECT * FROM client WHERE is_active = 1");
  const clientCount = clients.length;
  const totalOutstanding = clients.reduce((a, c) => a + clientBalance(c), 0);
  const today = pkDate();
  const todaySales = all<AnyRow>(
    `SELECT * FROM direct_sale WHERE is_void = 0 AND date(date_posted) = date(?) ORDER BY id DESC`,
    [today]
  );
  const dailyCash = todaySales.reduce((a, s) => a + Number(s.paid_amount || 0), 0);
  const dailyCredit = todaySales.reduce(
    (a, s) => a + Math.max(0, Number(s.amount || 0) - Number(s.discount || 0) - Number(s.paid_amount || 0)),
    0
  );
  const sales = all<AnyRow>("SELECT * FROM direct_sale WHERE is_void = 0 ORDER BY id DESC LIMIT 8");
  const recentSalesTotal = sales.reduce((a, s) => a + Number(s.amount || 0), 0);
  const recentSalesPaid = sales.reduce((a, s) => a + Number(s.paid_amount || 0), 0);
  const recentSalesDue = sales.reduce(
    (a, s) => a + Math.max(0, Number(s.amount || 0) - Number(s.discount || 0) - Number(s.paid_amount || 0)),
    0
  );
  const bookings = all<AnyRow>("SELECT * FROM booking WHERE is_void = 0 ORDER BY id DESC LIMIT 6");
  const pendingBookings = all<AnyRow>("SELECT * FROM booking WHERE is_void = 0");
  const pendingDispatchesCount = pendingBookings.filter((b) => Number(b.amount || 0) > Number(b.paid_amount || 0) || true).length;
  const drivers = all<AnyRow>("SELECT * FROM delivery_person WHERE is_active = 1");
  const accounts = all<AnyRow>("SELECT * FROM account WHERE is_active = 1");
  const companyMoney = accounts.reduce((a, acc) => a + accountNet(Number(acc.id)), 0);

  res.json({
    totalStock,
    totalInventoryValue,
    totalInventoryRetailValue: totalInventoryValue,
    clientCount,
    totalOutstanding,
    dailyCash,
    dailyCredit,
    recentSalesTotal,
    recentSalesPaid,
    recentSalesDue,
    recentSalesCount: sales.length,
    avgOrderValue: sales.length ? Math.round(recentSalesTotal / sales.length) : 0,
    pendingDispatchesCount,
    pendingBookingUnits: pendingBookings.reduce((a, b) => a + Number(b.amount || 0), 0),
    activeDriversOnTrip: 0,
    totalDrivers: drivers.length,
    companyMoney,
    stock,
    recentSales: sales,
    recentBookings: bookings
  });
});

/* ---------------- materials / stock ---------------- */
api.get("/materials", (_req, res) => {
  const stock = stockMap();
  const categories = all("SELECT * FROM material_category ORDER BY name");
  const materials = all<AnyRow>(
    `SELECT m.*, c.name AS category_name FROM material m
     LEFT JOIN material_category c ON c.id = m.category_id ORDER BY m.name`
  ).map((m) => ({ ...m, ...(stock[String(m.name)] || {}) }));
  res.json({ materials, categories });
});

api.post("/materials", (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "Material name is required" });
  let categoryId = b.category_id ? Number(b.category_id) : null;
  if (!categoryId && b.category) {
    const cat = one<{ id: number }>("SELECT id FROM material_category WHERE name = ? COLLATE NOCASE", [b.category]);
    if (cat) categoryId = cat.id;
    else categoryId = Number(run("INSERT INTO material_category (name, is_active, created_at) VALUES (?,1,?)", [b.category, pkNow()]).lastInsertRowid);
  }
  const code = b.code || nextCode("material", "MT-");
  const info = run(
    `INSERT INTO material (code, name, category_id, unit_price, total, unit, is_active, created_at)
     VALUES (?, ?, ?, ?, 0, ?, 1, ?)`,
    [code, String(b.name).trim(), categoryId, Number(b.unit_price || b.rate || 0), b.unit || "Bags", pkNow()]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

api.post("/materials/:id", (req, res) => {
  const b = req.body || {};
  run(
    `UPDATE material SET name=?, code=?, category_id=?, unit_price=?, unit=?, is_active=? WHERE id=?`,
    [
      b.name,
      b.code,
      b.category_id || null,
      Number(b.unit_price || 0),
      b.unit || "Bags",
      b.is_active === false || b.is_active === 0 ? 0 : 1,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

api.get("/stock", (_req, res) => {
  const stock = Object.values(stockMap());
  const totalStock = stock.reduce((a, m) => a + m.stock, 0);
  const totalIn = stock.reduce((a, m) => a + m.inn, 0);
  const totalOut = stock.reduce((a, m) => a + m.out, 0);
  const stockValuation = stock.reduce((a, m) => a + m.stock * m.rate, 0);
  const suppliers = all("SELECT * FROM supplier WHERE is_active = 1 ORDER BY name");
  const materials = all(
    `SELECT m.*, c.name AS category_name FROM material m LEFT JOIN material_category c ON c.id = m.category_id ORDER BY m.name`
  );
  res.json({ materials: stock, suppliers, catalog: materials, totalStock, totalIn, totalOut, stockValuation });
});

api.get("/daily", (req, res) => {
  const validDate = (value: unknown, fallback: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : fallback;
  const from = validDate(req.query.from || req.query.date, pkDate());
  const to = validDate(req.query.to || req.query.date, from);
  const show = ["active", "void", "all"].includes(String(req.query.show)) ? String(req.query.show) : "active";
  const lower = (value: unknown) => String(value || "").trim().toLocaleLowerCase();
  const matches = (actual: unknown, wanted: unknown) => !lower(wanted) || lower(wanted) === "all" || lower(actual).includes(lower(wanted));

  const materialCategoryByName = new Map(
    all<{ name: string; category: string }>(
      `SELECT m.name, COALESCE(c.name, 'General') AS category
         FROM material m LEFT JOIN material_category c ON c.id = m.category_id`
    ).map((row) => [lower(row.name), row.category])
  );

  let rows: AnyRow[] = all<AnyRow>(
    `SELECT * FROM entry WHERE date >= ? AND date <= ? ORDER BY date DESC, time DESC, id DESC`,
    [from, to]
  ).map((entry) => ({
    ...entry,
    kind: "entry",
    row_key: `entry-${entry.id}`,
    date_posted: entry.date,
    material_category: materialCategoryByName.get(lower(entry.material)) || "General",
    amount: null
  }));

  const payments = all<AnyRow>(
    `SELECT p.*, c.code AS resolved_client_code, c.category AS resolved_client_category
       FROM payment p LEFT JOIN client c ON c.id = p.client_id
      WHERE date(p.date_posted) >= date(?) AND date(p.date_posted) <= date(?)
      ORDER BY p.date_posted DESC, p.id DESC`,
    [from, to]
  ).map((payment) => {
    const stamp = String(payment.date_posted || "");
    return {
      ...payment,
      kind: "payment",
      row_key: `payment-${payment.id}`,
      date: stamp.slice(0, 10),
      time: stamp.includes("T") ? stamp.slice(11, 19) : (stamp.includes(" ") ? stamp.slice(11, 19) : ""),
      type: "PAYMENT",
      material: "",
      client: payment.client_name,
      client_code: payment.resolved_client_code || "",
      client_category: payment.resolved_client_category || "",
      transaction_category: "Payment",
      transaction_type: "Payment",
      bill_no: payment.manual_bill_no || payment.auto_bill_no,
      nimbus_no: payment.auto_bill_no,
      qty: null,
      source_table: "payment",
      source_id: payment.id
    };
  });
  rows.push(...payments);

  const clientCategory = req.query.client_category;
  const transactionCategory = req.query.transaction_category;
  const materialCategory = req.query.material_category;
  const material = req.query.material;
  const client = req.query.client;
  const bill = req.query.bill;

  rows = rows.filter((row) => {
    const isVoid = Boolean(row.is_void);
    if (show === "active" && isVoid) return false;
    if (show === "void" && !isVoid) return false;
    if (!matches(row.client_category, clientCategory)) return false;
    if (!matches(row.transaction_category || row.transaction_type, transactionCategory)) return false;
    if (lower(materialCategory) && lower(materialCategory) !== "all" && row.kind === "payment") return false;
    if (!matches(row.material_category, materialCategory)) return false;
    if (lower(material) && lower(material) !== "all" && row.kind === "payment") return false;
    if (!matches(row.material, material)) return false;
    if (!matches(`${row.client || ""} ${row.client_code || ""}`, client)) return false;
    if (!matches(`${row.bill_no || ""} ${row.auto_bill_no || ""} ${row.nimbus_no || ""}`, bill)) return false;
    return true;
  });

  rows.sort((a, b) => `${b.date || ""} ${b.time || ""} ${String(b.id).padStart(12, "0")}`.localeCompare(`${a.date || ""} ${a.time || ""} ${String(a.id).padStart(12, "0")}`));

  const stockIn = rows.filter((r) => r.kind === "entry" && !r.is_void && r.type === "IN").reduce((sum, r) => sum + Number(r.qty || 0), 0);
  const stockOut = rows.filter((r) => r.kind === "entry" && !r.is_void && r.type === "OUT").reduce((sum, r) => sum + Number(r.qty || 0), 0);
  const paymentTotal = rows.filter((r) => r.kind === "payment" && !r.is_void).reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pageSize = Math.min(100, Math.max(5, Number(req.query.page_size || 25)));
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, Number(req.query.page || 1)));
  const start = (page - 1) * pageSize;

  res.json({
    from,
    to,
    rows: rows.slice(start, start + pageSize),
    summary: { stockIn, stockOut, payments: paymentTotal, netQty: stockIn - stockOut },
    pagination: { page, pageSize, total, pages },
    options: {
      clients: all("SELECT id, code, name, category FROM client WHERE is_active = 1 ORDER BY name"),
      materials: all("SELECT id, code, name FROM material WHERE is_active = 1 ORDER BY name"),
      clientCategories: all<{ category: string }>("SELECT DISTINCT category FROM client WHERE category IS NOT NULL AND trim(category) != '' ORDER BY category").map((r) => r.category),
      transactionCategories: all<{ category: string }>("SELECT DISTINCT COALESCE(transaction_category, transaction_type) AS category FROM entry WHERE COALESCE(transaction_category, transaction_type) IS NOT NULL ORDER BY category").map((r) => r.category),
      materialCategories: all<{ name: string }>("SELECT name FROM material_category WHERE is_active = 1 ORDER BY name").map((r) => r.name)
    }
  });
});

api.post("/daily/transactions/:kind/:id/void", (req, res) => {
  const kind = String(req.params.kind);
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid transaction id" });

  if (kind === "payment") {
    const payment = one<AnyRow>("SELECT * FROM payment WHERE id = ?", [id]);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.is_void) return res.json({ ok: true });
    tx(() => {
      run("UPDATE payment SET is_void = 1, updated_by = ?, updated_at = ? WHERE id = ?", [actor(req), pkNow(), id]);
      run("UPDATE account_transaction SET is_void = 1 WHERE source_type IN ('Payment','payment') AND source_id = ?", [id]);
      if (payment.payment_account_id) refreshAccountBalance(Number(payment.payment_account_id));
    });
    return res.json({ ok: true });
  }

  if (kind !== "entry") return res.status(400).json({ error: "Unsupported transaction type" });
  const entry = one<AnyRow>("SELECT * FROM entry WHERE id = ?", [id]);
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  const sourceTable = String(entry.source_table || "").toLowerCase();
  const sourceId = Number(entry.source_id || 0);
  tx(() => {
    if (sourceId && sourceTable === "direct_sale") {
      run("UPDATE direct_sale SET is_void = 1 WHERE id = ?", [sourceId]);
      run("UPDATE entry SET is_void = 1 WHERE source_table = 'direct_sale' AND source_id = ?", [sourceId]);
      run("UPDATE delivery_rent SET is_void = 1 WHERE sale_id = ?", [sourceId]);
      run("UPDATE sale_delivery_persons SET is_void = 1 WHERE sale_id = ?", [sourceId]);
    } else if (sourceId && sourceTable === "grn") {
      run("UPDATE grn SET is_void = 1, updated_at = ? WHERE id = ?", [pkNow(), sourceId]);
      run("UPDATE entry SET is_void = 1 WHERE source_table = 'grn' AND source_id = ?", [sourceId]);
    } else if (sourceId && sourceTable === "material_return") {
      run("UPDATE material_return SET is_void = 1 WHERE id = ?", [sourceId]);
      run("UPDATE entry SET is_void = 1 WHERE source_table = 'material_return' AND source_id = ?", [sourceId]);
    } else {
      run("UPDATE entry SET is_void = 1 WHERE id = ?", [id]);
    }
  });
  res.json({ ok: true });
});

/* ---------------- clients ---------------- */
api.get("/clients", (_req, res) => {
  const clients = all<AnyRow>("SELECT * FROM client ORDER BY name").map((c) => ({
    ...c,
    balance: clientBalance(c)
  }));
  const totalReceivables = clients.reduce((a, c) => a + Number(c.balance || 0), 0);
  res.json({ clients, totalReceivables });
});

api.post("/clients", (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "Client name is required" });
  const code = b.code || nextCode("client", "CL-");
  const info = run(
    `INSERT INTO client (code, name, phone, address, category, opening_balance, opening_balance_date, is_active, require_manual_invoice, book_no, location_url, page_notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    [
      code,
      String(b.name).trim(),
      b.phone || null,
      b.address || null,
      b.category || b.type || "General",
      Number(b.opening_balance || 0),
      b.opening_balance_date || pkNow(),
      b.require_manual_invoice ? 1 : 0,
      b.book_no || null,
      b.location_url || null,
      b.page_notes || null,
      pkNow()
    ]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid), code });
});

api.post("/clients/:id", (req, res) => {
  const b = req.body || {};
  run(
    `UPDATE client SET name=?, phone=?, address=?, category=?, is_active=?, book_no=?, location_url=?, page_notes=?, require_manual_invoice=? WHERE id=?`,
    [
      b.name,
      b.phone,
      b.address,
      b.category,
      b.is_active === false || b.is_active === 0 ? 0 : 1,
      b.book_no,
      b.location_url,
      b.page_notes,
      b.require_manual_invoice ? 1 : 0,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

api.post("/clients/:id/payment", (req, res) => {
  const client = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client not found" });
  const b = req.body || {};
  const amount = money(b.amount || 0);
  if (amount <= 0) return res.status(400).json({ error: "Amount must be positive" });
  const accountId = b.payment_account_id ? Number(b.payment_account_id) : null;
  const autoBill = nextAutoBill(db, "CP");
  tx(() => {
    const info = run(
      `INSERT INTO payment (client_id, client_name, amount, amount_minor, method, payment_type, auto_bill_no, date_posted, is_void, note, payment_account_id, created_by, created_at, updated_at, revision)
       VALUES (?, ?, ?, ?, ?, 'Receipt', ?, ?, 0, ?, ?, ?, ?, ?, 1)`,
      [client.id, client.name, amount, toMinor(amount), b.method || "Cash", autoBill, pkNow(), b.note || null, accountId, actor(req), pkNow(), pkNow()]
    );
    if (accountId) {
      postAccountTx({
        toId: accountId,
        amount,
        description: `Payment received from ${client.name} (${autoBill})`,
        type: "Receipt",
        sourceType: "payment",
        sourceId: Number(info.lastInsertRowid),
        createdBy: actor(req)
      });
    }
  });
  res.json({ ok: true, auto_bill_no: autoBill });
});

api.post("/clients/:id/transfer", (req, res) => {
  const source = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.params.id]);
  if (!source) return res.status(404).json({ error: "Source client not found" });
  const target = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.body.target_client_id]);
  if (!target) return res.status(404).json({ error: "Target client not found" });
  const b = req.body || {};
  tx(() => {
    if (b.transfer_sales) {
      run("UPDATE direct_sale SET client_name = ?, client_code = ? WHERE client_code = ? OR client_name = ?", [target.name, target.code, source.code, source.name]);
      run("UPDATE booking SET client_name = ? WHERE client_name = ?", [target.name, source.name]);
    }
    if (b.transfer_payments) {
      run("UPDATE payment SET client_id = ?, client_name = ? WHERE client_id = ?", [target.id, target.name, source.id]);
    }
    if (b.transfer_bookings) {
      run("UPDATE booking SET client_name = ? WHERE client_name = ?", [target.name, source.name]);
    }
  });
  res.json({ ok: true, message: `Transferred data from ${source.name} to ${target.name}` });
});

api.get("/clients/:id/ledger", (req, res) => {
  const client = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json(buildClientLedger(client));
});

api.post("/clients/:id/opening-balance", (req, res) => {
  const client = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client not found" });
  const b = req.body || {};
  run("UPDATE client SET opening_balance = ?, opening_balance_date = ? WHERE id = ?", [
    Number(b.opening_balance || 0),
    b.opening_balance_date || pkNow(),
    client.id
  ]);
  res.json({ ok: true });
});

api.post("/clients/:id/toggle-active", (req, res) => {
  const client = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client not found" });
  run("UPDATE client SET is_active = ? WHERE id = ?", [client.is_active ? 0 : 1, client.id]);
  res.json({ ok: true, is_active: client.is_active ? 0 : 1 });
});

api.post("/clients/:id/booking-cancel", (req, res) => {
  const client = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client not found" });
  const ids = Array.isArray(req.body?.selected_item_ids)
    ? req.body.selected_item_ids.map((x: unknown) => Number(x)).filter(Boolean)
    : String(req.body?.selected_item_ids_csv || "")
        .split(",")
        .map((x) => Number(x.trim()))
        .filter(Boolean);
  try {
    res.json(applyBookingCancel(client, ids, actor(req)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

api.post("/clients/:id/booking-cancel-revert/:entryId", (req, res) => {
  const client = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client not found" });
  try {
    res.json(revertCancel(client, Number(req.params.entryId), actor(req)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

api.post("/ledger-transaction/:type/:id", (req, res) => {
  const type = String(req.params.type);
  const id = Number(req.params.id);
  const b = req.body || {};
  if (type === "Payment") {
    run(
      `UPDATE payment SET amount=?, method=?, manual_bill_no=?, bank_name=?, account_name=?, account_no=?, date_posted=?, note=? WHERE id=?`,
      [money(b.amount), b.method, b.manual_bill_no, b.bank_name, b.account_name, b.account_no, b.date_posted || pkNow(), b.note, id]
    );
  } else if (type === "Booking") {
    run(`UPDATE booking SET manual_bill_no=?, discount=?, discount_reason=?, date_posted=?, note=? WHERE id=?`, [
      b.manual_bill_no,
      Number(b.discount || 0),
      b.discount_reason,
      b.date_posted || pkNow(),
      b.note,
      id
    ]);
  } else if (type === "DirectSale") {
    run(`UPDATE direct_sale SET amount=?, manual_bill_no=?, category=?, payment_method=?, date_posted=?, note=? WHERE id=?`, [
      money(b.amount),
      b.manual_bill_no,
      b.category,
      b.payment_method,
      b.date_posted || pkNow(),
      b.note,
      id
    ]);
  } else {
    return res.status(400).json({ error: "Unsupported type" });
  }
  res.json({ ok: true });
});

api.post("/ledger-transaction/:type/:id/delete", (req, res) => {
  const type = String(req.params.type);
  const id = Number(req.params.id);
  if (type === "Payment") run("UPDATE payment SET is_void = 1 WHERE id = ?", [id]);
  else if (type === "Booking") run("UPDATE booking SET is_void = 1 WHERE id = ?", [id]);
  else if (type === "DirectSale") run("UPDATE direct_sale SET is_void = 1 WHERE id = ?", [id]);
  else if (type === "Entry") run("UPDATE entry SET is_void = 1 WHERE id = ?", [id]);
  else return res.status(400).json({ error: "Unsupported type" });
  res.json({ ok: true });
});

api.post("/clients/:id/payment", (req, res) => {
  const client = one<AnyRow>("SELECT * FROM client WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client not found" });
  const amt = money(req.body.amount);
  if (amt <= 0) return res.status(400).json({ error: "Invalid amount" });
  const auto = nextAutoBill(db, "CP");
  const manual = normalizeManualBill(req.body.ref || req.body.manual_bill_no);
  const info = run(
    `INSERT INTO payment (client_id, client_name, amount, amount_minor, method, payment_type, manual_bill_no, auto_bill_no, date_posted, is_void, note, payment_account_id, created_by, created_at, updated_at, revision)
     VALUES (?, ?, ?, ?, ?, 'Receipt', ?, ?, ?, 0, ?, ?, ?, ?, ?, 1)`,
    [
      client.id,
      client.name,
      amt,
      toMinor(amt),
      req.body.method || "Cash",
      manual,
      auto,
      req.body.date || pkNow(),
      req.body.description || req.body.note || "Payment received",
      req.body.account_id || null,
      actor(req),
      pkNow(),
      pkNow()
    ]
  );
  if (req.body.account_id) {
    postAccountTx({
      toId: Number(req.body.account_id),
      amount: amt,
      description: `Client receipt ${client.name}`,
      type: "Receipt",
      sourceType: "Payment",
      sourceId: Number(info.lastInsertRowid),
      createdBy: actor(req)
    });
  }
  res.json({ ok: true, id: Number(info.lastInsertRowid), auto_bill_no: auto });
});

/* ---------------- suppliers ---------------- */
api.get("/suppliers", (_req, res) => {
  const suppliers = all<AnyRow>("SELECT * FROM supplier ORDER BY name").map((s) => ({
    ...s,
    balance: supplierBalance(s)
  }));
  const totalPayables = suppliers.reduce((a, s) => a + Number(s.balance || 0), 0);
  res.json({ suppliers, totalPayables });
});

api.post("/suppliers", (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "Supplier name is required" });
  const info = run(
    `INSERT INTO supplier (name, phone, address, opening_balance, opening_balance_date, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [String(b.name).trim(), b.phone || null, b.address || null, Number(b.opening_balance || 0), pkNow(), pkNow()]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

api.post("/suppliers/:id", (req, res) => {
  const b = req.body || {};
  run("UPDATE supplier SET name=?, phone=?, address=?, is_active=? WHERE id=?", [
    b.name,
    b.phone,
    b.address,
    b.is_active === false || b.is_active === 0 ? 0 : 1,
    req.params.id
  ]);
  res.json({ ok: true });
});

api.get("/suppliers/:id/ledger", (req, res) => {
  const supplier = one<AnyRow>("SELECT * FROM supplier WHERE id = ?", [req.params.id]);
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });
  const entries: AnyRow[] = [];
  let running = Number(supplier.opening_balance || 0);
  if (running) {
    entries.push({
      date: ymd(String(supplier.opening_balance_date || supplier.created_at)),
      type: "Opening",
      description: "Opening Balance",
      debit: 0,
      credit: running,
      balance: running,
      ref: "OB"
    });
  }
  const grns = all<AnyRow>(
    "SELECT * FROM grn WHERE is_void = 0 AND (supplier_id = ? OR supplier = ?) ORDER BY date_posted, id",
    [supplier.id, supplier.name]
  );
  for (const g of grns) {
    const items = one<{ n: number }>(
      "SELECT COALESCE(SUM(qty * price_at_time),0) AS n FROM grn_item WHERE grn_id = ? AND is_void = 0",
      [g.id]
    )?.n || 0;
    const total =
      Number(items) +
      Number(g.loading_cost || 0) +
      Number(g.freight_cost || 0) +
      Number(g.other_expense || 0) +
      Number(g.tax_amount || 0) -
      Number(g.discount || 0);
    running += total;
    entries.push({
      date: ymd(String(g.date_posted)),
      type: "GRN",
      description: `GRN ${g.auto_bill_no || g.manual_bill_no || g.id}`,
      debit: 0,
      credit: total,
      balance: running,
      ref: g.auto_bill_no || g.manual_bill_no
    });
    if (Number(g.paid_amount || 0) > 0) {
      running -= Number(g.paid_amount);
      entries.push({
        date: ymd(String(g.date_posted)),
        type: "Payment",
        description: `Paid on GRN`,
        debit: Number(g.paid_amount),
        credit: 0,
        balance: running,
        ref: g.auto_bill_no
      });
    }
  }
  const pays = all<AnyRow>(
    "SELECT * FROM supplier_payment WHERE is_void = 0 AND supplier_id = ? ORDER BY date_posted, id",
    [supplier.id]
  );
  for (const p of pays) {
    running -= Number(p.amount || 0);
    entries.push({
      date: ymd(String(p.date_posted)),
      type: "Payment",
      description: p.note || "Supplier payment",
      debit: Number(p.amount || 0),
      credit: 0,
      balance: running,
      ref: p.auto_bill_no || p.manual_bill_no
    });
  }
  res.json({
    supplier: { ...supplier, balance: money(running) },
    entries,
    totalDebit: entries.reduce((a, e) => a + Number(e.debit || 0), 0),
    totalCredit: entries.reduce((a, e) => a + Number(e.credit || 0), 0)
  });
});

api.post("/suppliers/:id/payment", (req, res) => {
  const supplier = one<AnyRow>("SELECT * FROM supplier WHERE id = ?", [req.params.id]);
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });
  const amt = money(req.body.amount);
  if (amt <= 0) return res.status(400).json({ error: "Invalid amount" });
  const auto = nextAutoBill(db, "SP");
  const info = run(
    `INSERT INTO supplier_payment (supplier_id, amount, amount_minor, method, payment_type, date_posted, note, is_void, payment_account_id, auto_bill_no, created_by, created_at, updated_at, revision)
     VALUES (?, ?, ?, ?, 'Payment', ?, ?, 0, ?, ?, ?, ?, ?, 1)`,
    [
      supplier.id,
      amt,
      toMinor(amt),
      req.body.method || "Cash",
      req.body.date || pkNow(),
      req.body.note || "Supplier payment",
      req.body.account_id || null,
      auto,
      actor(req),
      pkNow(),
      pkNow()
    ]
  );
  if (req.body.account_id) {
    postAccountTx({
      fromId: Number(req.body.account_id),
      amount: amt,
      description: `Pay ${supplier.name}`,
      type: "Payment",
      sourceType: "SupplierPayment",
      sourceId: Number(info.lastInsertRowid),
      createdBy: actor(req)
    });
  }
  res.json({ ok: true, id: Number(info.lastInsertRowid), auto_bill_no: auto });
});

/* ---------------- GRN ---------------- */
api.get("/grn", (_req, res) => {
  const rows = all<AnyRow>("SELECT * FROM grn ORDER BY id DESC LIMIT 200").map((g) => {
    const items = all<AnyRow>("SELECT * FROM grn_item WHERE grn_id = ?", [g.id]);
    const itemTotal = items.reduce((a, i) => a + Number(i.qty || 0) * Number(i.price_at_time || 0), 0);
    return { ...g, items, itemTotal };
  });
  res.json({ grns: rows, suppliers: all("SELECT * FROM supplier WHERE is_active = 1 ORDER BY name") });
});

api.post("/grn", (req, res) => {
  const b = req.body || {};
  const supplier = b.supplier_id
    ? one<AnyRow>("SELECT * FROM supplier WHERE id = ?", [b.supplier_id])
    : one<AnyRow>("SELECT * FROM supplier WHERE name = ? COLLATE NOCASE", [b.supplier]);
  const items: { name: string; qty: number; rate: number }[] = Array.isArray(b.items)
    ? b.items
    : [{ name: b.material_name || b.mat_name, qty: Number(b.quantity || b.qty || 0), rate: Number(b.purchaseRate || b.rate || 0) }];
  const valid = items.filter((i) => i.name && Number(i.qty) > 0);
  if (!valid.length) return res.status(400).json({ error: "Add at least one GRN item" });
  const result = tx(() => {
    const auto = nextAutoBill(db, "GRN");
    const manual = normalizeManualBill(b.manual_bill_no);
    const info = run(
      `INSERT INTO grn (supplier_id, supplier, manual_bill_no, auto_bill_no, loading_cost, freight_cost, other_expense, discount, paid_amount, payment_type, payment_account_id, date_posted, is_void, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        supplier?.id || null,
        supplier?.name || b.supplier || null,
        manual,
        auto,
        Number(b.loading_cost || 0),
        Number(b.freight_cost || 0),
        Number(b.other_expense || 0),
        Number(b.discount || 0),
        Number(b.paid_amount || 0),
        b.payment_type || null,
        b.payment_account_id || null,
        b.date || pkNow(),
        b.note || b.vehicleNo || null
      ]
    );
    const id = Number(info.lastInsertRowid);
    for (const item of valid) {
      run("INSERT INTO grn_item (grn_id, mat_name, qty, price_at_time, is_void, is_locked) VALUES (?, ?, ?, ?, 0, 0)", [
        id,
        item.name,
        money(item.qty),
        money(item.rate)
      ]);
      postStockEntry({
        type: "IN",
        material: item.name,
        qty: item.qty,
        client: String(supplier?.name || ""),
        billNo: manual || auto,
        autoBillNo: auto,
        category: "GRN",
        note: b.note,
        sourceModule: "grn",
        sourceTable: "grn",
        sourceId: id,
        transactionType: "GRN"
      });
    }
    if (Number(b.paid_amount || 0) > 0 && b.payment_account_id) {
      postAccountTx({
        fromId: Number(b.payment_account_id),
        amount: Number(b.paid_amount),
        description: `GRN ${auto}`,
        type: "Payment",
        sourceType: "GRN",
        sourceId: id
      });
    }
    return { id, auto };
  });
  res.json({ ok: true, ...result });
});

api.post("/grn/:id/void", (req, res) => {
  const grn = one<AnyRow>("SELECT * FROM grn WHERE id = ?", [req.params.id]);
  if (!grn) return res.status(404).json({ error: "GRN not found" });
  tx(() => {
    run("UPDATE grn SET is_void = 1 WHERE id = ?", [grn.id]);
    run("UPDATE entry SET is_void = 1 WHERE source_table = 'grn' AND source_id = ?", [grn.id]);
  });
  res.json({ ok: true });
});

api.post("/grn/:id", (req, res) => {
  const grn = one<AnyRow>("SELECT * FROM grn WHERE id = ?", [req.params.id]);
  if (!grn) return res.status(404).json({ error: "GRN not found" });
  const b = req.body || {};
  const items: { name: string; qty: number; rate: number }[] = Array.isArray(b.items) ? b.items : [];
  const itemTotal = items.reduce((a, i) => a + money(Number(i.qty || 0) * Number(i.rate || 0)), 0);
  const loading = Number(b.loading_cost || 0);
  const freight = Number(b.freight_cost || 0);
  const other = Number(b.other_expense || 0);
  const discount = Number(b.discount || 0);
  const total = money(itemTotal + loading + freight + other - discount);
  tx(() => {
    run("UPDATE entry SET is_void = 1 WHERE source_table = 'grn' AND source_id = ?", [grn.id]);
    run("UPDATE grn SET manual_bill_no=?, paid_amount=?, discount=?, loading_cost=?, freight_cost=?, other_expense=?, note=?, updated_at=? WHERE id=?", [
      b.manual_bill_no || grn.manual_bill_no,
      Number(b.paid_amount ?? grn.paid_amount),
      discount,
      loading,
      freight,
      other,
      b.note ?? grn.note,
      pkNow(),
      grn.id
    ]);
    run("DELETE FROM grn_item WHERE grn_id = ?", [grn.id]);
    for (const item of items) {
      if (item.name && Number(item.qty) > 0) {
        run("INSERT INTO grn_item (grn_id, mat_name, qty, price_at_time, is_void, is_locked) VALUES (?, ?, ?, ?, 0, 0)", [
          grn.id, item.name, Number(item.qty), Number(item.rate || 0)
        ]);
        postStockEntry({
          type: "IN",
          material: item.name,
          qty: Number(item.qty),
          client: grn.supplier,
          billNo: grn.manual_bill_no,
          autoBillNo: grn.auto_bill_no,
          sourceModule: "grn",
          sourceTable: "grn",
          sourceId: Number(grn.id)
        });
      }
    }
  });
  res.json({ ok: true });
});

api.post("/grn/:id/payment", (req, res) => {
  const grn = one<AnyRow>("SELECT * FROM grn WHERE id = ?", [req.params.id]);
  if (!grn) return res.status(404).json({ error: "GRN not found" });
  const b = req.body || {};
  const amount = money(b.amount || 0);
  if (amount <= 0) return res.status(400).json({ error: "Amount must be positive" });
  const accountId = b.payment_account_id ? Number(b.payment_account_id) : null;
  const newPaid = money(Number(grn.paid_amount || 0) + amount);
  tx(() => {
    run("UPDATE grn SET paid_amount = ?, updated_at = ? WHERE id = ?", [newPaid, pkNow(), grn.id]);
    if (accountId) {
      postAccountTx({
        fromId: accountId,
        amount,
        description: `GRN payment to ${grn.supplier || "Supplier"} (${grn.auto_bill_no || grn.id})`,
        type: "Payment",
        sourceType: "grn",
        sourceId: Number(grn.id),
        createdBy: actor(req)
      });
    }
  });
  res.json({ ok: true, paid_amount: newPaid });
});

/* ---------------- sales ---------------- */
api.get("/sales", (req, res) => {
  const extras = saleListExtras();
  const show = String(req.query.show || "active");
  let sql = "SELECT * FROM direct_sale WHERE 1=1";
  const params: unknown[] = [];
  if (show !== "all") {
    sql += " AND is_void = 0";
  }
  if (req.query.client) {
    sql += " AND (client_name LIKE ? OR client_code LIKE ?)";
    params.push(`%${req.query.client}%`, `%${req.query.client}%`);
  }
  if (req.query.bill_no) {
    sql += " AND (manual_bill_no LIKE ? OR auto_bill_no LIKE ?)";
    params.push(`%${req.query.bill_no}%`, `%${req.query.bill_no}%`);
  }
  if (req.query.category) {
    sql += " AND category = ?";
    params.push(req.query.category);
  }
  sql += " ORDER BY id DESC LIMIT 250";
  const sales = all<AnyRow>(sql, params).map((s) => ({
    ...s,
    items: all("SELECT * FROM direct_sale_item WHERE sale_id = ?", [s.id]),
    due: money(Number(s.amount || 0) - Number(s.discount || 0) - Number(s.paid_amount || 0)),
    driver_rent: extras.delivery_rent_totals_by_sale[Number(s.id)] || 0
  }));
  res.json({
    sales,
    clients: all("SELECT id, code, name, phone, address, category FROM client WHERE is_active = 1 ORDER BY name"),
    materials: all("SELECT id, code, name, unit_price, unit FROM material WHERE is_active = 1 ORDER BY name"),
    drivers: all("SELECT id, name, phone FROM delivery_person WHERE is_active = 1 ORDER BY name"),
    accounts: all("SELECT id, name, category, balance FROM account WHERE is_active = 1 ORDER BY name"),
    ...extras
  });
});

api.get("/sales/client-booking/:code", (req, res) => {
  const client = getClient(req.params.code);
  if (!client) return res.json([]);
  res.json(clientBookingStatus(client));
});

api.get("/sales/client-financial/:code", (req, res) => {
  const client = getClient(req.params.code);
  if (!client) return res.json({ found: false });
  res.json(clientFinancialSummary(client));
});

api.post("/sales", (req, res) => {
  try {
    const result = createDirectSale(req.body || {}, actor(req));
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

api.post("/sales/:id/void", (req, res) => {
  const sale = one<AnyRow>("SELECT * FROM direct_sale WHERE id = ?", [req.params.id]);
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  tx(() => {
    run("UPDATE direct_sale SET is_void = 1 WHERE id = ?", [sale.id]);
    run("UPDATE entry SET is_void = 1 WHERE source_table = 'direct_sale' AND source_id = ?", [sale.id]);
    run("UPDATE delivery_rent SET is_void = 1 WHERE sale_id = ?", [sale.id]);
    run("UPDATE sale_delivery_persons SET is_void = 1 WHERE sale_id = ?", [sale.id]);
  });
  res.json({ ok: true });
});

api.post("/sales/:id/payment", (req, res) => {
  const sale = one<AnyRow>("SELECT * FROM direct_sale WHERE id = ?", [req.params.id]);
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  const amount = money(req.body.amount || 0);
  if (amount <= 0) return res.status(400).json({ error: "Invalid amount" });
  const accountId = req.body.payment_account_id ? Number(req.body.payment_account_id) : null;
  const newPaid = money(Number(sale.paid_amount || 0) + amount);
  tx(() => {
    run("UPDATE direct_sale SET paid_amount = ?, updated_at = ? WHERE id = ?", [newPaid, pkNow(), sale.id]);
    if (accountId) {
      postAccountTx({
        toId: accountId,
        amount,
        description: `Payment received from ${sale.client_name || "Client"} for sale ${sale.auto_bill_no || sale.manual_bill_no || sale.id}`,
        type: "Receipt",
        sourceType: "direct_sale",
        sourceId: Number(sale.id),
        createdBy: actor(req)
      });
    }
  });
  res.json({ ok: true, paid_amount: newPaid });
});

api.post("/sales/:id", (req, res) => {
  const sale = one<AnyRow>("SELECT * FROM direct_sale WHERE id = ?", [req.params.id]);
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  const b = req.body || {};
  const items: { name: string; qty: number; rate: number }[] = Array.isArray(b.items) ? b.items : [];
  const totalAmount = items.reduce((a, i) => a + money(Number(i.qty || 0) * Number(i.rate || 0)), 0);
  tx(() => {
    // Delete old stock entries
    run("UPDATE entry SET is_void = 1 WHERE source_table = 'direct_sale' AND source_id = ?", [sale.id]);
    // Update sale record
    run("UPDATE direct_sale SET client_name=?, amount=?, discount=?, paid_amount=?, note=?, updated_at=? WHERE id=?", [
      b.client_name || sale.client_name,
      totalAmount,
      Number(b.discount ?? sale.discount),
      Number(b.paid_amount ?? sale.paid_amount),
      b.note ?? sale.note,
      pkNow(),
      sale.id
    ]);
    // Delete old items and recreate
    run("DELETE FROM direct_sale_item WHERE sale_id = ?", [sale.id]);
    for (const item of items) {
      if (item.name && Number(item.qty) > 0) {
        const amt = money(Number(item.qty) * Number(item.rate || 0));
        run("INSERT INTO direct_sale_item (sale_id, product_name, qty, rate, amount) VALUES (?, ?, ?, ?, ?)", [
          sale.id, item.name, Number(item.qty), Number(item.rate || 0), amt
        ]);
        // Create new stock entry
        postStockEntry({
          type: "OUT",
          material: item.name,
          qty: Number(item.qty),
          client: sale.client_name,
          billNo: sale.manual_bill_no,
          autoBillNo: sale.auto_bill_no,
          sourceModule: "sales",
          sourceTable: "direct_sale",
          sourceId: Number(sale.id)
        });
      }
    }
  });
  res.json({ ok: true });
});

/* ---------------- bookings ---------------- */
api.get("/bookings", (req, res) => {
  try {
    const result = getBookings({
      show: req.query.show ? String(req.query.show) : undefined,
      client: req.query.client ? String(req.query.client) : undefined,
      bill_no: req.query.bill_no ? String(req.query.bill_no) : undefined,
      date_from: req.query.date_from ? String(req.query.date_from) : undefined,
      date_to: req.query.date_to ? String(req.query.date_to) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      per_page: req.query.per_page ? Number(req.query.per_page) : undefined
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

api.get(["/bookings/:id", "/bookings/:id/edit-modal"], (req, res) => {
  const detail = getBookingDetail(Number(req.params.id));
  if (!detail) return res.status(404).json({ error: "Booking not found" });
  res.json(detail);
});

api.post(["/add_booking", "/bookings"], (req, res) => {
  try {
    const result = createBooking(req.body || {}, actor(req));
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

api.post(["/edit_bill/Booking/:id", "/bookings/:id"], (req, res) => {
  try {
    const result = updateBooking(Number(req.params.id), req.body || {}, actor(req));
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});


api.post(["/delete_transaction/Booking/:id", "/bookings/:id/delete"], (req, res) => {
  try {
    const ok = hardDeleteBooking(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: "Booking not found" });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

api.post("/bookings/:id/void", (req, res) => {
  try {
    setBookingVoid(Number(req.params.id), true);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

api.post("/bookings/:id/unvoid", (req, res) => {
  try {
    setBookingVoid(Number(req.params.id), false);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

api.post("/bookings/:id/payment", (req, res) => {
  const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [req.params.id]);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  const b = req.body || {};
  const amount = money(b.amount || 0);
  if (amount <= 0) return res.status(400).json({ error: "Amount must be positive" });
  const accountId = b.payment_account_id ? Number(b.payment_account_id) : null;
  const newPaid = money(Number(booking.paid_amount || 0) + amount);
  tx(() => {
    run("UPDATE booking SET paid_amount = ?, updated_at = ? WHERE id = ?", [newPaid, pkNow(), booking.id]);
    if (accountId) {
      postAccountTx({
        toId: accountId,
        amount,
        description: `Booking payment received from ${booking.client_name || "Client"} (${booking.auto_bill_no || booking.id})`,
        type: "Receipt",
        sourceType: "booking",
        sourceId: Number(booking.id),
        createdBy: actor(req)
      });
    }
  });
  res.json({ ok: true, paid_amount: newPaid });
});

/* ---------------- returns / payments / pending ---------------- */
api.get("/returns", (_req, res) => {
  const rows = all<AnyRow>("SELECT * FROM material_return ORDER BY id DESC LIMIT 200").map((r) => ({
    ...r,
    items: all("SELECT * FROM material_return_item WHERE material_return_id = ?", [r.id])
  }));
  res.json({
    returns: rows,
    clients: all("SELECT id, code, name FROM client WHERE is_active = 1 ORDER BY name"),
    materials: all("SELECT id, name, unit_price, unit FROM material WHERE is_active = 1 ORDER BY name")
  });
});

api.post("/returns", (req, res) => {
  const b = req.body || {};
  const items: { name: string; qty: number; rate: number }[] = Array.isArray(b.items)
    ? b.items.map((i: AnyRow) => ({ name: String(i.name || i.material_name || ""), qty: Number(i.qty || 0), rate: Number(i.rate || 0) }))
    : [{ name: String(b.material_name || ""), qty: Number(b.qty || 0), rate: Number(b.rate || 0) }];
  const valid = items.filter((i) => i.name && i.qty > 0);
  if (!valid.length) return res.status(400).json({ error: "Add return items" });
  const amount = money(valid.reduce((a, i) => a + i.qty * i.rate, 0));
  const result = tx(() => {
    const auto = nextAutoBill(db, "RTN");
    const info = run(
      `INSERT INTO material_return (client_name, return_type, amount, manual_bill_no, auto_bill_no, date_posted, note, is_void)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [b.client_name, b.return_type || "normal", amount, normalizeManualBill(b.manual_bill_no), auto, pkNow(), b.note || null]
    );
    const id = Number(info.lastInsertRowid);
    for (const item of valid) {
      run(
        "INSERT INTO material_return_item (material_return_id, material_name, qty, unit_rate, rent_rate, price_at_time) VALUES (?, ?, ?, ?, 0, ?)",
        [id, item.name, item.qty, item.rate, item.rate]
      );
      postStockEntry({
        type: "IN",
        material: item.name,
        qty: item.qty,
        client: b.client_name,
        billNo: auto,
        autoBillNo: auto,
        category: "Return",
        sourceModule: "returns",
        sourceTable: "material_return",
        sourceId: id,
        transactionType: "Return"
      });
    }
    return { id, auto };
  });
  res.json({ ok: true, ...result });
});

api.post("/returns/:id/void", (req, res) => {
  const ret = one<AnyRow>("SELECT * FROM material_return WHERE id = ?", [req.params.id]);
  if (!ret) return res.status(404).json({ error: "Return not found" });
  tx(() => {
    run("UPDATE material_return SET is_void = 1 WHERE id = ?", [ret.id]);
    run("UPDATE entry SET is_void = 1 WHERE source_table = 'material_return' AND source_id = ?", [ret.id]);
  });
  res.json({ ok: true });
});

api.post("/returns/:id", (req, res) => {
  const ret = one<AnyRow>("SELECT * FROM material_return WHERE id = ?", [req.params.id]);
  if (!ret) return res.status(404).json({ error: "Return not found" });
  const b = req.body || {};
  const items: { name: string; qty: number; rate: number }[] = Array.isArray(b.items) ? b.items : [];
  const amount = items.reduce((a, i) => a + money(Number(i.qty || 0) * Number(i.rate || 0)), 0);
  tx(() => {
    run("UPDATE entry SET is_void = 1 WHERE source_table = 'material_return' AND source_id = ?", [ret.id]);
    run("UPDATE material_return SET client_name=?, amount=?, note=?, updated_at=? WHERE id=?", [
      b.client_name || ret.client_name,
      amount,
      b.note ?? ret.note,
      pkNow(),
      ret.id
    ]);
    run("DELETE FROM material_return_item WHERE material_return_id = ?", [ret.id]);
    for (const item of items) {
      if (item.name && Number(item.qty) > 0) {
        run("INSERT INTO material_return_item (material_return_id, material_name, qty, unit_rate, rent_rate, price_at_time) VALUES (?, ?, ?, ?, 0, ?)", [
          ret.id, item.name, Number(item.qty), Number(item.rate || 0), Number(item.rate || 0)
        ]);
        postStockEntry({
          type: "IN",
          material: item.name,
          qty: Number(item.qty),
          client: b.client_name || ret.client_name,
          autoBillNo: ret.auto_bill_no,
          sourceModule: "returns",
          sourceTable: "material_return",
          sourceId: Number(ret.id),
          transactionType: "Return"
        });
      }
    }
  });
  res.json({ ok: true });
});

api.get("/payments", (_req, res) => {
  res.json({
    payments: all("SELECT * FROM payment ORDER BY id DESC LIMIT 250"),
    clients: all("SELECT id, code, name FROM client WHERE is_active = 1 ORDER BY name"),
    accounts: all("SELECT id, name, category, balance FROM account WHERE is_active = 1 ORDER BY name")
  });
});

api.post("/payments", (req, res) => {
  const b = req.body || {};
  const client = getClient(b.client_id || b.client_name);
  if (!client) return res.status(400).json({ error: "Client is required" });
  const amt = money(b.amount);
  if (amt <= 0) return res.status(400).json({ error: "Invalid amount" });
  const auto = nextAutoBill(db, "CP");
  const info = run(
    `INSERT INTO payment (client_id, client_name, amount, amount_minor, method, payment_type, manual_bill_no, auto_bill_no, date_posted, is_void, note, payment_account_id, created_by, created_at, updated_at, revision)
     VALUES (?, ?, ?, ?, ?, 'Receipt', ?, ?, ?, 0, ?, ?, ?, ?, ?, 1)`,
    [
      client.id,
      client.name,
      amt,
      toMinor(amt),
      b.method || "Cash",
      normalizeManualBill(b.manual_bill_no),
      auto,
      b.date || pkNow(),
      b.note || null,
      b.account_id || null,
      actor(req),
      pkNow(),
      pkNow()
    ]
  );
  if (b.account_id) {
    postAccountTx({
      toId: Number(b.account_id),
      amount: amt,
      description: `Payment ${auto} ${client.name}`,
      type: "Receipt",
      sourceType: "Payment",
      sourceId: Number(info.lastInsertRowid)
    });
  }
  res.json({ ok: true, id: Number(info.lastInsertRowid), auto_bill_no: auto });
});

api.post("/payments/:id/void", (req, res) => {
  const payment = one<AnyRow>("SELECT * FROM payment WHERE id = ?", [req.params.id]);
  if (!payment) return res.status(404).json({ error: "Payment not found" });
  tx(() => {
    run("UPDATE payment SET is_void = 1 WHERE id = ?", [payment.id]);
    if (payment.payment_account_id) {
      postAccountTx({
        fromId: Number(payment.payment_account_id),
        amount: Number(payment.amount),
        description: `Void payment ${payment.auto_bill_no || payment.id}`,
        type: "Receipt",
        sourceType: "payment",
        sourceId: Number(payment.id)
      });
    }
  });
  res.json({ ok: true });
});

api.post("/payments/:id", (req, res) => {
  const payment = one<AnyRow>("SELECT * FROM payment WHERE id = ?", [req.params.id]);
  if (!payment) return res.status(404).json({ error: "Payment not found" });
  const b = req.body || {};
  run("UPDATE payment SET client_name=?, amount=?, method=?, note=?, updated_at=? WHERE id=?", [
    b.client_name || payment.client_name,
    money(b.amount || payment.amount),
    b.method || payment.method,
    b.note ?? payment.note,
    pkNow(),
    payment.id
  ]);
  res.json({ ok: true });
});

api.get("/pending-bills", (_req, res) => {
  res.json({
    bills: all("SELECT * FROM pending_bill ORDER BY id DESC LIMIT 300"),
    clients: all("SELECT id, code, name FROM client WHERE is_active = 1 ORDER BY name")
  });
});

api.post("/pending-bills", (req, res) => {
  const b = req.body || {};
  const bill = b.bill_no || "";
  const info = run(
    `INSERT INTO pending_bill (client_code, client_name, bill_no, bill_kind, nimbus_no, amount, reason, is_paid, is_cash, is_manual, created_at, created_by, is_void, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?)`,
    [
      b.client_code || null,
      b.client_name || null,
      bill,
      parseBillKind(bill),
      b.nimbus_no || null,
      Number(b.amount || 0),
      b.reason || null,
      b.is_cash ? 1 : 0,
      b.is_manual ? 1 : 0,
      pkNow(),
      actor(req),
      b.note || null
    ]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

api.post("/pending-bills/:id/paid", (req, res) => {
  run("UPDATE pending_bill SET is_paid = 1 WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

api.post("/pending-bills/:id/void", (req, res) => {
  run("UPDATE pending_bill SET is_void = 1 WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

api.post("/pending-bills/:id", (req, res) => {
  const b = req.body || {};
  const bill = b.bill_no || "";
  run("UPDATE pending_bill SET bill_no=?, bill_kind=?, client_name=?, amount=?, reason=?, note=? WHERE id=?", [
    bill, parseBillKind(bill), b.client_name, Number(b.amount || 0), b.reason, b.note, req.params.id
  ]);
  res.json({ ok: true });
});

/* ---------------- drivers / dispatch ---------------- */
api.get("/drivers", (_req, res) => {
  const drivers = all<AnyRow>("SELECT * FROM delivery_person ORDER BY name").map((d) => ({
    ...d,
    balance: driverBalance(d),
    deliveriesCount: one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM delivery_rent WHERE is_void = 0 AND delivery_person_name = ?",
      [d.name]
    )?.n || 0
  }));
  res.json({ drivers });
});

api.post("/drivers", (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "Name is required" });
  const info = run(
    "INSERT INTO delivery_person (name, phone, opening_balance, opening_balance_date, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
    [String(b.name).trim(), b.phone || null, Number(b.opening_balance || 0), pkNow(), pkNow()]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

api.post("/drivers/:id", (req, res) => {
  const b = req.body || {};
  run(
    "UPDATE delivery_person SET name=?, phone=?, opening_balance=?, is_active=? WHERE id=?",
    [
      b.name,
      b.phone,
      Number(b.opening_balance || 0),
      b.is_active === false || b.is_active === 0 ? 0 : 1,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

api.post("/drivers/:id/payment", (req, res) => {
  const driver = one<AnyRow>("SELECT * FROM delivery_person WHERE id = ?", [req.params.id]);
  if (!driver) return res.status(404).json({ error: "Driver not found" });
  const b = req.body || {};
  const amount = money(b.amount || 0);
  const waive = money(b.waive_off || 0);
  if (amount <= 0) return res.status(400).json({ error: "Amount must be positive" });
  const info = run(
    `INSERT INTO delivery_person_payment (delivery_person_id, amount_paid, waive_off_amount, note, created_at, is_void)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [driver.id, amount, waive, b.note || null, pkNow()]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

api.get("/dispatch", (_req, res) => {
  const sales = all<AnyRow>(
    "SELECT * FROM direct_sale WHERE is_void = 0 ORDER BY id DESC LIMIT 150"
  ).map((s) => ({ ...s, items: all("SELECT * FROM direct_sale_item WHERE sale_id = ?", [s.id]) }));
  const entries = all("SELECT * FROM entry WHERE is_void = 0 AND type = 'OUT' ORDER BY id DESC LIMIT 150");
  const drivers = all("SELECT * FROM delivery_person WHERE is_active = 1 ORDER BY name");
  res.json({ sales, entries, drivers });
});

api.get("/delivery-rents", (_req, res) => {
  res.json({
    rents: all("SELECT * FROM delivery_rent ORDER BY id DESC LIMIT 250"),
    drivers: all("SELECT * FROM delivery_person WHERE is_active = 1 ORDER BY name")
  });
});

/* ---------------- accounts / cash ---------------- */
api.get("/accounts", (_req, res) => {
  const accounts: AnyRow[] = all<AnyRow>("SELECT * FROM account ORDER BY name").map((a) => ({
    ...a,
    live_balance: accountNet(Number(a.id))
  }));
  const txs = all(
    `SELECT t.*, fa.name AS from_name, ta.name AS to_name
     FROM account_transaction t
     LEFT JOIN account fa ON fa.id = t.from_account_id
     LEFT JOIN account ta ON ta.id = t.to_account_id
     ORDER BY t.id DESC LIMIT 80`
  );
  const totalCash = accounts.filter((a) => String(a.category) === "cash").reduce((s, a) => s + Number(a.live_balance), 0);
  const totalBank = accounts.filter((a) => String(a.category) === "bank").reduce((s, a) => s + Number(a.live_balance), 0);
  const today = pkDate();
  const client_payments_today = Number(one<{ n: number }>(`SELECT COALESCE(SUM(amount),0) AS n FROM payment WHERE is_void = 0 AND date(date_posted) = date(?)`, [today])?.n || 0);
  const supplier_payments_today = Number(one<{ n: number }>(`SELECT COALESCE(SUM(amount),0) AS n FROM supplier_payment WHERE is_void = 0 AND date(date_posted) = date(?)`, [today])?.n || 0);
  const expenditures_today = Number(one<{ n: number }>(`SELECT COALESCE(SUM(amount),0) AS n FROM account_transaction WHERE is_void = 0 AND date(date_posted) = date(?) AND transaction_type IN ('Expense','Payment') AND to_account_id IS NULL`, [today])?.n || 0);
  const receipts_today = Number(one<{ n: number }>(`SELECT COALESCE(SUM(amount),0) AS n FROM account_transaction WHERE is_void = 0 AND date(date_posted) = date(?) AND transaction_type = 'Receipt'`, [today])?.n || 0);
  res.json({
    accounts,
    transactions: txs,
    totalCash,
    totalBank,
    totalCompanyMoney: totalCash + totalBank,
    client_payments_today,
    supplier_payments_today,
    expenditures_today,
    receipts_today: receipts_today + client_payments_today,
    clients: all("SELECT id, code, name FROM client WHERE is_active = 1 ORDER BY name"),
    suppliers: all("SELECT id, name FROM supplier WHERE is_active = 1 ORDER BY name"),
    drivers: all("SELECT id, name FROM delivery_person WHERE is_active = 1 ORDER BY name"),
    categories: all("SELECT id, name FROM account_category ORDER BY name")
  });
});

api.post("/accounts", (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "Account name is required" });
  const opening = money(b.opening_balance || b.balance || 0);
  const info = run(
    `INSERT INTO account (name, type, category, account_type, balance, balance_minor, opening_balance, opening_balance_minor, opening_balance_date, bank_name, account_number, is_active, revision, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
    [
      b.name,
      b.type || b.account_type || "company",
      b.category || "cash",
      b.account_type || "company",
      opening,
      toMinor(opening),
      opening,
      toMinor(opening),
      pkNow(),
      b.bank_name || null,
      b.account_number || null,
      pkNow(),
      pkNow()
    ]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

api.post("/accounts/transfer", (req, res) => {
  const b = req.body || {};
  const amt = money(b.amount);
  if (!b.from_account_id || !b.to_account_id || amt <= 0) {
    return res.status(400).json({ error: "Invalid transfer" });
  }
  if (accountNet(Number(b.from_account_id)) < amt) {
    return res.status(400).json({ error: "Insufficient balance" });
  }
  const id = postAccountTx({
    fromId: Number(b.from_account_id),
    toId: Number(b.to_account_id),
    amount: amt,
    description: b.description || "Internal transfer",
    type: "Transfer",
    createdBy: actor(req)
  });
  res.json({ ok: true, id });
});

api.post("/accounts/expense", (req, res) => {
  const b = req.body || {};
  const amt = money(b.amount);
  if (!b.account_id || amt <= 0) return res.status(400).json({ error: "Invalid expense" });
  if (accountNet(Number(b.account_id)) < amt) return res.status(400).json({ error: "Insufficient balance" });
  const id = postAccountTx({
    fromId: Number(b.account_id),
    amount: amt,
    description: b.description || b.category || "Expense",
    type: "Expense",
    note: b.category,
    createdBy: actor(req)
  });
  res.json({ ok: true, id });
});

api.get("/cash-flow", (_req, res) => {
  const txs = all<AnyRow>(
    `SELECT t.*, fa.name AS from_name, ta.name AS to_name
     FROM account_transaction t
     LEFT JOIN account fa ON fa.id = t.from_account_id
     LEFT JOIN account ta ON ta.id = t.to_account_id
     WHERE t.is_void = 0
     ORDER BY t.id DESC LIMIT 400`
  );
  const totalInflow = txs
    .filter((t) => t.to_account_id && (t.transaction_type === "Receipt" || t.transaction_type === "Transfer"))
    .reduce((a, t) => a + (t.transaction_type === "Receipt" ? Number(t.amount || 0) : 0), 0);
  const receipts = txs.filter((t) => t.transaction_type === "Receipt").reduce((a, t) => a + Number(t.amount || 0), 0);
  const payments = txs
    .filter((t) => t.transaction_type === "Payment" || t.transaction_type === "Expense")
    .reduce((a, t) => a + Number(t.amount || 0), 0);
  res.json({
    flows: txs,
    totalInflow: receipts,
    totalOutflow: payments,
    netFlow: receipts - payments
  });
});

api.get("/cash-flow-differences", (_req, res) => {
  const drawer = one<AnyRow>("SELECT * FROM account WHERE category = 'cash' ORDER BY id LIMIT 1");
  const differences = all("SELECT * FROM cash_flow_difference_adjustment ORDER BY adjustment_date DESC, id DESC");
  res.json({
    differences,
    cashDrawerBalance: drawer ? accountNet(Number(drawer.id)) : 0
  });
});

api.post("/cash-flow-differences", (req, res) => {
  const physical = money(req.body.physical_cash || req.body.physicalCash);
  const drawer = one<AnyRow>("SELECT * FROM account WHERE category = 'cash' ORDER BY id LIMIT 1");
  const calculated = drawer ? accountNet(Number(drawer.id)) : 0;
  const diff = money(physical - calculated);
  const info = run(
    `INSERT INTO cash_flow_difference_adjustment (
      adjustment_date, amount, note, physical_cash_available, calculated_closing, difference, reason, created_by, created_at, updated_at, edit_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [pkDate(), diff, req.body.notes || null, physical, calculated, diff, req.body.notes || null, actor(req), pkNow(), pkNow()]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid), difference: diff });
});

api.get("/reconciliation", (_req, res) => {
  const drawer = one<AnyRow>("SELECT * FROM account WHERE category = 'cash' ORDER BY id LIMIT 1");
  const recs = all("SELECT * FROM cash_flow_difference_adjustment ORDER BY adjustment_date DESC, id DESC");
  res.json({
    reconciliations: recs,
    cashDrawerBalance: drawer ? accountNet(Number(drawer.id)) : 0,
    drawer
  });
});

api.post("/reconciliation", (req, res) => {
  const physical = money(req.body.physical_cash || req.body.physicalCash);
  const drawer = one<AnyRow>("SELECT * FROM account WHERE category = 'cash' ORDER BY id LIMIT 1");
  const calculated = drawer ? accountNet(Number(drawer.id)) : 0;
  const diff = money(physical - calculated);
  const info = run(
    `INSERT INTO cash_flow_difference_adjustment (
      adjustment_date, amount, note, physical_cash_available, calculated_closing, difference, reason, created_by, created_at, updated_at, edit_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [pkDate(), diff, req.body.notes || null, physical, calculated, diff, req.body.notes || null, actor(req), pkNow(), pkNow()]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid), difference: diff });
});

/* ---------------- reports ---------------- */
api.get("/reports", (_req, res) => {
  const sales = all<AnyRow>("SELECT * FROM direct_sale WHERE is_void = 0");
  const stock = Object.values(stockMap());
  res.json({
    totalSalesVolume: sales.reduce((a, s) => a + Number(s.amount || 0), 0),
    totalCashCollected: sales.reduce((a, s) => a + Number(s.paid_amount || 0), 0),
    totalCreditIssued: sales.reduce(
      (a, s) => a + Math.max(0, Number(s.amount || 0) - Number(s.discount || 0) - Number(s.paid_amount || 0)),
      0
    ),
    totalInventoryUnits: stock.reduce((a, m) => a + m.stock, 0),
    sales: sales.slice(0, 40),
    materials: stock
  });
});

api.get("/financial-details", (_req, res) => {
  const today = pkDate();
  const cash = all<AnyRow>(
    `SELECT * FROM direct_sale WHERE is_void = 0 AND date(date_posted) = date(?) ORDER BY id DESC`,
    [today]
  );
  const credit = all<AnyRow>(
    `SELECT * FROM direct_sale WHERE is_void = 0 AND date(date_posted) = date(?) ORDER BY id DESC`,
    [today]
  );
  const totalCash = cash.reduce((a, s) => a + Number(s.paid_amount || 0), 0);
  const totalCredit = credit.reduce(
    (a, s) => a + Math.max(0, Number(s.amount || 0) - Number(s.discount || 0) - Number(s.paid_amount || 0)),
    0
  );
  res.json({ cash, credit, totalCash, totalCredit });
});

api.get("/profit-reports", (_req, res) => {
  const sales = all<AnyRow>("SELECT * FROM direct_sale WHERE is_void = 0");
  const totalSales = sales.reduce((a, s) => a + Number(s.amount || 0), 0);
  const salesByCategory: Record<string, { amount: number; count: number }> = {};
  const topClients: Record<string, { amount: number; count: number }> = {};
  for (const s of sales) {
    const cat = String(s.category || "General");
    if (!salesByCategory[cat]) salesByCategory[cat] = { amount: 0, count: 0 };
    salesByCategory[cat].amount += Number(s.amount || 0);
    salesByCategory[cat].count += 1;
    const client = String(s.client_name || "Unknown");
    if (!topClients[client]) topClients[client] = { amount: 0, count: 0 };
    topClients[client].amount += Number(s.amount || 0);
    topClients[client].count += 1;
  }
  const topMaterials: Record<string, { amount: number; qty: number }> = {};
  const items = all<AnyRow>("SELECT * FROM direct_sale_item");
  for (const item of items) {
    const mat = String(item.material_name || "Unknown");
    if (!topMaterials[mat]) topMaterials[mat] = { amount: 0, qty: 0 };
    topMaterials[mat].amount += Number(item.amount || 0);
    topMaterials[mat].qty += Number(item.qty || 0);
  }
  const totalCost = Object.values(topMaterials).reduce((a, m) => a + m.amount * 0.7, 0); // Approximate cost
  const grossProfit = totalSales - totalCost;
  res.json({
    totalSales,
    totalCost,
    grossProfit,
    profitMargin: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0,
    salesByCategory: Object.entries(salesByCategory).map(([category, data]) => ({ category, ...data })),
    topClients: Object.entries(topClients)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
    topMaterials: Object.entries(topMaterials)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  });
});

api.get(["/void-audit", "/void_audit"], (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).toLowerCase().trim() : "";
    const section = req.query.section ? String(req.query.section).toLowerCase().trim() : "all";

    const rows: {
      id: number;
      entity: string;
      title: string;
      details: string;
      date_posted: string;
      amount?: number;
    }[] = [];

    if (section === "all" || section === "direct_sale" || section === "sales" || section === "directsale") {
      const sales = all<AnyRow>("SELECT * FROM direct_sale WHERE is_void = 1 ORDER BY date_posted DESC, id DESC LIMIT 100");
      for (const s of sales) {
        rows.push({
          id: Number(s.id),
          entity: "DirectSale",
          title: `Direct Sale: ${s.manual_bill_no || s.auto_bill_no || s.id} (${s.client_name || "Unknown"})`,
          details: `Category: ${s.category || "-"} | Amount: Rs. ${Number(s.amount || 0)} | Note: ${s.note || "-"}`,
          date_posted: String(s.date_posted || ""),
          amount: Number(s.amount || 0)
        });
      }
    }

    if (section === "all" || section === "booking" || section === "bookings") {
      const bookings = all<AnyRow>("SELECT * FROM booking WHERE is_void = 1 ORDER BY date_posted DESC, id DESC LIMIT 100");
      for (const b of bookings) {
        rows.push({
          id: Number(b.id),
          entity: "Booking",
          title: `Booking: ${b.manual_bill_no || b.auto_bill_no || b.id} (${b.client_name || "Unknown"})`,
          details: `Amount: Rs. ${Number(b.amount || 0)} | Paid: Rs. ${Number(b.paid_amount || 0)} | Note: ${b.note || "-"}`,
          date_posted: String(b.date_posted || ""),
          amount: Number(b.amount || 0)
        });
      }
    }

    if (section === "all" || section === "grn") {
      const grns = all<AnyRow>("SELECT * FROM grn WHERE is_void = 1 ORDER BY date_posted DESC, id DESC LIMIT 100");
      for (const g of grns) {
        rows.push({
          id: Number(g.id),
          entity: "GRN",
          title: `GRN: ${g.manual_bill_no || g.auto_bill_no || g.id} (${g.supplier || "Unknown"})`,
          details: `Paid: Rs. ${Number(g.paid_amount || 0)} | Note: ${g.note || "-"}`,
          date_posted: String(g.date_posted || "")
        });
      }
    }

    if (section === "all" || section === "payment" || section === "payments") {
      const payments = all<AnyRow>("SELECT * FROM payment WHERE is_void = 1 ORDER BY date_posted DESC, id DESC LIMIT 100");
      for (const p of payments) {
        rows.push({
          id: Number(p.id),
          entity: "Payment",
          title: `Payment: ${p.manual_bill_no || p.auto_bill_no || p.id} (${p.client_name || "Unknown"})`,
          details: `Method: ${p.method || "-"} | Amount: Rs. ${Number(p.amount || 0)} | Note: ${p.note || "-"}`,
          date_posted: String(p.date_posted || ""),
          amount: Number(p.amount || 0)
        });
      }
    }

    if (section === "all" || section === "return" || section === "returns" || section === "material_return" || section === "materialreturn") {
      const returns = all<AnyRow>("SELECT * FROM material_return WHERE is_void = 1 ORDER BY date_posted DESC, id DESC LIMIT 100");
      for (const r of returns) {
        rows.push({
          id: Number(r.id),
          entity: "MaterialReturn",
          title: `Return: ${r.manual_bill_no || r.auto_bill_no || r.id} (${r.client_name || "Unknown"})`,
          details: `Type: ${r.return_type || "normal"} | Amount: Rs. ${Number(r.amount || 0)} | Note: ${r.note || "-"}`,
          date_posted: String(r.date_posted || ""),
          amount: Number(r.amount || 0)
        });
      }
    }

    if (section === "all" || section === "pending" || section === "pending_bill" || section === "pendingbill") {
      const pbs = all<AnyRow>("SELECT * FROM pending_bill WHERE is_void = 1 ORDER BY created_at DESC, id DESC LIMIT 100");
      for (const pb of pbs) {
        rows.push({
          id: Number(pb.id),
          entity: "PendingBill",
          title: `Pending Bill: ${pb.bill_no} (${pb.client_name || pb.client_code || "Unknown"})`,
          details: `Amount: Rs. ${Number(pb.amount || 0)} | Reason: ${pb.reason || "-"}`,
          date_posted: String(pb.created_at || ""),
          amount: Number(pb.amount || 0)
        });
      }
    }

    const filtered = q
      ? rows.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.details.toLowerCase().includes(q) ||
            r.entity.toLowerCase().includes(q)
        )
      : rows;

    res.json({
      records: filtered,
      voidedSales: rows.filter((r) => r.entity === "DirectSale"),
      voidedBookings: rows.filter((r) => r.entity === "Booking"),
      voidedGrns: rows.filter((r) => r.entity === "GRN"),
      voidedPayments: rows.filter((r) => r.entity === "Payment"),
      voidedReturns: rows.filter((r) => r.entity === "MaterialReturn"),
      voidedPendingBills: rows.filter((r) => r.entity === "PendingBill")
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

api.post(["/void_audit/restore/:entity/:id", "/restore_audit_record/:entity/:id", "/void-audit/restore/:entity/:id"], (req, res) => {
  try {
    const { entity, id } = req.params;
    const recordId = Number(id);
    const entLower = String(entity || "").toLowerCase();

    tx(() => {
      if (entLower === "directsale" || entLower === "direct_sale" || entLower === "sale") {
        run("UPDATE direct_sale SET is_void = 0 WHERE id = ?", [recordId]);
        run("UPDATE entry SET is_void = 0 WHERE source_table = 'direct_sale' AND source_id = ?", [recordId]);
        run("UPDATE pending_bill SET is_void = 0 WHERE source_table = 'direct_sale' AND source_id = ?", [recordId]);
      } else if (entLower === "booking") {
        run("UPDATE booking SET is_void = 0 WHERE id = ?", [recordId]);
        run("UPDATE pending_bill SET is_void = 0 WHERE source_table = 'booking' AND source_id = ?", [recordId]);
      } else if (entLower === "grn") {
        run("UPDATE grn SET is_void = 0 WHERE id = ?", [recordId]);
        run("UPDATE entry SET is_void = 0 WHERE source_table = 'grn' AND source_id = ?", [recordId]);
      } else if (entLower === "payment") {
        run("UPDATE payment SET is_void = 0 WHERE id = ?", [recordId]);
        run("UPDATE pending_bill SET is_void = 0 WHERE source_table = 'payment' AND source_id = ?", [recordId]);
      } else if (entLower === "materialreturn" || entLower === "material_return" || entLower === "return") {
        run("UPDATE material_return SET is_void = 0 WHERE id = ?", [recordId]);
        run("UPDATE entry SET is_void = 0 WHERE source_table = 'material_return' AND source_id = ?", [recordId]);
      } else if (entLower === "pendingbill" || entLower === "pending_bill") {
        run("UPDATE pending_bill SET is_void = 0 WHERE id = ?", [recordId]);
      } else if (entLower === "accounttransaction" || entLower === "account_transaction") {
        run("UPDATE account_transaction SET is_void = 0, voided_at = NULL, voided_by = NULL WHERE id = ?", [recordId]);
      }
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

api.get("/materials/:id/ledger", (req, res) => {
  const material = one<AnyRow>(
    `SELECT m.*, c.name AS category_name FROM material m
     LEFT JOIN material_category c ON c.id = m.category_id WHERE m.id = ?`,
    [req.params.id]
  );
  if (!material) return res.status(404).json({ error: "Material not found" });
  const entries = all(
    `SELECT * FROM entry WHERE is_void = 0 AND material = ? ORDER BY date DESC, id DESC`,
    [material.name]
  );
  const totalIn = entries.filter((e: any) => e.type === "IN").reduce((a: number, e: any) => a + Number(e.qty || 0), 0);
  const totalOut = entries.filter((e: any) => e.type === "OUT").reduce((a: number, e: any) => a + Number(e.qty || 0), 0);
  res.json({
    material,
    entries,
    opening: 0,
    closing: totalIn - totalOut,
    totalIn,
    totalOut
  });
});

api.get("/accounts/:id/ledger", (req, res) => {
  const account = one<AnyRow>("SELECT * FROM account WHERE id = ?", [req.params.id]);
  if (!account) return res.status(404).json({ error: "Account not found" });
  const transactions = all<AnyRow>(
    `SELECT t.*, fa.name AS from_name, ta.name AS to_name
     FROM account_transaction t
     LEFT JOIN account fa ON fa.id = t.from_account_id
     LEFT JOIN account ta ON ta.id = t.to_account_id
     WHERE (t.from_account_id = ? OR t.to_account_id = ?)
     ORDER BY t.date_posted DESC, t.id DESC`,
    [account.id, account.id]
  );
  const opening = Number(account.opening_balance || account.balance || 0);
  const totalIn = transactions
    .filter((t) => t.to_account_id === account.id && !t.is_void)
    .reduce((a, t) => a + Number(t.amount || 0), 0);
  const totalOut = transactions
    .filter((t) => t.from_account_id === account.id && !t.is_void)
    .reduce((a, t) => a + Number(t.amount || 0), 0);
  res.json({
    account,
    transactions,
    opening,
    totalIn,
    totalOut,
    closing: opening + totalIn - totalOut
  });
});

/* ---------------- xlsx ---------------- */
api.get("/export/master", async (_req, res) => {
  const wb = await buildMasterWorkbook();
  await sendWorkbook(res, wb, xlsxFilename("AMS_master_export"));
});

api.get("/export/full-raw", async (_req, res) => {
  const wb = await buildFullRawWorkbook();
  await sendWorkbook(res, wb, xlsxFilename("AMS_full_raw_export"));
});

api.get("/export/template", async (_req, res) => {
  const wb = await buildMasterWorkbook();
  for (const ws of wb.worksheets) {
    if (ws.name === "__AMS_META__") continue;
    if (ws.rowCount > 1) ws.spliceRows(2, ws.rowCount - 1);
  }
  await sendWorkbook(res, wb, "AMS_import_template.xlsx");
});

api.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "Choose an .xlsx file" });
  const mode = req.body.mode === "full_raw" ? "full_raw" : "master";
  try {
    const table_results = await importWorkbook(req.file.buffer, mode);
    const inserted = table_results.reduce((a, r) => a + r.inserted, 0);
    const updated = table_results.reduce((a, r) => a + r.updated, 0);
    const failed = table_results.reduce((a, r) => a + r.failed, 0);
    res.json({
      ok: failed === 0,
      inserted,
      updated,
      failed,
      table_results,
      headline: `Inserted ${inserted}, updated ${updated}, failed ${failed}`
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
