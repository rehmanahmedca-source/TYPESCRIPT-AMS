import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ams-schema-"));
process.env.APP_DB_PATH = path.join(dir, "test.sqlite");

try {
  const { db } = await import("../server/db.ts");
  const tableCount = Number((db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get() as { n: number }).n);
  const indexCount = Number((db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex%'").get() as { n: number }).n);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
  const columnCount = tables.reduce((total, table) => total + db.prepare(`PRAGMA table_info("${table.name}")`).all().length, 0);
  const foreignKeyCount = tables.reduce((total, table) => total + db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all().length, 0);
  const foreignKeysEnabled = Number((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys);

  assert.equal(tableCount, 64, "AMS99 table contract changed");
  assert.equal(columnCount, 781, "AMS99 column contract changed");
  assert.equal(indexCount, 218, "AMS99 index contract changed");
  // The TypeScript port fixes AMS99's missing destination-account FK, hence 57
  // rather than the reference database's 56.
  assert.equal(foreignKeyCount, 57, "foreign-key contract changed");
  assert.equal(foreignKeysEnabled, 1, "SQLite foreign keys must be enabled");
  assert.ok(tables.some((table) => table.name === "cash_flow_entry_audit"));
  db.close();
  console.log("Schema parity check passed (64 tables, 781 columns, 218 indexes, foreign keys enabled).");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
