import fs from "node:fs";
import path from "node:path";
import { money, pkDate, pkNow } from "./money.ts";

const instanceDir = path.join(process.cwd(), "instance");
const cfPrefsPath = path.join(instanceDir, "cf_prefs.json");
const importReportsDir = path.join(instanceDir, "import_reports");

export type CfPrefs = {
  today_opening_override?: { date: string; amount: number };
  fresh_start_cutoff?: { date: string; at: string };
};

export function readCfPrefs(): CfPrefs {
  try {
    return JSON.parse(fs.readFileSync(cfPrefsPath, "utf8")) as CfPrefs;
  } catch {
    return {};
  }
}

export function writeCfPrefs(prefs: CfPrefs) {
  fs.mkdirSync(instanceDir, { recursive: true });
  fs.writeFileSync(cfPrefsPath, JSON.stringify(prefs, null, 2));
}

export function todayOpeningOverride(): number | null {
  const prefs = readCfPrefs();
  const today = pkDate();
  if (prefs.today_opening_override?.date !== today) return null;
  const amt = Number(prefs.today_opening_override.amount);
  return Number.isFinite(amt) ? money(amt) : null;
}

export function freshStartCutoff(): string | null {
  const prefs = readCfPrefs();
  const today = pkDate();
  if (prefs.fresh_start_cutoff?.date !== today) return null;
  return prefs.fresh_start_cutoff.at || null;
}

export type ImportReport = {
  name: string;
  created_at: string;
  mode: string;
  tenant_name: string;
  status: string;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  warnings: number;
  tables: string;
  source_file: string;
  row_count: number;
};

function metaPath(csvName: string) {
  return path.join(importReportsDir, csvName.replace(/\.csv$/i, ".meta.json"));
}

export function writeImportReport(opts: {
  mode: string;
  source_file: string;
  table_results: { name: string; inserted: number; updated: number; skipped?: number; failed: number; status?: string }[];
}) {
  fs.mkdirSync(importReportsDir, { recursive: true });
  const stamp = pkNow().replace(/[: ]/g, "-");
  const name = `full_raw_${stamp}.csv`;
  const inserted = opts.table_results.reduce((a, r) => a + Number(r.inserted || 0), 0);
  const updated = opts.table_results.reduce((a, r) => a + Number(r.updated || 0), 0);
  const skipped = opts.table_results.reduce((a, r) => a + Number(r.skipped || 0), 0);
  const failed = opts.table_results.reduce((a, r) => a + Number(r.failed || 0), 0);
  const rows = ["table,status,inserted,updated,skipped,failed"];
  for (const r of opts.table_results) {
    rows.push([r.name, r.status || (r.failed ? "partial" : "ok"), r.inserted, r.updated, r.skipped || 0, r.failed].join(","));
  }
  fs.writeFileSync(path.join(importReportsDir, name), rows.join("\n"));
  const meta: ImportReport = {
    name,
    created_at: pkNow(),
    mode: opts.mode,
    tenant_name: "AMS Main Yard",
    status: failed ? "partial" : "ok",
    inserted,
    updated,
    skipped,
    failed,
    warnings: 0,
    tables: opts.table_results.map((r) => r.name).join(", "),
    source_file: opts.source_file || "",
    row_count: inserted + updated + skipped + failed
  };
  fs.writeFileSync(metaPath(name), JSON.stringify(meta, null, 2));
  return meta;
}

export function listImportReports(): ImportReport[] {
  fs.mkdirSync(importReportsDir, { recursive: true });
  const names = fs.readdirSync(importReportsDir).filter((n) => n.endsWith(".csv")).sort().reverse();
  return names.map((name) => {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath(name), "utf8")) as ImportReport;
      return { ...meta, name };
    } catch {
      const st = fs.statSync(path.join(importReportsDir, name));
      return {
        name,
        created_at: st.mtime.toISOString(),
        mode: "full_raw",
        tenant_name: "AMS Main Yard",
        status: "ok",
        inserted: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        warnings: 0,
        tables: "",
        source_file: "",
        row_count: 0
      };
    }
  });
}

export function deleteImportReports(names: string[] | "all") {
  fs.mkdirSync(importReportsDir, { recursive: true });
  const targets = names === "all"
    ? fs.readdirSync(importReportsDir).filter((n) => n.endsWith(".csv"))
    : names.map((n) => path.basename(n)).filter((n) => n.endsWith(".csv"));
  let removed = 0;
  for (const name of targets) {
    const csv = path.join(importReportsDir, name);
    const meta = metaPath(name);
    try {
      if (fs.existsSync(csv)) {
        fs.unlinkSync(csv);
        removed += 1;
      }
      if (fs.existsSync(meta)) fs.unlinkSync(meta);
    } catch {
      /* ignore */
    }
  }
  return removed;
}

export function importReportFile(name: string) {
  const safe = path.basename(name);
  if (safe !== name || !safe.endsWith(".csv")) return null;
  const p = path.join(importReportsDir, safe);
  return fs.existsSync(p) ? p : null;
}
