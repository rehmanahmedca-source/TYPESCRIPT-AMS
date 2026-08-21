import { all, one, run } from "./db.ts";
import { money, pkDate, pkNow, toMinor, ymd } from "./money.ts";
import { accountNet, refreshAccountBalance, type AnyRow } from "./services.ts";
import { freshStartCutoff, todayOpeningOverride } from "./opsExtras.ts";

export const CF_DIR_IN = "in";
export const CF_DIR_OUT = "out";
export const CF_DIR_TRANSFER = "transfer";
export const SRC_MANUAL = "MANUAL_CASH_FLOW";
export const CF_SRC_MARKER = "[SRC:CashFlow]";
export const CF_PARTY_TYPES: [string, string][] = [
  ["person", "Person"],
  ["outsider", "Outsider / other party"],
  ["loan", "Loan (person or outside lender)"],
  ["other", "Other"]
];

const MIRROR_MARKERS = [
  "[SRC:BOOKING:",
  "[SRC:DIRECTSALE:",
  "[SRC:PAYMENT:",
  "[SRC:SUPPLIERPAYMENT:",
  "[SRC:CLIENTREFUND:",
  "[SRC:CASHFLOW"
];

export function cfNormalizeDirection(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  if (["received", "receive", "in", "cash_in"].includes(raw)) return CF_DIR_IN;
  if (["spent", "spend", "out", "cash_out", "paid"].includes(raw)) return CF_DIR_OUT;
  if (["transfer", "xfer"].includes(raw)) return CF_DIR_TRANSFER;
  return raw;
}

export function cfTypeLabel(direction: string) {
  return direction === CF_DIR_IN ? "Received" : direction === CF_DIR_OUT ? "Spent" : direction === CF_DIR_TRANSFER ? "Transfer" : direction;
}

function isMoneyAccount(acc?: AnyRow | null) {
  if (!acc || acc.is_active === 0) return false;
  return ["cash", "bank"].includes(String(acc.category || "").toLowerCase());
}

export function companyAccounts(activeOnly = true): AnyRow[] {
  const rows = all<AnyRow>("SELECT * FROM account ORDER BY name, id");
  return rows.filter((a) => {
    if (activeOnly && a.is_active === 0) return false;
    return ["cash", "bank"].includes(String(a.category || "").toLowerCase());
  }).map((a) => ({ ...a, live_balance: accountNet(Number(a.id)) }));
}

function findCategory(id?: unknown, name?: unknown, activeOnly = true) {
  if (id) {
    const cat = one<AnyRow>("SELECT * FROM cash_flow_category WHERE id = ?", [Number(id)]);
    if (cat && (!activeOnly || cat.is_active !== 0)) return cat;
    return null;
  }
  const n = String(name || "").trim();
  if (!n) return null;
  return one<AnyRow>(
    `SELECT * FROM cash_flow_category WHERE lower(name) = lower(?) ${activeOnly ? "AND (is_active = 1 OR is_active IS NULL)" : ""}`,
    [n]
  );
}

function findSubcategory(category: AnyRow | null, id?: unknown, name?: unknown, activeOnly = true) {
  if (!category) return null;
  if (id) {
    const sub = one<AnyRow>("SELECT * FROM cash_flow_subcategory WHERE id = ?", [Number(id)]);
    if (sub && Number(sub.category_id) === Number(category.id) && (!activeOnly || sub.is_active !== 0)) return sub;
    return null;
  }
  const n = String(name || "").trim();
  if (!n) return null;
  return one<AnyRow>(
    `SELECT * FROM cash_flow_subcategory WHERE category_id = ? AND lower(name) = lower(?) ${activeOnly ? "AND (is_active = 1 OR is_active IS NULL)" : ""}`,
    [category.id, n]
  );
}

function findParty(id?: unknown, name?: unknown, partyType?: unknown, activeOnly = true) {
  if (id) {
    const p = one<AnyRow>("SELECT * FROM cash_flow_party WHERE id = ?", [Number(id)]);
    if (p && (!activeOnly || p.is_active !== 0)) return p;
    return null;
  }
  const n = String(name || "").trim();
  if (!n) return null;
  const params: unknown[] = [n];
  let sql = "SELECT * FROM cash_flow_party WHERE lower(name) = lower(?)";
  if (partyType) {
    sql += " AND lower(coalesce(party_type,'')) = lower(?)";
    params.push(partyType);
  }
  if (activeOnly) sql += " AND (is_active = 1 OR is_active IS NULL)";
  return one<AnyRow>(sql, params);
}

export function saveCfCategory(name: string, direction = "both", notes?: string) {
  const n = String(name || "").trim();
  const dir = String(direction || "both").trim().toLowerCase();
  if (!n) throw new Error("Category name is required.");
  if (!["in", "out", "both"].includes(dir)) throw new Error("Category direction must be Received, Spent, or Both.");
  const existing = one<AnyRow>("SELECT * FROM cash_flow_category WHERE lower(name) = lower(?)", [n]);
  if (existing) {
    run("UPDATE cash_flow_category SET is_active=1, direction=?, notes=?, updated_at=? WHERE id=?", [
      dir,
      notes !== undefined ? (notes || null) : existing.notes,
      pkNow(),
      existing.id
    ]);
    return one<AnyRow>("SELECT * FROM cash_flow_category WHERE id = ?", [existing.id])!;
  }
  const info = run(
    "INSERT INTO cash_flow_category (name, direction, is_active, notes, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)",
    [n, dir, notes || null, pkNow(), pkNow()]
  );
  return one<AnyRow>("SELECT * FROM cash_flow_category WHERE id = ?", [Number(info.lastInsertRowid)])!;
}

