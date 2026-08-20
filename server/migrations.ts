import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

const REQUIRED_COLUMNS: Record<string, string[]> = {
  cash_flow_category: ["notes VARCHAR(200)", "updated_at DATETIME"],
  cash_flow_subcategory: ["notes VARCHAR(200)", "updated_at DATETIME"],
  cash_flow_party: ["updated_at DATETIME"],
  cash_flow_entry: [
    "amount_minor BIGINT",
    "destination_account_id INTEGER REFERENCES account(id)",
    "reference VARCHAR(200)",
    "updated_by VARCHAR(200)",
    "source_type VARCHAR(200)",
    "source_id INTEGER",
    "voided_at DATETIME",
    "voided_by VARCHAR(200)",
    "void_reason VARCHAR(200)",
    "idempotency_key VARCHAR(200)",
    "revision INTEGER DEFAULT 1",
    "updated_at DATETIME"
  ],
  user: ["can_manage_accounts INTEGER DEFAULT 0", "can_view_cash_flow INTEGER DEFAULT 0"]
};

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function columns(db: DatabaseSync, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

/**
 * Idempotently upgrades databases created by older TypeScript builds.
 * SQLite only supports adding one column at a time, so every operation is
 * guarded using PRAGMA metadata and is safe to run on every startup.
 */
export function migrateDatabase(db: DatabaseSync, serverDir: string) {
  for (const [table, definitions] of Object.entries(REQUIRED_COLUMNS)) {
    const existing = columns(db, table);
    for (const definition of definitions) {
      const name = definition.split(/\s+/, 1)[0];
      if (existing.has(name)) continue;
      db.exec(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${definition}`);
      existing.add(name);
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_flow_entry_audit (
      id INTEGER NOT NULL PRIMARY KEY,
      entry_id INTEGER NOT NULL,
      action VARCHAR(20) NOT NULL,
      before_json TEXT,
      after_json TEXT,
      reason VARCHAR(300),
      changed_by VARCHAR(80),
      changed_at DATETIME,
      FOREIGN KEY(entry_id) REFERENCES cash_flow_entry(id)
    )
  `);

  // The checked-in index contract comes from the audited AMS99 schema. Apply
  // statements separately so a bad legacy duplicate cannot prevent all other
  // performance and integrity indexes from being installed.
  const indexPath = path.join(serverDir, "reference-indexes.sql");
  const indexSql = fs.readFileSync(indexPath, "utf8");
  const failures: string[] = [];
  for (const raw of indexSql.split(";")) {
    const statement = raw.replace(/^\s*--.*$/gm, "").trim();
    if (!statement) continue;
    const safe = statement.replace(/^CREATE\s+(UNIQUE\s+)?INDEX\s+/i, "CREATE $1INDEX IF NOT EXISTS ");
    try {
      db.exec(safe);
    } catch (error) {
      failures.push(`${safe.slice(0, 100)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length) {
    console.warn(`[schema] ${failures.length} AMS99 index(es) could not be applied:\n${failures.join("\n")}`);
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (id INTEGER NOT NULL PRIMARY KEY, version INTEGER, applied_at DATETIME)");
  const row = db.prepare("SELECT id FROM schema_version ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
  if (row) db.prepare("UPDATE schema_version SET version = ?, applied_at = ? WHERE id = ?").run(2, now, row.id);
  else db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(2, now);
}
