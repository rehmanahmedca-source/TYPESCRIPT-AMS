import { all, one, run, tx } from "./db.ts";
import { money, pkNow } from "./money.ts";
import { nextAutoBill, normalizeManualBill } from "./bills.ts";
import { db } from "./db.ts";
import { getClient, postAccountTx, type AnyRow } from "./services.ts";

export interface BookingItemPayload {
  id?: number;
  material_name: string;
  qty: number;
  price_at_time: number;
}

export function peekNextBookingBill(): string {
  const row = db.prepare("SELECT count FROM bill_counter WHERE namespace = 'BK'").get() as
    | { count: number }
    | undefined;
  const next = row ? Number(row.count || 1000) + 1 : 1001;
  return `SB-BK-${next}`;
}

export function findBookingConflict(manualBillNo: string, excludeBookingId?: number): [string, number] | null {
  if (!manualBillNo) return null;
  const norm = normalizeManualBill(manualBillNo);
  if (!norm) return null;
  const variants = [manualBillNo.trim(), norm];

  // Check DirectSale
  for (const v of variants) {
    const ds = one<AnyRow>(
      "SELECT id, manual_bill_no, auto_bill_no FROM direct_sale WHERE is_void = 0 AND (manual_bill_no = ? OR auto_bill_no = ?)",
      [v, v]
    );
    if (ds) return ["DirectSale", Number(ds.id)];
  }

  // Check Booking
  for (const v of variants) {
    let sql = "SELECT id, manual_bill_no, auto_bill_no FROM booking WHERE is_void = 0 AND (manual_bill_no = ? OR auto_bill_no = ?)";
    const params: (string | number)[] = [v, v];
    if (excludeBookingId) {
      sql += " AND id != ?";
      params.push(excludeBookingId);
    }
    const bk = one<AnyRow>(sql, params);
    if (bk) return ["Booking", Number(bk.id)];
  }

  // Check Payment
  for (const v of variants) {
    const pay = one<AnyRow>(
      "SELECT id, manual_bill_no, auto_bill_no FROM payment WHERE is_void = 0 AND (manual_bill_no = ? OR auto_bill_no = ?)",
      [v, v]
    );
    if (pay) return ["Payment", Number(pay.id)];
  }

  return null;
}

export function syncBookingPendingBill(
  bookingId: number,
  primaryMaterial = "",
  extraVoidRefs: string[] = []
) {
  const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [bookingId]);
  if (!booking) return null;

  const client = getClient(booking.client_name);
  const clientCode = client ? client.code : null;
  const clientName = client ? client.name : booking.client_name;

  const billRef = booking.manual_bill_no || booking.auto_bill_no || `BK-${booking.id}`;
  const pendingAmount = Math.max(
    0,
    Number(booking.amount || 0) - Number(booking.discount || 0) - Number(booking.paid_amount || 0)
  );

  // Find existing pending bills for this booking
  const staleRows = all<AnyRow>(
    "SELECT * FROM pending_bills WHERE source_table = 'booking' AND source_id = ?",
    [booking.id]
  );

  let reusable: AnyRow | null = null;
  for (const pb of staleRows) {
    const sameCurrent =
      !pb.is_void &&
      String(pb.bill_no || "").trim() === billRef &&
      pendingAmount > 0 &&
      !booking.is_void;

    if (sameCurrent && !reusable) {
      reusable = pb;
      continue;
    }
    run(
      "UPDATE pending_bills SET is_void = 1, source_kind = 'Booking', source_bill_ref = ?, source_category = 'Booking' WHERE id = ?",
      [billRef, pb.id]
    );
  }

  if (booking.is_void) return null;
  if (pendingAmount <= 0 || !clientCode) return null;

  let reason = `Booking: ${primaryMaterial}`.trim();
  if (reason.endsWith(":")) reason = reason.slice(0, -1).trim();

  const isManual = booking.manual_bill_no ? 1 : 0;
  const billKind = isManual ? "MB" : "SB";

  if (reusable) {
    run(
      `UPDATE pending_bills SET
        client_code = ?, client_name = ?, bill_no = ?, amount = ?, reason = ?,
        is_manual = ?, bill_kind = ?, note = ?, is_paid = 0, is_void = 0,
        source_table = 'booking', source_id = ?, source_kind = 'Booking',
        source_bill_ref = ?, source_category = 'Booking'
       WHERE id = ?`,
      [
        clientCode,
        clientName,
        billRef,
        pendingAmount,
        reason,
        isManual,
        billKind,
        booking.note || null,
        booking.id,
        billRef,
        reusable.id
      ]
    );
    return reusable.id;
  } else {
    const datePosted = booking.date_posted || pkNow();
    const info = run(
      `INSERT INTO pending_bills (
        client_code, client_name, bill_no, amount, reason, is_manual, bill_kind,
        note, is_paid, is_void, source_table, source_id, source_kind,
        source_bill_ref, source_category, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'booking', ?, 'Booking', ?, 'Booking', ?, 'Admin')`,
      [
        clientCode,
        clientName,
        billRef,
        pendingAmount,
        reason,
        isManual,
        billKind,
        booking.note || null,
        booking.id,
        billRef,
        datePosted
      ]
    );
    return Number(info.lastInsertRowid);
  }
}

