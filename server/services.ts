import { all, one, run } from "./db.ts";
import { money, pkDate, pkNow, pkTime, toMinor, ymd } from "./money.ts";
import { nextAutoBill, normalizeManualBill } from "./bills.ts";

export type AnyRow = Record<string, any>;

export function stockMap(): Record<string, { inn: number; out: number; stock: number; rate: number; unit: string; category: string; code: string; name: string; id: number }> {
  const mats = all<AnyRow>(
    `SELECT m.*, c.name AS category_name
     FROM material m
     LEFT JOIN material_category c ON c.id = m.category_id
     ORDER BY m.name`
  );
  const inn = all<{ material: string; qty: number }>(
    `SELECT material, COALESCE(SUM(qty),0) AS qty FROM entry WHERE is_void = 0 AND type = 'IN' GROUP BY material`
  );
  const out = all<{ material: string; qty: number }>(
    `SELECT material, COALESCE(SUM(qty),0) AS qty FROM entry WHERE is_void = 0 AND type = 'OUT' GROUP BY material`
  );
  const innMap: Record<string, number> = {};
  const outMap: Record<string, number> = {};
  for (const r of inn) innMap[String(r.material)] = Number(r.qty || 0);
  for (const r of out) outMap[String(r.material)] = Number(r.qty || 0);
  const result: Record<string, ReturnType<typeof stockMap>[string]> = {};
  for (const m of mats) {
    const name = String(m.name);
    const i = innMap[name] || 0;
    const o = outMap[name] || 0;
    result[name] = {
      id: Number(m.id),
      code: String(m.code || ""),
      name,
      category: String(m.category_name || "General"),
      unit: String(m.unit || "Bags"),
      rate: Number(m.unit_price || 0),
      inn: i,
      out: o,
      stock: i - o
    };
  }
  return result;
}

export function clientBalance(client: AnyRow): number {
  const name = String(client.name || "");
  const code = String(client.code || "");
  const opening = Number(client.opening_balance || 0);
  const sales = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount - COALESCE(discount,0)),0) AS n
     FROM direct_sale WHERE is_void = 0 AND (client_code = ? OR client_name = ?)`,
    [code, name]
  )?.n || 0;
  const salePaid = one<{ n: number }>(
    `SELECT COALESCE(SUM(paid_amount),0) AS n
     FROM direct_sale WHERE is_void = 0 AND (client_code = ? OR client_name = ?)`,
    [code, name]
  )?.n || 0;
  const pays = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n
     FROM payment WHERE is_void = 0 AND (client_id = ? OR client_name = ?)`,
    [client.id, name]
  )?.n || 0;
  const bookingPaid = one<{ n: number }>(
    `SELECT COALESCE(SUM(paid_amount),0) AS n FROM booking WHERE is_void = 0 AND client_name = ?`,
    [name]
  )?.n || 0;
  const returns = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM material_return WHERE is_void = 0 AND client_name = ?`,
    [name]
  )?.n || 0;
  const waive = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM waive_off WHERE is_void = 0 AND (client_code = ? OR client_name = ?)`,
    [code, name]
  )?.n || 0;
  return money(opening + Number(sales) - Number(salePaid) - Number(pays) - Number(bookingPaid) - Number(returns) - Number(waive));
}

