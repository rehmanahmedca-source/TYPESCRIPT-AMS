import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Modal, Combobox } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

type Line = {
  name: string;
  qty: string;
  rate: string;
  alt: string;
  grn: string;
  ignore: boolean;
};
type Delivery = { id: string; bags: string; rent: string };
type Sale = {
  id: number;
  client_name: string;
  auto_bill_no: string;
  manual_bill_no: string;
  date_posted: string;
  amount: number;
  paid_amount: number;
  discount: number;
  category: string;
  is_void: number;
  note: string;
  driver_rent?: number;
  items: { product_name: string; qty: number; price_at_time?: number; rate?: number }[];
};
type BookingRow = { material: string; booked: number; delivered: number; returned: number; balance: number; unit_price: number };
type Fin = { found: boolean; balance: number; debit_total: number; cash_received_total: number; waive_off_total: number };

const CATS = ["Booking Delivery", "Mixed Transaction", "Credit Customer", "Open Khata", "Cash"] as const;

function saleStatus(s: Sale) {
  if (s.is_void) return { label: "DELETED", cls: "bg-danger" };
  if (s.category === "Open Khata") return { label: "OPEN KHATA", cls: "bg-warning text-dark" };
  if (s.category === "Cash" && !s.manual_bill_no) return { label: "UNBILLED", cls: "bg-danger" };
  return { label: "BILLED", cls: "bg-success" };
}