export function syncBookingPaidIntoAccount(
  booking: AnyRow,
  opts: {
    paymentAccountId?: number | null;
    method?: string;
    requireAccount?: boolean;
  }
) {
  const paid = Number(booking.paid_amount || 0);
  const method = (opts.method || "Cash").trim() || "Cash";
  const accId = opts.paymentAccountId ? Number(opts.paymentAccountId) : null;
  const acc = accId ? one<AnyRow>("SELECT * FROM account WHERE id = ?", [accId]) : null;

  if (paid > 0) {
    if (!acc) {
      if (opts.requireAccount) {
        throw new Error("Select the cash/bank account that should receive Paid Now.");
      }
      return null;
    }
    run("UPDATE booking SET receive_in_account_id = ? WHERE id = ?", [acc.id, booking.id]);
  } else {
    run("UPDATE booking SET receive_in_account_id = NULL WHERE id = ?", [booking.id]);
  }

  const bill = booking.manual_bill_no || booking.auto_bill_no || `BK-${booking.id}`;
  const marker = `[SRC:Booking:${booking.id}]`;
  const noteParts = [(booking.note || "").trim(), `Method: ${method}`, marker].filter(Boolean);
  const fullNote = noteParts.join(" ");

  // Find existing account transaction
  const existingTx = one<AnyRow>(
    "SELECT * FROM account_transaction WHERE note LIKE ? LIMIT 1",
    [`%${marker}%`]
  );

  const isVoid = Boolean(booking.is_void) || paid <= 0;
  if (existingTx) {
    if (isVoid || !acc || paid <= 0) {
      run("UPDATE account_transaction SET is_void = 1 WHERE id = ?", [existingTx.id]);
    } else {
      run(
        `UPDATE account_transaction SET
          to_account_id = ?, amount = ?, description = ?, note = ?, date_posted = ?, is_void = 0
         WHERE id = ?`,
        [
          acc.id,
          paid,
          `Booking paid now from ${booking.client_name || "Client"} (${bill})`,
          fullNote,
          booking.date_posted || pkNow(),
          existingTx.id
        ]
      );
    }
  } else if (acc && paid > 0 && !booking.is_void) {
    postAccountTx({
      toId: acc.id,
      amount: paid,
      description: `Booking paid now from ${booking.client_name || "Client"} (${bill})`,
      type: "Receipt",
      sourceType: "booking",
      sourceId: Number(booking.id),
      note: fullNote
    });
  }

  return acc;
}

