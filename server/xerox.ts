import { Router } from "express";
import { all, db, one, run } from "./db.ts";
import { money, pkDate, pkNow, toMinor, ymd } from "./money.ts";
import { nextAutoBill, normalizeManualBill } from "./bills.ts";
import {
  accountNet,
  clientBalance,
  driverBalance,
  getClient,
  postAccountTx,
  postStockEntry,
  refreshAccountBalance,
  stockMap,
  supplierBalance,
  type AnyRow
} from "./services.ts";
import {
  buildCashFlowPayload,
  cashFlowEntryDetail,
  cfNormalizeDirection,
  restoreManualCashFlow,
  saveCfCategory,
  saveCfParty,
  saveCfSubcategory,
  saveManualCashFlow,
  updateManualCashFlow,
  voidManualCashFlow
} from "./cashFlowCore.ts";

export const xeroxApi = Router();

function actor(req: { authUser?: { username: string } }) {
  return req.authUser?.username || "system";
}

function todaySum(sql: string, params: unknown[] = []) {
  return Number(one<{ n: number }>(sql, params)?.n || 0);
}

xeroxApi.get("/accounts/summary", (_req, res) => {
  const today = pkDate();
  const accounts: AnyRow[] = all<AnyRow>("SELECT * FROM account ORDER BY name").map((a) => ({
    ...a,
    live_balance: accountNet(Number(a.id))
  }));
  const client_payments_today = todaySum(
    `SELECT COALESCE(SUM(amount),0) AS n FROM payment WHERE is_void = 0 AND date(date_posted) = date(?)`,
    [today]
  );
  const supplier_payments_today = todaySum(
    `SELECT COALESCE(SUM(amount),0) AS n FROM supplier_payment WHERE is_void = 0 AND date(date_posted) = date(?)`,
    [today]
  );
  const expenditures_today = todaySum(
    `SELECT COALESCE(SUM(amount),0) AS n FROM account_transaction
      WHERE is_void = 0 AND date(date_posted) = date(?) AND transaction_type IN ('Expense','Payment') AND from_account_id IS NOT NULL AND to_account_id IS NULL`,
    [today]
  );
  const receipts_today = todaySum(
    `SELECT COALESCE(SUM(amount),0) AS n FROM account_transaction
      WHERE is_void = 0 AND date(date_posted) = date(?) AND transaction_type IN ('Receipt')`,
    [today]
  );
  const totalCash = accounts.filter((a) => String(a.category) === "cash" && a.is_active !== 0).reduce((s, a) => s + Number(a.live_balance), 0);
  const totalBank = accounts.filter((a) => String(a.category) === "bank" && a.is_active !== 0).reduce((s, a) => s + Number(a.live_balance), 0);
  res.json({
    accounts,
    client_payments_today,
    supplier_payments_today,
    expenditures_today,
    receipts_today: receipts_today + client_payments_today,
    totalCash,
    totalBank,
    totalCompanyMoney: totalCash + totalBank,
    clients: all("SELECT id, code, name FROM client WHERE is_active = 1 ORDER BY name"),
    suppliers: all("SELECT id, name FROM supplier WHERE is_active = 1 ORDER BY name"),
    drivers: all("SELECT id, name FROM delivery_person WHERE is_active = 1 ORDER BY name"),
    categories: all("SELECT id, name FROM account_category WHERE is_active = 1 OR is_active IS NULL ORDER BY name")
  });
});

xeroxApi.get("/accounts/client-payments", (_req, res) => {
  const payments = all<AnyRow>(
    `SELECT p.*, a.name AS account_name FROM payment p
     LEFT JOIN account a ON a.id = p.payment_account_id
     ORDER BY p.id DESC LIMIT 300`
  );
  res.json({
    payments,
    clients: all("SELECT id, code, name FROM client WHERE is_active = 1 ORDER BY name"),
    accounts: all("SELECT id, name, category FROM account WHERE is_active = 1 ORDER BY name")
  });
});

