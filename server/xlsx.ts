import ExcelJS from "exceljs";
import type { Request, Response } from "express";
import { all, db, tableColumns, tableNames, tx } from "./db.ts";
import { pkNow } from "./money.ts";

export const MASTER_SHEETS = [
  "Clients",
  "MaterialCategories",
  "Materials",
  "PendingBills",
  "Dispatch",
  "Bookings",
  "BookingItems",
  "Payments",
  "Sales",
  "SaleItems",
  "GRN",
  "GRNItems",
  "DeliveryPersons",
  "DeliveryRents",
  "FBMCashDrawer",
  "FBMCashDrawerCategories",
  "Users",
  "Suppliers",
  "Accounts"
];

const EXCLUDE = new Set(["user_login_session", "tenant_wipe_backup_history"]);

function sheetFromRows(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[], columns?: string[]) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : ["id"]);
  ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(28, Math.max(12, c.length + 4)) }));
  for (const row of rows) {
    const out: Record<string, unknown> = {};
    for (const c of cols) out[c] = row[c] ?? "";
    ws.addRow(out);
  }
}

export async function buildMasterWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AMS ERP";
  wb.created = new Date();

  const clients = all(`SELECT code, name, phone, address, category,
    financial_book_no, financial_page, cement_book_no, cement_page, steel_book_no, steel_page,
    book_no, location_url, page_notes, CASE WHEN is_active=1 THEN 'active' ELSE 'inactive' END AS status
    FROM client ORDER BY name`);
  sheetFromRows(wb, "Clients", clients);

  const cats = all("SELECT id, name, is_active FROM material_category ORDER BY name");
  sheetFromRows(wb, "MaterialCategories", cats);

  const mats = all(
    `SELECT m.code, m.name, c.name AS category_name, m.unit_price, m.total, m.unit, m.is_active
     FROM material m LEFT JOIN material_category c ON c.id = m.category_id ORDER BY m.name`
  );
  sheetFromRows(wb, "Materials", mats);

  const pending = all(
    "SELECT client_code, bill_no, client_name AS name, amount, reason, nimbus_no AS nimbus FROM pending_bill WHERE is_void = 0"
  );
  sheetFromRows(wb, "PendingBills", pending);

  const dispatch = all(
    `SELECT client_code AS CLIENT_CODE, client AS CLIENT_NAME, client_category AS CLIENT_CATEGORY,
            transaction_category AS TRANSACTION_CATEGORY, bill_no AS BILL_NO, date AS BILL_DATE,
            material AS CEMENT_BRAND, qty AS QTY, nimbus_no AS NIMBUS, note AS NOTES,
            source_module AS SOURCE, '' AS MATCH_STATUS
     FROM entry WHERE is_void = 0 ORDER BY date DESC, id DESC`
  );
  sheetFromRows(wb, "Dispatch", dispatch);

  const bookings = all(
    "SELECT client_name, manual_bill_no, amount, paid_amount, date_posted, note FROM booking WHERE is_void = 0"
  );
  sheetFromRows(wb, "Bookings", bookings);

  const bookingItems = all(
    `SELECT b.manual_bill_no AS booking_bill_no, b.auto_bill_no AS booking_auto_bill,
            b.client_name AS booking_client_name, i.material_name, i.qty, i.price_at_time
     FROM booking_item i JOIN booking b ON b.id = i.booking_id WHERE b.is_void = 0`
  );
  sheetFromRows(wb, "BookingItems", bookingItems);

  const payments = all(
    "SELECT client_name, manual_bill_no, amount, method, date_posted, note FROM payment WHERE is_void = 0"
  );
  sheetFromRows(wb, "Payments", payments);

  const sales = all(
    `SELECT client_name, manual_bill_no, auto_bill_no, category, amount, paid_amount,
            rent_item_revenue, delivery_rent_cost, rent_variance_loss, date_posted, note
     FROM direct_sale WHERE is_void = 0`
  );
  sheetFromRows(wb, "Sales", sales);

  const saleItems = all(
    `SELECT COALESCE(s.manual_bill_no, s.auto_bill_no) AS sale_bill_no, s.client_name AS sale_client_name,
            i.product_name, i.qty, i.price_at_time
     FROM direct_sale_item i JOIN direct_sale s ON s.id = i.sale_id WHERE s.is_void = 0`
  );
  sheetFromRows(wb, "SaleItems", saleItems);

  const grn = all("SELECT supplier, manual_bill_no, auto_bill_no, date_posted, note FROM grn WHERE is_void = 0");
  sheetFromRows(wb, "GRN", grn);

  const grnItems = all(
    `SELECT g.manual_bill_no AS "GRN Manual Bill", g.auto_bill_no AS "GRN Auto Bill",
            i.mat_name AS "Material Name", i.qty AS Quantity, i.price_at_time AS Rate
     FROM grn_item i JOIN grn g ON g.id = i.grn_id WHERE g.is_void = 0`
  );
  sheetFromRows(wb, "GRNItems", grnItems);

  const dps = all("SELECT name, phone, opening_balance, is_active FROM delivery_person");
  sheetFromRows(wb, "DeliveryPersons", dps);

  const rents = all(
    "SELECT delivery_person_name, bill_no, amount, note, date_posted FROM delivery_rent WHERE is_void = 0"
  );
  sheetFromRows(wb, "DeliveryRents", rents);

  const drawer = all(
    "SELECT entry_type, amount, category, method, note, date_posted FROM fbm_cash_drawer_entry WHERE is_void = 0"
  );
  sheetFromRows(wb, "FBMCashDrawer", drawer);

  const drawerCats = all("SELECT name, is_active FROM fbm_cash_drawer_category");
  sheetFromRows(wb, "FBMCashDrawerCategories", drawerCats);

  const users = all("SELECT username, role, status FROM user");
  sheetFromRows(wb, "Users", users);

  const suppliers = all("SELECT name, phone, address, opening_balance, is_active FROM supplier");
  sheetFromRows(wb, "Suppliers", suppliers);

  const accounts = all("SELECT name, type, category, account_type, balance, bank_name, account_number, is_active FROM account");
  sheetFromRows(wb, "Accounts", accounts);

  sheetFromRows(wb, "__AMS_META__", [
    { key: "exported_at", value: pkNow() },
    { key: "app", value: "REACT-AMS TypeScript" },
    { key: "format", value: "master" }
  ], ["key", "value"]);

  return wb;
}

