import { all, one, run, tx } from "./db.ts";
import { money, pkNow } from "./money.ts";
import { nextAutoBill, normalizeManualBill } from "./bills.ts";
import { db } from "./db.ts";
import {
  clientBalance,
  getClient,
  postAccountTx,
  postStockEntry,
  stockMap,
  type AnyRow
} from "./services.ts";

function matKey(name: unknown) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function clientBookingStatus(client: AnyRow) {
  const name = String(client.name);
  const code = String(client.code);
  const booked = all<{ material_name: string; qty: number; rate: number }>(
    `SELECT bi.material_name, SUM(bi.qty) AS qty, AVG(bi.price_at_time) AS rate
     FROM booking_item bi JOIN booking b ON b.id = bi.booking_id
     WHERE b.is_void = 0 AND LOWER(TRIM(b.client_name)) = LOWER(TRIM(?))
     GROUP BY bi.material_name`,
    [name]
  );
  const delivered = all<{ mat: string; qty: number }>(
    `SELECT COALESCE(booked_material, material) AS mat, SUM(qty) AS qty
     FROM entry WHERE is_void = 0 AND type = 'OUT'
     AND (client_code = ? OR LOWER(TRIM(client)) = LOWER(TRIM(?)))
     AND NOT (nimbus_no = 'Direct Sale' AND IFNULL(client_category,'') != 'Booking Delivery')
     GROUP BY COALESCE(booked_material, material)`,
    [code, name]
  );
  const returned = all<{ mat: string; qty: number }>(
    `SELECT material AS mat, SUM(qty) AS qty
     FROM entry WHERE is_void = 0 AND type = 'IN'
     AND (client_code = ? OR LOWER(TRIM(client)) = LOWER(TRIM(?)))
     AND nimbus_no = 'Material Return'
     AND (transaction_category = 'Booked Return' OR client_category = 'Booked Return')
     GROUP BY material`,
    [code, name]
  );
  const dmap: Record<string, number> = {};
  const rmap: Record<string, number> = {};
  for (const r of delivered) dmap[matKey(r.mat)] = Number(r.qty || 0);
  for (const r of returned) rmap[matKey(r.mat)] = Number(r.qty || 0);
  return booked
    .map((b) => {
      const key = matKey(b.material_name);
      const bookedQty = Number(b.qty || 0);
      const deliveredQty = dmap[key] || 0;
      const returnedQty = rmap[key] || 0;
      const balance = bookedQty - deliveredQty + returnedQty;
      return {
        material: b.material_name,
        booked: bookedQty,
        delivered: deliveredQty,
        returned: returnedQty,
        balance,
        unit_price: Number(b.rate || 0)
      };
    })
    .filter((r) => r.booked > 0);
}

export function bookedClientCodes() {
  const clients = all<AnyRow>("SELECT * FROM client WHERE is_active = 1");
  const codes: string[] = [];
  for (const c of clients) {
    const rows = clientBookingStatus(c);
    if (rows.some((r) => r.balance > 0)) codes.push(String(c.code));
  }
  return codes;
}

