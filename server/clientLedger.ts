import { all, one, run, tx } from "./db.ts";
import { money, pkDate, pkNow, pkTime } from "./money.ts";
import { parseBillKind } from "./bills.ts";
import type { AnyRow } from "./services.ts";

function f(n: unknown) {
  return Number(n || 0);
}

function billRef(row: AnyRow, prefix: string) {
  return String(row.manual_bill_no || row.auto_bill_no || `${prefix}-${row.id}`);
}

function parseCancelAmount(note: unknown, qty: number) {
  const s = String(note || "");
  const amt = s.match(/amount=([0-9.]+)/);
  if (amt) return Number(amt[1]);
  const rate = s.match(/rate=([0-9.]+)/);
  if (rate) return Number(rate[1]) * qty;
  return 0;
}

function parseCancelRate(note: unknown) {
  const s = String(note || "");
  const rate = s.match(/rate=([0-9.]+)/);
  return rate ? Number(rate[1]) : null;
}

export function buildCancelPlan(client: AnyRow) {
  const name = String(client.name);
  const code = String(client.code);
  const delivered = all<AnyRow>(
    `SELECT * FROM entry WHERE is_void = 0 AND type = 'OUT'
     AND (client_code = ? OR LOWER(TRIM(client)) = LOWER(TRIM(?)))
     AND NOT (nimbus_no = 'Direct Sale' AND IFNULL(client_category,'') != 'Booking Delivery')`,
    [code, name]
  );
  const bookedReturns = all<AnyRow>(
    `SELECT * FROM entry WHERE is_void = 0 AND type = 'IN'
     AND (client_code = ? OR LOWER(TRIM(client)) = LOWER(TRIM(?)))
     AND nimbus_no = 'Material Return'
     AND (transaction_category = 'Booked Return' OR client_category = 'Booked Return')`,
    [code, name]
  );
  const consumed: Record<string, number> = {};
  for (const e of delivered) {
    const key = String(e.booked_material || e.material || "");
    consumed[key] = (consumed[key] || 0) + f(e.qty);
  }
  for (const e of bookedReturns) {
    const key = String(e.booked_material || e.material || "");
    consumed[key] = (consumed[key] || 0) - f(e.qty);
  }
  const items = all<AnyRow>(
    `SELECT bi.*, b.date_posted, b.manual_bill_no, b.auto_bill_no, b.id AS booking_id
     FROM booking_item bi JOIN booking b ON b.id = bi.booking_id
     WHERE b.is_void = 0 AND LOWER(TRIM(b.client_name)) = LOWER(TRIM(?))`,
    [name]
  );
  const byMat: Record<string, AnyRow[]> = {};
  for (const item of items) {
    const mat = String(item.material_name || "");
    (byMat[mat] ||= []).push(item);
  }
  const rows: AnyRow[] = [];
  let cancel_total = 0;
  let cancel_total_qty = 0;
  for (const [mat, list] of Object.entries(byMat)) {
    list.sort((a, b) => String(a.date_posted || "").localeCompare(String(b.date_posted || "")) || Number(a.id) - Number(b.id));
    let remainingDelivered = consumed[mat] || 0;
    const leftovers: { item: AnyRow; remaining: number }[] = [];
    for (const item of list) {
      const booked = f(item.qty);
      const used = remainingDelivered > 0 ? Math.min(booked, remainingDelivered) : 0;
      remainingDelivered = Math.max(0, remainingDelivered - used);
      const rem = booked - used;
      if (rem > 0) leftovers.push({ item, remaining: rem });
    }
    leftovers.reverse();
    for (const { item, remaining } of leftovers) {
      const rate = f(item.price_at_time);
      const amount = remaining * rate;
      cancel_total += amount;
      cancel_total_qty += remaining;
      rows.push({
        item_id: item.id,
        booking_id: item.booking_id,
        material: mat,
        bill_no: item.manual_bill_no || item.auto_bill_no || `BK-${item.booking_id}`,
        booking_date: String(item.date_posted || "").slice(0, 10),
        qty_remaining: remaining,
        remaining_qty: remaining,
        rate,
        amount
      });
    }
  }
  rows.sort((a, b) => String(a.material).localeCompare(String(b.material)) || String(a.booking_date).localeCompare(String(b.booking_date)));
  return { rows, cancel_total: money(cancel_total), cancel_total_qty };
}

