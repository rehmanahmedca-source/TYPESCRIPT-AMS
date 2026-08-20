export function toMinor(value: unknown): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromMinor(minor: unknown): number {
  const n = Number(minor || 0);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

export function money(value: unknown): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function pkNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Karachi" }).replace(" ", "T");
}

export function pkDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

export function pkTime(): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Karachi",
    hour12: false
  });
}

export function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function ymd(value?: string | Date | null): string {
  if (!value) return pkDate();
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return pkDate();
  return d.toISOString().slice(0, 10);
}