export function getBookings(query: {
  show?: string;
  client?: string;
  bill_no?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}) {
  const showMode = (query.show || "active").toLowerCase();
  const page = Math.max(1, Number(query.page || 1));
  const perPage = Math.min(50, Math.max(10, Number(query.per_page || 10)));
  const offset = (page - 1) * perPage;

  let whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (showMode === "voided") {
    whereClauses.push("b.is_void = 1");
  } else if (showMode === "all") {
    // no void filter
  } else {
    whereClauses.push("b.is_void = 0");
  }

  if (query.client?.trim()) {
    const term = `%${query.client.trim()}%`;
    whereClauses.push("(b.client_name LIKE ?)");
    params.push(term);
  }

  if (query.bill_no?.trim()) {
    const term = `%${query.bill_no.trim()}%`;
    whereClauses.push("(b.manual_bill_no LIKE ? OR b.auto_bill_no LIKE ?)");
    params.push(term, term);
  }

  if (query.date_from?.trim()) {
    whereClauses.push("DATE(b.date_posted) >= ?");
    params.push(query.date_from.trim());
  }

  if (query.date_to?.trim()) {
    whereClauses.push("DATE(b.date_posted) <= ?");
    params.push(query.date_to.trim());
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const totalCount =
    one<{ c: number }>(`SELECT COUNT(*) as c FROM booking b ${whereSql}`, params)?.c || 0;
  const totalPages = Math.ceil(totalCount / perPage) || 1;

  const rows = all<AnyRow>(
    `SELECT b.* FROM booking b ${whereSql} ORDER BY b.date_posted DESC, b.id DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );

  const bookings = rows.map((b) => {
    const items = all<AnyRow>(
      "SELECT * FROM booking_item WHERE booking_id = ? ORDER BY id ASC",
      [b.id]
    );
    const remaining = Math.max(0, Number(b.amount || 0) - Number(b.discount || 0) - Number(b.paid_amount || 0));
    return {
      ...b,
      items,
      remaining: money(remaining)
    };
  });

  const clients = all<AnyRow>("SELECT id, code, name FROM client WHERE is_active = 1 ORDER BY name ASC");
  const materials = all<AnyRow>(
    "SELECT id, name, unit_price, unit FROM material WHERE is_active = 1 ORDER BY name ASC"
  );
  const accounts = all<AnyRow>(
    "SELECT id, name, bank_name, category FROM account WHERE IFNULL(is_active, 1) = 1 ORDER BY name ASC"
  );
  const next_auto = peekNextBookingBill();

  return {
    bookings,
    clients,
    materials,
    accounts,
    next_auto,
    show_mode: showMode,
    client_filter: query.client || "",
    bill_filter: query.bill_no || "",
    date_from: query.date_from || "",
    date_to: query.date_to || "",
    pagination: {
      page,
      per_page: perPage,
      total: totalCount,
      pages: totalPages,
      has_prev: page > 1,
      has_next: page < totalPages,
      prev_num: page - 1,
      next_num: page + 1
    }
  };
}

export function getBookingDetail(id: number) {
  const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [id]);
  if (!booking) return null;
  const items = all<AnyRow>(
    "SELECT * FROM booking_item WHERE booking_id = ? ORDER BY id ASC",
    [id]
  );
  const clients = all<AnyRow>("SELECT id, code, name FROM client WHERE is_active = 1 ORDER BY name ASC");
  const materials = all<AnyRow>(
    "SELECT id, name, unit_price, unit FROM material WHERE is_active = 1 ORDER BY name ASC"
  );
  const accounts = all<AnyRow>(
    "SELECT id, name, bank_name, category FROM account WHERE IFNULL(is_active, 1) = 1 ORDER BY name ASC"
  );
  return {
    booking: {
      ...booking,
      items
    },
    clients,
    materials,
    accounts
  };
}

export function createBooking(body: AnyRow, user = "Admin") {
  const clientInput = String(body.client_code || body.client_name || "").trim();
  const client = getClient(clientInput);
  if (!client) {
    throw new Error(`Client "${clientInput}" not found. Please add client first.`);
  }

  const manualBillRaw = String(body.manual_bill_no || "").trim();
  const manualBillNo = manualBillRaw ? normalizeManualBill(manualBillRaw) : null;
  if (manualBillNo) {
    const conflict = findBookingConflict(manualBillNo);
    if (conflict) {
      throw new Error(`Manual bill '${manualBillNo}' already exists in ${conflict[0]} #${conflict[1]}.`);
    }
  }

  const itemsRaw: { material_name?: string; name?: string; qty?: number; unit_rate?: number; rate?: number; price_at_time?: number; id?: number }[] =
    Array.isArray(body.items) ? body.items : [];

  if (!itemsRaw.length && body.material_name) {
    itemsRaw.push({
      material_name: String(body.material_name),
      qty: Number(body.qty || 1),
      unit_rate: Number(body.unit_rate || body.rate || 0)
    });
  }

  const validItems = itemsRaw
    .map((it) => ({
      name: String(it.material_name || it.name || "").trim(),
      qty: Number(it.qty || 0),
      rate: Number(it.unit_rate || it.rate || it.price_at_time || 0)
    }))
    .filter((it) => it.name && it.qty > 0);

  if (!validItems.length) {
    throw new Error("At least one booking material item is required.");
  }

  for (const it of validItems) {
    if (it.qty > 0 && it.rate <= 0) {
      throw new Error(`Unit rate is required and must be greater than 0 for "${it.name}".`);
    }
  }

  const calculatedAmount = validItems.reduce((acc, it) => acc + money(it.qty * it.rate), 0);
  const amount = money(body.amount != null ? Number(body.amount) : calculatedAmount);
  const paidAmount = money(Number(body.paid_amount || 0));
  const discount = money(Number(body.discount || 0));
  const discountReason = String(body.discount_reason || "").trim();
  const note = String(body.note || "").trim();
  const photoPath = body.photo_path ? String(body.photo_path).trim() : null;
  const photoUrl = body.photo_url ? String(body.photo_url).trim() : null;
  const datePosted = body.date || body.date_posted || pkNow();

  return tx(() => {
    const autoBillNo = nextAutoBill(db, "BK");

    const info = run(
      `INSERT INTO booking (
        client_name, amount, paid_amount, discount, discount_reason,
        manual_bill_no, auto_bill_no, photo_path, photo_url,
        date_posted, is_void, note, receive_in_account_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
      [
        client.name,
        amount,
        paidAmount,
        discount,
        discountReason,
        manualBillNo,
        autoBillNo,
        photoPath,
        photoUrl,
        datePosted,
        note
      ]
    );

    const bookingId = Number(info.lastInsertRowid);

    for (const it of validItems) {
      run(
        "INSERT INTO booking_item (booking_id, material_name, qty, price_at_time) VALUES (?, ?, ?, ?)",
        [bookingId, it.name, it.qty, it.rate]
      );
    }

    const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [bookingId])!;
    syncBookingPendingBill(bookingId, validItems[0].name);

    if (paidAmount > 0) {
      const paymentAccountId = body.payment_account_id || body.receive_in_account_id;
      syncBookingPaidIntoAccount(booking, {
        paymentAccountId,
        method: body.payment_method || body.method || "Cash",
        requireAccount: true
      });
    }

    return {
      id: bookingId,
      auto_bill_no: autoBillNo,
      manual_bill_no: manualBillNo,
      client_name: client.name,
      amount,
      paid_amount: paidAmount
    };
  });
}

export function updateBooking(bookingId: number, body: AnyRow, user = "Admin") {
  const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [bookingId]);
  if (!booking) throw new Error("Booking not found");

  const oldBillNo = booking.manual_bill_no;
  const oldPaid = Number(booking.paid_amount || 0);

  const clientInput = String(body.client_code || body.client_name || "").trim();
  const client = clientInput ? getClient(clientInput) : getClient(booking.client_name);
  const clientName = client ? client.name : booking.client_name;

  const manualBillRaw = String(body.manual_bill_no ?? booking.manual_bill_no ?? "").trim();
  const manualBillNo = manualBillRaw ? normalizeManualBill(manualBillRaw) : null;
  if (manualBillNo) {
    const conflict = findBookingConflict(manualBillNo, bookingId);
    if (conflict) {
      throw new Error(`Manual bill '${manualBillNo}' already exists in ${conflict[0]} #${conflict[1]}.`);
    }
  }

  const itemsRaw: { id?: number; booking_item_id?: number; material_name?: string; name?: string; qty?: number; unit_rate?: number; rate?: number; price_at_time?: number }[] =
    Array.isArray(body.items) ? body.items : [];

  const validItems = itemsRaw
    .map((it) => ({
      keepId: it.id || it.booking_item_id || undefined,
      name: String(it.material_name || it.name || "").trim(),
      qty: Number(it.qty || 0),
      rate: Number(it.unit_rate || it.rate || it.price_at_time || 0)
    }))
    .filter((it) => it.name && it.qty > 0);

  if (!validItems.length) {
    throw new Error("At least one booking item is required.");
  }

  for (const it of validItems) {
    if (it.qty > 0 && it.rate <= 0) {
      throw new Error(`Unit rate is required and must be greater than 0 for "${it.name}".`);
    }
  }

  const existingItems = all<AnyRow>(
    "SELECT * FROM booking_item WHERE booking_id = ? ORDER BY id ASC",
    [bookingId]
  );

  // Check allocated quantities for items
  const allocatedMap: Record<number, number> = {};
  for (const it of existingItems) {
    const alloc = one<{ n: number }>(
      "SELECT COALESCE(SUM(qty), 0) as n FROM booking_allocation WHERE is_void = 0 AND booking_item_id = ?",
      [it.id]
    )?.n || 0;
    allocatedMap[it.id] = Number(alloc);
  }

  return tx(() => {
    // In-place update of booking_items
    const unused = new Map(existingItems.map((i) => [i.id, i]));

    for (const desired of validItems) {
      let item: AnyRow | undefined;
      if (desired.keepId && unused.has(desired.keepId)) {
        item = unused.get(desired.keepId);
        unused.delete(desired.keepId);
      } else {
        // match by name
        for (const [id, it] of unused.entries()) {
          if (String(it.material_name || "").trim().toLowerCase() === desired.name.toLowerCase()) {
            item = it;
            unused.delete(id);
            break;
          }
        }
      }

      if (!item) {
        run(
          "INSERT INTO booking_item (booking_id, material_name, qty, price_at_time) VALUES (?, ?, ?, ?)",
          [bookingId, desired.name, desired.qty, desired.rate]
        );
      } else {
        const usedQty = allocatedMap[item.id] || 0;
        if (desired.qty + 1e-6 < usedQty) {
          throw new Error(`Cannot reduce "${desired.name}" below the already delivered quantity ${usedQty}.`);
        }
        if (usedQty > 0 && String(item.material_name).trim().toLowerCase() !== desired.name.toLowerCase()) {
          throw new Error(
            `Cannot change "${item.material_name}" to "${desired.name}" because that line has already been delivered.`
          );
        }
        run(
          "UPDATE booking_item SET material_name = ?, qty = ?, price_at_time = ? WHERE id = ?",
          [desired.name, desired.qty, desired.rate, item.id]
        );
      }
    }

    // Check remaining unused items for deletion
    for (const [id, item] of unused.entries()) {
      const usedQty = allocatedMap[id] || 0;
      if (usedQty > 0) {
        throw new Error(
          `Cannot remove "${item.material_name}" because it has already been delivered. Void or correct that sale first.`
        );
      }
      run("DELETE FROM booking_item WHERE id = ?", [id]);
    }

    const calculatedAmount = validItems.reduce((acc, it) => acc + money(it.qty * it.rate), 0);
    const amount = money(body.amount != null ? Number(body.amount) : calculatedAmount);
    const paidAmount = money(Number(body.paid_amount ?? booking.paid_amount ?? 0));
    const discount = money(Number(body.discount ?? booking.discount ?? 0));
    const discountReason = String(body.discount_reason ?? booking.discount_reason ?? "").trim();
    const note = String(body.note ?? booking.note ?? "").trim();
    const datePosted = body.date || body.date_posted || booking.date_posted || pkNow();
    const photoUrl = body.photo_url ?? booking.photo_url;
    const photoPath = body.photo_path ?? booking.photo_path;

    run(
      `UPDATE booking SET
        client_name = ?, amount = ?, paid_amount = ?, discount = ?, discount_reason = ?,
        manual_bill_no = ?, photo_path = ?, photo_url = ?, date_posted = ?, note = ?
       WHERE id = ?`,
      [
        clientName,
        amount,
        paidAmount,
        discount,
        discountReason,
        manualBillNo,
        photoPath,
        photoUrl,
        datePosted,
        note,
        bookingId
      ]
    );

    const updatedBooking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [bookingId])!;
    const oldBillRef = oldBillNo || booking.auto_bill_no || `BK-${bookingId}`;
    syncBookingPendingBill(bookingId, validItems[0].name, [oldBillRef]);

    const formAccount = body.payment_account_id || body.receive_in_account_id || booking.receive_in_account_id;
    const paidIncreased = paidAmount > oldPaid + 0.0001;

    syncBookingPaidIntoAccount(updatedBooking, {
      paymentAccountId: formAccount,
      method: body.payment_method || body.method || "Cash",
      requireAccount: Boolean(formAccount) || paidIncreased
    });

    return { ok: true, booking_id: bookingId };
  });
}