export function clientFinancialSummary(client: AnyRow) {
  const ledgerish = {
    found: true,
    balance: clientBalance(client),
    debit_total: 0,
    cash_received_total: 0,
    waive_off_total: 0
  };
  const name = String(client.name);
  const code = String(client.code);
  const salesDue = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount - COALESCE(discount,0)),0) AS n FROM direct_sale WHERE is_void=0 AND (client_code=? OR client_name=?)`,
    [code, name]
  )?.n || 0;
  const bookingAmt = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM booking WHERE is_void=0 AND client_name=?`,
    [name]
  )?.n || 0;
  const opening = Number(client.opening_balance || 0);
  ledgerish.debit_total = money(Math.max(0, opening) + Number(salesDue) + Number(bookingAmt));
  const salePaid = one<{ n: number }>(
    `SELECT COALESCE(SUM(paid_amount),0) AS n FROM direct_sale WHERE is_void=0 AND (client_code=? OR client_name=?)`,
    [code, name]
  )?.n || 0;
  const pays = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM payment WHERE is_void=0 AND (client_id=? OR client_name=?)`,
    [client.id, name]
  )?.n || 0;
  const bookingPaid = one<{ n: number }>(
    `SELECT COALESCE(SUM(paid_amount),0) AS n FROM booking WHERE is_void=0 AND client_name=?`,
    [name]
  )?.n || 0;
  ledgerish.cash_received_total = money(Number(salePaid) + Number(pays) + Number(bookingPaid));
  ledgerish.waive_off_total = one<{ n: number }>(
    `SELECT COALESCE(SUM(amount),0) AS n FROM waive_off WHERE is_void=0 AND (client_code=? OR client_name=?)`,
    [code, name]
  )?.n || 0;
  return ledgerish;
}

export function saleListExtras() {
  const rents = all<{ sale_id: number; n: number }>(
    `SELECT sale_id, COALESCE(SUM(rent_amount),0) AS n FROM sale_delivery_persons WHERE is_void=0 GROUP BY sale_id`
  );
  const rentMap: Record<number, number> = {};
  for (const r of rents) rentMap[Number(r.sale_id)] = Number(r.n || 0);
  const fallback = all<{ id: number; delivery_rent_cost: number }>(`SELECT id, delivery_rent_cost FROM direct_sale`);
  for (const s of fallback) {
    if (!rentMap[Number(s.id)]) rentMap[Number(s.id)] = Number(s.delivery_rent_cost || 0);
  }
  const billed = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM direct_sale WHERE is_void=0 AND category != 'Open Khata'
     AND (category != 'Cash' OR IFNULL(LENGTH(TRIM(manual_bill_no)),0) > 0 OR invoice_id IS NOT NULL)`
  )?.n || 0;
  const unbilled = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM direct_sale WHERE is_void=0 AND category='Cash'
     AND IFNULL(LENGTH(TRIM(manual_bill_no)),0)=0 AND invoice_id IS NULL`
  )?.n || 0;
  const grns = all<AnyRow>(`SELECT * FROM grn WHERE is_void=0 ORDER BY id DESC LIMIT 80`).map((g) => ({
    ...g,
    items: all<AnyRow>(`SELECT * FROM grn_item WHERE grn_id=? AND IFNULL(is_void,0)=0`, [g.id])
  }));
  return {
    delivery_rent_totals_by_sale: rentMap,
    stats: { billed, unbilled },
    booked_client_codes: bookedClientCodes(),
    grns,
    categories: ["Booking Delivery", "Mixed Transaction", "Credit Customer", "Open Khata", "Cash"]
  };
}

type SaleItemIn = {
  name?: string;
  product_name?: string;
  qty?: number;
  rate?: number;
  unit_rate?: number;
  price_at_time?: number;
  ignore_booking?: boolean;
  alternate_material?: string;
  grn_item_id?: number | string;
};

export function createDirectSale(b: AnyRow, actor: string) {
  const category = String(b.category || "Cash");
  const client = getClient(String(b.client_id || b.client_code || b.client_name || ""));
  let clientName = String(b.manual_client_name || client?.name || b.client_name || "").trim();
  if (!clientName && category !== "Open Khata" && category !== "Cash") {
    throw new Error("Select a registered client from the client list for this sale type.");
  }
  if (category === "Open Khata") {
    clientName = String(b.manual_client_name || clientName).trim();
    if (!clientName) throw new Error("Open Khata requires manual customer name.");
  }
  const itemsIn: SaleItemIn[] = Array.isArray(b.items) ? (b.items as SaleItemIn[]) : [];
  const delivery: { id?: number; name?: string; bags?: number; rent?: number }[] = Array.isArray(b.delivery_persons)
    ? (b.delivery_persons as AnyRow[]).map((d) => ({
        id: Number(d.delivery_person_id || d.id || 0) || undefined,
        name: String(d.name || ""),
        bags: Number(d.bags_delivered || d.bags || 0),
        rent: Number(d.rent_amount || d.rent || 0)
      }))
    : [];
  const validDelivery = delivery.filter((d) => d.id || d.name);
  if (!validDelivery.length && !b.driver_name) {
    throw new Error("Add at least one delivery person.");
  }

  const balances: Record<string, number> = {};
  const rates: Record<string, number> = {};
  if (client) {
    for (const row of clientBookingStatus(client)) {
      balances[matKey(row.material)] = row.balance;
      rates[matKey(row.material)] = row.unit_price;
    }
  }

  const processed: {
    product_name: string;
    booked_material?: string | null;
    qty: number;
    price_at_time: number;
    is_booking: boolean;
    is_alternate: boolean;
    grn_item_id?: number | null;
  }[] = [];
  let calculated = 0;
  const stock = stockMap();

  for (const raw of itemsIn) {
    const name = String(raw.name || raw.product_name || "").trim();
    const qty = Number(raw.qty || 0);
    if (!name || qty <= 0) continue;
    let ignore = !!raw.ignore_booking;
    if (["Cash", "Credit Customer", "Open Khata"].includes(category)) ignore = true;
    const key = matKey(name);
    let bal = ignore ? 0 : balances[key] || 0;
    let qtyBooking = 0;
    let qtySale = qty;
    if (bal > 0) {
      qtyBooking = Math.min(qty, bal);
      qtySale = qty - qtyBooking;
      balances[key] = bal - qtyBooking;
    }
    const alt = String(raw.alternate_material || "").trim();
    if (alt && qtyBooking <= 0) throw new Error(`Alternate material is only allowed for booked items. "${name}" has no booking balance.`);
    if (qtyBooking > 0) {
      processed.push({
        product_name: alt || name,
        booked_material: name,
        qty: qtyBooking,
        price_at_time: 0,
        is_booking: true,
        is_alternate: !!alt && alt !== name,
        grn_item_id: null
      });
    }
    if (qtySale > 0) {
      let rate = Number(raw.rate || raw.unit_rate || raw.price_at_time || 0);
      if (rate <= 0) rate = stock[name]?.rate || 0;
      if (rate <= 0 && category !== "Booking Delivery") throw new Error(`Rate is required for non-booked items: ${name}`);
      processed.push({
        product_name: name,
        booked_material: null,
        qty: qtySale,
        price_at_time: rate,
        is_booking: false,
        is_alternate: false,
        grn_item_id: raw.grn_item_id ? Number(raw.grn_item_id) : null
      });
      calculated += qtySale * rate;
    }
  }
  if (!processed.length) throw new Error("Add at least one item with qty > 0.");

  const allBooking = processed.every((i) => i.is_booking);
  const anyBooking = processed.some((i) => i.is_booking);
  let amount = money(calculated);
  let paid = money(b.paid_amount || 0);
  let discount = money(b.discount || 0);
  let cat = category;
  const hasBookingBalance = client ? clientBookingStatus(client).some((r) => r.balance > 0) : false;

  if (cat === "Booking Delivery") {
    if (!hasBookingBalance || !allBooking) throw new Error("Booked Sale is only for clients with booking balance and booked materials only.");
    amount = 0;
    paid = 0;
    discount = 0;
  } else if (cat === "Mixed Transaction") {
    if (!hasBookingBalance || !anyBooking) throw new Error("Booked + Credit is only for clients with booking balance and must include booked items.");
    if (allBooking || amount <= 0) throw new Error("Booked + Credit must include a non-booked credit portion with amount > 0.");
  } else if (cat === "Credit Customer") {
    if (anyBooking) throw new Error("Credit Sale cannot include booked-material fulfillment.");
  } else if (cat === "Open Khata") {
    /* ok */
  } else {
    cat = "Cash";
  }
  if (cat !== "Booking Delivery" && discount > amount + 0.01) throw new Error("Discount cannot exceed total amount.");
  if (cat === "Cash" && paid + discount < amount - 0.01) throw new Error("Cash Sale must be fully paid. Transaction not complete.");
  if (["Mixed Transaction", "Credit Customer", "Open Khata"].includes(cat) && Math.max(0, amount - discount - paid) <= 0 && discount <= 0) {
    throw new Error("This sale type is for credit only. Use Cash Sale if fully paid.");
  }
  if ((paid > 0 || cat === "Cash") && !b.payment_account_id) {
    throw new Error("Select a cash/bank account for the paid amount.");
  }

  const totalQty = processed.reduce((a, i) => a + i.qty, 0);
  const bags = validDelivery.reduce((a, d) => a + Number(d.bags || 0), 0);
  if (bags > totalQty + 0.0001) throw new Error("Total delivery bags cannot exceed total material quantity.");

  const deliveryRent = money(validDelivery.reduce((a, d) => a + Number(d.rent || 0), 0) || Number(b.delivery_rent || 0));
  const driverName =
    validDelivery[0]?.name ||
    (validDelivery[0]?.id
      ? String(one<AnyRow>("SELECT name FROM delivery_person WHERE id=?", [validDelivery[0].id])?.name || "")
      : String(b.driver_name || ""));

  return tx(() => {
    const auto = nextAutoBill(db, "SL");
    const manual = normalizeManualBill(String(b.manual_bill_no || ""));
    const info = run(
      `INSERT INTO direct_sale (
        client_name, client_code, category, amount, paid_amount, discount, discount_reason,
        manual_bill_no, auto_bill_no, date_posted, is_void, note, driver_name,
        delivery_rent_cost, payment_method, payment_account_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        clientName,
        client?.code || null,
        cat,
        amount,
        paid,
        discount,
        b.discount_reason || null,
        manual,
        auto,
        b.sale_date || b.date || pkNow(),
        b.note || null,
        driverName,
        deliveryRent,
        b.payment_method || "Cash",
        b.payment_account_id || null
      ]
    );
    const id = Number(info.lastInsertRowid);
    const bill = manual || auto;
    for (const item of processed) {
      run("INSERT INTO direct_sale_item (sale_id, product_name, qty, price_at_time, grn_item_id) VALUES (?, ?, ?, ?, ?)", [
        id,
        item.product_name,
        money(item.qty),
        money(item.price_at_time),
        item.grn_item_id || null
      ]);
      const itemCat = item.is_booking ? "Booking Delivery" : cat === "Mixed Transaction" ? "Credit Customer" : cat;
      postStockEntry({
        type: "OUT",
        material: item.product_name,
        qty: item.qty,
        client: clientName,
        clientCode: client ? String(client.code) : undefined,
        billNo: bill,
        autoBillNo: auto,
        category: cat === "Cash" ? "Unbilled" : "Billed",
        clientCategory: itemCat,
        nimbusNo: "Direct Sale",
        bookedMaterial: item.is_alternate ? item.booked_material || undefined : undefined,
        driver: driverName,
        note: String(b.note || ""),
        sourceModule: "sales",
        sourceTable: "direct_sale",
        sourceId: id,
        transactionType: "Sale"
      });
    }
    if (validDelivery.length) {
      for (const d of validDelivery) {
        const dp =
          d.id != null
            ? one<AnyRow>("SELECT * FROM delivery_person WHERE id=?", [d.id])
            : one<AnyRow>("SELECT * FROM delivery_person WHERE name=? COLLATE NOCASE", [d.name]);
        if (dp) {
          run(
            `INSERT INTO sale_delivery_persons (sale_id, delivery_person_id, bags_delivered, rent_amount, created_at, is_void)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [id, dp.id, Number(d.bags || 0), money(d.rent || 0), pkNow()]
          );
        }
      }
    }
    if (deliveryRent > 0) {
      run(
        `INSERT INTO delivery_rent (sale_id, delivery_person_name, bill_no, amount, note, date_posted, created_by, is_void)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, driverName, bill, deliveryRent, b.note || null, pkNow(), actor]
      );
    }
    if (paid > 0 && b.payment_account_id) {
      postAccountTx({
        toId: Number(b.payment_account_id),
        amount: paid,
        description: `Sale ${auto} ${clientName}`,
        type: "Receipt",
        sourceType: "DirectSale",
        sourceId: id,
        createdBy: actor
      });
    }
    if (Math.max(0, amount - discount - paid) > 0 && client) {
      run(
        `INSERT INTO pending_bill (client_code, client_name, bill_no, bill_kind, amount, reason, is_paid, created_at, created_by, is_void, source_table, source_id)
         VALUES (?, ?, ?, 'SALE', ?, 'Direct Sale', 0, ?, ?, 0, 'direct_sale', ?)`,
        [client.code, clientName, bill, money(amount - discount - paid), pkNow(), actor, id]
      );
    }
    return { id, auto, amount };
  });
}
