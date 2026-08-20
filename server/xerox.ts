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
  refreshAccountBalance,
  type AnyRow
} from "./services.ts";

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
  res.json({
    tables,
    users: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM user")?.n || 0),
    clients: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM client")?.n || 0),
    materials: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM material")?.n || 0),
    sales: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM direct_sale")?.n || 0),
    bookings: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM booking")?.n || 0),
    payments: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM payment")?.n || 0),
    accounts: Number(one<{ n: number }>("SELECT COUNT(*) AS n FROM account")?.n || 0)
  });
});
