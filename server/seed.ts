import type { DatabaseSync } from "node:sqlite";
type Database = DatabaseSync;
import bcrypt from "bcryptjs";
import { pkNow, toMinor } from "./money.ts";

export function seedIfEmpty(db: Database) {
  const userCount = (db.prepare("SELECT COUNT(*) AS n FROM user").get() as { n: number }).n;
  if (userCount === 0) {
    const username = (process.env.DEFAULT_ADMIN_USER || "Admin").trim() || "Admin";
    const password = (process.env.DEFAULT_ADMIN_PASSWORD || "Admin@fbm12345").trim();
    db.prepare(
      `INSERT INTO user (
        username, password_hash, role, status,
        can_view_stock, can_view_daily, can_view_history, can_import_export,
        can_manage_directory, can_view_dashboard, can_manage_grn, can_manage_bookings,
        can_manage_payments, can_manage_sales, can_view_delivery_rent, can_manage_pending_bills,
        can_view_reports, can_manage_notifications, can_view_client_ledger, can_view_supplier_ledger,
        can_view_decision_ledger, can_manage_clients, can_manage_suppliers, can_manage_materials,
        can_manage_delivery_persons, can_access_settings, created_at
      ) VALUES (?, ?, 'admin', 'active', 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1, ?)`
    ).run(username, bcrypt.hashSync(password, 10), pkNow());
  }

  const settingsCount = (db.prepare("SELECT COUNT(*) AS n FROM settings").get() as { n: number }).n;
  if (settingsCount === 0) {
    db.prepare(
      `INSERT INTO settings (currency, company_name, company_address, company_phone, tax_rate, invoice_prefix, bill_prefix, ui_theme, allow_global_negative_stock)
       VALUES ('PKR', 'Ahmed Material System', 'JALAL PUR SOBTIAN', '+92302-0000993 +92331-0000993', 0, 'INV-', '#', 'dark', 0)`
    ).run();
  }

  const materialCount = (db.prepare("SELECT COUNT(*) AS n FROM material").get() as { n: number }).n;
  if (materialCount > 0) return;

  const now = pkNow();
  const cats = ["Cement", "Steel", "Aggregates", "General"];
  const insertCat = db.prepare(
    "INSERT INTO material_category (name, is_active, created_at) VALUES (?, 1, ?)"
  );
  const catIds: Record<string, number> = {};
  for (const name of cats) {
    catIds[name] = Number(insertCat.run(name, now).lastInsertRowid);
  }

  const materials = [
    ["FC-01", "Fauji Cement", "Cement", 1250, "Bags"],
    ["BW-01", "Bestway Cement", "Cement", 1240, "Bags"],
    ["LC-01", "Lucky Cement", "Cement", 1260, "Bags"],
    ["DG-01", "DG Cement", "Cement", 1230, "Bags"],
    ["ML-01", "Maple Leaf Cement", "Cement", 1270, "Bags"],
    ["CH-01", "Cherat Cement", "Cement", 1240, "Bags"],
    ["ST-60", "Steel Rebar Grade 60", "Steel", 265000, "Tons"],
    ["CR-01", "Crush / Aggregate", "Aggregates", 85, "Cu.Ft"],
    ["SD-01", "Ravi Sand", "Aggregates", 35, "Cu.Ft"]
  ] as const;
  const insertMat = db.prepare(
    "INSERT INTO material (code, name, category_id, unit_price, total, unit, is_active, created_at) VALUES (?, ?, ?, ?, 0, ?, 1, ?)"
  );
  for (const [code, name, cat, price, unit] of materials) {
    insertMat.run(code, name, catIds[cat], price, unit, now);
  }

  const clients = [
    ["CL-001", "Al-Rehman Builders", "0300-1234567", "Plot 42, Commercial Zone, Lahore", "Contractor", 302000],
    ["CL-002", "Malik & Sons Construction", "0321-7654321", "Sector H, DHA Phase 6, Lahore", "Builder", 0],
    ["CL-003", "Green City Developers", "0333-9876543", "Main Raiwind Road, Lahore", "Corporate", 0],
    ["CL-004", "Ahmed Bilal", "0312-5554433", "Block B, Model Town, Lahore", "Retail", 0],
    ["CL-005", "Royal Heights Project", "0345-8889900", "Main Boulevard, Gulberg III, Lahore", "Commercial", 0]
  ] as const;
  const insertClient = db.prepare(
    `INSERT INTO client (code, name, phone, address, category, opening_balance, opening_balance_date, is_active, require_manual_invoice, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`
  );
  for (const [code, name, phone, address, category, ob] of clients) {
    insertClient.run(code, name, phone, address, category, ob, now, now);
  }

  const suppliers = [
    ["Fauji Cement Company Ltd", "051-5551122", "Rawalpindi Industrial Zone", 570000],
    ["Bestway Cement Mills", "051-4443322", "Hattar Industrial Estate", 0],
    ["Mughal Steel Industries", "042-3665544", "Badami Bagh, Lahore", 0],
    ["Allied Logistics & Transport", "0300-9988776", "Kot Lakhpat Terminal, Lahore", 0]
  ] as const;
  const insertSup = db.prepare(
    "INSERT INTO supplier (name, phone, address, opening_balance, opening_balance_date, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
  );
  for (const [name, phone, address, ob] of suppliers) {
    insertSup.run(name, phone, address, ob, now, now);
  }

  const drivers = [
    ["Tariq Mehmood", "0301-4455667", 0],
    ["Asif Khan", "0322-9988112", 0],
    ["Imran Ali", "0334-1122334", 0],
    ["Bilal Shah", "0315-7766554", 0]
  ] as const;
  const insertDp = db.prepare(
    "INSERT INTO delivery_person (name, phone, opening_balance, opening_balance_date, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  );
  for (const [name, phone, ob] of drivers) insertDp.run(name, phone, ob, now, now);

  const accounts = [
    ["Physical Cash Drawer", "Cash", "cash", "company", 385000],
    ["Meezan Bank - Main Business A/c", "Bank", "bank", "company", 1420000],
    ["HBL - Corporate Collection A/c", "Bank", "bank", "company", 850000],
    ["Petty Cash Yard", "Cash", "cash", "company", 45000]
  ] as const;
  const insertAcc = db.prepare(
    `INSERT INTO account (name, type, category, account_type, balance, balance_minor, opening_balance, opening_balance_minor, opening_balance_date, is_active, revision, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`
  );
  for (const [name, type, category, accountType, bal] of accounts) {
    insertAcc.run(name, type, category, accountType, bal, toMinor(bal), bal, toMinor(bal), now, now, now);
  }

  const accCats = ["Client Payment", "Supplier Payment", "Yard Expense", "Vehicle Diesel", "Bank Deposit", "Internal Transfer"];
  const insertAccCat = db.prepare("INSERT INTO account_category (name, is_active, created_at) VALUES (?, 1, ?)");
  for (const name of accCats) insertAccCat.run(name, now);

  const cfCats = [
    ["Sales Receipts", "in", 1],
    ["Client Recoveries", "in", 2],
    ["Supplier Payments", "out", 3],
    ["Yard Expenses", "out", 4],
    ["Fuel & Fleet", "out", 5],
    ["Transfers", "both", 6]
  ] as const;
  const insertCf = db.prepare(
    "INSERT INTO cash_flow_category (name, direction, is_active, sort_order, created_at) VALUES (?, ?, 1, ?, ?)"
  );
  for (const [name, dir, sort] of cfCats) insertCf.run(name, dir, sort, now);

  const drawerCats = ["Labour", "Tea", "Fuel", "Misc", "Freight", "Loading"];
  const insertDc = db.prepare(
    "INSERT INTO fbm_cash_drawer_category (name, is_active, created_at) VALUES (?, 1, ?)"
  );
  for (const name of drawerCats) insertDc.run(name, now);

  for (const ns of ["GEN", "SL", "BK", "GRN", "CP", "SP", "RTN", "EN"]) {
    db.prepare("INSERT INTO bill_counter (namespace, count) VALUES (?, 1000)").run(ns);
  }

  // Opening GRNs so stock is real
  const insertGrn = db.prepare(
    `INSERT INTO grn (supplier_id, supplier, auto_bill_no, paid_amount, date_posted, is_void, note)
     VALUES (?, ?, ?, 0, ?, 0, 'Seed intake')`
  );
  const insertGi = db.prepare(
    "INSERT INTO grn_item (grn_id, mat_name, qty, price_at_time, is_void, is_locked) VALUES (?, ?, ?, ?, 0, 0)"
  );
  const insertEntry = db.prepare(
    `INSERT INTO entry (date, time, type, material, client, qty, bill_no, auto_bill_no, created_by, created_at, is_void, transaction_category, source_module, source_table, source_id, transaction_type)
     VALUES (?, '09:00:00', 'IN', ?, ?, ?, ?, ?, 'Admin', ?, 0, 'GRN', 'grn', 'grn', ?, 'GRN')`
  );
  const lots = [
    [1, "Fauji Cement Company Ltd", "Fauji Cement", 4500, 1180, "SB-GRN-1001"],
    [2, "Bestway Cement Mills", "Bestway Cement", 3800, 1170, "SB-GRN-1002"],
    [1, "Fauji Cement Company Ltd", "Lucky Cement", 2500, 1190, "SB-GRN-1003"],
    [1, "Fauji Cement Company Ltd", "DG Cement", 1800, 1160, "SB-GRN-1004"],
    [2, "Bestway Cement Mills", "Maple Leaf Cement", 2100, 1200, "SB-GRN-1005"],
    [2, "Bestway Cement Mills", "Cherat Cement", 1200, 1175, "SB-GRN-1006"],
    [3, "Mughal Steel Industries", "Steel Rebar Grade 60", 85, 255000, "SB-GRN-1007"],
    [4, "Allied Logistics & Transport", "Crush / Aggregate", 12000, 70, "SB-GRN-1008"],
    [4, "Allied Logistics & Transport", "Ravi Sand", 15000, 35, "SB-GRN-1009"]
  ] as const;
  for (const [sid, sname, mat, qty, rate, bill] of lots) {
    const id = Number(insertGrn.run(sid, sname, bill, "2026-08-10T09:00:00").lastInsertRowid);
    insertGi.run(id, mat, qty, rate);
    insertEntry.run("2026-08-10", mat, sname, qty, bill, bill, now, id);
  }
  db.prepare("UPDATE bill_counter SET count = 1009 WHERE namespace = 'GRN'").run();
}