export async function buildFullRawWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AMS ERP";
  for (const name of tableNames()) {
    if (EXCLUDE.has(name)) continue;
    const cols = tableColumns(name);
    const rows = all(`SELECT * FROM "${name}"`);
    sheetFromRows(wb, name, rows, cols);
  }
  sheetFromRows(wb, "__AMS_META__", [
    { key: "exported_at", value: pkNow() },
    { key: "app", value: "REACT-AMS TypeScript" },
    { key: "format", value: "full_raw" }
  ], ["key", "value"]);
  return wb;
}

export async function sendWorkbook(res: Response, wb: ExcelJS.Workbook, filename: string) {
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-AMS-Export-Sheets", wb.worksheets.map((s) => s.name).join(","));
  res.send(buf);
}

function sheetRows(ws: ExcelJS.Worksheet): Record<string, string>[] {
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.value ?? "").trim();
  });
  const out: Record<string, string>[] = [];
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const rec: Record<string, string> = {};
    let empty = true;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = row.getCell(col).value;
      const text = v == null ? "" : typeof v === "object" && v && "text" in (v as object)
        ? String((v as { text: string }).text)
        : String(v);
      rec[h] = text.trim();
      if (text.trim()) empty = false;
    });
    if (!empty) out.push(rec);
  });
  return out;
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  const map = new Map(Object.keys(row).map((k) => [k.toLowerCase().replace(/[\s_]+/g, ""), row[k]]));
  for (const k of keys) {
    const hit = map.get(k.toLowerCase().replace(/[\s_]+/g, ""));
    if (hit) return hit;
  }
  return "";
}

