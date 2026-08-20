import type { DatabaseSync } from "node:sqlite";
type Database = DatabaseSync;

const NS_RE = /^[A-Z][A-Z0-9]{1,7}$/;

export function normalizeNamespace(namespace?: string | null, fallback = "GEN"): string {
  const ns = String(namespace || fallback).trim().toUpperCase();
  return NS_RE.test(ns) ? ns : fallback;
}

export function normalizeAutoBill(value?: string | null, namespace = "GEN"): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const txt = raw.toUpperCase();
  const m = txt.match(/^SB\s*-\s*([A-Z][A-Z0-9]{1,7})\s*-\s*(\d+)$/);
  if (m) return `SB-${normalizeNamespace(m[1])}-${Number(m[2])}`;
  let body = raw;
  if (txt.startsWith("SB NO.")) body = raw.split(".").slice(1).join(".").trim();
  else if (txt.startsWith("SB ")) body = raw.slice(2).trim();
  else if (txt.startsWith("AUTO ")) body = raw.slice(5).trim();
  if (body.startsWith("#")) body = body.slice(1).trim();
  if (/^\d+\.0+$/.test(body)) body = body.split(".")[0];
  if (/^\d+$/.test(body)) return `SB-${normalizeNamespace(namespace)}-${Number(body)}`;
  return null;
}

export function normalizeManualBill(value?: string | null): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  let body = raw;
  if (upper.startsWith("MB NO.") || upper.startsWith("SB NO.")) {
    body = raw.split(".").slice(1).join(".").trim();
  }
  if (body.startsWith("#")) body = body.slice(1).trim();
  if (/^\d+\.0+$/.test(body)) body = body.split(".")[0];
  if (!body) return null;
  if (/^\d+$/.test(body)) body = String(Number(body));
  return `MB NO.${body}`;
}

export function parseBillKind(value?: string | null): "SB" | "MB" | "UNKNOWN" {
  const txt = String(value || "").trim().toUpperCase();
  if (txt.startsWith("SB NO.") || txt.startsWith("SB-")) return "SB";
  if (txt.startsWith("MB NO.")) return "MB";
  return normalizeAutoBill(value) ? "SB" : "UNKNOWN";
}

export function nextAutoBill(db: Database, namespace: string): string {
  const ns = normalizeNamespace(namespace);
  const row = db.prepare("SELECT id, count FROM bill_counter WHERE namespace = ?").get(ns) as
    | { id: number; count: number }
    | undefined;
  let next = 1001;
  if (row) {
    next = Number(row.count || 1000) + 1;
    db.prepare("UPDATE bill_counter SET count = ? WHERE id = ?").run(next, row.id);
  } else {
    db.prepare("INSERT INTO bill_counter (namespace, count) VALUES (?, ?)").run(ns, next);
  }
  return `SB-${ns}-${next}`;
}
