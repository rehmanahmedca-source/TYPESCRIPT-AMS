import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { seedIfEmpty } from "./seed.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

export const instanceDir = path.join(root, "instance");
export const dbPath = path.join(instanceDir, "ahmed_cement.db");

fs.mkdirSync(instanceDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = OFF");
db.exec("PRAGMA busy_timeout = 5000");

function applySchema() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS to avoid errors on restart
  const safeSchema = schema.replace(/CREATE TABLE\s+/gi, "CREATE TABLE IF NOT EXISTS ");
  db.exec(safeSchema);
  const indexes = [
    "CREATE INDEX IF NOT EXISTS ix_grn_auto_bill_no ON grn(auto_bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_grn_manual_bill_no ON grn(manual_bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_direct_sale_manual_bill_no ON direct_sale(manual_bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_direct_sale_auto_bill_no ON direct_sale(auto_bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_booking_manual_bill_no ON booking(manual_bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_booking_auto_bill_no ON booking(auto_bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_payment_manual_bill_no ON payment(manual_bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_payment_auto_bill_no ON payment(auto_bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_entry_bill_no ON entry(bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_entry_material ON entry(material)",
    "CREATE INDEX IF NOT EXISTS ix_entry_type ON entry(type)",
    "CREATE INDEX IF NOT EXISTS ix_pending_bill_bill_no ON pending_bill(bill_no)",
    "CREATE INDEX IF NOT EXISTS ix_client_code ON client(code)",
    "CREATE INDEX IF NOT EXISTS ix_material_code ON material(code)",
    "CREATE INDEX IF NOT EXISTS ix_direct_sale_date ON direct_sale(date_posted)",
    "CREATE INDEX IF NOT EXISTS ix_payment_date ON payment(date_posted)"
  ];
  for (const sql of indexes) {
    try {
      db.exec(sql);
    } catch {
      /* ignore */
    }
  }
}

applySchema();
seedIfEmpty(db);

export type Row = Record<string, unknown>;

export function all<T = Row>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function one<T = Row>(sql: string, params: unknown[] = []): T | undefined {
  return (db.prepare(sql).get(...params) as T | undefined) ?? undefined;
}

export function run(sql: string, params: unknown[] = []) {
  const result = db.prepare(sql).run(...params) as { lastInsertRowid?: number | bigint; changes?: number };
  return {
    lastInsertRowid: Number(result.lastInsertRowid || 0),
    changes: Number(result.changes || 0)
  };
}

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export function tableNames(): string[] {
  return all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY 1"
  ).map((r) => r.name);
}

export function tableColumns(table: string): string[] {
  return all<{ name: string }>(`PRAGMA table_info(${JSON.stringify(table)})`).map((c) => c.name);
}
