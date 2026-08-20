import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "./migrations.ts";
import { seedIfEmpty } from "./seed.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

export const dbPath = path.resolve(process.env.APP_DB_PATH || path.join(root, "instance", "ahmed_cement.db"));
export const instanceDir = path.dirname(dbPath);

fs.mkdirSync(instanceDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 8000");
db.exec("PRAGMA foreign_keys = OFF");

function applySchema() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const safeSchema = schema.replace(/CREATE TABLE\s+/gi, "CREATE TABLE IF NOT EXISTS ");
  db.exec(safeSchema);
  migrateDatabase(db, __dirname);
}

applySchema();
db.exec("PRAGMA foreign_keys = ON");
try {
  const requested = (process.env.SQLITE_JOURNAL_MODE || "WAL").toUpperCase();
  const mode = ["WAL", "DELETE", "TRUNCATE", "PERSIST", "MEMORY", "OFF"].includes(requested) ? requested : "WAL";
  db.exec(`PRAGMA journal_mode = ${mode}`);
} catch (error) {
  console.warn("Could not set SQLite journal mode; using database default", error);
}
seedIfEmpty(db);

export type Row = Record<string, any>;

export function all<T = Row>(sql: string, params: any[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function one<T = Row>(sql: string, params: any[] = []): T | undefined {
  return (db.prepare(sql).get(...params) as T | undefined) ?? undefined;
}

export function run(sql: string, params: any[] = []) {
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