xeroxApi.post("/accounts/payments/clients/save", (req, res) => {
  const b = req.body || {};
  const client = getClient(b.client_code || b.client_name || b.client_input);
  if (!client) return res.status(400).json({ error: "Client is required" });
  const amt = money(b.amount);
  if (amt <= 0) return res.status(400).json({ error: "Invalid amount" });
  const auto = nextAutoBill(db, "CP");
  const info = run(
    `INSERT INTO payment (client_id, client_name, amount, amount_minor, method, payment_type, manual_bill_no, auto_bill_no, date_posted, is_void, note, discount, discount_reason, payment_account_id, created_by, created_at, updated_at, revision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      client.id,
      client.name,
      amt,
      toMinor(amt),
      b.method || "Cash",
      b.payment_type || "Receipt",
      normalizeManualBill(b.manual_bill_no),
      auto,
      b.date || pkNow(),
      b.note || null,
      Number(b.discount || 0),
      b.discount_reason || null,
      b.payment_account_id || null,
      actor(req),
      pkNow(),
      pkNow()
    ]
  );
  if (b.payment_account_id) {
    postAccountTx({
      toId: Number(b.payment_account_id),
      amount: amt,
      description: `Client payment ${client.name} ${auto}`,
      type: "Receipt",
      sourceType: "Payment",
      sourceId: Number(info.lastInsertRowid),
      createdBy: actor(req)
    });
  }
  res.json({ ok: true, id: Number(info.lastInsertRowid), auto_bill_no: auto });
});

xeroxApi.post("/accounts/payments/clients/void/:id", (req, res) => {
  run("UPDATE payment SET is_void = 1 WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

xeroxApi.get("/accounts/supplier-payments", (_req, res) => {
  const payments = all<AnyRow>(
    `SELECT p.*, s.name AS supplier_name, a.name AS account_name
       FROM supplier_payment p
       LEFT JOIN supplier s ON s.id = p.supplier_id
       LEFT JOIN account a ON a.id = p.payment_account_id
      ORDER BY p.id DESC LIMIT 300`
  );
  res.json({
    payments,
    suppliers: all("SELECT id, name FROM supplier WHERE is_active = 1 ORDER BY name"),
    accounts: all("SELECT id, name FROM account WHERE is_active = 1 ORDER BY name")
  });
});

xeroxApi.post("/accounts/payments/suppliers/save", (req, res) => {
  const b = req.body || {};
  const supplier = one<AnyRow>("SELECT * FROM supplier WHERE id = ? OR name = ? COLLATE NOCASE", [b.supplier_id, b.supplier_input]);
  if (!supplier) return res.status(400).json({ error: "Supplier is required" });
  const amt = money(b.amount);
  if (amt <= 0) return res.status(400).json({ error: "Invalid amount" });
  const auto = nextAutoBill(db, "SP");
  const info = run(
    `INSERT INTO supplier_payment (supplier_id, amount, amount_minor, method, payment_type, date_posted, note, is_void, payment_account_id, auto_bill_no, manual_bill_no, created_by, created_at, updated_at, revision)
     VALUES (?, ?, ?, ?, 'Payment', ?, ?, 0, ?, ?, ?, ?, ?, ?, 1)`,
    [supplier.id, amt, toMinor(amt), b.method || "Cash", b.date || pkNow(), b.note || null, b.payment_account_id || null, auto, normalizeManualBill(b.manual_bill_no), actor(req), pkNow(), pkNow()]
  );
  if (b.payment_account_id) {
    postAccountTx({
      fromId: Number(b.payment_account_id),
      amount: amt,
      description: `Pay ${supplier.name}`,
      type: "Payment",
      sourceType: "SupplierPayment",
      sourceId: Number(info.lastInsertRowid),
      createdBy: actor(req)
    });
  }
  res.json({ ok: true, auto_bill_no: auto });
});

xeroxApi.post("/accounts/payments/suppliers/:id/delete", (req, res) => {
  run("UPDATE supplier_payment SET is_void = 1 WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

xeroxApi.get("/accounts/expenditures", (_req, res) => {
  const rows = all<AnyRow>(
    `SELECT t.*, fa.name AS from_name FROM account_transaction t
     LEFT JOIN account fa ON fa.id = t.from_account_id
     WHERE t.is_void = 0 AND t.transaction_type IN ('Expense','Payment') AND t.to_account_id IS NULL
     ORDER BY t.id DESC LIMIT 300`
  );
  res.json({ rows, total: rows.reduce((a, r) => a + Number(r.amount || 0), 0) });
});

xeroxApi.get("/accounts/receipts", (_req, res) => {
  const rows = all<AnyRow>(
    `SELECT t.*, ta.name AS to_name FROM account_transaction t
     LEFT JOIN account ta ON ta.id = t.to_account_id
     WHERE t.is_void = 0 AND t.transaction_type IN ('Receipt')
     ORDER BY t.id DESC LIMIT 300`
  );
  res.json({ rows, total: rows.reduce((a, r) => a + Number(r.amount || 0), 0) });
});

xeroxApi.get("/accounts/audit", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  let rows = all<AnyRow>(
    `SELECT t.*, fa.name AS from_name, ta.name AS to_name
       FROM account_transaction t
       LEFT JOIN account fa ON fa.id = t.from_account_id
       LEFT JOIN account ta ON ta.id = t.to_account_id
      ORDER BY t.id DESC LIMIT 400`
  );
  if (q) rows = rows.filter((r) => `${r.description || ""} ${r.note || ""}`.toLowerCase().includes(q));
  res.json({ rows });
});

xeroxApi.get("/accounts/transfers", (_req, res) => {
  const rows = all<AnyRow>(
    `SELECT t.*, fa.name AS from_name, ta.name AS to_name
       FROM account_transaction t
       LEFT JOIN account fa ON fa.id = t.from_account_id
       LEFT JOIN account ta ON ta.id = t.to_account_id
      WHERE t.transaction_type = 'Transfer'
      ORDER BY t.id DESC LIMIT 300`
  );
  res.json({ rows });
});

xeroxApi.get("/accounts/reconciliations", (_req, res) => {
  const rows = all<AnyRow>(
    `SELECT r.*, a.name AS account_name FROM account_reconciliation r
     LEFT JOIN account a ON a.id = r.account_id
     ORDER BY r.id DESC LIMIT 200`
  );
  res.json({ rows });
});

xeroxApi.post("/accounts/categories", (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required" });
  const info = run("INSERT INTO account_category (name, note, is_active, created_at) VALUES (?, ?, 1, ?)", [
    name,
    req.body?.note || null,
    pkNow()
  ]);
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

xeroxApi.post("/accounts/:id/update", (req, res) => {
  const id = Number(req.params.id);
  const acc = one<AnyRow>("SELECT * FROM account WHERE id = ?", [id]);
  if (!acc) return res.status(404).json({ error: "Account not found" });
  const b = req.body || {};
  run(
    `UPDATE account SET name=?, category=?, account_type=?, source_category=?, bank_name=?, account_holder_name=?, account_number=?, branch_code=?, note=?, updated_at=? WHERE id=?`,
    [
      b.name ?? acc.name,
      b.category ?? acc.category,
      b.account_type ?? acc.account_type,
      b.source_category ?? acc.source_category,
      b.bank_name ?? acc.bank_name,
      b.account_holder_name ?? acc.account_holder_name,
      b.account_number ?? acc.account_number,
      b.branch_code ?? acc.branch_code,
      b.note ?? acc.note,
      pkNow(),
      id
    ]
  );
  if (b.balance !== undefined) {
    run("UPDATE account SET balance = ?, balance_minor = ? WHERE id = ?", [money(b.balance), toMinor(b.balance), id]);
  }
  res.json({ ok: true });
});

xeroxApi.post("/accounts/:id/toggle", (req, res) => {
  const acc = one<AnyRow>("SELECT * FROM account WHERE id = ?", [req.params.id]);
  if (!acc) return res.status(404).json({ error: "Not found" });
  run("UPDATE account SET is_active = ? WHERE id = ?", [acc.is_active ? 0 : 1, acc.id]);
  res.json({ ok: true });
});

xeroxApi.post("/accounts/:id/delete", (req, res) => {
  const id = Number(req.params.id);
  const used = one<{ n: number }>("SELECT COUNT(*) AS n FROM account_transaction WHERE from_account_id = ? OR to_account_id = ?", [id, id]);
  if (Number(used?.n || 0) > 0) return res.status(400).json({ error: "Account has transactions and cannot be deleted" });
  run("DELETE FROM account WHERE id = ?", [id]);
  res.json({ ok: true });
});

xeroxApi.post("/accounts/transactions/:id/void", (req, res) => {
  const txRow = one<AnyRow>("SELECT * FROM account_transaction WHERE id = ?", [req.params.id]);
  if (!txRow) return res.status(404).json({ error: "Not found" });
  run("UPDATE account_transaction SET is_void = 1, voided_at = ?, voided_by = ? WHERE id = ?", [pkNow(), actor(req), txRow.id]);
  if (txRow.from_account_id) refreshAccountBalance(Number(txRow.from_account_id));
  if (txRow.to_account_id) refreshAccountBalance(Number(txRow.to_account_id));
  res.json({ ok: true });
});

xeroxApi.post("/accounts/transactions", (req, res) => {
  const b = req.body || {};
  const amt = money(b.amount);
  const mode = String(b.tx_mode || "receive");
  if (mode === "receive") {
    const client = getClient(b.client_input || b.client_code);
    const toId = Number(b.receive_account_id || 0);
    if (amt > 0 && toId) {
      const id = postAccountTx({
        toId,
        amount: amt,
        description: `Receive ${client?.name || b.receive_source_label || "source"}`,
        type: "Receipt",
        note: b.note,
        createdBy: actor(req)
      });
      if (client) {
        const auto = nextAutoBill(db, "CP");
        run(
          `INSERT INTO payment (client_id, client_name, amount, amount_minor, method, payment_type, auto_bill_no, date_posted, is_void, note, discount, payment_account_id, created_by, created_at, updated_at, revision)
           VALUES (?, ?, ?, ?, ?, 'Receipt', ?, ?, 0, ?, ?, ?, ?, ?, ?, 1)`,
          [client.id, client.name, amt, toMinor(amt), b.method || "Cash", auto, b.date_posted || pkNow(), b.note || null, Number(b.discount || 0), toId, actor(req), pkNow(), pkNow()]
        );
      }
      return res.json({ ok: true, id });
    }
    if (Number(b.discount || 0) > 0 && client) {
      return res.json({ ok: true, discount_only: true });
    }
    return res.status(400).json({ error: "Receive amount and destination account are required" });
  }
  const fromId = Number(b.pay_from_account_id || 0);
  if (!fromId || amt <= 0) return res.status(400).json({ error: "Pay from account and amount are required" });
  const target = String(b.pay_target || "other_expense");
  if (target === "company_transfer") {
    const toId = Number(b.pay_to_account_id || 0);
    if (!toId) return res.status(400).json({ error: "Destination account required" });
    const id = postAccountTx({ fromId, toId, amount: amt, description: b.note || "Internal transfer", type: "Transfer", createdBy: actor(req) });
    return res.json({ ok: true, id });
  }
  if (target === "supplier") {
    const supplier = one<AnyRow>("SELECT * FROM supplier WHERE id = ? OR name = ? COLLATE NOCASE", [b.supplier_id, b.supplier_input]);
    const id = postAccountTx({ fromId, amount: amt, description: `Pay ${supplier?.name || "supplier"}`, type: "Payment", createdBy: actor(req) });
    if (supplier) {
      const auto = nextAutoBill(db, "SP");
      run(
        `INSERT INTO supplier_payment (supplier_id, amount, amount_minor, method, date_posted, note, is_void, payment_account_id, auto_bill_no, created_by, created_at, updated_at, revision)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 1)`,
        [supplier.id, amt, toMinor(amt), b.method || "Cash", b.date_posted || pkNow(), b.note || null, fromId, auto, actor(req), pkNow(), pkNow()]
      );
    }
    return res.json({ ok: true, id });
  }
  const id = postAccountTx({
    fromId,
    amount: amt,
    description: b.target_label || b.note || target,
    type: "Expense",
    note: b.note,
    createdBy: actor(req)
  });
  res.json({ ok: true, id });
});

xeroxApi.get("/accounts/kpi/:kind", (req, res) => {
  const kind = String(req.params.kind);
  const today = pkDate();
  if (kind === "client_payments") {
    const rows = all(`SELECT client_name, amount, method, date_posted, note FROM payment WHERE is_void = 0 AND date(date_posted) = date(?) ORDER BY id DESC`, [today]);
    return res.json({ rows, total: rows.reduce((a: number, r: AnyRow) => a + Number(r.amount || 0), 0) });
  }
  if (kind === "supplier_payments") {
    const rows = all(
      `SELECT s.name AS supplier_name, p.amount, p.method, p.date_posted, p.note
         FROM supplier_payment p LEFT JOIN supplier s ON s.id = p.supplier_id
        WHERE p.is_void = 0 AND date(p.date_posted) = date(?) ORDER BY p.id DESC`,
      [today]
    );
    return res.json({ rows, total: rows.reduce((a: number, r: AnyRow) => a + Number(r.amount || 0), 0) });
  }
  if (kind === "expenditures") {
    const rows = all(
      `SELECT transaction_type AS category, amount, date_posted, note, description FROM account_transaction
        WHERE is_void = 0 AND date(date_posted) = date(?) AND transaction_type IN ('Expense','Payment') AND to_account_id IS NULL`,
      [today]
    );
    return res.json({ rows, total: rows.reduce((a: number, r: AnyRow) => a + Number(r.amount || 0), 0) });
  }
  if (kind === "receipts") {
    const rows = all(
      `SELECT transaction_type AS type, amount, date_posted, note, description FROM account_transaction
        WHERE is_void = 0 AND date(date_posted) = date(?) AND transaction_type = 'Receipt'`,
      [today]
    );
    return res.json({ rows, total: rows.reduce((a: number, r: AnyRow) => a + Number(r.amount || 0), 0) });
  }
  const accounts = all<AnyRow>("SELECT * FROM account WHERE is_active = 1 OR is_active IS NULL").map((a) => ({
    name: a.name,
    account_type: a.account_type,
    category: a.category,
    balance: accountNet(Number(a.id))
  }));
  if (kind === "cash_accounts" || kind === "cash_money") {
    const rows = accounts.filter((a) => String(a.category) === "cash");
    return res.json({ rows, total: rows.reduce((s, a) => s + Number(a.balance), 0) });
  }
  if (kind === "bank_accounts") {
    const rows = accounts.filter((a) => String(a.category) === "bank");
    return res.json({ rows, total: rows.reduce((s, a) => s + Number(a.balance), 0) });
  }
  res.json({ rows: accounts, total: accounts.reduce((s, a) => s + Number(a.balance), 0) });
});

xeroxApi.get("/history", (req, res) => {
  if (req.query.idle === "1" && !req.query.start_date && !req.query.filtered) {
    return res.json({
      entries: [],
      total_qty: 0,
      pagination: { page: 1, pages: 1, total: 0 },
      clients: all("SELECT code, name FROM client WHERE is_active = 1 ORDER BY name"),
      materials: all("SELECT name FROM material WHERE is_active = 1 ORDER BY name")
    });
  }
  const from = String(req.query.start_date || req.query.from || "1970-01-01");
  const to = String(req.query.end_date || req.query.to || pkDate());
  const type = String(req.query.type || "");
  const client = String(req.query.client || "").toLowerCase();
  const material = String(req.query.material || "").toLowerCase();
  const bill = String(req.query.bill_no || "").toLowerCase();
  let entries = all<AnyRow>(`SELECT * FROM entry WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 500`, [from, to]);
  const payments = all<AnyRow>(
    `SELECT id, date(date_posted) AS date, substr(date_posted,12,8) AS time, 'PAYMENT' AS type, client_name AS client, '' AS client_code, '' AS material, amount AS qty, auto_bill_no, manual_bill_no AS bill_no, '' AS nimbus_no, created_by, is_void, 'Payment' AS source_type
       FROM payment WHERE date(date_posted) >= date(?) AND date(date_posted) <= date(?) ORDER BY id DESC LIMIT 300`,
    [from, to]
  );
  let rows = [...entries, ...payments];
  if (type) rows = rows.filter((r) => String(r.type).toUpperCase() === type.toUpperCase());
  if (client) rows = rows.filter((r) => `${r.client || ""} ${r.client_code || ""}`.toLowerCase().includes(client));
  if (material) rows = rows.filter((r) => String(r.material || "").toLowerCase().includes(material));
  if (bill) rows = rows.filter((r) => `${r.bill_no || ""} ${r.auto_bill_no || ""}`.toLowerCase().includes(bill));
  const total_qty = rows.filter((r) => r.type !== "PAYMENT").reduce((a, r) => a + Number(r.qty || 0), 0);
  res.json({
    entries: rows,
    total_qty,
    pagination: { page: 1, pages: 1, total: rows.length },
    clients: all("SELECT code, name FROM client WHERE is_active = 1 ORDER BY name"),
    materials: all("SELECT name FROM material WHERE is_active = 1 ORDER BY name")
  });
});

xeroxApi.post("/history/entries/:id", (req, res) => {
  const b = req.body || {};
  run("UPDATE entry SET date=?, time=?, type=?, material=?, client=?, qty=?, bill_no=?, nimbus_no=? WHERE id=?", [
    b.date, b.time, b.type, b.material, b.client, Number(b.qty || 0), b.bill_no, b.nimbus_no, req.params.id
  ]);
  res.json({ ok: true });
});

xeroxApi.get("/decision-ledger", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const category = String(req.query.category || "");
  const balanceFilter = String(req.query.balance || "all");
  let clients = all<AnyRow>("SELECT * FROM client ORDER BY name");
  if (q) clients = clients.filter((c) => `${c.name} ${c.code}`.toLowerCase().includes(q));
  if (category) clients = clients.filter((c) => c.category === category);
  const materials = all<{ name: string }>("SELECT name FROM material WHERE is_active = 1 ORDER BY name");
  const overall: Record<string, { name: string; booked: number; dispatched: number; remaining: number }> = {};
  for (const m of materials) overall[m.name] = { name: m.name, booked: 0, dispatched: 0, remaining: 0 };
  const data = clients.map((c) => {
    const bal = clientBalance(c);
    const items = all<AnyRow>(
      `SELECT bi.material_name AS name, SUM(bi.qty) AS booked
         FROM booking_item bi JOIN booking b ON b.id = bi.booking_id
        WHERE b.is_void = 0 AND b.client_name = ?
        GROUP BY bi.material_name`,
      [c.name]
    );
    const dispatched = all<AnyRow>(
      `SELECT product_name AS name, SUM(qty) AS qty FROM direct_sale_item i
         JOIN direct_sale s ON s.id = i.sale_id
        WHERE s.is_void = 0 AND s.client_name = ?
        GROUP BY product_name`,
      [c.name]
    );
    const dispMap: Record<string, number> = {};
    for (const d of dispatched) dispMap[String(d.name)] = Number(d.qty || 0);
    const mats = items.map((it) => {
      const booked = Number(it.booked || 0);
      const disp = dispMap[String(it.name)] || 0;
      const remaining = Math.max(0, booked - disp);
      if (overall[String(it.name)]) {
        overall[String(it.name)].booked += booked;
        overall[String(it.name)].dispatched += disp;
        overall[String(it.name)].remaining += remaining;
      }
      return { name: it.name, booked, dispatched: disp, remaining, unit_price: 0, booked_cost: 0, dispatched_cost: 0, remaining_cost: 0 };
    });
    return {
      client: { id: c.id, name: c.name, code: c.code, category: c.category },
      financial: { balance: bal },
      materials: mats,
      material_totals: { total_remaining_qty: mats.reduce((a, m) => a + m.remaining, 0), total_reserved_cost: 0 }
    };
  }).filter((row) => {
    if (balanceFilter === "debit") return row.financial.balance > 0;
    if (balanceFilter === "credit") return row.financial.balance < 0;
    if (balanceFilter === "zero") return row.financial.balance === 0;
    return true;
  });
  res.json({
    data: data.slice(0, 50),
    overall_material_summary: Object.values(overall).filter((m) => m.booked || m.dispatched),
    overall_remaining_total: Object.values(overall).reduce((a, m) => a + m.remaining, 0),
    total: data.length,
    page: 1,
    total_pages: 1,
    categories: [...new Set(all<{ category: string }>("SELECT DISTINCT category FROM client WHERE category IS NOT NULL").map((r) => r.category))]
  });
});

xeroxApi.get("/current-payables", (req, res) => {
  const status = String(req.query.status || "outstanding");
  const clientQ = String(req.query.client || "").toLowerCase();
  let clients = all<AnyRow>("SELECT * FROM client ORDER BY name");
  if (clientQ) clients = clients.filter((c) => `${c.name} ${c.code}`.toLowerCase().includes(clientQ));
  const rows = clients.map((c) => {
    const outstanding = clientBalance(c);
    let st = "Settled";
    if (outstanding > 0.009) st = "Outstanding";
    else if (outstanding < -0.009) st = "Credit";
    return {
      client_id: c.id,
      client_name: c.name,
      client_code: c.code,
      outstanding,
      last_transaction_date: c.created_at,
      last_payment_date: null,
      status: st
    };
  }).filter((r) => {
    if (status === "outstanding") return r.outstanding > 0.009;
    if (status === "settled") return Math.abs(r.outstanding) <= 0.009;
    if (status === "credit") return r.outstanding < -0.009;
    return true;
  });
  res.json({
    rows,
    total_outstanding: rows.filter((r) => r.outstanding > 0).reduce((a, r) => a + r.outstanding, 0),
    total_records: rows.length
  });
});

xeroxApi.get("/notifications", (_req, res) => {
  const bills = all<AnyRow>("SELECT * FROM pending_bill WHERE is_void = 0 ORDER BY id DESC LIMIT 200");
  const reminders = all<AnyRow>("SELECT * FROM follow_up_reminder WHERE is_done = 0 OR is_done IS NULL ORDER BY remind_at");
  const staff_emails = all("SELECT * FROM staff_email ORDER BY id");
  const rows = bills.map((b) => ({
    bill: b,
    amount: Number(b.amount || 0),
    risk_level: b.risk_override || "Medium",
    risk_level_key: String(b.risk_override || "medium").toLowerCase().replace(" ", "_"),
    active_remind_at: reminders.find((r) => r.pending_bill_id === b.id)?.remind_at,
    last_contact_response: "",
    contact_count: 0
  }));
  res.json({
    counts: {
      total: bills.length,
      pending: bills.filter((b) => !b.is_paid).length,
      very_high: 0,
      high: 0,
      medium: bills.length,
      low: 0
    },
    rows,
    reminders,
    staff_emails
  });
});

xeroxApi.get("/notifications/upcoming", (_req, res) => {
  const reminders = all<AnyRow>(
    `SELECT r.*, pb.client_name, pb.bill_no FROM follow_up_reminder r
     LEFT JOIN pending_bill pb ON pb.id = r.pending_bill_id
     WHERE r.is_done = 0 OR r.is_done IS NULL
     ORDER BY r.remind_at`
  );
  res.json({ reminders });
});

xeroxApi.get("/notifications/due", (_req, res) => {
  const now = pkNow();
  const items = all<AnyRow>(
    `SELECT r.id, r.remind_at, r.note, pb.client_name AS client, pb.bill_no
       FROM follow_up_reminder r
       LEFT JOIN pending_bill pb ON pb.id = r.pending_bill_id
      WHERE (r.is_done = 0 OR r.is_done IS NULL) AND r.remind_at <= ?
      ORDER BY r.remind_at LIMIT 20`,
    [now]
  );
  res.json(items);
});

xeroxApi.post("/notifications/emails", (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!email) return res.status(400).json({ error: "Email required" });
  run("INSERT INTO staff_email (email, is_active, created_at) VALUES (?, 1, ?)", [email, pkNow()]);
  res.json({ ok: true });
});

xeroxApi.get("/drivers/:id/ledger", (req, res) => {
  const driver = one<AnyRow>("SELECT * FROM delivery_person WHERE id = ?", [req.params.id]);
  if (!driver) return res.status(404).json({ error: "Driver not found" });
  const rents = all<AnyRow>("SELECT * FROM delivery_rent WHERE is_void = 0 AND delivery_person_name = ? ORDER BY id", [driver.name]);
  const pays = all<AnyRow>("SELECT * FROM delivery_person_payment WHERE is_void = 0 AND delivery_person_id = ? ORDER BY id", [driver.id]);
  const entries: AnyRow[] = [];
  let running = Number(driver.opening_balance || 0);
  if (running) entries.push({ id: 0, date: ymd(String(driver.opening_balance_date || driver.created_at)), type: "Opening", description: "Opening balance", debit: running > 0 ? running : 0, credit: running < 0 ? -running : 0, balance: running });
  for (const r of rents) {
    running += Number(r.amount || 0);
    entries.push({ id: r.id, date: ymd(String(r.date_posted)), type: "Rent", description: r.bill_no || "Delivery rent", debit: Number(r.amount || 0), credit: 0, balance: running });
  }
  for (const p of pays) {
    running -= Number(p.amount_paid || 0);
    entries.push({ id: p.id, date: ymd(String(p.date_posted || p.created_at)), type: "Payment", description: p.note || "Driver payment", debit: 0, credit: Number(p.amount_paid || 0), balance: running });
  }
  res.json({ driver: { ...driver, balance: driverBalance(driver) }, entries, rents });
});

xeroxApi.get("/system-report", (_req, res) => {
  const tables = all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY 1").map((t) => ({
    name: t.name,
    rows: Number(one<{ n: number }>(`SELECT COUNT(*) AS n FROM "${t.name}"`)?.n || 0)
  }));
  const unpaid = Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM pending_bill WHERE is_void = 0 AND (is_paid = 0 OR is_paid IS NULL)")?.n || 0);
  const zeroBills = Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM direct_sale WHERE is_void = 0 AND COALESCE(amount,0) = 0")?.n || 0);
  const salesMissingEntries = all<AnyRow>(
    `SELECT s.id, s.auto_bill_no FROM direct_sale s
      WHERE s.is_void = 0 AND NOT EXISTS (SELECT 1 FROM entry e WHERE e.source_table = 'direct_sale' AND e.source_id = s.id AND e.is_void = 0)`
  );
  const grnsMissingEntries = all<AnyRow>(
    `SELECT g.id, g.auto_bill_no FROM grn g
      WHERE g.is_void = 0 AND NOT EXISTS (SELECT 1 FROM entry e WHERE e.source_table = 'grn' AND e.source_id = g.id AND e.is_void = 0)`
  );
  const sync_issues = [
    ...salesMissingEntries.map((s) => ({ type: "SALE", desc: `Sale ${s.auto_bill_no || s.id} has no matching stock OUT entry.` })),
    ...grnsMissingEntries.map((g) => ({ type: "GRN", desc: `GRN ${g.auto_bill_no || g.id} has no matching stock IN entry.` }))
  ];
  const stock = stockMap();
  const stock_issues = Object.values(stock)
    .filter((m) => m.stock < 0)
    .map((m) => ({ material: m.name, db_stock: m.stock, calc_stock: m.inn - m.out, diff: m.stock - (m.inn - m.out) }));
  res.json({
    tables,
    users: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM user")?.n || 0),
    clients: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM client")?.n || 0),
    materials: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM material")?.n || 0),
    sales: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM direct_sale")?.n || 0),
    bookings: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM booking")?.n || 0),
    payments: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM payment")?.n || 0),
    accounts: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM account")?.n || 0),
    report: {
      sync_issues,
      stock_issues,
      unpaid_count: unpaid,
      zero_amount_bills: zeroBills
    }
  });
});

xeroxApi.get(["/cash-flow", "/cash_flow"], (req, res) => {
  res.json(buildCashFlowPayload(req.query as AnyRow));
});

xeroxApi.get(["/cash-flow/export.csv", "/cash_flow/export.csv"], (req, res) => {
  const payload = buildCashFlowPayload(req.query as AnyRow);
  const header = ["Date", "Type", "Account", "Category", "Subcategory", "Party", "Description", "Notes", "Reference", "Received", "Spent", "Transfer"];
  const lines = [header.join(",")];
  for (const r of payload.rows as AnyRow[]) {
    const cells = [
      r.date, r.tx_type_label, r.account_display, r.category, r.subcategory, r.party_name,
      r.description, r.note, r.reference, r.cash_in || "", r.cash_out || "", r.transfer_amount || ""
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="AMS_cash_flow_${payload.from_date}_${payload.to_date}.csv"`);
  res.send(lines.join("\n"));
});