export function saveCfSubcategory(categoryId: number, name: string, notes?: string) {
  const n = String(name || "").trim();
  const cat = one<AnyRow>("SELECT * FROM cash_flow_category WHERE id = ?", [categoryId]);
  if (!cat) throw new Error("Pick a parent category.");
  if (!n) throw new Error("Sub-category name is required.");
  const existing = one<AnyRow>("SELECT * FROM cash_flow_subcategory WHERE category_id = ? AND lower(name) = lower(?)", [cat.id, n]);
  if (existing) {
    run("UPDATE cash_flow_subcategory SET is_active=1, notes=?, updated_at=? WHERE id=?", [
      notes !== undefined ? (notes || null) : existing.notes,
      pkNow(),
      existing.id
    ]);
    return one<AnyRow>("SELECT * FROM cash_flow_subcategory WHERE id = ?", [existing.id])!;
  }
  const info = run(
    "INSERT INTO cash_flow_subcategory (category_id, name, is_active, notes, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)",
    [cat.id, n, notes || null, pkNow(), pkNow()]
  );
  return one<AnyRow>("SELECT * FROM cash_flow_subcategory WHERE id = ?", [Number(info.lastInsertRowid)])!;
}

export function saveCfParty(name: string, partyType = "person", note?: string) {
  const n = String(name || "").trim();
  const ptype = String(partyType || "other").trim().toLowerCase() || "other";
  if (!n) throw new Error("Name is required.");
  const existing = findParty(undefined, n, ptype, false);
  if (existing) {
    run("UPDATE cash_flow_party SET is_active=1, note=?, updated_at=? WHERE id=?", [
      note !== undefined ? (note || null) : existing.note,
      pkNow(),
      existing.id
    ]);
    return one<AnyRow>("SELECT * FROM cash_flow_party WHERE id = ?", [existing.id])!;
  }
  const info = run(
    "INSERT INTO cash_flow_party (name, party_type, note, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    [n, ptype, note || null, pkNow(), pkNow()]
  );
  return one<AnyRow>("SELECT * FROM cash_flow_party WHERE id = ?", [Number(info.lastInsertRowid)])!;
}

function resolveCategory(direction: string, categoryId?: unknown, categoryName?: unknown, required = true, createIfMissing = false) {
  if (direction === CF_DIR_TRANSFER) return null;
  let cat = findCategory(categoryId, categoryName, true);
  if (cat) {
    const allowed = String(cat.direction || "both").toLowerCase();
    if (allowed !== "both" && allowed !== direction) throw new Error("Selected category is not allowed for this transaction type.");
    return cat;
  }
  const name = String(categoryName || "").trim();
  if (required && !name && !categoryId) throw new Error("Category is required for Received and Spent.");
  if (categoryId && !cat) throw new Error("Selected category is missing or inactive.");
  if (name && createIfMissing) return saveCfCategory(name, direction);
  if (required) throw new Error("Category must exist and be active. Create it in Categories first.");
  return null;
}

function resolveSubcategory(category: AnyRow | null, subcategoryId?: unknown, subcategoryName?: unknown, createIfMissing = false) {
  if (!category) {
    if (subcategoryId || String(subcategoryName || "").trim()) throw new Error("Sub-category requires a category.");
    return null;
  }
  const sub = findSubcategory(category, subcategoryId, subcategoryName, true);
  if (sub) return sub;
  if (subcategoryId) throw new Error("Sub-category does not belong to the selected category.");
  const name = String(subcategoryName || "").trim();
  if (name && createIfMissing) return saveCfSubcategory(Number(category.id), name);
  if (name) throw new Error("Sub-category must belong to the selected category.");
  return null;
}

function snapshot(entry: AnyRow) {
  return {
    id: entry.id,
    direction: entry.direction,
    amount: Number(entry.amount || 0),
    account_id: entry.account_id,
    destination_account_id: entry.destination_account_id,
    category_id: entry.category_id,
    subcategory_id: entry.subcategory_id,
    party_id: entry.party_id,
    party_name: entry.party_name,
    party_type: entry.party_type,
    description: entry.description,
    note: entry.note,
    reference: entry.reference,
    date_posted: String(entry.date_posted || ""),
    is_void: Boolean(entry.is_void),
    source_type: entry.source_type || SRC_MANUAL
  };
}