export function buildClientLedger(client: AnyRow) {
  const name = String(client.name);
  const code = String(client.code);
  const pending_bills = all<AnyRow>(
    `SELECT * FROM pending_bill WHERE client_code = ? AND IFNULL(is_void,0) = 0 ORDER BY id DESC`,
    [code]
  ).map((pb) => ({ ...pb, reason: pb.reason || "" }));

  const bookings = all<AnyRow>(
    `SELECT * FROM booking WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(?))`,
    [name]
  );
  const payments = all<AnyRow>(
    `SELECT * FROM payment WHERE client_id = ? OR (client_id IS NULL AND LOWER(TRIM(client_name)) = LOWER(TRIM(?)))`,
    [client.id, name]
  );
  const direct_sales = all<AnyRow>(
    `SELECT * FROM direct_sale WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(?))`,
    [name]
  );
  const waive_rows = all<AnyRow>(
    `SELECT * FROM waive_off WHERE LOWER(TRIM(client_name)) = LOWER(TRIM(?)) AND IFNULL(is_void,0)=0
     AND LOWER(IFNULL(note,'')) NOT LIKE '[direct_sale_discount:%' ORDER BY date_posted, id`,
    [name]
  );

  const cancelEntries = all<AnyRow>(
    `SELECT * FROM entry WHERE IFNULL(is_void,0)=0 AND type = 'CANCEL'
     AND (client_code = ? OR LOWER(TRIM(client)) = LOWER(TRIM(?)))
     ORDER BY date, time, id`,
    [code, name]
  );
  const cancel_amount_by_bill: Record<string, number> = {};
  for (const ce of cancelEntries) {
    const bill = String(ce.bill_no || ce.auto_bill_no || "");
    const qty = f(ce.qty);
    const amount = parseCancelAmount(ce.note, qty);
    if (bill && amount > 0) cancel_amount_by_bill[bill] = (cancel_amount_by_bill[bill] || 0) + amount;
  }

  const financial_history: AnyRow[] = [];
  const booking_bill_refs = new Set<string>();

  for (const b of bookings) {
    if (b.is_void) continue;
    const booking_bill_ref = billRef(b, "BK");
    if (b.manual_bill_no) booking_bill_refs.add(String(b.manual_bill_no));
    if (b.auto_bill_no) booking_bill_refs.add(String(b.auto_bill_no));
    booking_bill_refs.add(`BK-${b.id}`);
    const debit = f(b.amount);
    const credit = f(b.paid_amount);
    const discount = f(b.discount);
    financial_history.push({
      date: b.date_posted,
      date_display: String(b.date_posted || ""),
      description: "Booking",
      bill_no: booking_bill_ref,
      debit,
      credit,
      type: "Booking",
      id: b.id
    });
    if (discount > 0) {
      const reason = String(b.discount_reason || "").trim();
      financial_history.push({
        date: b.date_posted,
        date_display: String(b.date_posted || ""),
        description: reason ? `DISCOUNT WAIVE OFF (${reason})` : "DISCOUNT WAIVE OFF",
        bill_no: booking_bill_ref,
        debit: 0,
        credit: discount,
        type: null,
        id: null
      });
    }
  }

  const waive_by_payment: Record<number, AnyRow[]> = {};
  const standalone_waive: AnyRow[] = [];
  for (const w of waive_rows) {
    if (w.payment_id) (waive_by_payment[Number(w.payment_id)] ||= []).push(w);
    else standalone_waive.push(w);
  }

  const payment_map: Record<string, AnyRow> = {};
  for (const p of payments) {
    if (p.is_void) continue;
    payment_map[`Payment${p.id}`] = p;
    const amt = f(p.amount);
    const method = String(p.method || "Cash");
    const details: string[] = [];
    if (p.bank_name) details.push(`Bank: ${p.bank_name}`);
    if (p.account_name) details.push(`A/C Name: ${p.account_name}`);
    if (p.account_no) details.push(`A/C No: ${p.account_no}`);
    const suffix = details.length ? ` - ${details.join(" | ")}` : "";
    const debit = amt < 0 ? Math.abs(amt) : 0;
    const credit = amt >= 0 ? amt : 0;
    financial_history.push({
      date: p.date_posted,
      date_display: String(p.date_posted || ""),
      description: `${amt >= 0 ? "Payment" : "Repayment"} (${method})${suffix}`,
      bill_no: billRef(p, "PAY"),
      debit,
      credit,
      type: "Payment",
      id: p.id
    });
    const linked = waive_by_payment[Number(p.id)] || [];
    if (linked.length) {
      for (const w of linked) {
        const r = String(w.reason || "").trim();
        financial_history.push({
          date: w.date_posted || p.date_posted,
          date_display: String(w.date_posted || p.date_posted || ""),
          description: r ? `Waive-Off (Loss) (${r})` : "Waive-Off (Loss)",
          bill_no: w.bill_no || billRef(p, "PAY"),
          debit: 0,
          credit: f(w.amount),
          type: null,
          id: null
        });
      }
    } else if (f(p.discount) > 0) {
      const r = String(p.discount_reason || "").trim();
      financial_history.push({
        date: p.date_posted,
        date_display: String(p.date_posted || ""),
        description: r ? `Waive-Off (Loss) (${r})` : "Waive-Off (Loss)",
        bill_no: billRef(p, "PAY"),
        debit: 0,
        credit: f(p.discount),
        type: null,
        id: null
      });
    }
  }

  for (const w of standalone_waive) {
    const r = String(w.reason || "").trim();
    financial_history.push({
      date: w.date_posted,
      date_display: String(w.date_posted || ""),
      description: r ? `Waive-Off (Loss) (${r})` : "Waive-Off (Loss)",
      bill_no: w.bill_no || "",
      debit: 0,
      credit: f(w.amount),
      type: null,
      id: null
    });
  }

  const sale_map: Record<string, AnyRow> = {};
  for (const s of direct_sales) {
    if (s.is_void) continue;
    sale_map[`DirectSale${s.id}`] = s;
    const sale_bill_ref = billRef(s, "DS");
    const debit = f(s.amount);
    const credit = f(s.paid_amount);
    const discount = f(s.discount);
    if (debit > 0 || credit > 0) {
      financial_history.push({
        date: s.date_posted,
        date_display: String(s.date_posted || ""),
        description: "Direct Sale",
        bill_no: sale_bill_ref,
        debit,
        credit,
        type: "DirectSale",
        id: s.id
      });
    }
    if (discount > 0) {
      const r = String(s.discount_reason || "").trim();
      financial_history.push({
        date: s.date_posted,
        date_display: String(s.date_posted || ""),
        description: r ? `DISCOUNT WAIVE OFF (Direct Sale) (${r})` : "DISCOUNT WAIVE OFF (Direct Sale)",
        bill_no: sale_bill_ref,
        debit: 0,
        credit: discount,
        type: null,
        id: null
      });
    }
    if (f(s.rent_variance_loss) > 0) {
      financial_history.push({
        date: s.date_posted,
        date_display: String(s.date_posted || ""),
        description: `Delivery Rent Variance (Company Loss) Rs.${f(s.rent_variance_loss).toFixed(2)}`,
        bill_no: sale_bill_ref,
        debit: 0,
        credit: 0,
        type: null,
        id: null
      });
    }
  }

  for (const ce of cancelEntries) {
    const qty = f(ce.qty);
    const amount = parseCancelAmount(ce.note, qty);
    financial_history.push({
      date: `${ce.date || ""} ${ce.time || ""}`.trim(),
      date_display: `${ce.date || ""} ${ce.time || ""}`.trim(),
      description: `Booking Cancel (${ce.material || ce.booked_material || "-"} x ${qty.toFixed(3)})`,
      bill_no: ce.bill_no || "",
      debit: 0,
      credit: amount,
      type: "Entry",
      id: ce.id,
      is_cancel_entry: true,
      cancel_amount: amount
    });
  }

  const opening = f(client.opening_balance);
  if (opening !== 0) {
    financial_history.push({
      date: client.opening_balance_date || client.created_at,
      date_display: String(client.opening_balance_date || client.created_at || ""),
      description: "Opening Balance",
      bill_no: "OPENING",
      debit: opening > 0 ? opening : 0,
      credit: opening < 0 ? Math.abs(opening) : 0,
      type: null,
      id: null
    });
  }

  const openingRows = financial_history.filter((r) => r.bill_no === "OPENING");
  const otherRows = financial_history
    .filter((r) => r.bill_no !== "OPENING")
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const ordered = [...openingRows, ...otherRows];
  let running = 0;
  for (const item of ordered) {
    item.debit = money(item.debit);
    item.credit = money(item.credit);
    running = money(running + Number(item.debit) - Number(item.credit));
    item.balance = running;
  }

  const deliveries = all<AnyRow>(
    `SELECT * FROM entry WHERE IFNULL(is_void,0)=0
     AND (client_code = ? OR LOWER(TRIM(client)) = LOWER(TRIM(?)))
     AND (
       type IN ('OUT','CANCEL')
       OR (type = 'IN' AND nimbus_no = 'Material Return' AND (client_category = 'Booked Return' OR transaction_category = 'Booked Return'))
     )
     ORDER BY date, time, id`,
    [code, name]
  );

  const material_history: AnyRow[] = [];
  const seen = new Set<string>();

  for (const b of bookings) {
    if (b.is_void) continue;
    const items = all<AnyRow>(`SELECT * FROM booking_item WHERE booking_id = ?`, [b.id]);
    for (const item of items) {
      material_history.push({
        date: String(b.date_posted || "").slice(0, 10),
        date_sort: String(b.date_posted || ""),
        material: item.material_name,
        material_group: item.material_name,
        material_display: item.material_name,
        qty_added: f(item.qty),
        qty_dispatched: 0,
        bill_no: billRef(b, "BK"),
        nimbus_no: "Booking",
        type: "Booking",
        source_type: "Booking",
        source_id: b.id
      });
    }
  }

  for (const d of deliveries) {
    const bill_ref = String(d.bill_no || d.auto_bill_no || "");
    const mat = String(d.material || d.booked_material || "");
    if (!mat) continue;
    if (d.type === "IN") {
      material_history.push({
        date: d.date,
        date_sort: `${d.date || ""} ${d.time || ""}`,
        material: mat,
        material_group: mat,
        material_display: mat,
        qty_added: f(d.qty),
        qty_dispatched: 0,
        bill_no: bill_ref,
        nimbus_no: d.nimbus_no || "Material Return",
        type: "Return",
        source_type: "Entry",
        source_id: d.id
      });
      continue;
    }
    if (d.type === "CANCEL") {
      material_history.push({
        date: d.date,
        date_sort: `${d.date || ""} ${d.time || ""}`,
        material: mat,
        material_group: mat,
        material_display: mat,
        qty_added: 0,
        qty_dispatched: f(d.qty),
        bill_no: bill_ref,
        nimbus_no: d.nimbus_no || "Booking Cancel",
        type: "Cancel",
        source_type: "Entry",
        source_id: d.id
      });
      continue;
    }
    const isBooking = d.client_category === "Booking Delivery" || booking_bill_refs.has(bill_ref);
    if (!isBooking) continue;
    const group = String(d.booked_material || d.material);
    let display = group;
    if (d.booked_material && d.material && d.booked_material !== d.material) {
      display = `${d.booked_material}>ALT>${d.material}`;
    }
    material_history.push({
      date: d.date,
      date_sort: `${d.date || ""} ${d.time || ""}`,
      material: group,
      material_group: group,
      material_display: display,
      qty_added: 0,
      qty_dispatched: f(d.qty),
      bill_no: bill_ref,
      nimbus_no: d.nimbus_no,
      type: "Dispatch",
      source_type: "Entry",
      source_id: d.id
    });
    if (bill_ref) seen.add(bill_ref);
  }

  material_history.sort((a, b) => String(a.date_sort || "").localeCompare(String(b.date_sort || "")));
  const matBalances: Record<string, number> = {};
  for (const item of material_history) {
    const mat = String(item.material_group || item.material);
    if (item.type !== "Cancel") {
      matBalances[mat] = (matBalances[mat] || 0) + f(item.qty_added) - f(item.qty_dispatched);
    }
    item.balance = matBalances[mat] || 0;
  }
  const material_history_grouped: Record<string, AnyRow[]> = {};
  for (const item of material_history) {
    const mat = String(item.material_group || item.material || "Unknown");
    (material_history_grouped[mat] ||= []).push(item);
  }

  const total_debit = money(ordered.reduce((a, i) => a + f(i.debit), 0));
  const total_credit = money(ordered.reduce((a, i) => a + f(i.credit), 0));
  const total_balance = money(total_debit - total_credit);

  const plan = buildCancelPlan(client);
  const cancel_new_balance = money(total_balance - plan.cancel_total);

  const booking_map: Record<string, AnyRow> = {};
  for (const b of bookings) if (!b.is_void) booking_map[`Booking${b.id}`] = b;

  return {
    client,
    pending_bills,
    financial_history: ordered,
    material_history,
    material_history_grouped,
    unresolved_dispatches: [] as AnyRow[],
    total_debit,
    total_credit,
    total_balance,
    balance: total_balance,
    cancel_rows: plan.rows,
    cancel_total: plan.cancel_total,
    cancel_total_qty: plan.cancel_total_qty,
    cancel_new_balance,
    cancel_client_due: Math.max(0, cancel_new_balance),
    cancel_company_due: Math.max(0, -cancel_new_balance),
    transactions_map: { ...booking_map, ...payment_map, ...sale_map }
  };
}