xeroxApi.get(["/cash-flow/entry/:id", "/cash_flow/entry/:id"], (req, res) => {
  const detail = cashFlowEntryDetail(Number(req.params.id));
  if (!detail) return res.status(404).json({ error: "Entry not found" });
  res.json(detail);
});

xeroxApi.post(["/cash-flow", "/cash_flow"], (req, res) => {
  const b = req.body || {};
  const action = String(b.action || "record_movement");
  try {
    if (action === "record_movement") {
      const entry = saveManualCashFlow(b, actor(req));
      return res.json({ ok: true, id: entry.id });
    }
    if (action === "edit_entry") {
      const entry = updateManualCashFlow(Number(b.entry_id), b, actor(req));
      return res.json({ ok: true, id: entry.id });
    }
    if (action === "void_entry") {
      voidManualCashFlow(Number(b.entry_id), String(b.void_reason || b.reason || ""), actor(req));
      return res.json({ ok: true });
    }
    if (action === "restore_entry") {
      restoreManualCashFlow(Number(b.entry_id), String(b.reason || ""), actor(req));
      return res.json({ ok: true });
    }
    if (action === "add_category") {
      const cat = saveCfCategory(String(b.new_category_name || b.name || ""), String(b.new_category_direction || b.direction || "both"), String(b.new_category_notes || b.notes || ""));
      return res.json({ ok: true, category: cat });
    }
    if (action === "add_subcategory") {
      const sub = saveCfSubcategory(Number(b.new_sub_category_id || b.category_id), String(b.new_subcategory_name || b.name || ""), String(b.new_subcategory_notes || b.notes || ""));
      return res.json({ ok: true, subcategory: sub });
    }
    if (action === "add_party") {
      const party = saveCfParty(String(b.new_party_name || b.name || ""), String(b.new_party_type || b.party_type || "person"), String(b.new_party_note || b.note || ""));
      return res.json({ ok: true, party });
    }
    if (action === "rename_category") {
      const cat = saveCfCategory(String(b.category_name), String(b.category_direction || "both"), String(b.category_notes || ""));
      run("UPDATE cash_flow_category SET name=?, direction=?, notes=?, updated_at=? WHERE id=?", [
        b.category_name, b.category_direction || "both", b.category_notes || null, pkNow(), b.category_id
      ]);
      return res.json({ ok: true, category: cat });
    }
    if (action === "disable_category") {
      run("UPDATE cash_flow_category SET is_active=0, updated_at=? WHERE id=?", [pkNow(), b.category_id]);
      return res.json({ ok: true });
    }
    if (action === "enable_category") {
      run("UPDATE cash_flow_category SET is_active=1, updated_at=? WHERE id=?", [pkNow(), b.category_id]);
      return res.json({ ok: true });
    }
    if (action === "delete_category") {
      const used = one("SELECT id FROM cash_flow_entry WHERE category_id = ? LIMIT 1", [b.category_id]);
      if (used) return res.status(400).json({ error: "This category is used by historical transactions and cannot be deleted. Disable it instead." });
      run("DELETE FROM cash_flow_subcategory WHERE category_id = ?", [b.category_id]);
      run("DELETE FROM cash_flow_category WHERE id = ?", [b.category_id]);
      return res.json({ ok: true });
    }
    if (action === "rename_subcategory") {
      run("UPDATE cash_flow_subcategory SET name=?, notes=?, updated_at=? WHERE id=?", [b.subcategory_name, b.subcategory_notes || null, pkNow(), b.subcategory_id]);
      return res.json({ ok: true });
    }
    if (action === "disable_subcategory") {
      run("UPDATE cash_flow_subcategory SET is_active=0, updated_at=? WHERE id=?", [pkNow(), b.subcategory_id]);
      return res.json({ ok: true });
    }
    if (action === "enable_subcategory") {
      run("UPDATE cash_flow_subcategory SET is_active=1, updated_at=? WHERE id=?", [pkNow(), b.subcategory_id]);
      return res.json({ ok: true });
    }
    if (action === "delete_subcategory") {
      const used = one("SELECT id FROM cash_flow_entry WHERE subcategory_id = ? LIMIT 1", [b.subcategory_id]);
      if (used) return res.status(400).json({ error: "This sub-category is used by historical transactions and cannot be deleted. Disable it instead." });
      run("DELETE FROM cash_flow_subcategory WHERE id = ?", [b.subcategory_id]);
      return res.json({ ok: true });
    }
    if (action === "update_party") {
      run("UPDATE cash_flow_party SET name=?, party_type=?, note=?, updated_at=? WHERE id=?", [b.party_name, b.party_type || "other", b.party_note || null, pkNow(), b.party_id]);
      return res.json({ ok: true });
    }
    if (action === "disable_party") {
      run("UPDATE cash_flow_party SET is_active=0, updated_at=? WHERE id=?", [pkNow(), b.party_id]);
      return res.json({ ok: true });
    }
    if (action === "enable_party") {
      run("UPDATE cash_flow_party SET is_active=1, updated_at=? WHERE id=?", [pkNow(), b.party_id]);
      return res.json({ ok: true });
    }
    if (action === "delete_party") {
      const used = one("SELECT id FROM cash_flow_entry WHERE party_id = ? LIMIT 1", [b.party_id]);
      if (used) return res.status(400).json({ error: "This party is used by historical transactions and cannot be deleted. Disable it instead." });
      run("DELETE FROM cash_flow_party WHERE id = ?", [b.party_id]);
      return res.json({ ok: true });
    }
    if (action === "save_reconciliation") {
      const physical = money(b.physical_cash_available);
      const calculated = money(b.opening_balance ?? b.calculated_closing ?? 0);
      const payload = buildCashFlowPayload({ from_date: b.from_date, to_date: b.to_date });
      const closing = Number(payload.closing_balance || calculated);
      const diff = money(physical - closing);
      const existing = one<AnyRow>("SELECT * FROM cash_flow_difference_adjustment WHERE date(adjustment_date) = date(?)", [b.adjustment_date || pkDate()]);
      if (existing) {
        run(
          `UPDATE cash_flow_difference_adjustment SET physical_cash_available=?, calculated_closing=?, difference=?, amount=?, reason=?, note=?,
            old_physical_cash=?, edited_by=?, edited_date=?, edit_count=COALESCE(edit_count,0)+1, updated_at=? WHERE id=?`,
          [physical, closing, diff, diff, b.reconciliation_reason || null, b.reconciliation_reason || null, existing.physical_cash_available, actor(req), pkNow(), pkNow(), existing.id]
        );
        run(
          `INSERT INTO cash_flow_reconciliation_audit (reconciliation_id, adjustment_date, change_type, old_physical_cash, new_physical_cash, old_difference, new_difference, old_reason, new_reason, changed_by, changed_at)
           VALUES (?, ?, 'EDIT', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [existing.id, existing.adjustment_date, existing.physical_cash_available, physical, existing.difference, diff, existing.reason, b.reconciliation_reason || null, actor(req), pkNow()]
        );
        return res.json({ ok: true, id: existing.id, difference: diff });
      }
      const info = run(
        `INSERT INTO cash_flow_difference_adjustment (adjustment_date, amount, note, physical_cash_available, calculated_closing, difference, reason, created_by, created_at, updated_at, edit_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [b.adjustment_date || pkDate(), diff, b.reconciliation_reason || null, physical, closing, diff, b.reconciliation_reason || null, actor(req), pkNow(), pkNow()]
      );
      run(
        `INSERT INTO cash_flow_reconciliation_audit (reconciliation_id, adjustment_date, change_type, old_physical_cash, new_physical_cash, old_difference, new_difference, old_reason, new_reason, changed_by, changed_at)
         VALUES (?, ?, 'CREATE', NULL, ?, NULL, ?, NULL, ?, ?, ?)`,
        [Number(info.lastInsertRowid), b.adjustment_date || pkDate(), physical, diff, b.reconciliation_reason || null, actor(req), pkNow()]
      );
      return res.json({ ok: true, id: Number(info.lastInsertRowid), difference: diff });
    }
    if (action === "delete") {
      const rec = one<AnyRow>("SELECT * FROM cash_flow_difference_adjustment WHERE date(adjustment_date) = date(?)", [b.adjustment_date || pkDate()]);
      if (rec) run("DELETE FROM cash_flow_difference_adjustment WHERE id = ?", [rec.id]);
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: `Unknown action ${action}` });
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

xeroxApi.get(["/cash-flow/categories", "/cash_flow/categories"], (req, res) => {
  const dir = cfNormalizeDirection(req.query.direction);
  let rows = all<AnyRow>("SELECT * FROM cash_flow_category WHERE is_active = 1 OR is_active IS NULL ORDER BY name");
  if (dir === "in" || dir === "out") rows = rows.filter((c) => ["both", dir].includes(String(c.direction || "both")));
  res.json({ categories: rows });
});

xeroxApi.post(["/cash-flow/categories", "/cash_flow/categories"], (req, res) => {
  try {
    const cat = saveCfCategory(String(req.body?.name || ""), String(req.body?.direction || "both"), String(req.body?.notes || ""));
    res.json({ ok: true, category: cat });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

xeroxApi.get(["/cash-flow/subcategories", "/cash_flow/subcategories"], (req, res) => {
  const categoryId = Number(req.query.category_id || 0);
  const rows = all("SELECT * FROM cash_flow_subcategory WHERE category_id = ? AND (is_active = 1 OR is_active IS NULL) ORDER BY name", [categoryId]);
  res.json({ subcategories: rows });
});

xeroxApi.post(["/cash-flow/subcategories", "/cash_flow/subcategories"], (req, res) => {
  try {
    const b = req.body || {};
    let categoryId = Number(b.category_id || 0);
    if (!categoryId && b.category_name) {
      const cat = saveCfCategory(String(b.category_name), "both");
      categoryId = Number(cat.id);
    }
    const sub = saveCfSubcategory(categoryId, String(b.name || ""), String(b.notes || ""));
    res.json({ ok: true, subcategory: sub });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

xeroxApi.get(["/cash-flow/parties", "/cash_flow/parties"], (_req, res) => {
  res.json({ parties: all("SELECT * FROM cash_flow_party WHERE is_active = 1 OR is_active IS NULL ORDER BY name") });
});

xeroxApi.post(["/cash-flow/parties", "/cash_flow/parties"], (req, res) => {
  try {
    const party = saveCfParty(String(req.body?.name || ""), String(req.body?.party_type || "person"), String(req.body?.note || ""));
    res.json({ ok: true, party });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

xeroxApi.get(["/cash_flow_differences/:id", "/cash-flow-differences/:id"], (req, res) => {
  const rec = one<AnyRow>("SELECT * FROM cash_flow_difference_adjustment WHERE id = ?", [req.params.id]);
  if (!rec) return res.status(404).json({ error: "Not found" });
  const audit_trail = all("SELECT * FROM cash_flow_reconciliation_audit WHERE reconciliation_id = ? ORDER BY id DESC", [rec.id]);
  res.json({ reconciliation: rec, audit_trail });
});

xeroxApi.get("/accounts/:id/reconcile", (req, res) => {
  const account = one<AnyRow>("SELECT * FROM account WHERE id = ?", [req.params.id]);
  if (!account) return res.status(404).json({ error: "Account not found" });
  const expected = accountNet(Number(account.id));
  const recent = all<AnyRow>("SELECT * FROM account_reconciliation WHERE account_id = ? ORDER BY id DESC LIMIT 20", [account.id]);
  res.json({
    account: { ...account, live_balance: expected },
    expected,
    recent,
    today: pkDate()
  });
});

xeroxApi.post("/accounts/:id/reconcile", (req, res) => {
  const account = one<AnyRow>("SELECT * FROM account WHERE id = ?", [req.params.id]);
  if (!account) return res.status(404).json({ error: "Account not found" });
  const expected = accountNet(Number(account.id));
  const actual = money(req.body?.actual_balance);
  const diff = money(actual - expected);
  let difference_type = "Matched";
  if (diff < -0.005) difference_type = "Loss";
  else if (diff > 0.005) difference_type = "Excess";
  const prev = one<AnyRow>("SELECT * FROM account_reconciliation WHERE account_id = ? ORDER BY id DESC LIMIT 1", [account.id]);
  const info = run(
    `INSERT INTO account_reconciliation (
      account_id, previous_reconciliation_id, reconciliation_date, previous_balance, opening_balance,
      expected_balance, actual_balance, difference, adjustment_amount, final_reconciled_balance,
      expected_balance_minor, actual_balance_minor, difference_minor, final_reconciled_balance_minor,
      difference_type, status, note, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?, ?)`,
    [
      account.id, prev?.id || null, req.body?.reconciliation_date || pkDate(),
      prev?.final_reconciled_balance ?? account.opening_balance ?? 0,
      account.opening_balance || 0, expected, actual, diff, diff, actual,
      toMinor(expected), toMinor(actual), toMinor(diff), toMinor(actual),
      difference_type, req.body?.note || null, actor(req), pkNow(), pkNow()
    ]
  );
  if (Math.abs(diff) >= 0.005) {
    postAccountTx({
      toId: diff > 0 ? Number(account.id) : undefined,
      fromId: diff < 0 ? Number(account.id) : undefined,
      amount: Math.abs(diff),
      description: `Reconciliation ${difference_type} ${account.name}`,
      type: diff > 0 ? "Receipt" : "Expense",
      sourceType: "AccountReconciliation",
      sourceId: Number(info.lastInsertRowid),
      note: req.body?.note,
      createdBy: actor(req)
    });
  }
  res.json({ ok: true, id: Number(info.lastInsertRowid), difference: diff, difference_type });
});

xeroxApi.get("/grn/:id", (req, res) => {
  const g = one<AnyRow>("SELECT * FROM grn WHERE id = ?", [req.params.id]);
  if (!g) return res.status(404).json({ error: "GRN not found" });
  const items = all<AnyRow>("SELECT * FROM grn_item WHERE grn_id = ?", [g.id]);
  res.json({
    grn: { ...g, items },
    suppliers: all("SELECT * FROM supplier WHERE is_active = 1 ORDER BY name"),
    materials: all("SELECT id, code, name, unit_price, unit FROM material WHERE is_active = 1 ORDER BY name"),
    accounts: all("SELECT id, name, category, bank_name, account_holder_name, account_number FROM account WHERE is_active = 1 ORDER BY name")
  });
});

xeroxApi.get("/supplier_balance/:id", (req, res) => {
  const s = one<AnyRow>("SELECT * FROM supplier WHERE id = ?", [req.params.id]);
  if (!s) return res.json({ balance: 0 });
  res.json({ balance: supplierBalance(s) });
});

xeroxApi.post(["/merge_materials", "/materials/merge"], (req, res) => {
  const sourceId = Number(req.body?.source_material_id);
  const targetId = Number(req.body?.target_material_id);
  const source = one<AnyRow>("SELECT * FROM material WHERE id = ?", [sourceId]);
  const target = one<AnyRow>("SELECT * FROM material WHERE id = ?", [targetId]);
  if (!source || !target) return res.status(400).json({ error: "Select source and target brands." });
  if (source.id === target.id) return res.status(400).json({ error: "Source and target must be different." });
  const oldName = String(source.name);
  const newName = String(target.name);
  run("UPDATE entry SET material = ? WHERE material = ?", [newName, oldName]);
  run("UPDATE booking_item SET material_name = ? WHERE material_name = ?", [newName, oldName]);
  run("UPDATE direct_sale_item SET product_name = ? WHERE product_name = ?", [newName, oldName]);
  run("UPDATE grn_item SET mat_name = ? WHERE mat_name = ?", [newName, oldName]);
  run("UPDATE material_return_item SET material_name = ? WHERE material_name = ?", [newName, oldName]);
  run("DELETE FROM material WHERE id = ?", [source.id]);
  res.json({ ok: true, message: `Merged ${oldName} into ${newName}` });
});

xeroxApi.post("/materials/rename_label", (req, res) => {
  const oldLabel = String(req.body?.old_label || "").trim();
  const target = one<AnyRow>("SELECT * FROM material WHERE id = ?", [req.body?.target_material_id]);
  if (!oldLabel || !target) return res.status(400).json({ error: "Old name and target brand are required." });
  const newName = String(target.name);
  const tables: [string, string][] = [
    ["entry", "material"],
    ["booking_item", "material_name"],
    ["direct_sale_item", "product_name"],
    ["grn_item", "mat_name"],
    ["material_return_item", "material_name"]
  ];
  let changed = 0;
  for (const [table, col] of tables) {
    const info = run(`UPDATE ${table} SET ${col} = ? WHERE replace(lower(${col}), ' ', '') = replace(lower(?), ' ', '')`, [newName, oldLabel]);
    changed += Number(info.changes || 0);
  }
  res.json({ ok: true, changed, message: `Replaced "${oldLabel}" with ${newName} in ${changed} rows.` });
});

xeroxApi.post("/bulk_update_material_unit", (req, res) => {
  const unit = String(req.body?.new_unit || "").trim();
  if (!unit) return res.status(400).json({ error: "New unit is required." });
  const catId = req.body?.category_id;
  if (catId) run("UPDATE material SET unit = ? WHERE category_id = ?", [unit, catId]);
  else run("UPDATE material SET unit = ?", [unit]);
  res.json({ ok: true });
});

xeroxApi.post("/materials/activate-all", (_req, res) => {
  run("UPDATE material SET is_active = 1 WHERE is_active = 0");
  res.json({ ok: true });
});

xeroxApi.get("/direct_sales/hold", (_req, res) => {
  res.json({ drafts: all("SELECT * FROM direct_sale_draft ORDER BY id DESC LIMIT 100") });
});

xeroxApi.post("/direct_sales/hold", (req, res) => {
  const b = req.body || {};
  const payload = JSON.stringify(b.payload || b);
  const items = Array.isArray(b.items) ? b.items : [];
  const info = run(
    `INSERT INTO direct_sale_draft (client_code, client_name, manual_client_name, category, driver_name, manual_bill_no, item_count, total_qty, total_amount, payload, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.client_code || null, b.client_name || null, b.manual_client_name || null, b.category || null,
      b.driver_name || null, b.manual_bill_no || null, items.length,
      items.reduce((a: number, i: AnyRow) => a + Number(i.qty || 0), 0),
      items.reduce((a: number, i: AnyRow) => a + Number(i.qty || 0) * Number(i.rate || 0), 0),
      payload, actor(req), pkNow(), pkNow()
    ]
  );
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

xeroxApi.post("/direct_sales/hold/:id/delete", (req, res) => {
  run("DELETE FROM direct_sale_draft WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

xeroxApi.get("/mixed_transactions", (_req, res) => {
  const sales = all<AnyRow>("SELECT * FROM direct_sale WHERE is_void = 0 AND category = 'Mixed Transaction' ORDER BY id DESC LIMIT 200").map((s) => ({
    ...s,
    items: all("SELECT * FROM direct_sale_item WHERE sale_id = ?", [s.id])
  }));
  res.json({ sales });
});

xeroxApi.get(["/view_bill/:billNo", "/view_bill_detail/:type/:id"], (req, res) => {
  const typeParam = String((req.params as AnyRow).type || req.query.src || "").toLowerCase();
  const billNo = decodeURIComponent(String((req.params as AnyRow).billNo || ""));
  const srcId = Number((req.params as AnyRow).id || req.query.src_id || 0);
  let type = "Invoice";
  let bill: AnyRow | null = null;
  let items: AnyRow[] = [];
  let client: AnyRow | null = null;
  if (typeParam === "payment" || (!typeParam && billNo.startsWith("CP-"))) {
    bill = (srcId ? one("SELECT * FROM payment WHERE id = ?", [srcId]) : one("SELECT * FROM payment WHERE auto_bill_no = ? OR manual_bill_no = ?", [billNo, billNo])) || null;
    type = "Payment";
  } else if (typeParam === "grn" || (!typeParam && billNo.startsWith("GRN-"))) {
    bill = (srcId ? one("SELECT * FROM grn WHERE id = ?", [srcId]) : one("SELECT * FROM grn WHERE auto_bill_no = ? OR manual_bill_no = ?", [billNo, billNo])) || null;
    type = "GRN";
    if (bill) {
      items = all("SELECT mat_name AS name, qty, price_at_time FROM grn_item WHERE grn_id = ? AND (is_void = 0 OR is_void IS NULL)", [bill.id]);
      bill.supplier_name = bill.supplier;
    }
  } else if (typeParam === "materialreturn" || typeParam === "return") {
    bill = (srcId ? one("SELECT * FROM material_return WHERE id = ?", [srcId]) : one("SELECT * FROM material_return WHERE auto_bill_no = ? OR manual_bill_no = ?", [billNo, billNo])) || null;
    type = "MaterialReturn";
    if (bill) items = all("SELECT material_name AS name, qty, price_at_time FROM material_return_item WHERE material_return_id = ?", [bill.id]);
  } else if (typeParam === "booking") {
    bill = (srcId ? one("SELECT * FROM booking WHERE id = ?", [srcId]) : one("SELECT * FROM booking WHERE auto_bill_no = ? OR manual_bill_no = ?", [billNo, billNo])) || null;
    type = "Booking";
    if (bill) items = all("SELECT material_name AS name, qty, price_at_time FROM booking_item WHERE booking_id = ?", [bill.id]);
  } else {
    bill = (srcId ? one("SELECT * FROM direct_sale WHERE id = ?", [srcId]) : one("SELECT * FROM direct_sale WHERE auto_bill_no = ? OR manual_bill_no = ?", [billNo, billNo])) || null;
    type = "DirectSale";
    if (bill) items = all("SELECT product_name AS name, qty, price_at_time FROM direct_sale_item WHERE sale_id = ?", [bill.id]);
  }
  if (!bill) return res.status(404).json({ error: "Bill not found" });
  if (bill.client_name || bill.client_id) {
    client = (bill.client_id
      ? one("SELECT * FROM client WHERE id = ?", [bill.client_id])
      : one("SELECT * FROM client WHERE name = ? COLLATE NOCASE OR code = ?", [bill.client_name, bill.client_code])) || null;
  }
  const settings = one("SELECT * FROM settings ORDER BY id LIMIT 1") || {};
  let previous_balance = 0;
  if (client) previous_balance = clientBalance(client);
  const billAmount = Number(bill.amount || items.reduce((a, i) => a + Number(i.qty || 0) * Number(i.price_at_time || 0), 0));
  res.json({
    type,
    bill: { ...bill, amount: billAmount },
    items,
    client,
    settings,
    previous_balance,
    client_balance: client ? clientBalance(client) : 0,
    transaction_type_label: type === "Payment" ? "Payment Received" : type === "GRN" ? "Goods Receipt" : type === "MaterialReturn" ? "Material Return" : "Sale"
  });
});

xeroxApi.get("/data_lab", (_req, res) => {
  res.json({ ok: true });
});

xeroxApi.post("/data_lab", (req, res) => {
  const b = req.body || {};
  const rows: AnyRow[] = Array.isArray(b.rows) ? b.rows : [];
  for (const r of rows.slice(0, 500)) {
    run(
      `INSERT INTO recon_basket (bill_no, inv_date, inv_client, fin_client, inv_material, inv_qty, status, match_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.bill_no || null, r.inv_date || null, r.inv_client || null, r.fin_client || null, r.inv_material || null, Number(r.inv_qty || 0), r.status || "pending", Number(r.match_score || 0), pkNow()]
    );
  }
  if (!rows.length) {
    run(
      `INSERT INTO recon_basket (bill_no, inv_date, inv_client, fin_client, inv_material, inv_qty, status, match_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
      [b.note || "upload", pkDate(), b.index_name || "Ledger Index", b.finance_name || "Finance", b.dispatch_name || "Dispatch", 0, pkNow()]
    );
  }
  res.json({ ok: true, basket_count: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM recon_basket")?.n || 0) });
});

xeroxApi.get("/data_lab/basket", (_req, res) => {
  res.json({ rows: all("SELECT * FROM recon_basket ORDER BY id DESC LIMIT 300") });
});

xeroxApi.get(["/import_export/full_raw_import_history", "/import-export/history"], (_req, res) => {
  const jobs = all<AnyRow>(
    `SELECT j.*, u.filename AS source_file FROM import_job j
     LEFT JOIN import_upload u ON u.id = j.upload_id
     ORDER BY j.id DESC LIMIT 200`
  );
  res.json({
    reports: jobs.map((j) => ({
      name: `job-${j.id}`,
      created_at: j.started_at || j.created_at,
      mode: "full_raw",
      tenant_name: "AMS Main Yard",
      status: j.status,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      warnings: 0,
      tables: j.current_sheet || "",
      source_file: j.source_file || "",
      row_count: j.processed_rows || j.total_rows || 0
    }))
  });
});

xeroxApi.get("/delivery-rents", (req, res) => {
  const from = String(req.query.date_from || "");
  const to = String(req.query.date_to || "");
  const driver = String(req.query.driver || "");
  let sql = `SELECT a.*, d.name AS driver_name, s.client_name, s.auto_bill_no, s.manual_bill_no, s.date_posted AS sale_date
               FROM sale_delivery_persons a
               LEFT JOIN delivery_person d ON d.id = a.delivery_person_id
               LEFT JOIN direct_sale s ON s.id = a.sale_id
              WHERE (a.is_void = 0 OR a.is_void IS NULL)`;
  const params: unknown[] = [];
  if (from) { sql += " AND date(COALESCE(a.created_at, s.date_posted)) >= date(?)"; params.push(from); }
  if (to) { sql += " AND date(COALESCE(a.created_at, s.date_posted)) <= date(?)"; params.push(to); }
  if (driver) { sql += " AND d.name = ?"; params.push(driver); }
  sql += " ORDER BY a.id DESC LIMIT 400";
  const allocs: AnyRow[] = all<AnyRow>(sql, params).map((r: AnyRow) => {
    const paid = Number(one<{ n: number }>(
      "SELECT COALESCE(SUM(amount_paid),0) AS n FROM delivery_person_payment WHERE is_void = 0 AND allocation_id = ?",
      [r.id]
    )?.n || 0);
    const waived = Number(one<{ n: number }>(
      "SELECT COALESCE(SUM(COALESCE(waive_off_amount,0)),0) AS n FROM delivery_person_payment WHERE is_void = 0 AND allocation_id = ?",
      [r.id]
    )?.n || 0);
    const rent = Number(r.rent_amount || 0);
    return { ...r, paid_total: paid, waived_total: waived, due_total: money(rent - paid - waived) };
  });
  const drivers = all<AnyRow>("SELECT * FROM delivery_person WHERE is_active = 1 ORDER BY name");
  const byDriver: Record<string, number> = {};
  for (const r of allocs) byDriver[String(r.driver_name || "-")] = (byDriver[String(r.driver_name || "-")] || 0) + Number(r.rent_amount || 0);
  res.json({
    rents: allocs,
    rows: allocs,
    drivers,
    driver_names: drivers.map((d) => d.name),
    accounts: all("SELECT id, name, category, balance FROM account WHERE is_active = 1 ORDER BY name"),
    total_rent: allocs.reduce((a, r) => a + Number(r.rent_amount || 0), 0),
    total_paid: allocs.reduce((a, r) => a + Number(r.paid_total || 0), 0),
    total_waived: allocs.reduce((a, r) => a + Number(r.waived_total || 0), 0),
    total_due: allocs.reduce((a, r) => a + Number(r.due_total || 0), 0),
    totals_by_driver: Object.entries(byDriver).map(([name, amt]) => ({ name, amt }))
  });
});

xeroxApi.post("/delivery-rents/:id/pay", (req, res) => {
  const alloc = one<AnyRow>(
    `SELECT a.*, d.name AS driver_name FROM sale_delivery_persons a
     LEFT JOIN delivery_person d ON d.id = a.delivery_person_id WHERE a.id = ?`,
    [req.params.id]
  );
  if (!alloc) return res.status(404).json({ error: "Rent entry not found" });
  const paid = money(req.body?.paid_amount);
  const waive = money(req.body?.waive_off_amount);
  if (paid <= 0 && waive <= 0) return res.status(400).json({ error: "Enter paid amount or waive-off." });
  const info = run(
    `INSERT INTO delivery_person_payment (delivery_person_id, sale_id, allocation_id, amount_paid, amount_paid_minor, waive_off_amount, waive_off_minor, payment_account_id, method, reference, note, date_posted, created_by, created_at, updated_at, is_void, revision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    [
      alloc.delivery_person_id, alloc.sale_id, alloc.id, paid, toMinor(paid), waive, toMinor(waive),
      req.body?.payment_account_id || null, req.body?.method || "Cash", req.body?.reference || null,
      req.body?.note || null, req.body?.date || pkNow(), actor(req), pkNow(), pkNow()
    ]
  );
  if (paid > 0 && req.body?.payment_account_id) {
    postAccountTx({
      fromId: Number(req.body.payment_account_id),
      amount: paid,
      description: `Delivery rent ${alloc.driver_name || ""}`,
      type: "Driver Payment",
      sourceType: "DeliveryPersonPayment",
      sourceId: Number(info.lastInsertRowid),
      createdBy: actor(req)
    });
  }
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

xeroxApi.post("/delivery-rents/:id/void", (req, res) => {
  run("UPDATE sale_delivery_persons SET is_void = 1 WHERE id = ?", [req.params.id]);
  run("UPDATE delivery_rent SET is_void = 1 WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

xeroxApi.post("/dispatch", (req, res) => {
  const b = req.body || {};
  const client = getClient(b.client || b.client_name);
  const qty = Number(b.qty || 0);
  const material = String(b.material || "").trim();
  if (!material || qty <= 0) return res.status(400).json({ error: "Material and quantity are required." });
  const auto = nextAutoBill(db, "DSP");
  const bill = b.has_bill === false || b.has_bill === "0" ? "" : normalizeManualBill(b.bill_no);
  postStockEntry({
    type: "OUT",
    material,
    qty,
    client: client?.name || String(b.client || ""),
    clientCode: client?.code,
    billNo: bill || auto,
    autoBillNo: auto,
    category: b.track_as_cash ? "Cash" : "Dispatch",
    nimbusNo: b.nimbus_no,
    note: b.note,
    sourceModule: "dispatch",
    sourceTable: "entry",
    transactionType: "Dispatch"
  });
  if (b.track_as_cash) {
    run(
      `INSERT INTO pending_bill (client_code, client_name, bill_no, bill_kind, nimbus_no, amount, reason, is_paid, is_cash, is_manual, created_at, created_by, is_void, note)
       VALUES (?, ?, ?, ?, ?, 0, 'Cash dispatch', 0, 1, 0, ?, ?, 0, ?)`,
      [client?.code || null, client?.name || b.client, bill || auto, "DSP", b.nimbus_no || null, pkNow(), actor(req), b.note || null]
    );
  }
  res.json({ ok: true, auto_bill_no: auto });
});

xeroxApi.get(["/settings/activity", "/settings/activity_log"], (_req, res) => {
  res.json({ logs: all("SELECT * FROM audit_log ORDER BY timestamp DESC, id DESC LIMIT 200") });
});

xeroxApi.get(["/settings/sessions", "/settings/login_sessions"], (_req, res) => {
  res.json({
    sessions: all(
      `SELECT s.*, u.username, u.role FROM user_login_session s LEFT JOIN user u ON u.id = s.user_id ORDER BY s.last_seen_at DESC LIMIT 100`
    )
  });
});