function writeAudit(entryId: number, action: string, before?: unknown, after?: unknown, reason?: string, actor?: string) {
  run(
    `INSERT INTO cash_flow_entry_audit (entry_id, action, before_json, after_json, reason, changed_by, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entryId,
      action,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      (reason || "").trim() || null,
      actor || "system",
      pkNow()
    ]
  );
}

function postCfAccountTx(opts: {
  direction: string;
  amount: number;
  accountId: number;
  destId?: number | null;
  description: string;
  note?: string | null;
  posted: string;
  entryId: number;
  actor: string;
}) {
  const marker = `[SRC:CashFlow:${opts.entryId}]`;
  const note = [opts.note, marker].filter(Boolean).join(" ").trim();
  const fromId = opts.direction === CF_DIR_IN ? null : opts.accountId;
  const toId = opts.direction === CF_DIR_OUT ? null : opts.direction === CF_DIR_IN ? opts.accountId : opts.destId;
  const type = opts.direction === CF_DIR_IN ? "Receipt" : opts.direction === CF_DIR_OUT ? "Expense" : "Transfer";
  const info = run(
    `INSERT INTO account_transaction (
      from_account_id, to_account_id, amount, amount_minor, description, date_posted,
      is_void, note, transaction_type, source_type, source_id, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'CashFlowEntry', ?, ?, ?)`,
    [fromId, toId, opts.amount, toMinor(opts.amount), opts.description, opts.posted, note, type, opts.entryId, opts.actor, pkNow()]
  );
  if (fromId) refreshAccountBalance(fromId);
  if (toId) refreshAccountBalance(Number(toId));
  return Number(info.lastInsertRowid);
}

export function saveManualCashFlow(b: AnyRow, actor: string) {
  const key = String(b.idempotency_key || "").trim() || null;
  if (key) {
    const existing = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE idempotency_key = ?", [key]);
    if (existing) return existing;
  }
  const direction = cfNormalizeDirection(b.direction);
  const amount = money(b.amount);
  if (![CF_DIR_IN, CF_DIR_OUT, CF_DIR_TRANSFER].includes(direction)) throw new Error("Choose Received, Spent, or Transfer.");
  if (amount <= 0) throw new Error("Amount must be greater than zero.");
  const account = one<AnyRow>("SELECT * FROM account WHERE id = ?", [Number(b.account_id || b.cash_account_id)]);
  if (!isMoneyAccount(account)) throw new Error("Select a valid company cash or bank account.");
  let destination: AnyRow | null = null;
  if (direction === CF_DIR_TRANSFER) {
    destination = one<AnyRow>("SELECT * FROM account WHERE id = ?", [Number(b.to_account_id || b.destination_account_id)]) || null;
    if (!isMoneyAccount(destination)) throw new Error("Select a valid destination account.");
    if (Number(destination!.id) === Number(account!.id)) throw new Error("Source and destination accounts cannot be the same.");
  }
  if ((direction === CF_DIR_OUT || direction === CF_DIR_TRANSFER) && accountNet(Number(account!.id)) < amount) {
    throw new Error(`Insufficient balance in ${account!.name}.`);
  }
  const cat = resolveCategory(direction, b.category_id, b.category_name, direction !== CF_DIR_TRANSFER, true);
  const sub = resolveSubcategory(cat, b.subcategory_id, b.subcategory_name, true);
  const ptype = String(b.party_type || "other").trim().toLowerCase() || "other";
  let party = findParty(b.party_id, b.party_name, ptype, true);
  if (!party && String(b.party_name || "").trim()) party = saveCfParty(String(b.party_name), ptype);
  const partyName = party ? String(party.name) : String(b.party_name || "").trim() || null;
  const posted = String(b.date_posted || b.movement_date || pkNow());
  let desc = String(b.description || "").trim();
  if (!desc) {
    desc = cat ? String(cat.name) : cfTypeLabel(direction);
    if (partyName) desc = `${desc} — ${partyName}`;
  }
  const note = String(b.note || b.movement_note || "").trim() || null;
  const reference = String(b.reference || "").trim() || null;
  const info = run(
    `INSERT INTO cash_flow_entry (
      direction, amount, amount_minor, account_id, destination_account_id, category_id, subcategory_id,
      party_id, party_name, party_type, description, note, reference, date_posted, created_by, updated_by,
      source_type, is_void, revision, idempotency_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`,
    [
      direction, amount, toMinor(amount), account!.id, destination?.id || null, cat?.id || null, sub?.id || null,
      party?.id || null, partyName, ptype, desc, note, reference, posted, actor, actor, SRC_MANUAL, key, pkNow(), pkNow()
    ]
  );
  const id = Number(info.lastInsertRowid);
  const txId = postCfAccountTx({
    direction, amount, accountId: Number(account!.id), destId: destination ? Number(destination.id) : null,
    description: desc, note, posted, entryId: id, actor
  });
  run("UPDATE cash_flow_entry SET account_tx_id = ? WHERE id = ?", [txId, id]);
  const entry = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE id = ?", [id])!;
  writeAudit(id, "Created", undefined, snapshot(entry), undefined, actor);
  return entry;
}

export function updateManualCashFlow(id: number, b: AnyRow, actor: string) {
  const entry = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE id = ?", [id]);
  if (!entry) throw new Error("Entry not found.");
  if (entry.is_void) throw new Error("A voided transaction cannot be edited. Restore it first.");
  const before = snapshot(entry);
  const direction = cfNormalizeDirection(b.direction);
  const amount = money(b.amount);
  const account = one<AnyRow>("SELECT * FROM account WHERE id = ?", [Number(b.account_id || b.cash_account_id)]);
  if (!isMoneyAccount(account)) throw new Error("Select a valid company cash or bank account.");
  let destination: AnyRow | null = null;
  if (direction === CF_DIR_TRANSFER) {
    destination = one<AnyRow>("SELECT * FROM account WHERE id = ?", [Number(b.to_account_id || b.destination_account_id)]) || null;
    if (!isMoneyAccount(destination)) throw new Error("Select a valid destination account.");
  }
  if (entry.account_tx_id) {
    const tx = one<AnyRow>("SELECT * FROM account_transaction WHERE id = ?", [entry.account_tx_id]);
    if (tx && !tx.is_void) {
      run("UPDATE account_transaction SET is_void = 1, voided_at = ?, voided_by = ? WHERE id = ?", [pkNow(), actor, tx.id]);
      if (tx.from_account_id) refreshAccountBalance(Number(tx.from_account_id));
      if (tx.to_account_id) refreshAccountBalance(Number(tx.to_account_id));
    }
  }
  if ((direction === CF_DIR_OUT || direction === CF_DIR_TRANSFER) && accountNet(Number(account!.id)) < amount) {
    throw new Error(`Insufficient balance in ${account!.name}.`);
  }
  const cat = resolveCategory(direction, b.category_id, b.category_name, direction !== CF_DIR_TRANSFER, true);
  const sub = resolveSubcategory(cat, b.subcategory_id, b.subcategory_name, true);
  const ptype = String(b.party_type || entry.party_type || "other").trim().toLowerCase() || "other";
  let party = findParty(b.party_id, b.party_name, ptype, true);
  if (!party && String(b.party_name || "").trim()) party = saveCfParty(String(b.party_name), ptype);
  const partyName = party ? String(party.name) : String(b.party_name || "").trim() || null;
  const posted = String(b.date_posted || b.movement_date || entry.date_posted || pkNow());
  const desc = String(b.description || "").trim() || String(entry.description || cfTypeLabel(direction));
  const note = String(b.note || b.movement_note || "").trim() || null;
  const reference = b.reference !== undefined ? (String(b.reference || "").trim() || null) : entry.reference;
  run(
    `UPDATE cash_flow_entry SET direction=?, amount=?, amount_minor=?, account_id=?, destination_account_id=?,
      category_id=?, subcategory_id=?, party_id=?, party_name=?, party_type=?, description=?, note=?, reference=?,
      date_posted=?, updated_by=?, updated_at=?, revision=COALESCE(revision,1)+1 WHERE id=?`,
    [
      direction, amount, toMinor(amount), account!.id, destination?.id || null, cat?.id || null, sub?.id || null,
      party?.id || null, partyName, ptype, desc, note, reference, posted, actor, pkNow(), id
    ]
  );
  const txId = postCfAccountTx({
    direction, amount, accountId: Number(account!.id), destId: destination ? Number(destination.id) : null,
    description: desc, note, posted, entryId: id, actor
  });
  run("UPDATE cash_flow_entry SET account_tx_id = ? WHERE id = ?", [txId, id]);
  const updated = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE id = ?", [id])!;
  writeAudit(id, "Edited", before, snapshot(updated), String(b.edit_reason || b.reason || ""), actor);
  return updated;
}

export function voidManualCashFlow(id: number, reason: string | undefined, actor: string) {
  const entry = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE id = ?", [id]);
  if (!entry) throw new Error("Entry not found.");
  if (entry.is_void) throw new Error("This transaction is already voided.");
  const before = snapshot(entry);
  if (entry.account_tx_id) {
    const tx = one<AnyRow>("SELECT * FROM account_transaction WHERE id = ?", [entry.account_tx_id]);
    if (tx && !tx.is_void) {
      run("UPDATE account_transaction SET is_void = 1, voided_at = ?, voided_by = ? WHERE id = ?", [pkNow(), actor, tx.id]);
      if (tx.from_account_id) refreshAccountBalance(Number(tx.from_account_id));
      if (tx.to_account_id) refreshAccountBalance(Number(tx.to_account_id));
    }
  }
  run(
    `UPDATE cash_flow_entry SET is_void=1, voided_at=?, voided_by=?, void_reason=?, updated_by=?, updated_at=?, revision=COALESCE(revision,1)+1 WHERE id=?`,
    [pkNow(), actor, (reason || "").trim() || null, actor, pkNow(), id]
  );
  const after = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE id = ?", [id])!;
  writeAudit(id, "Voided", before, snapshot(after), reason, actor);
  return after;
}

export function restoreManualCashFlow(id: number, reason: string | undefined, actor: string) {
  const entry = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE id = ?", [id]);
  if (!entry) throw new Error("Entry not found.");
  if (!entry.is_void) throw new Error("This transaction is already active.");
  const before = snapshot(entry);
  if (entry.account_tx_id) {
    const tx = one<AnyRow>("SELECT * FROM account_transaction WHERE id = ?", [entry.account_tx_id]);
    if (tx && tx.is_void) {
      run("UPDATE account_transaction SET is_void = 0, voided_at = NULL, voided_by = NULL WHERE id = ?", [tx.id]);
      if (tx.from_account_id) refreshAccountBalance(Number(tx.from_account_id));
      if (tx.to_account_id) refreshAccountBalance(Number(tx.to_account_id));
    }
  }
  run(
    `UPDATE cash_flow_entry SET is_void=0, voided_at=NULL, voided_by=NULL, void_reason=NULL, updated_by=?, updated_at=?, revision=COALESCE(revision,1)+1 WHERE id=?`,
    [actor, pkNow(), id]
  );
  const after = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE id = ?", [id])!;
  writeAudit(id, "Restored", before, snapshot(after), reason, actor);
  return after;
}

function cfRow(opts: AnyRow) {
  const direction = opts.direction;
  const amount = Number(opts.amount || 0);
  const destName = opts.dest_account_name || "";
  const accountDisplay = destName && direction === CF_DIR_TRANSFER
    ? `${opts.account_name || "—"} → ${destName}`
    : opts.account_name || "—";
  return {
    date: opts.sort_dt,
    sort_dt: opts.sort_dt,
    type: direction,
    tx_type_label: cfTypeLabel(direction),
    cash_in: direction === CF_DIR_IN ? amount : 0,
    cash_out: direction === CF_DIR_OUT ? amount : 0,
    transfer_amount: direction === CF_DIR_TRANSFER ? amount : 0,
    amount,
    account_id: opts.account_id || null,
    account_name: opts.account_name || "",
    account_to_id: opts.dest_account_id || null,
    account_to_name: destName,
    account_display: accountDisplay,
    category: opts.category || "",
    subcategory: opts.subcategory || "",
    party_name: opts.party_name || "",
    party_type: opts.party_type || "",
    description: opts.description || "",
    note: opts.note || "",
    reference: opts.reference || "",
    source: opts.source_type === SRC_MANUAL ? "MANUAL" : "SYSTEM",
    source_type: opts.source_type,
    origin: opts.origin,
    origin_label: opts.origin_label || "",
    created_by: opts.created_by || "",
    status: opts.status || "active",
    entry_id: opts.entry_id || null,
    tx_id: opts.tx_id || null,
    running_balance: 0
  };
}

function isMirrorTx(tx: AnyRow) {
  const note = String(tx.note || "").toUpperCase();
  if (note.includes(CF_SRC_MARKER.toUpperCase()) || note.includes("[SRC:CASHFLOW")) return true;
  if (String(tx.source_type || "") === "CashFlowEntry") return true;
  return MIRROR_MARKERS.some((m) => note.includes(m));
}

export function collectCashFlowRows(fromDate: string, toDate: string, includeVoided = true, postedAfter?: string | null) {
  const rows: AnyRow[] = [];
  const accounts = all<AnyRow>("SELECT * FROM account");
  const byId: Record<number, AnyRow> = {};
  for (const a of accounts) byId[Number(a.id)] = a;
  const cats = all<AnyRow>("SELECT * FROM cash_flow_category");
  const catBy: Record<number, AnyRow> = {};
  for (const c of cats) catBy[Number(c.id)] = c;
  const subs = all<AnyRow>("SELECT * FROM cash_flow_subcategory");
  const subBy: Record<number, AnyRow> = {};
  for (const s of subs) subBy[Number(s.id)] = s;

  let recSql = `SELECT * FROM cash_flow_entry WHERE date(date_posted) >= date(?) AND date(date_posted) <= date(?)`;
  const recParams: unknown[] = [fromDate, toDate];
  if (!includeVoided) recSql += " AND (is_void = 0 OR is_void IS NULL)";
  if (postedAfter) {
    recSql += " AND datetime(date_posted) > datetime(?)";
    recParams.push(postedAfter);
  }
  for (const e of all<AnyRow>(recSql, recParams)) {
    const acc = byId[Number(e.account_id)];
    const dest = byId[Number(e.destination_account_id)];
    rows.push(cfRow({
      sort_dt: e.date_posted,
      direction: e.direction,
      amount: e.amount,
      reference: e.reference || `CF-${e.id}`,
      description: e.description || "",
      note: e.note || "",
      category: catBy[Number(e.category_id)]?.name || "",
      subcategory: subBy[Number(e.subcategory_id)]?.name || "",
      party_name: e.party_name || "",
      party_type: e.party_type || "",
      account_id: e.account_id,
      account_name: acc?.name || "",
      dest_account_id: e.destination_account_id,
      dest_account_name: dest?.name || "",
      source_type: e.source_type || SRC_MANUAL,
      origin: "recorded",
      origin_label: "Recorded on Cash Flow",
      created_by: e.created_by || "",
      status: e.is_void ? "voided" : "active",
      entry_id: e.id,
      tx_id: e.account_tx_id
    }));
  }

  const pays = all<AnyRow>(
    `SELECT * FROM payment WHERE is_void = 0 AND date(date_posted) >= date(?) AND date(date_posted) <= date(?)
      AND lower(trim(coalesce(method,''))) IN ('cash','cash sale')`,
    [fromDate, toDate]
  );
  for (const p of pays) {
    const acc = byId[Number(p.payment_account_id)];
    const amt = Number(p.amount || 0);
    rows.push(cfRow({
      sort_dt: p.date_posted, direction: amt < 0 ? CF_DIR_OUT : CF_DIR_IN, amount: Math.abs(amt),
      reference: p.manual_bill_no || p.auto_bill_no || `PAY-${p.id}`,
      description: `Client Payment — ${p.client_name || ""}`,
      note: p.note || "", party_name: p.client_name || "", party_type: "client",
      account_id: p.payment_account_id, account_name: acc?.name || "",
      source_type: "CLIENT_PAYMENT", origin: "derived", origin_label: "From Accounts · Client Payments",
      created_by: p.created_by || ""
    }));
  }

  const sales = all<AnyRow>(
    `SELECT * FROM direct_sale WHERE is_void = 0 AND paid_amount > 0
      AND date(date_posted) >= date(?) AND date(date_posted) <= date(?)
      AND (
        lower(trim(coalesce(category,''))) IN ('cash','cash sale')
        OR lower(trim(coalesce(payment_method,''))) IN ('cash','cash sale')
      )`,
    [fromDate, toDate]
  );
  for (const s of sales) {
    const acc = byId[Number(s.payment_account_id)];
    rows.push(cfRow({
      sort_dt: s.date_posted, direction: CF_DIR_IN, amount: s.paid_amount,
      reference: s.manual_bill_no || s.auto_bill_no || `DS-${s.id}`,
      description: `Cash Sale — ${s.client_name || ""}`,
      note: s.note || "", party_name: s.client_name || "", party_type: "client",
      account_id: s.payment_account_id, account_name: acc?.name || "",
      source_type: "SALE", origin: "derived", origin_label: "From Sales",
      created_by: s.created_by || ""
    }));
  }

  const sps = all<AnyRow>(
    `SELECT p.*, s.name AS supplier_name FROM supplier_payment p
     LEFT JOIN supplier s ON s.id = p.supplier_id
     WHERE p.is_void = 0 AND date(p.date_posted) >= date(?) AND date(p.date_posted) <= date(?)`,
    [fromDate, toDate]
  );
  for (const sp of sps) {
    const acc = byId[Number(sp.payment_account_id)];
    rows.push(cfRow({
      sort_dt: sp.date_posted, direction: CF_DIR_OUT, amount: sp.amount,
      reference: sp.manual_bill_no || sp.auto_bill_no || `SUP-${sp.id}`,
      description: `Supplier Payment — ${sp.supplier_name || ""}`,
      note: sp.note || "", party_name: sp.supplier_name || "", party_type: "supplier",
      account_id: sp.payment_account_id, account_name: acc?.name || "",
      source_type: "SUPPLIER_PAYMENT", origin: "derived", origin_label: "From Accounts · Supplier Payments",
      created_by: sp.created_by || ""
    }));
  }

  const txs = all<AnyRow>(
    `SELECT * FROM account_transaction WHERE is_void = 0
      AND transaction_type IN ('Expense','Payment','Driver Payment','Transfer','Receipt')
      AND date(date_posted) >= date(?) AND date(date_posted) <= date(?)`,
    [fromDate, toDate]
  );
  for (const tx of txs) {
    if (isMirrorTx(tx)) continue;
    const fromAcc = byId[Number(tx.from_account_id)];
    const toAcc = byId[Number(tx.to_account_id)];
    const moneyCat = (a?: AnyRow) => a && ["cash", "bank"].includes(String(a.category || "").toLowerCase());
    if (tx.transaction_type === "Transfer") {
      if (!moneyCat(fromAcc) && !moneyCat(toAcc)) continue;
      rows.push(cfRow({
        sort_dt: tx.date_posted, direction: CF_DIR_TRANSFER, amount: tx.amount,
        reference: `TX-${tx.id}`, description: tx.description || "Account transfer", note: tx.note || "",
        account_id: tx.from_account_id, account_name: fromAcc?.name || "",
        dest_account_id: tx.to_account_id, dest_account_name: toAcc?.name || "",
        source_type: "TRANSFER", origin: "derived", origin_label: "From Accounts · Transfer",
        created_by: tx.created_by || "", tx_id: tx.id
      }));
      continue;
    }
    if (tx.transaction_type === "Receipt" && moneyCat(toAcc)) {
      rows.push(cfRow({
        sort_dt: tx.date_posted, direction: CF_DIR_IN, amount: tx.amount,
        reference: `TX-${tx.id}`, description: tx.description || "Cash received", note: tx.note || "",
        account_id: tx.to_account_id, account_name: toAcc?.name || "",
        source_type: "ACCOUNT_RECEIPT", origin: "derived", origin_label: "From Accounts · Other receive",
        created_by: tx.created_by || "", tx_id: tx.id
      }));
      continue;
    }
    if (["Expense", "Payment", "Driver Payment"].includes(String(tx.transaction_type)) && moneyCat(fromAcc)) {
      const isDriver = tx.transaction_type === "Driver Payment";
      rows.push(cfRow({
        sort_dt: tx.date_posted, direction: CF_DIR_OUT, amount: tx.amount,
        reference: `TX-${tx.id}`,
        description: tx.description || (isDriver ? "Driver service payment" : "Expense"),
        note: tx.note || "", party_type: isDriver ? "delivery_person" : "",
        account_id: tx.from_account_id, account_name: fromAcc?.name || "",
        source_type: isDriver ? "DRIVER_PAYMENT" : "ACCOUNT_EXPENSE",
        origin: "derived",
        origin_label: isDriver ? "From Accounts · Driver Services" : "From Accounts · Expense",
        created_by: tx.created_by || "", tx_id: tx.id
      }));
    }
  }
  rows.sort((a, b) => String(a.sort_dt || "").localeCompare(String(b.sort_dt || "")) || String(a.reference || "").localeCompare(String(b.reference || "")));
  return rows;
}

export function filterCashFlowRows(rows: AnyRow[], f: AnyRow) {
  let out = [...rows];
  const ftype = String(f.filter_type || "all").toLowerCase();
  if (["cash_in", "received", "in"].includes(ftype)) out = out.filter((r) => r.type === CF_DIR_IN);
  else if (["cash_out", "spent", "out"].includes(ftype)) out = out.filter((r) => r.type === CF_DIR_OUT);
  else if (ftype === "transfer") out = out.filter((r) => r.type === CF_DIR_TRANSFER);
  const origin = String(f.origin || "all").toLowerCase();
  if (["derived", "recorded"].includes(origin)) out = out.filter((r) => r.origin === origin);
  else if (origin === "manual") out = out.filter((r) => r.source === "MANUAL");
  else if (origin === "system") out = out.filter((r) => r.source === "SYSTEM");
  const category = String(f.category || "").toLowerCase();
  if (category) out = out.filter((r) => String(r.category || "").toLowerCase().includes(category));
  const subcategory = String(f.subcategory || "").toLowerCase();
  if (subcategory) out = out.filter((r) => String(r.subcategory || "").toLowerCase().includes(subcategory));
  const partyType = String(f.party_type || "").toLowerCase();
  if (partyType) out = out.filter((r) => String(r.party_type || "").toLowerCase() === partyType);
  const party = String(f.party || "").toLowerCase();
  if (party) out = out.filter((r) => String(r.party_name || "").toLowerCase().includes(party));
  const accountId = Number(f.account_id || 0);
  if (accountId) out = out.filter((r) => Number(r.account_id) === accountId || Number(r.account_to_id) === accountId);
  const notes = String(f.notes || "").toLowerCase();
  if (notes) out = out.filter((r) => String(r.note || "").toLowerCase().includes(notes));
  const reference = String(f.reference || "").toLowerCase();
  if (reference) out = out.filter((r) => String(r.reference || "").toLowerCase().includes(reference));
  const description = String(f.description || "").toLowerCase();
  if (description) out = out.filter((r) => String(r.description || "").toLowerCase().includes(description));
  const createdBy = String(f.created_by || "").toLowerCase();
  if (createdBy) out = out.filter((r) => String(r.created_by || "").toLowerCase().includes(createdBy));
  const status = String(f.status || "active").toLowerCase();
  if (status === "active" || status === "voided") out = out.filter((r) => (r.status || "active") === status);
  const amin = f.amount_min;
  if (amin !== undefined && amin !== "" && amin !== null) out = out.filter((r) => Number(r.amount || 0) >= Number(amin));
  const amax = f.amount_max;
  if (amax !== undefined && amax !== "" && amax !== null) out = out.filter((r) => Number(r.amount || 0) <= Number(amax));
  const q = String(f.q || "").toLowerCase().trim();
  if (q) {
    out = out.filter((r) =>
      [r.entry_id, r.reference, r.description, r.note, r.party_name, r.category, r.subcategory, r.account_display]
        .map((x) => String(x || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }
  return out;
}

export function applyRunningBalance(rows: AnyRow[], opening: number, accountId?: number) {
  let running = Number(opening || 0);
  for (const row of rows) {
    if ((row.status || "active") === "voided") {
      row.running_balance = running;
      continue;
    }
    if (accountId) {
      if (row.type === CF_DIR_IN && Number(row.account_id) === accountId) running += Number(row.cash_in || 0);
      else if (row.type === CF_DIR_OUT && Number(row.account_id) === accountId) running -= Number(row.cash_out || 0);
      else if (row.type === CF_DIR_TRANSFER) {
        if (Number(row.account_to_id) === accountId) running += Number(row.transfer_amount || 0);
        if (Number(row.account_id) === accountId) running -= Number(row.transfer_amount || 0);
      }
    } else {
      running += Number(row.cash_in || 0) - Number(row.cash_out || 0);
    }
    row.running_balance = running;
  }
  return running;
}

export function summarizeCashFlow(rows: AnyRow[]) {
  const active = rows.filter((r) => (r.status || "active") === "active");
  const total_cash_in = active.reduce((a, r) => a + Number(r.cash_in || 0), 0);
  const total_cash_out = active.reduce((a, r) => a + Number(r.cash_out || 0), 0);
  const total_transfer_in = active.filter((r) => r.type === CF_DIR_TRANSFER).reduce((a, r) => a + Number(r.transfer_amount || 0), 0);
  const breakdown_cat: Record<string, { in: number; out: number; transfer: number }> = {};
  const breakdown_party: Record<string, { in: number; out: number; transfer: number }> = {};
  const breakdown_account: Record<string, { in: number; out: number; transfer: number }> = {};
  const bump = (map: Record<string, { in: number; out: number; transfer: number }>, key: string, r: AnyRow) => {
    const k = key.trim() || "—";
    if (!map[k]) map[k] = { in: 0, out: 0, transfer: 0 };
    map[k].in += Number(r.cash_in || 0);
    map[k].out += Number(r.cash_out || 0);
    map[k].transfer += Number(r.transfer_amount || 0);
  };
  for (const r of active) {
    bump(breakdown_cat, String(r.category || "—"), r);
    bump(breakdown_party, `${r.party_type || ""} · ${r.party_name || "—"}`.replace(/^ · /, ""), r);
    bump(breakdown_account, String(r.account_display || r.account_name || "—"), r);
  }
  return { total_cash_in, total_cash_out, total_transfer_in, breakdown_cat, breakdown_party, breakdown_account };
}

export function cashFlowOpening(fromDate: string) {
  const last = one<AnyRow>(
    `SELECT * FROM cash_flow_difference_adjustment
      WHERE date(adjustment_date) < date(?) AND physical_cash_available IS NOT NULL
      ORDER BY adjustment_date DESC, id DESC LIMIT 1`,
    [fromDate]
  );
  if (last) {
    const start = ymd(String(last.adjustment_date));
    const prev = new Date(`${fromDate}T00:00:00`);
    prev.setDate(prev.getDate() - 1);
    const prevStr = prev.toISOString().slice(0, 10);
    const startNext = new Date(`${start}T00:00:00`);
    startNext.setDate(startNext.getDate() + 1);
    const startStr = startNext.toISOString().slice(0, 10);
    const rows = collectCashFlowRows(startStr, prevStr, false);
    const net = rows.filter((r) => r.status === "active").reduce((a, r) => a + Number(r.cash_in || 0) - Number(r.cash_out || 0), 0);
    return money(Number(last.physical_cash_available || 0) + net);
  }
  const prev = new Date(`${fromDate}T00:00:00`);
  prev.setDate(prev.getDate() - 1);
  const rows = collectCashFlowRows("1970-01-01", prev.toISOString().slice(0, 10), false);
  return money(rows.filter((r) => r.status === "active").reduce((a, r) => a + Number(r.cash_in || 0) - Number(r.cash_out || 0), 0));
}

export function buildCashFlowPayload(query: AnyRow) {
  const today = pkDate();
  const fromDate = String(query.from_date || today);
  const toDate = String(query.to_date || today);
  const includeVoided = String(query.status || "active") !== "active";
  const override = todayOpeningOverride();
  const cutoff = fromDate === today ? freshStartCutoff() : null;
  let rows = collectCashFlowRows(fromDate, toDate, true, cutoff);
  rows = filterCashFlowRows(rows, query);
  if (!includeVoided && String(query.status || "active") === "active") {
    rows = rows.filter((r) => r.status === "active");
  }
  const opening = fromDate === today ? (override != null ? override : 0) : cashFlowOpening(fromDate);
  const closing = applyRunningBalance(rows, opening, Number(query.account_id || 0) || undefined);
  const sums = summarizeCashFlow(rows);
  const accounts = companyAccounts(true);
  const cashList = accounts.filter((a: AnyRow) => String(a.category) === "cash");
  const bankList = accounts.filter((a: AnyRow) => String(a.category) === "bank");
  const recon = one<AnyRow>(
    "SELECT * FROM cash_flow_difference_adjustment WHERE date(adjustment_date) = date(?) ORDER BY id DESC LIMIT 1",
    [toDate]
  );
  const accountActivity: Record<number, { in: number; out: number }> = {};
  for (const r of rows.filter((x) => x.status === "active")) {
    const id = Number(r.account_id || 0);
    if (!id) continue;
    if (!accountActivity[id]) accountActivity[id] = { in: 0, out: 0 };
    accountActivity[id].in += Number(r.cash_in || 0);
    accountActivity[id].out += Number(r.cash_out || 0);
  }
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(`${today}T00:00:00`);
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  const month = today.slice(0, 8) + "01";
  const last30 = new Date(`${today}T00:00:00`);
  last30.setDate(last30.getDate() - 29);
  return {
    from_date: fromDate,
    to_date: toDate,
    today_str: today,
    today_opening_override: override,
    is_fresh_start_view: fromDate === today,
    fresh_start_date: today,
    yesterday_str: yesterday.toISOString().slice(0, 10),
    this_week_str: week.toISOString().slice(0, 10),
    this_month_str: month,
    last_30_days_str: last30.toISOString().slice(0, 10),
    generated_at: pkNow(),
    default_movement_datetime: pkNow().slice(0, 16),
    rows,
    opening_balance: opening,
    closing_balance: closing,
    adjusted_closing_balance: recon?.physical_cash_available != null ? Number(recon.physical_cash_available) : closing,
    physical_cash_available: recon?.physical_cash_available ?? null,
    reconciliation_reason: recon?.reason || recon?.note || "",
    adjustment_date_input: toDate,
    show_delete_button: Boolean(recon),
    cash_accounts: accounts,
    cash_accounts_list: cashList,
    bank_accounts_list: bankList,
    cash_total: cashList.reduce((s, a) => s + Number(a.live_balance || 0), 0),
    bank_total: bankList.reduce((s, a) => s + Number(a.live_balance || 0), 0),
    account_activity: accountActivity,
    cf_categories: all("SELECT * FROM cash_flow_category ORDER BY name"),
    cf_subcategories: all(
      `SELECT s.*, c.name AS category_name FROM cash_flow_subcategory s
       LEFT JOIN cash_flow_category c ON c.id = s.category_id ORDER BY s.name`
    ),
    cf_parties: all("SELECT * FROM cash_flow_party WHERE is_active = 1 OR is_active IS NULL ORDER BY name"),
    cf_parties_all: all("SELECT * FROM cash_flow_party ORDER BY name"),
    party_types: CF_PARTY_TYPES,
    used_category_ids: all<{ category_id: number }>("SELECT DISTINCT category_id FROM cash_flow_entry WHERE category_id IS NOT NULL").map((r) => r.category_id),
    used_subcategory_ids: all<{ subcategory_id: number }>("SELECT DISTINCT subcategory_id FROM cash_flow_entry WHERE subcategory_id IS NOT NULL").map((r) => r.subcategory_id),
    used_party_ids: all<{ party_id: number }>("SELECT DISTINCT party_id FROM cash_flow_entry WHERE party_id IS NOT NULL").map((r) => r.party_id),
    created_by_options: [...new Set(rows.map((r) => String(r.created_by || "")).filter(Boolean))],
    source_options: [
      ["all", "All sources"],
      ["manual", "Manual (Cash Flow)"],
      ["system", "System / derived"],
      ["recorded", "Recorded on this page"],
      ["derived", "Derived from other modules"]
    ],
    ...sums
  };
}

export function cashFlowEntryDetail(id: number) {
  const e = one<AnyRow>("SELECT * FROM cash_flow_entry WHERE id = ?", [id]);
  if (!e) return null;
  const acc = one<AnyRow>("SELECT * FROM account WHERE id = ?", [e.account_id]);
  const dest = e.destination_account_id ? one<AnyRow>("SELECT * FROM account WHERE id = ?", [e.destination_account_id]) : null;
  const cat = e.category_id ? one<AnyRow>("SELECT * FROM cash_flow_category WHERE id = ?", [e.category_id]) : null;
  const sub = e.subcategory_id ? one<AnyRow>("SELECT * FROM cash_flow_subcategory WHERE id = ?", [e.subcategory_id]) : null;
  const audit = all("SELECT * FROM cash_flow_entry_audit WHERE entry_id = ? ORDER BY id DESC", [id]);
  return {
    ...e,
    account_name: acc?.name || "",
    destination_account_name: dest?.name || "",
    category_name: cat?.name || "",
    subcategory_name: sub?.name || "",
    audit
  };
}