export default function Sales() {
  const { data, reload, error } = useApi<{
    sales: Sale[];
    clients: { id: number; name: string; code: string }[];
    materials: { id: number; name: string; unit_price: number }[];
    drivers: { id: number; name: string }[];
    accounts: { id: number; name: string; category: string }[];
    stats: { billed: number; unbilled: number };
    booked_client_codes: string[];
    grns: { id: number; manual_bill_no: string; auto_bill_no: string; items: { id: number; mat_name: string; qty: number; price_at_time: number }[] }[];
    categories: string[];
  }>("/sales");

  const [showMode, setShowMode] = useState<"active" | "all">("active");
  const [qClient, setQClient] = useState("");
  const [qBill, setQBill] = useState("");
  const [qCat, setQCat] = useState("");
  const [qMat, setQMat] = useState("");
  const [billState, setBillState] = useState("all");
  const [sheet, setSheet] = useState<null | "Billed" | "Unbilled">(null);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [saveErr, setSaveErr] = useState("");

  const [category, setCategory] = useState<string>("Booking Delivery");
  const [clientCode, setClientCode] = useState("");
  const [manualName, setManualName] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [manualBill, setManualBill] = useState("");
  const [note, setNote] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [paid, setPaid] = useState("0");
  const [method, setMethod] = useState("Cash");
  const [accountId, setAccountId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ name: "", qty: "1", rate: "", alt: "", grn: "", ignore: false }]);
  const [dels, setDels] = useState<Delivery[]>([{ id: "", bags: "", rent: "" }]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [fin, setFin] = useState<Fin | null>(null);
  const [showIgnore, setShowIgnore] = useState(false);

  const bookedCodes = new Set(data?.booked_client_codes || []);
  const clients = data?.clients || [];
  const materials = data?.materials || [];
  const drivers = data?.drivers || [];
  const accounts = data?.accounts || [];

  const filteredClients = category === "Booking Delivery" || category === "Mixed Transaction"
    ? clients.filter((c) => bookedCodes.has(c.code))
    : clients;

  useEffect(() => {
    if (!clientCode) {
      setBookings([]);
      setFin(null);
      return;
    }
    api<BookingRow[]>(`/sales/client-booking/${encodeURIComponent(clientCode)}`).then(setBookings).catch(() => setBookings([]));
    api<Fin>(`/sales/client-financial/${encodeURIComponent(clientCode)}`).then(setFin).catch(() => setFin(null));
  }, [clientCode]);

  useEffect(() => {
    if (sheet === "Unbilled") {
      setCategory("Cash");
    } else if (sheet === "Billed" && category === "Cash") {
      setCategory("Booking Delivery");
    }
  }, [sheet]);

  const balMap = useMemo(() => {
    const m: Record<string, BookingRow> = {};
    for (const b of bookings) m[b.material.toLowerCase()] = b;
    return m;
  }, [bookings]);

  function lineCharge(l: Line) {
    const qty = Number(l.qty || 0);
    const rate = Number(l.rate || 0);
    const ignore = l.ignore || ["Cash", "Credit Customer", "Open Khata"].includes(category);
    const bal = ignore ? 0 : Number(balMap[l.name.toLowerCase()]?.balance || 0);
    const chargeQty = bal > 0 ? Math.max(0, qty - bal) : qty;
    return chargeQty * rate;
  }

  const itemTotal = lines.reduce((a, l) => a + lineCharge(l), 0);
  const hidePricing = category === "Booking Delivery" || itemTotal <= 0;
  const displayTotal = hidePricing ? 0 : itemTotal;
  const displayPaid = category === "Cash" ? Math.max(0, displayTotal - Number(discount || 0)) : Number(paid || 0);
  const rentActual = dels.reduce((a, d) => a + Number(d.rent || 0), 0);

  const rows = (data?.sales || []).filter((s) => {
    if (showMode === "active" && s.is_void) return false;
    if (qClient && !(s.client_name || "").toLowerCase().includes(qClient.toLowerCase())) return false;
    if (qBill && !`${s.manual_bill_no || ""} ${s.auto_bill_no || ""}`.toLowerCase().includes(qBill.toLowerCase())) return false;
    if (qCat && s.category !== qCat) return false;
    if (qMat && !(s.items || []).some((i) => (i.product_name || "").toLowerCase().includes(qMat.toLowerCase()))) return false;
    if (billState === "unbilled" && !(s.category === "Cash" && !s.manual_bill_no)) return false;
    if (billState === "billed" && s.category === "Cash" && !s.manual_bill_no) return false;
    return true;
  });

  function resetSheet() {
    setCategory(sheet === "Unbilled" ? "Cash" : "Booking Delivery");
    setClientCode("");
    setManualName("");
    setUseManual(false);
    setSaleDate(new Date().toISOString().slice(0, 16));
    setManualBill("");
    setNote("");
    setDiscount("0");
    setDiscountReason("");
    setPaid("0");
    setMethod("Cash");
    setAccountId("");
    setLines([{ name: "", qty: "1", rate: "", alt: "", grn: "", ignore: false }]);
    setDels([{ id: "", bags: "", rent: "" }]);
    setSaveErr("");
    setEditSale(null);
  }

  function openSheet(mode: "Billed" | "Unbilled") {
    setSheet(mode);
    setCategory(mode === "Unbilled" ? "Cash" : "Booking Delivery");
    setSaveErr("");
  }

  function startEdit(s: Sale) {
    setEditSale(s);
    setSheet("Billed");
    setCategory(s.category || "Cash");
    const c = clients.find((x) => x.name === s.client_name);
    setClientCode(c?.code || s.client_name);
    setManualBill(s.manual_bill_no || "");
    setNote(s.note || "");
    setDiscount(String(s.discount || 0));
    setPaid(String(s.paid_amount || 0));
    setSaleDate(String(s.date_posted || "").slice(0, 16));
    setLines(
      (s.items || []).length
        ? s.items.map((i) => ({
            name: i.product_name,
            qty: String(i.qty),
            rate: String(i.price_at_time ?? i.rate ?? 0),
            alt: "",
            grn: "",
            ignore: false
          }))
        : [{ name: "", qty: "1", rate: "", alt: "", grn: "", ignore: false }]
    );
  }

  async function saveSale(e: FormEvent) {
    e.preventDefault();
    setSaveErr("");
    const payload = {
      client_code: clientCode,
      client_name: clients.find((c) => c.code === clientCode)?.name || clientCode,
      manual_client_name: useManual || category === "Open Khata" ? manualName : "",
      category,
      sale_date: saleDate,
      manual_bill_no: category === "Cash" && sheet === "Unbilled" ? "" : manualBill,
      note,
      discount: hidePricing ? 0 : Number(discount || 0),
      discount_reason: discountReason,
      paid_amount: hidePricing ? 0 : displayPaid,
      payment_method: method,
      payment_account_id: accountId,
      items: lines.map((l) => ({
        name: l.name,
        qty: Number(l.qty || 0),
        rate: Number(l.rate || 0),
        alternate_material: l.alt,
        grn_item_id: l.grn,
        ignore_booking: l.ignore
      })),
      delivery_persons: dels
        .filter((d) => d.id)
        .map((d) => ({
          delivery_person_id: d.id,
          bags_delivered: Number(d.bags || 0),
          rent_amount: Number(d.rent || 0)
        }))
    };
    try {
      if (editSale) {
        await api(`/sales/${editSale.id}`, {
          method: "POST",
          body: JSON.stringify({
            client_name: payload.client_name,
            discount: payload.discount,
            paid_amount: payload.paid_amount,
            note: payload.note,
            items: payload.items
          })
        });
      } else {
        await api("/sales", { method: "POST", body: JSON.stringify(payload) });
      }
      setSheet(null);
      resetSheet();
      reload();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  }

  async function voidSale(id: number) {
    if (!confirm("Permanently delete this sale? Stock will be reversed.")) return;
    await api(`/sales/${id}/void`, { method: "POST" });
    reload();
  }

  function onMaterial(i: number, name: string) {
    const n = [...lines];
    n[i].name = name;
    const b = balMap[name.toLowerCase()];
    const mat = materials.find((m) => m.name === name);
    if (b && b.balance > 0 && !n[i].ignore && !["Cash", "Credit Customer", "Open Khata"].includes(category)) {
      n[i].rate = String(b.unit_price || "");
    } else if (mat) n[i].rate = String(mat.unit_price || "");
    setLines(n);
  }

  const cashMode = category === "Cash";
  const openKhata = category === "Open Khata";
  const showManual = openKhata || (cashMode && useManual);

  return (
    <div>
      <PageHeader icon="bi-cart-check" title="Sales" subtitle="Direct sales — billed and unbilled">
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/" className="btn btn-outline-light btn-sm fw-bold">
            <i className="bi bi-arrow-left me-1" /> Back
          </Link>
          <Link to="/direct_sales/hold" className="btn btn-outline-info btn-sm fw-bold">Hold Bills</Link>
          <Link to="/mixed_transactions" className="btn btn-outline-secondary btn-sm fw-bold">Mixed Report</Link>
          <button className="btn btn-warning btn-sm text-dark fw-bold" onClick={() => openSheet("Billed")}>
            <i className="bi bi-plus-lg" /> Add Sale
          </button>
        </div>
      </PageHeader>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="mb-3 d-flex gap-2">
        <button className={`btn btn-sm fw-bold ${showMode === "active" ? "btn-warning text-dark" : "btn-outline-warning"}`} onClick={() => setShowMode("active")}>
          Active
        </button>
        <button className={`btn btn-sm fw-bold ${showMode === "all" ? "btn-info text-dark" : "btn-outline-info"}`} onClick={() => setShowMode("all")}>
          All
        </button>
      </div>

      <div className="ui-card mb-3">
        <div className="ui-card-body">
          <div className="row g-2">
            <div className="col-lg-2 col-md-4">
              <label className="ui-label">Client</label>
              <input className="form-control form-control-sm" value={qClient} onChange={(e) => setQClient(e.target.value)} placeholder="Search client..." />
            </div>
            <div className="col-lg-2 col-md-4">
              <label className="ui-label">Bill No</label>
              <input className="form-control form-control-sm" value={qBill} onChange={(e) => setQBill(e.target.value)} placeholder="Manual/Auto" />
            </div>
            <div className="col-lg-2 col-md-4">
              <label className="ui-label">Billed State</label>
              <select className="form-select form-select-sm" value={billState} onChange={(e) => setBillState(e.target.value)}>
                <option value="all">All</option>
                <option value="billed">Billed</option>
                <option value="unbilled">Unbilled</option>
              </select>
            </div>
            <div className="col-lg-2 col-md-4">
              <label className="ui-label">Category</label>
              <select className="form-select form-select-sm" value={qCat} onChange={(e) => setQCat(e.target.value)}>
                <option value="">All</option>
                {(data?.categories || CATS).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-md-4">
              <label className="ui-label">Material</label>
              <input className="form-control form-control-sm" value={qMat} onChange={(e) => setQMat(e.target.value)} placeholder="Search material..." />
            </div>
            <div className="col-lg-2 col-md-4 d-flex align-items-end gap-2">
              <button className="btn btn-outline-light btn-sm fw-bold" onClick={() => { setQClient(""); setQBill(""); setQCat(""); setQMat(""); setBillState("all"); }}>
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <button type="button" className="ds-add-tile ds-add-tile--billed w-100" onClick={() => openSheet("Billed")}>
            <div className="ds-add-label"><i className="bi bi-receipt me-2" />Billed Sales (Due / Booking)</div>
            <div className="ds-add-value">{data?.stats.billed ?? 0}</div>
            <span className="ds-add-cta">Click to Add</span>
          </button>
        </div>
        <div className="col-md-6">
          <button type="button" className="ds-add-tile ds-add-tile--unbilled w-100" onClick={() => openSheet("Unbilled")}>
            <div className="ds-add-label"><i className="bi bi-cash-coin me-2" />Unbilled Sales (Cash)</div>
            <div className="ds-add-value">{data?.stats.unbilled ?? 0}</div>
            <span className="ds-add-cta">Click to Add</span>
          </button>
        </div>
      </div>

      <div className="ui-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 table-dark">
            <thead>
              <tr>
                <th className="text-center">Bill No.</th>
                <th className="text-center">System Ref</th>
                <th className="text-center">Status</th>
                <th>Client</th>
                <th>Date & Time</th>
                <th>Material</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Total Amount</th>
                <th className="text-end">Driver Rent</th>
                <th>Notes</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const st = saleStatus(s);
                return (
                  <tr key={s.id} className={s.is_void ? "opacity-50" : ""}>
                    <td className="text-center">
                      {s.manual_bill_no ? (
                        <span className="badge bg-dark border border-secondary text-warning">{s.manual_bill_no}</span>
                      ) : (
                        <span className="badge bg-secondary">CASH-SALE</span>
                      )}
                    </td>
                    <td className="text-center">
                      {s.auto_bill_no ? <span className="badge bg-dark border border-secondary text-info">{s.auto_bill_no}</span> : "—"}
                    </td>
                    <td className="text-center"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      {s.client_name}
                      {s.category === "Open Khata" && <span className="badge bg-warning text-dark ms-1">Open Khata</span>}
                    </td>
                    <td>
                      <span className="d-block">{ymd(s.date_posted)}</span>
                      <small className="text-white-50">{String(s.date_posted || "").slice(11, 16)}</small>
                    </td>
                    <td>{(s.items || []).map((it, i) => <div className="small" key={i}>{it.product_name}</div>)}</td>
                    <td className="text-end fw-bold">{(s.items || []).map((it, i) => <div key={i}>{it.qty}</div>)}</td>
                    <td className="text-end fw-bold text-danger">{money(s.amount)}</td>
                    <td className="text-end fw-bold text-warning">{money(s.driver_rent)}</td>
                    <td className="small text-white-50">{s.note || "—"}</td>
                    <td className="text-end pe-4">
                      {!s.is_void && (
                        <>
                          <Link to={`/view_bill/${encodeURIComponent(s.manual_bill_no || s.auto_bill_no)}`} className="btn btn-outline-info btn-sm rounded-pill me-1" title="View">
                            <i className="bi bi-eye" />
                          </Link>
                          <button className="btn btn-outline-warning btn-sm rounded-pill me-1" onClick={() => startEdit(s)} title="Edit">
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="btn btn-outline-danger btn-sm rounded-pill" onClick={() => voidSale(s.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={11} className="text-center py-4 text-white-50">No sales found for selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!sheet}
        title={editSale ? `Edit Sale ${editSale.auto_bill_no || ""}` : sheet === "Unbilled" ? "New Unbilled Sale (Cash)" : "New Billed Sale"}
        onClose={() => { setSheet(null); resetSheet(); }}
        size="full"
        footer={
          <div className="d-flex gap-2 w-100">
            <button className="btn btn-outline-secondary flex-grow-1 py-2 rounded-pill fw-bold" type="button" onClick={resetSheet}>Reset</button>
            <button className="btn btn-outline-info flex-grow-1 py-2 rounded-pill fw-bold" type="button" onClick={async () => {
              await api("/direct_sales/hold", { method: "POST", body: JSON.stringify({ client_code: clientCode, client_name: clients.find((c) => c.code === clientCode)?.name, category, manual_bill_no: manualBill, items: lines, payload: { lines, dels, paid, discount } }) });
              setSheet(null); resetSheet();
            }}>Hold Bill</button>
            <button className="btn btn-warning text-dark fw-bold flex-grow-1 py-2 rounded-pill" type="submit" form="saleSheetForm">Save Sale</button>
          </div>
        }
      >
        <form id="saleSheetForm" className="sale-form" onSubmit={saveSale}>
          {saveErr && <div className="alert alert-danger py-2">{saveErr}</div>}
          <div className="row g-3">
            <div className="col-lg-3 col-md-4 border-end border-secondary pe-md-3">
              {sheet !== "Unbilled" && (
                <div className="mb-3">
                  <label className="text-white-50 small fw-bold mb-1">1. Select Sale Type</label>
                  <select className="form-select bg-dark text-white border-secondary" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATS.map((c) => <option key={c} value={c}>{c === "Booking Delivery" ? "Booked Sale" : c === "Mixed Transaction" ? "Booked + Due" : c === "Credit Customer" ? "Due Sale" : c === "Cash" ? "Cash Sale" : c}</option>)}
                  </select>
                </div>
              )}
              {!showManual && (
                <div className="mb-3">
                  <label className="text-white-50 small fw-bold mb-1">2. Select Client</label>
                  <select className="form-select bg-dark text-white border-secondary" value={clientCode} onChange={(e) => setClientCode(e.target.value)} required={!showManual}>
                    <option value="">Search by name or code...</option>
                    {filteredClients.map((c) => <option key={c.id} value={c.code}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
              )}
              {cashMode && (
                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id="manualClient" checked={useManual} onChange={(e) => setUseManual(e.target.checked)} />
                  <label className="form-check-label text-white-50 small" htmlFor="manualClient">Unregistered / Manual Client Name</label>
                </div>
              )}
              {showManual && (
                <div className="mb-3">
                  <label className="text-white-50 small fw-bold mb-1">Customer Name (Manual)</label>
                  <input className="form-control bg-dark text-white border-secondary" value={manualName} onChange={(e) => setManualName(e.target.value)} required />
                </div>
              )}
              <div className="p-3 rounded border mb-3" style={{ minHeight: 180, background: "#111a2d", borderColor: "#3b465c" }}>
                {!bookings.length ? (
                  <p className="text-white-50 text-center mt-4">Select a client to see booked items</p>
                ) : (
                  <>
                    <label className="text-warning small fw-bold mb-2">CLIENT BOOKING STATUS</label>
                    {bookings.map((b) => (
                      <div key={b.material} className="mb-2 p-2 rounded border border-secondary">
                        <div className="d-flex justify-content-between">
                          <span className="text-white small fw-bold">{b.material}</span>
                          <span className={`small fw-bold ${b.balance > 0 ? "text-success" : "text-danger"}`}>{b.balance} Left</span>
                        </div>
                        <div className="progress mt-1" style={{ height: 4 }}>
                          <div className="progress-bar bg-warning" style={{ width: `${b.booked > 0 ? (b.delivered / b.booked) * 100 : 0}%` }} />
                        </div>
                        <div className="d-flex justify-content-between mt-1">
                          <span className="text-white-50" style={{ fontSize: "0.7rem" }}>Booked: {b.booked}</span>
                          <span className="text-white-50" style={{ fontSize: "0.7rem" }}>Delivered: {b.delivered}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="p-3 rounded border" style={{ background: "#111a2d", borderColor: "#3b465c" }}>
                {!fin?.found ? (
                  <p className="text-white-50 text-center mb-0">Select a client to see running balance</p>
                ) : (
                  <>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-warning small fw-bold">RUNNING PENDING</span>
                      <span className={`badge ${fin.balance > 0 ? "bg-danger" : fin.balance < 0 ? "bg-success" : "bg-secondary"}`}>
                        {fin.balance > 0 ? "DUE" : fin.balance < 0 ? "ADVANCE" : "SETTLED"}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between"><span className="text-white-50 small">Total Due</span><span className="text-danger fw-bold">{money(fin.debit_total)}</span></div>
                    <div className="d-flex justify-content-between"><span className="text-white-50 small">Total Paid</span><span className="text-success fw-bold">{money(fin.cash_received_total)}</span></div>
                    <div className="d-flex justify-content-between"><span className="text-white-50 small">Waive-Off (Loss)</span><span className="text-warning fw-bold">{money(fin.waive_off_total)}</span></div>
                    <div className="d-flex justify-content-between mt-2 pt-2 border-top border-secondary">
                      <span className="text-white-50 small">Net Pending</span>
                      <span className={`fw-bold ${fin.balance > 0 ? "text-danger" : "text-success"}`}>{money(fin.balance)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col-lg-9 col-md-8">
              <div className="section-title mb-2 fw-bold">3. Sale Details</div>
              <div className="row g-3 mb-3">
                <div className="col-md-8">
                  <label className="text-white-50 small fw-bold mb-1">Delivery Persons</label>
                  {dels.map((d, i) => (
                    <div className="row g-2 mb-2" key={i}>
                      <div className="col-md-5">
                        <select className="form-select bg-dark text-white border-secondary" value={d.id} onChange={(e) => { const n = [...dels]; n[i].id = e.target.value; setDels(n); }} required>
                          <option value="">Select person</option>
                          {drivers.map((dr) => <option key={dr.id} value={dr.id}>{dr.name}</option>)}
                        </select>
                      </div>
                      <div className="col-md-3"><input className="form-control bg-dark text-white border-secondary text-center" placeholder="Bags" value={d.bags} onChange={(e) => { const n = [...dels]; n[i].bags = e.target.value; setDels(n); }} /></div>
                      <div className="col-md-3"><input className="form-control bg-dark text-white border-secondary text-center" placeholder="Rent" value={d.rent} onChange={(e) => { const n = [...dels]; n[i].rent = e.target.value; setDels(n); }} /></div>
                      <div className="col-md-1"><button type="button" className="btn btn-outline-danger btn-sm w-100" onClick={() => setDels(dels.length > 1 ? dels.filter((_, j) => j !== i) : [{ id: "", bags: "", rent: "" }])}>X</button></div>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm btn-outline-warning w-100" onClick={() => setDels([...dels, { id: "", bags: "", rent: "" }])}>+ Add Delivery Person</button>
                </div>
                <div className="col-md-4">
                  <label className="text-white-50 small fw-bold mb-1">Sale Date</label>
                  <input type="datetime-local" className="form-control bg-dark text-white border-secondary" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                </div>
              </div>

              <div className="d-flex justify-content-end mb-1">
                <label className="form-check-label text-white-50 small">
                  <input type="checkbox" className="form-check-input me-1" checked={showIgnore} onChange={(e) => setShowIgnore(e.target.checked)} />
                  Show ignore booking per item
                </label>
              </div>

              {lines.map((l, i) => {
                const b = balMap[l.name.toLowerCase()];
                const qty = Number(l.qty || 0);
                const ignore = l.ignore || ["Cash", "Credit Customer", "Open Khata"].includes(category);
                const reserved = !ignore && b && b.balance > 0 && qty <= b.balance;
                const mixed = !ignore && b && b.balance > 0 && qty > b.balance;
                return (
                  <div className="compact-item-row mb-2 p-2 rounded border border-secondary" key={i} style={{ background: "#111a2d" }}>
                    <div className="row g-2 align-items-end">
                      <div className="col-md-3">
                        <label className="text-white-50 small">Material</label>
                        <select className="form-select form-select-sm bg-dark text-white border-secondary" value={l.name} onChange={(e) => onMaterial(i, e.target.value)} required>
                          <option value="">Search material...</option>
                          {materials.map((m) => <option key={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div className="col-md-2">
                        <label className="text-white-50 small">GRN</label>
                        <select className="form-select form-select-sm bg-dark text-white border-secondary" value={l.grn} onChange={(e) => { const n = [...lines]; n[i].grn = e.target.value; setLines(n); }}>
                          <option value="">optional</option>
                          {(data?.grns || []).flatMap((g) =>
                            (g.items || [])
                              .filter((it) => !l.name || it.mat_name === l.name)
                              .map((it) => (
                                <option key={it.id} value={it.id}>
                                  {g.manual_bill_no || g.auto_bill_no} — {it.mat_name}
                                </option>
                              ))
                          )}
                        </select>
                      </div>
                      <div className="col-md-2">
                        <label className="text-white-50 small">Alternate</label>
                        <select className="form-select form-select-sm bg-dark text-white border-secondary" value={l.alt} onChange={(e) => { const n = [...lines]; n[i].alt = e.target.value; setLines(n); }}>
                          <option value="">optional</option>
                          {materials.map((m) => <option key={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div className="col-md-2">
                        <label className="text-white-50 small">Qty</label>
                        <div className="input-group input-group-sm">
                          <button type="button" className="btn btn-outline-secondary" onClick={() => { const n = [...lines]; n[i].qty = String(Math.max(0, Number(n[i].qty || 0) - 1)); setLines(n); }}>−</button>
                          <input className="form-control bg-dark text-white border-secondary text-center fw-bold" value={l.qty} onChange={(e) => { const n = [...lines]; n[i].qty = e.target.value; setLines(n); }} required />
                          <button type="button" className="btn btn-outline-secondary" onClick={() => { const n = [...lines]; n[i].qty = String(Number(n[i].qty || 0) + 1); setLines(n); }}>+</button>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <label className="text-white-50 small">Unit Price</label>
                        <input className="form-control form-control-sm bg-dark text-white border-secondary" value={l.rate} readOnly={!!reserved} onChange={(e) => { const n = [...lines]; n[i].rate = e.target.value; setLines(n); }} placeholder={reserved ? "Reserved" : "Rate"} />
                        {showIgnore && (
                          <label className="small text-warning mt-1">
                            <input type="checkbox" className="form-check-input me-1" checked={l.ignore} onChange={(e) => { const n = [...lines]; n[i].ignore = e.target.checked; setLines(n); }} />
                            Ignore
                          </label>
                        )}
                      </div>
                      <div className="col-md-1">
                        <label className="text-white-50 small">Total</label>
                        <input className="form-control form-control-sm bg-dark text-info border-secondary text-center" readOnly value={lineCharge(l).toFixed(2)} />
                      </div>
                    </div>
                    <div className="mt-1">
                      {reserved && <span className="badge bg-warning text-dark">BOOKED | Bal: {b?.balance} | Dispatch: {qty}</span>}
                      {mixed && <span className="badge bg-info text-dark">MIXED | Bal: {b?.balance} | Excess: {qty - (b?.balance || 0)}</span>}
                      {!reserved && !mixed && l.name && <span className="badge bg-info text-dark">NON-BOOKED | Dispatch: {qty}</span>}
                    </div>
                    <div className="text-end mt-1">
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : [{ name: "", qty: "1", rate: "", alt: "", grn: "", ignore: false }])}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="btn btn-sm btn-outline-warning mb-3 w-100" onClick={() => setLines([...lines, { name: "", qty: "1", rate: "", alt: "", grn: "", ignore: false }])}>+ Add More Items</button>

              <div className="row g-3">
                <div className="col-sm-4">
                  <label className="text-white-50 small fw-bold mb-1">DELIVERY PERSON RENT (ACTUAL)</label>
                  <input className="form-control bg-dark text-white border-secondary" readOnly value={rentActual.toFixed(2)} />
                </div>
                <div className="col-sm-4">
                  <label className="text-white-50 small fw-bold mb-1">AUTO BILL NO</label>
                  <input className="form-control bg-dark text-white border-secondary" readOnly value="Not assigned until saved" />
                </div>
                {!(cashMode && sheet === "Unbilled") && (
                  <div className="col-sm-4">
                    <label className="text-white-50 small fw-bold mb-1">MANUAL BILL NO</label>
                    <input className="form-control bg-dark text-white border-secondary" value={manualBill} onChange={(e) => setManualBill(e.target.value)} />
                  </div>
                )}
                <div className="col-12">
                  <label className="text-white-50 small fw-bold mb-1">NOTES</label>
                  <textarea className="form-control bg-dark text-white border-secondary" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="col-sm-4">
                  <label className="text-white-50 small fw-bold mb-1">TOTAL AMOUNT</label>
                  <input className="form-control bg-dark text-white border-secondary" readOnly value={displayTotal.toFixed(2)} />
                </div>
                <div className="col-sm-4">
                  <label className="text-white-50 small fw-bold mb-1">DISCOUNT</label>
                  <input className="form-control bg-dark text-white border-secondary" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                  <input className="form-control bg-dark text-white border-secondary mt-1 form-control-sm" placeholder="Reason (optional)" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
                </div>
                <div className="col-sm-4">
                  <label className="text-white-50 small fw-bold mb-1">PAID NOW</label>
                  <input className="form-control bg-dark text-white border-secondary" value={hidePricing ? "0" : displayPaid} readOnly={cashMode || hidePricing} onChange={(e) => setPaid(e.target.value)} />
                  {cashMode && <small className="text-white-50">For Cash Sale, this auto-fills as Total − Discount.</small>}
                </div>
                {(displayPaid > 0 || cashMode) && (
                  <>
                    <div className="col-sm-6">
                      <label className="text-white-50 small fw-bold mb-1">PAYMENT METHOD</label>
                      <select className="form-select bg-dark text-white border-secondary" value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option>Cash</option>
                        <option>Bank</option>
                        <option>Check</option>
                      </select>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-white-50 small fw-bold mb-1">SELECT ACCOUNT</label>
                      <select className="form-select bg-dark text-white border-secondary" value={accountId} onChange={(e) => setAccountId(e.target.value)} required={displayPaid > 0 || cashMode}>
                        <option value="">Select account...</option>
                        {accounts
                          .filter((a) => (method === "Cash" ? a.category === "cash" : a.category === "bank" || a.category === "cash"))
                          .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