export function applyBookingCancel(client: AnyRow, selectedIds: number[], actor: string) {
  const plan = buildCancelPlan(client);
  let rows = plan.rows;
  if (selectedIds.length) rows = rows.filter((r) => selectedIds.includes(Number(r.item_id)));
  if (!rows.length) throw new Error("Select at least one material row to cancel.");

  tx(() => {
    const touched = new Set<number>();
    for (const row of rows) {
      const item = one<AnyRow>("SELECT * FROM booking_item WHERE id = ?", [row.item_id]);
      if (!item) continue;
      const remaining = f(row.remaining_qty);
      const rate = f(item.price_at_time);
      const amount = remaining * rate;
      const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [item.booking_id]);
      const bill = booking ? billRef(booking, "BK") : "";
      run(
        `INSERT INTO entry (date, time, type, material, client, client_code, qty, bill_no, nimbus_no, created_by, created_at, is_void, client_category, transaction_category, note)
         VALUES (?, ?, 'CANCEL', ?, ?, ?, ?, ?, 'Booking Cancel', ?, ?, 0, 'Booking Delivery', 'Cancel', ?)`,
        [
          pkDate(),
          pkTime(),
          item.material_name,
          client.name,
          client.code,
          remaining,
          bill,
          actor,
          pkNow(),
          `Booking cancellation|rate=${rate.toFixed(6)}|amount=${amount.toFixed(6)}`
        ]
      );
      const newQty = f(item.qty) - remaining;
      if (newQty <= 0) {
        run("DELETE FROM booking_item WHERE id = ?", [item.id]);
      } else {
        run("UPDATE booking_item SET qty = ? WHERE id = ?", [newQty, item.id]);
      }
      if (booking) touched.add(Number(booking.id));
    }
    for (const bid of touched) {
      const items = all<AnyRow>("SELECT * FROM booking_item WHERE booking_id = ?", [bid]);
      const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [bid]);
      if (!booking) continue;
      const newAmount = items.reduce((a, i) => a + f(i.qty) * f(i.price_at_time), 0);
      run("UPDATE booking SET amount = ? WHERE id = ?", [newAmount, bid]);
      const bill = billRef(booking, "BK");
      const pending = Math.max(0, newAmount - f(booking.discount) - f(booking.paid_amount));
      const pb = one<AnyRow>("SELECT * FROM pending_bill WHERE bill_no = ? AND client_code = ?", [bill, client.code]);
      if (pending <= 0) {
        if (pb) run("DELETE FROM pending_bill WHERE id = ?", [pb.id]);
      } else if (pb) {
        run("UPDATE pending_bill SET amount = ?, client_name = ? WHERE id = ?", [pending, booking.client_name, pb.id]);
      } else {
        run(
          `INSERT INTO pending_bill (client_code, client_name, bill_no, bill_kind, amount, reason, is_manual, created_at, created_by, is_void)
           VALUES (?, ?, ?, ?, ?, 'Booking (Adjusted)', ?, ?, ?, 0)`,
          [client.code, booking.client_name, bill, parseBillKind(bill), pending, booking.manual_bill_no ? 1 : 0, pkNow(), actor]
        );
      }
    }
  });
  return { ok: true, cancelled: rows.length };
}