export function supplierBalance(supplier: AnyRow): number {
  const opening = Number(supplier.opening_balance || 0);
  const grns = all<AnyRow>(
    `SELECT g.id, g.discount, g.paid_amount, g.loading_cost, g.freight_cost, g.other_expense, g.tax_amount
     FROM grn g WHERE g.is_void = 0 AND (g.supplier_id = ? OR g.supplier = ?)`,
    [supplier.id, supplier.name]
  );
  let grnTotal = 0;
  for (const g of grns) {
    const items = one<{ n: number }>(
      `SELECT COALESCE(SUM(qty * price_at_time),0) AS n FROM grn_item WHERE grn_id = ? AND is_void = 0`,
      [g.id]
    )?.n || 0;
    grnTotal += Number(items) + Number(g.loading_cost || 0) + Number(g.freight_cost || 0) + Number(g.other_expense || 0) + Number(g.tax_amount || 0) - Number(g.discount || 0);
  }
  const pays = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM supplier_payment WHERE is_void = 0 AND supplier_id = ?`,
    [supplier.id]
  )?.n || 0;
  return money(opening + grnTotal - Number(pays));
}

export function driverBalance(person: AnyRow): number {
  const opening = Number(person.opening_balance || 0);
  const rents = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM delivery_rent WHERE is_void = 0 AND delivery_person_name = ?`,
    [person.name]
  )?.n || 0;
  const alloc = one<{ n: number }>(
    `SELECT COALESCE(SUM(rent_amount),0) AS n FROM sale_delivery_persons WHERE is_void = 0 AND delivery_person_id = ?`,
    [person.id]
  )?.n || 0;
  const paid = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount_paid + COALESCE(waive_off_amount,0)),0) AS n
     FROM delivery_person_payment WHERE is_void = 0 AND delivery_person_id = ?`,
    [person.id]
  )?.n || 0;
  return money(opening + Number(rents) + Number(alloc) - Number(paid));
}

export function accountNet(accountId: number): number {
  const acc = one<AnyRow>("SELECT * FROM account WHERE id = ?", [accountId]);
  if (!acc) return 0;
  const opening = Number(acc.opening_balance ?? acc.balance ?? 0);
  const inn = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM account_transaction WHERE is_void = 0 AND to_account_id = ?`,
    [accountId]
  )?.n || 0;
  const out = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM account_transaction WHERE is_void = 0 AND from_account_id = ?`,
    [accountId]
  )?.n || 0;
  return money(opening + Number(inn) - Number(out));
}

export function refreshAccountBalance(accountId: number) {
  const bal = accountNet(accountId);
  run(
    "UPDATE account SET balance = ?, balance_minor = ?, updated_at = ? WHERE id = ?",
    [bal, toMinor(bal), pkNow(), accountId]
  );
}

export function postAccountTx(opts: {
  fromId?: number | null;
  toId?: number | null;
  amount: number;
  description: string;
  type: string;
  sourceType?: string;
  sourceId?: number;
  note?: string;
  createdBy?: string;
}) {
  const amt = money(opts.amount);
  if (amt <= 0) return null;
  const info = run(
    `INSERT INTO account_transaction (
      from_account_id, to_account_id, amount, amount_minor, description, date_posted,
      is_void, note, transaction_type, source_type, source_id, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    [
      opts.fromId || null,
      opts.toId || null,
      amt,
      toMinor(amt),
      opts.description,
      pkNow(),
      opts.note || null,
      opts.type,
      opts.sourceType || null,
      opts.sourceId || null,
      opts.createdBy || "Admin",
      pkNow()
    ]
  );
  if (opts.fromId) refreshAccountBalance(opts.fromId);
  if (opts.toId) refreshAccountBalance(opts.toId);
  return Number(info.lastInsertRowid);
}

export function postStockEntry(opts: {
  type: "IN" | "OUT";
  material: string;
  qty: number;
  client?: string;
  clientCode?: string;
  billNo?: string;
  autoBillNo?: string;
  category?: string;
  clientCategory?: string;
  nimbusNo?: string;
  bookedMaterial?: string;
  driver?: string;
  note?: string;
  sourceModule?: string;
  sourceTable?: string;
  sourceId?: number;
  transactionType?: string;
}) {
  run(
    `INSERT INTO entry (
      date, time, type, material, booked_material, client, client_code, client_category, qty, bill_no, auto_bill_no,
      nimbus_no, created_by, created_at, is_void, transaction_category, driver_name, note,
      source_module, source_table, source_id, source_bill_no, transaction_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pkDate(),
      pkTime(),
      opts.type,
      opts.material,
      opts.bookedMaterial || null,
      opts.client || null,
      opts.clientCode || null,
      opts.clientCategory || opts.category || null,
      money(opts.qty),
      opts.billNo || opts.autoBillNo || null,
      opts.autoBillNo || null,
      opts.nimbusNo || null,
      "Admin",
      pkNow(),
      opts.category || null,
      opts.driver || null,
      opts.note || null,
      opts.sourceModule || null,
      opts.sourceTable || null,
      opts.sourceId || null,
      opts.billNo || opts.autoBillNo || null,
      opts.transactionType || opts.sourceModule || null
    ]
  );
}

export function nextCode(table: string, prefix: string, column = "code"): string {
  const rows = all<{ code: string }>(`SELECT ${column} AS code FROM ${table} WHERE ${column} LIKE ?`, [`${prefix}%`]);
  let max = 0;
  for (const r of rows) {
    const m = String(r.code || "").match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function getClient(input: string | number): AnyRow | undefined {
  if (input === "" || input == null) return undefined;
  if (typeof input === "number" || /^\d+$/.test(String(input))) {
    const byId = one("SELECT * FROM client WHERE id = ?", [Number(input)]);
    if (byId) return byId;
  }
  const s = String(input).trim();
  return (
    one("SELECT * FROM client WHERE code = ? COLLATE NOCASE", [s]) ||
    one("SELECT * FROM client WHERE name = ? COLLATE NOCASE", [s])
  );
}

export function billFor(kind: "auto" | "manual" | undefined, value: string | undefined, ns: string) {
  if (kind === "manual") return { manual: normalizeManualBill(value), auto: nextAutoBill(require("./db.ts").db, ns) };
  return { manual: normalizeManualBill(value), auto: nextAutoBill(require("./db.ts").db, ns) };
}

export { nextAutoBill, ymd };
