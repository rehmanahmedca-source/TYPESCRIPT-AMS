export function money(val: unknown): string {
  const num = Number(val) || 0;
  return "Rs. " + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function num(val: unknown): string {
  const n = Number(val) || 0;
  return n.toLocaleString("en-US");
}

export function ymd(val?: unknown): string {
  if (!val) return "";
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

export function dueOf(row: { amount?: number; discount?: number; paid_amount?: number }): number {
  return Math.max(0, Number(row.amount || 0) - Number(row.discount || 0) - Number(row.paid_amount || 0));
}

export function qty(val: unknown): string {
  const n = Number(val || 0);
  if (!n) return "---";
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 }).replace(/\.?0+$/, "");
}

export function money3(val: unknown): string {
  const n = Number(val || 0);
  if (!n) return "---";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