export function revertCancel(client: AnyRow, entryId: number, actor: string) {
  const entry = one<AnyRow>("SELECT * FROM entry WHERE id = ?", [entryId]);
  if (!entry) throw new Error("Cancellation entry not found");
  if (entry.is_void) throw new Error("This cancellation is already reverted.");
  if (String(entry.type).toUpperCase() !== "CANCEL") throw new Error("Selected row is not a booking cancellation entry.");
  const bill = String(entry.bill_no || entry.auto_bill_no || "");
  if (!bill) throw new Error("Cannot revert: cancellation row has no bill reference.");
  const booking = one<AnyRow>(
    `SELECT * FROM booking WHERE is_void = 0 AND LOWER(TRIM(client_name)) = LOWER(TRIM(?))
     AND (manual_bill_no = ? OR auto_bill_no = ?) ORDER BY id DESC`,
    [client.name, bill, bill]
  );
  if (!booking) throw new Error("Cannot revert: original booking for this bill was not found.");
  const material = String(entry.material || entry.booked_material || "");
  const qty = f(entry.qty);
  if (!material || qty <= 0) throw new Error("Cannot revert: invalid material/qty.");
  let rate = parseCancelRate(entry.note);
  if (rate == null) {
    const existing = one<AnyRow>("SELECT * FROM booking_item WHERE booking_id = ? AND material_name = ?", [booking.id, material]);
    rate = existing ? f(existing.price_at_time) : 0;
  }
  tx(() => {
    const item = one<AnyRow>("SELECT * FROM booking_item WHERE booking_id = ? AND material_name = ?", [booking.id, material]);
    if (item) {
      run("UPDATE booking_item SET qty = ?, price_at_time = CASE WHEN IFNULL(price_at_time,0) <= 0 THEN ? ELSE price_at_time END WHERE id = ?", [
        f(item.qty) + qty,
        rate,
        item.id
      ]);
    } else {
      run("INSERT INTO booking_item (booking_id, material_name, qty, price_at_time) VALUES (?, ?, ?, ?)", [
        booking.id,
        material,
        qty,
        rate
      ]);
    }
    const items = all<AnyRow>("SELECT * FROM booking_item WHERE booking_id = ?", [booking.id]);
    const newAmount = items.reduce((a, i) => a + f(i.qty) * f(i.price_at_time), 0);
    run("UPDATE booking SET amount = ? WHERE id = ?", [newAmount, booking.id]);
    run("UPDATE entry SET is_void = 1 WHERE id = ?", [entry.id]);
    void actor;
  });
  return { ok: true };
}