export function hardDeleteBooking(bookingId: number) {
  const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [bookingId]);
  if (!booking) return false;

  return tx(() => {
    // Void and remove linked account transactions
    const marker = `[SRC:Booking:${booking.id}]`;
    const linkedTxs = all<AnyRow>(
      "SELECT * FROM account_transaction WHERE note LIKE ?",
      [`%${marker}%`]
    );

    for (const txRow of linkedTxs) {
      run("DELETE FROM account_transaction WHERE id = ?", [txRow.id]);
    }

    // Retain payment identity / audit while setting void
    const linkedPays = all<AnyRow>(
      "SELECT * FROM payment WHERE note LIKE ?",
      [`%${marker}%`]
    );
    for (const pay of linkedPays) {
      run("UPDATE payment SET is_void = 1 WHERE id = ?", [pay.id]);
    }

    // Delete booking allocations for items
    run(
      `DELETE FROM booking_allocation WHERE booking_item_id IN (
        SELECT id FROM booking_item WHERE booking_id = ?
      )`,
      [booking.id]
    );

    // Delete pending bills
    run("DELETE FROM pending_bills WHERE source_table = 'booking' AND source_id = ?", [booking.id]);

    // Delete booking items and booking
    run("DELETE FROM booking_item WHERE booking_id = ?", [booking.id]);
    run("DELETE FROM booking WHERE id = ?", [booking.id]);

    return true;
  });
}

export function setBookingVoid(bookingId: number, isVoid: boolean) {
  const booking = one<AnyRow>("SELECT * FROM booking WHERE id = ?", [bookingId]);
  if (!booking) return false;
  const target = isVoid ? 1 : 0;
  if (booking.is_void === target) return false;

  return tx(() => {
    run("UPDATE booking SET is_void = ? WHERE id = ?", [target, bookingId]);
    const billRef = booking.manual_bill_no || booking.auto_bill_no || `BK-${booking.id}`;
    const extraRefs = [booking.manual_bill_no, booking.auto_bill_no, `BK-${booking.id}`].filter(Boolean);

    syncBookingPendingBill(bookingId, "", extraRefs);

    // Mark CANCEL entries matching bill references
    for (const ref of extraRefs) {
      run("UPDATE entry SET is_void = ? WHERE type = 'CANCEL' AND bill_no = ?", [target, ref]);
    }

    // Void / unvoid linked account transactions
    const marker = `[SRC:Booking:${booking.id}]`;
    run("UPDATE account_transaction SET is_void = ? WHERE note LIKE ?", [target, `%${marker}%`]);

    return true;
  });
}