export async function importWorkbook(buffer: Buffer, mode: "master" | "full_raw" = "master") {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const report: { name: string; status: string; inserted: number; updated: number; skipped: number; failed: number; error?: string }[] = [];

  if (mode === "full_raw") {
    return tx(() => {
      for (const ws of wb.worksheets) {
        const name = ws.name;
        if (name.startsWith("__")) continue;
        if (!tableNames().includes(name)) {
          report.push({ name, status: "skipped", inserted: 0, updated: 0, skipped: 1, failed: 0, error: "unknown table" });
          continue;
        }
        const cols = tableColumns(name);
        const rows = sheetRows(ws);
        let inserted = 0;
        let failed = 0;
        for (const row of rows) {
          const keys = cols.filter((c) => row[c] !== undefined && row[c] !== "");
          if (!keys.length) continue;
          try {
            const placeholders = keys.map(() => "?").join(",");
            db.prepare(
              `INSERT OR REPLACE INTO "${name}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${placeholders})`
            ).run(...keys.map((k) => row[k]));
            inserted += 1;
          } catch (err) {
            failed += 1;
            if (!report.find((r) => r.name === name && r.error)) {
              report.push({
                name,
                status: "partial",
                inserted,
                updated: 0,
                skipped: 0,
                failed,
                error: err instanceof Error ? err.message : String(err)
              });
            }
          }
        }
        if (!report.some((r) => r.name === name)) {
          report.push({ name, status: failed ? "partial" : "ok", inserted, updated: 0, skipped: 0, failed });
        }
      }
      return report;
    });
  }

  return tx(() => {
    const byName = new Map(wb.worksheets.map((s) => [s.name, s]));

    const cats = byName.get("MaterialCategories");
    if (cats) {
      let inserted = 0;
      for (const row of sheetRows(cats)) {
        const name = pick(row, "name");
        if (!name) continue;
        const exists = db.prepare("SELECT id FROM material_category WHERE name = ? COLLATE NOCASE").get(name);
        if (!exists) {
          db.prepare("INSERT INTO material_category (name, is_active, created_at) VALUES (?, 1, ?)").run(name, pkNow());
          inserted += 1;
        }
      }
      report.push({ name: "MaterialCategories", status: "ok", inserted, updated: 0, skipped: 0, failed: 0 });
    }

    const mats = byName.get("Materials");
    if (mats) {
      let inserted = 0;
      let updated = 0;
      for (const row of sheetRows(mats)) {
        const name = pick(row, "name");
        if (!name) continue;
        const catName = pick(row, "category_name", "category") || "General";
        let cat = db.prepare("SELECT id FROM material_category WHERE name = ? COLLATE NOCASE").get(catName) as { id: number } | undefined;
        if (!cat) {
          const info = db.prepare("INSERT INTO material_category (name, is_active, created_at) VALUES (?, 1, ?)").run(catName, pkNow());
          cat = { id: Number(info.lastInsertRowid) };
        }
        const code = pick(row, "code") || name.slice(0, 8).toUpperCase();
        const price = Number(pick(row, "unit_price", "rate") || 0);
        const unit = pick(row, "unit") || "Bags";
        const existing = db.prepare("SELECT id FROM material WHERE name = ? COLLATE NOCASE").get(name) as { id: number } | undefined;
        if (existing) {
          db.prepare("UPDATE material SET code=?, category_id=?, unit_price=?, unit=? WHERE id=?").run(code, cat.id, price, unit, existing.id);
          updated += 1;
        } else {
          db.prepare(
            "INSERT INTO material (code, name, category_id, unit_price, total, unit, is_active, created_at) VALUES (?, ?, ?, ?, 0, ?, 1, ?)"
          ).run(code, name, cat.id, price, unit, pkNow());
          inserted += 1;
        }
      }
      report.push({ name: "Materials", status: "ok", inserted, updated, skipped: 0, failed: 0 });
    }

    const clients = byName.get("Clients");
    if (clients) {
      let inserted = 0;
      let updated = 0;
      for (const row of sheetRows(clients)) {
        const name = pick(row, "name");
        if (!name) continue;
        const code = pick(row, "code") || name.slice(0, 8).toUpperCase();
        const payload = [
          code,
          name,
          pick(row, "phone"),
          pick(row, "address"),
          pick(row, "category") || "General",
          pick(row, "financial_book_no"),
          pick(row, "financial_page"),
          pick(row, "cement_book_no"),
          pick(row, "cement_page"),
          pick(row, "steel_book_no"),
          pick(row, "steel_page"),
          pick(row, "book_no"),
          pick(row, "location_url"),
          pick(row, "page_notes")
        ];
        const existing = db.prepare("SELECT id FROM client WHERE code = ? OR name = ? COLLATE NOCASE").get(code, name) as { id: number } | undefined;
        if (existing) {
          db.prepare(
            `UPDATE client SET code=?, name=?, phone=?, address=?, category=?, financial_book_no=?, financial_page=?,
             cement_book_no=?, cement_page=?, steel_book_no=?, steel_page=?, book_no=?, location_url=?, page_notes=? WHERE id=?`
          ).run(...payload, existing.id);
          updated += 1;
        } else {
          db.prepare(
            `INSERT INTO client (code, name, phone, address, category, financial_book_no, financial_page,
             cement_book_no, cement_page, steel_book_no, steel_page, book_no, location_url, page_notes, opening_balance, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`
          ).run(...payload, pkNow());
          inserted += 1;
        }
      }
      report.push({ name: "Clients", status: "ok", inserted, updated, skipped: 0, failed: 0 });
    }

    const suppliers = byName.get("Suppliers");
    if (suppliers) {
      let inserted = 0;
      for (const row of sheetRows(suppliers)) {
        const name = pick(row, "name");
        if (!name) continue;
        const exists = db.prepare("SELECT id FROM supplier WHERE name = ? COLLATE NOCASE").get(name);
        if (!exists) {
          db.prepare(
            "INSERT INTO supplier (name, phone, address, opening_balance, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
          ).run(name, pick(row, "phone"), pick(row, "address"), Number(pick(row, "opening_balance") || 0), pkNow());
          inserted += 1;
        }
      }
      report.push({ name: "Suppliers", status: "ok", inserted, updated: 0, skipped: 0, failed: 0 });
    }

    const dps = byName.get("DeliveryPersons");
    if (dps) {
      let inserted = 0;
      for (const row of sheetRows(dps)) {
        const name = pick(row, "name");
        if (!name) continue;
        const exists = db.prepare("SELECT id FROM delivery_person WHERE name = ? COLLATE NOCASE").get(name);
        if (!exists) {
          db.prepare(
            "INSERT INTO delivery_person (name, phone, opening_balance, is_active, created_at) VALUES (?, ?, ?, 1, ?)"
          ).run(name, pick(row, "phone"), Number(pick(row, "opening_balance") || 0), pkNow());
          inserted += 1;
        }
      }
      report.push({ name: "DeliveryPersons", status: "ok", inserted, updated: 0, skipped: 0, failed: 0 });
    }

    return report;
  });
}

export function xlsxFilename(prefix: string) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}_${d}.xlsx`;
}

export function handleExportError(_req: Request, res: Response, err: unknown) {
  res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
}
