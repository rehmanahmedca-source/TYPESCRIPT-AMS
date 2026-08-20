import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Modal } from "../components/ui";
import { api } from "../api";
import { money3, qty, ymd } from "../format";
import { useApi } from "../useApi";

type FinRow = {
  id?: number | null;
  date?: string;
  date_display?: string;
  description: string;
  bill_no?: string;
  debit: number;
  credit: number;
  balance: number;
  type?: string | null;
  is_cancel_entry?: boolean;
  cancel_amount?: number;
};

type MatRow = {
  date: string;
  bill_no?: string;
  material: string;
  material_display?: string;
  qty_added: number;
  qty_dispatched: number;
  balance: number;
  type?: string;
  nimbus_no?: string;
  source_type?: string;
  source_id?: number;
};

type CancelRow = {
  item_id: number;
  material: string;
  booking_date: string;
  bill_no: string;
  qty_remaining: number;
  rate: number;
  amount: number;
};

type Txn = Record<string, unknown> & { id: number };

type LedgerPayload = {
  client: {
    id: number;
    name: string;
    code: string;
    opening_balance: number;
    opening_balance_date?: string;
    created_at?: string;
    is_active: number;
  };
  financial_history: FinRow[];
  material_history: MatRow[];
  material_history_grouped: Record<string, MatRow[]>;
  pending_bills: { bill_no: string; amount: number; is_paid: number; reason: string }[];
  total_balance: number;
  cancel_rows: CancelRow[];
  cancel_total: number;
  cancel_total_qty: number;
  cancel_new_balance: number;
  cancel_client_due: number;
  cancel_company_due: number;
  unresolved_dispatches: unknown[];
  transactions_map: Record<string, Txn>;
};

function fmtAmt(n: number) {
  return n > 0 ? money3(n) : "---";
}

export default function ClientLedger() {
  const { id } = useParams();
  const { data, reload, error } = useApi<LedgerPayload>(id ? `/clients/${id}/ledger` : null);
  const [openOb, setOpenOb] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [selected, setSelected] = useState<number[] | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);

  const c = data?.client;
  const cancelRows = data?.cancel_rows || [];
  const checked = selected ?? cancelRows.map((r) => r.item_id);
  const grouped = data?.material_history_grouped || {};
  const txn = editKey && data ? data.transactions_map[editKey] : null;

  const openingLabel = useMemo(() => {
    if (!c) return "";
    const d = ymd(c.opening_balance_date || c.created_at);
    const ob = Number(c.opening_balance || 0);
    const tag = ob > 0 ? "(Pending Due)" : ob < 0 ? "(Advance/Credit)" : "";
    return `Opening Balance: ${Number(ob).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${d ? `on ${d}` : ""} ${tag}`;
  }, [c]);

  async function setOpening(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api(`/clients/${id}/opening-balance`, {
      method: "POST",
      body: JSON.stringify({
        opening_balance: fd.get("opening_balance"),
        opening_balance_date: fd.get("opening_balance_date")
      })
    });
    setOpenOb(false);
    reload();
  }

  async function toggleActive() {
    const msg = c?.is_active
      ? "Suspend this client? Deliveries will be blocked."
      : "Re-activate this client? Deliveries will be allowed.";
    if (!confirm(msg)) return;
    await api(`/clients/${id}/toggle-active`, { method: "POST" });
    reload();
  }

  async function confirmCancel() {
    if (!checked.length) {
      alert("Select at least one material row to cancel.");
      return;
    }
    if (!confirm("Confirm cancellation of selected booking items? This will update booking balances.")) return;
    await api(`/clients/${id}/booking-cancel`, {
      method: "POST",
      body: JSON.stringify({ selected_item_ids: checked })
    });
    setOpenCancel(false);
    setSelected(null);
    reload();
  }

  async function revert(entryId: number) {
    if (!confirm("Revert this cancellation row? It will add this qty back to booking.")) return;
    await api(`/clients/${id}/booking-cancel-revert/${entryId}`, { method: "POST" });
    reload();
  }

  async function delTxn(type: string, tid: number) {
    if (!confirm("Permanently delete this transaction?")) return;
    await api(`/ledger-transaction/${type}/${tid}/delete`, { method: "POST" });
    reload();
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editKey || !txn) return;
    const type = editKey.startsWith("Payment") ? "Payment" : editKey.startsWith("Booking") ? "Booking" : "DirectSale";
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      body[k] = v;
    });
    await api(`/ledger-transaction/${type}/${txn.id}`, { method: "POST", body: JSON.stringify(body) });
    setEditKey(null);
    reload();
  }

  function printPage() {
    window.print();
  }

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data || !c) return <div className="text-white-50 p-4">Loading client ledger…</div>;

  return (
    <div className="ledger-print-area">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="mb-1 text-warning">Client Ledger: {c.name}</h2>
          <span className="badge bg-dark border border-secondary text-info">Client Code: {c.code || "N/A"}</span>
          <div
            className={`small mt-2 ${
              Number(c.opening_balance) > 0 ? "text-danger" : Number(c.opening_balance) < 0 ? "text-success" : "text-white-50"
            }`}
          >
            {openingLabel}
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap ledger-toolbar">
          <button className="btn btn-outline-info d-print-none btn-sm" onClick={() => setOpenOb(true)}>
            <i className="bi bi-wallet2" /> Set Opening Balance
          </button>
          {c.is_active ? (
            <button className="btn btn-outline-danger btn-sm d-print-none" onClick={toggleActive}>
              <i className="bi bi-pause-circle me-1" /> Suspend Delivery
            </button>
          ) : (
            <button className="btn btn-outline-success btn-sm d-print-none" onClick={toggleActive}>
              <i className="bi bi-play-circle me-1" /> Resume Delivery
            </button>
          )}
          <button className="btn btn-outline-warning d-print-none btn-sm" onClick={() => setOpenCancel(true)}>
            <i className="bi bi-x-octagon me-1" /> Cancel Remaining Booking
          </button>
          <Link to={`/payments?party=customer&client=${encodeURIComponent(c.code || c.name)}`} className="btn btn-outline-info d-print-none btn-sm fw-bold">
            <i className="bi bi-cash-coin me-1" /> Pay Remaining
          </Link>
          <button className="btn btn-outline-primary d-print-none btn-sm" onClick={printPage}>
            <i className="bi bi-printer" /> Print
          </button>
          <Link to="/clients" className="btn btn-outline-secondary btn-sm d-print-none">
            Back
          </Link>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4 financial-ledger-card" style={{ background: "#1e293b", border: "2px solid #475569", borderRadius: 15 }}>
        <div className="card-header border-bottom border-secondary py-3 d-flex justify-content-between align-items-center" style={{ background: "#0f172a" }}>
          <h5 className="mb-0 text-success fw-bold">
            <i className="bi bi-cash-coin me-2" />
            Financial Transaction Ledger
          </h5>
          <span className="badge bg-success text-white">{data.financial_history.length} Transactions</span>
        </div>
        <div className="table-responsive ledger-table-wrap">
          <table className="table table-dark table-hover align-middle mb-0 financial-ledger-table">
            <thead style={{ background: "#0f172a" }}>
              <tr>
                <th className="fw-bold py-3 ps-4 border-bottom border-secondary text-white-50">Date</th>
                <th className="fw-bold py-3 border-bottom border-secondary text-white-50">Description</th>
                <th className="fw-bold py-3 border-bottom border-secondary text-white-50">Bill #</th>
                <th className="fw-bold py-3 text-end border-bottom border-secondary text-white-50">Due Amount</th>
                <th className="fw-bold py-3 text-end border-bottom border-secondary text-white-50">Paid Amount</th>
                <th className="fw-bold py-3 text-end pe-4 border-bottom border-secondary text-white-50">Pending Amount</th>
                <th className="fw-bold py-3 text-end pe-4 border-bottom border-secondary text-white-50">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.financial_history.map((t, i) => {
                const dtxt = String(t.date_display || t.date || "");
                const key = `${t.type || "x"}-${t.id || i}`;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #334155" }}>
                    <td className="ps-4 py-3 small text-white-50">
                      <div>{dtxt.slice(0, 10)}</div>
                      <div style={{ fontSize: "0.72rem", opacity: 0.9 }}>{dtxt.length > 15 ? dtxt.slice(11, 16) : ""}</div>
                    </td>
                    <td>
                      {t.is_cancel_entry ? (
                        <>
                          <span className="text-info fw-bold">{t.description}</span>
                          <div className="small text-warning mt-1">
                            <span className="badge bg-warning text-dark me-1">Audit</span>
                            Cancellation value posted in Paid Amount
                            {t.cancel_amount != null ? ` | Value Rs. ${money3(t.cancel_amount)}` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-info fw-bold">{t.description}</span>
                      )}
                    </td>
                    <td>
                      {t.bill_no ? (
                        <span className="badge bg-dark border border-secondary text-warning">{t.bill_no}</span>
                      ) : (
                        <span className="badge bg-dark border border-secondary text-white-50">---</span>
                      )}
                    </td>
                    <td className="text-end text-danger fw-bold">{fmtAmt(t.debit)}</td>
                    <td className="text-end text-success fw-bold">{fmtAmt(t.credit)}</td>
                    <td className="text-end pe-4 fw-bold text-white">{money3(t.balance)}</td>
                    <td className="text-end pe-4 position-relative">
                      <button className="btn btn-sm btn-outline-light dropdown-toggle" onClick={() => setOpenAction(openAction === key ? null : key)}>
                        Action
                      </button>
                      {openAction === key && (
                        <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end border-secondary shadow-sm show" style={{ display: "block", position: "absolute", right: 0, zIndex: 20 }}>
                          {t.is_cancel_entry && t.id ? (
                            <li>
                              <button className="dropdown-item text-success fw-bold" onClick={() => revert(Number(t.id))}>
                                <i className="bi bi-arrow-counterclockwise me-2" />
                                Revert Cancel
                              </button>
                            </li>
                          ) : null}
                          {t.type && ["Booking", "Payment", "DirectSale"].includes(t.type) && t.id ? (
                            <>
                              <li>
                                <button className="dropdown-item text-warning" onClick={() => { setEditKey(`${t.type}${t.id}`); setOpenAction(null); }}>
                                  <i className="bi bi-pencil me-2" />
                                  Edit Transaction
                                </button>
                              </li>
                              <li>
                                <button className="dropdown-item text-danger fw-bold" onClick={() => delTxn(String(t.type), Number(t.id))}>
                                  <i className="bi bi-trash me-2" />
                                  Delete Transaction
                                </button>
                              </li>
                            </>
                          ) : null}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.financial_history.length && <div className="p-5 text-center text-white-50">No financial transactions found.</div>}
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4" style={{ background: "#1e293b", border: "2px solid #475569", borderRadius: 15, overflow: "hidden" }}>
        <div className="card-header border-bottom border-secondary py-3 d-flex justify-content-between align-items-center" style={{ background: "#0f172a" }}>
          <h5 className="mb-0 text-info fw-bold d-flex align-items-center gap-2">
            <span>
              <i className="bi bi-box-seam me-2" />
              Material Transaction Ledger (Deliveries)
            </span>
            {data.unresolved_dispatches?.length ? <span className="badge bg-warning text-dark">Unconfirmed: {data.unresolved_dispatches.length}</span> : null}
          </h5>
          <span className="badge bg-info text-dark">{data.material_history.length} Records</span>
        </div>
        <div className="table-responsive">
          <table className="table table-dark table-hover align-middle mb-0">
            <thead style={{ background: "#020617" }}>
              <tr>
                <th className="ps-3">Date</th>
                <th>Bill #</th>
                <th>Material</th>
                <th className="text-end">Qty Added</th>
                <th className="text-end">Dispatched</th>
                <th className="text-end pe-3">Total Remaining</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([materialName, items]) => (
                <>
                  <tr key={`h-${materialName}`} style={{ background: "#0b1220", borderTop: "2px solid #334155" }}>
                    <td className="ps-3 py-2 fw-bold text-info" colSpan={7}>
                      Material: {materialName} <span className="text-white-50">({items.length} rows)</span>
                    </td>
                  </tr>
                  {items.map((m, i) => {
                    const isCancel = m.type === "Cancel" || m.nimbus_no === "Booking Cancel";
                    return (
                      <tr key={`${materialName}-${i}`} style={{ borderBottom: "1px solid #334155" }}>
                        <td className="ps-3 small">{m.date}</td>
                        <td>
                          {m.bill_no ? (
                            <span className="badge bg-dark border border-secondary text-warning">{m.bill_no}</span>
                          ) : (
                            <span className="badge bg-dark border border-secondary text-white-50">---</span>
                          )}
                          <br />
                          <small className="text-white-50">{m.nimbus_no || ""}</small>
                        </td>
                        <td className="fw-bold">
                          {m.material_display || m.material}
                          {isCancel ? <span className="badge bg-danger ms-2">CANCELLED</span> : null}
                          {m.type === "Booking" || m.nimbus_no === "Booking" ? <span className="badge bg-success ms-2">BOOKING ADDED</span> : null}
                        </td>
                        {isCancel ? (
                          <td className="text-end text-warning fw-bold">booking cancelled</td>
                        ) : (
                          <td className="text-end text-success fw-bold">{m.qty_added > 0 ? qty(m.qty_added) : "---"}</td>
                        )}
                        <td className={`text-end fw-bold ${isCancel ? "text-warning" : "text-danger"}`}>{m.qty_dispatched > 0 ? qty(m.qty_dispatched) : "---"}</td>
                        <td className="text-end pe-3 fw-bold text-info">{qty(m.balance)}</td>
                        <td className="text-end pe-3">
                          {m.source_type === "Booking" && m.source_id ? (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => delTxn("Booking", m.source_id!)}>
                              <i className="bi bi-trash" />
                            </button>
                          ) : null}
                          {isCancel && m.source_id ? (
                            <button className="btn btn-sm btn-success me-1" onClick={() => revert(m.source_id!)}>
                              <i className="bi bi-arrow-counterclockwise me-1" />
                              Revert Cancel
                            </button>
                          ) : null}
                          {m.source_type === "Entry" && m.source_id ? (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => delTxn("Entry", m.source_id!)}>
                              <i className="bi bi-trash" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
          {!data.material_history.length && <div className="p-5 text-center text-white-50">No material transactions found.</div>}
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4" style={{ background: "#1e293b", border: "2px solid #475569", borderRadius: 15, overflow: "hidden" }}>
        <div className="card-header border-bottom border-secondary py-3 d-flex justify-content-between align-items-center" style={{ background: "#0f172a" }}>
          <h5 className="mb-0 text-warning fw-bold">
            <i className="bi bi-clock-history me-2" />
            Bills (Pending Section)
          </h5>
          <span className="badge bg-warning text-dark">{data.pending_bills.length} Records</span>
        </div>
        <div className="table-responsive">
          <table className="table table-dark table-hover align-middle mb-0">
            <thead style={{ background: "#020617" }}>
              <tr>
                <th className="ps-3">Bill #</th>
                <th className="text-end">Amount</th>
                <th>Status</th>
                <th className="pe-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.pending_bills.map((b, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #334155" }}>
                  <td className="ps-3 fw-bold text-warning">{b.bill_no}</td>
                  <td className="text-end text-danger fw-bold">{Number(b.amount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td>{b.is_paid ? <span className="badge bg-success">Paid</span> : <span className="badge bg-danger">Pending</span>}</td>
                  <td className="pe-3 small text-white-50">{String(b.reason || "").slice(0, 50)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.pending_bills.length && <div className="p-5 text-center text-white-50">No pending bills found.</div>}
        </div>
      </div>

      <Modal open={openOb} title="Set Opening Balance" onClose={() => setOpenOb(false)}>
        <form onSubmit={setOpening}>
          <label className="text-white-50 small fw-bold mb-1">OPENING BALANCE</label>
          <input type="number" step="0.01" name="opening_balance" className="form-control bg-dark text-white border-secondary" defaultValue={Number(c.opening_balance || 0).toFixed(2)} required />
          <small className="text-white-50">Use + for pending due, - for advance/credit.</small>
          <label className="text-white-50 small fw-bold mb-1 mt-3">OPENING BALANCE DATE</label>
          <input type="date" name="opening_balance_date" className="form-control bg-dark text-white border-secondary" defaultValue={ymd(c.opening_balance_date || c.created_at)} required />
          <button type="submit" className="btn btn-warning text-dark fw-bold w-100 mt-3">
            Update Opening Balance
          </button>
        </form>
      </Modal>

      <Modal open={openCancel} title="Cancel Remaining Booking (LIFO)" onClose={() => setOpenCancel(false)} size="xl">
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="p-3 rounded border border-secondary bg-dark h-100">
              <div className="text-white-50 small">Current Balance</div>
              <div className="text-white fw-bold fs-5">{Number(data.total_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 rounded border border-secondary bg-dark h-100">
              <div className="text-white-50 small">Cancel Value</div>
              <div className="text-warning fw-bold fs-5">{Number(data.cancel_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              <div className="text-white-50 small mt-1">Total Remaining Qty: {Number(data.cancel_total_qty).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 rounded border border-secondary bg-dark h-100">
              <div className="text-white-50 small">Balance After Cancel</div>
              <div className={`fw-bold fs-5 ${data.cancel_new_balance < 0 ? "text-success" : data.cancel_new_balance > 0 ? "text-danger" : "text-info"}`}>
                {Number(data.cancel_new_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              {data.cancel_company_due > 0 ? (
                <div className="text-success small mt-1">Pay back to client: {Number(data.cancel_company_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              ) : data.cancel_client_due > 0 ? (
                <div className="text-danger small mt-1">Client has to pay: {Number(data.cancel_client_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              ) : (
                <div className="text-info small mt-1">Settled</div>
              )}
            </div>
          </div>
        </div>
        {cancelRows.length ? (
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead style={{ background: "#020617" }}>
                <tr>
                  <th className="ps-3 text-center">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={checked.length === cancelRows.length}
                      onChange={(e) => setSelected(e.target.checked ? cancelRows.map((r) => r.item_id) : [])}
                    />
                  </th>
                  <th>Material</th>
                  <th>Booking Date</th>
                  <th>Bill #</th>
                  <th className="text-end">Remaining Qty</th>
                  <th className="text-end">Rate</th>
                  <th className="text-end pe-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {cancelRows.map((row) => (
                  <tr key={row.item_id}>
                    <td className="ps-3 text-center">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={checked.includes(row.item_id)}
                        onChange={(e) =>
                          setSelected(e.target.checked ? [...checked, row.item_id] : checked.filter((x) => x !== row.item_id))
                        }
                      />
                    </td>
                    <td className="fw-bold text-white">{row.material}</td>
                    <td className="text-white-50">{row.booking_date}</td>
                    <td>
                      <span className="badge bg-dark border border-secondary text-warning">{row.bill_no || "---"}</span>
                    </td>
                    <td className="text-end text-info fw-bold">{Number(row.qty_remaining).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="text-end text-white-50">{Number(row.rate).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="text-end pe-3 text-warning fw-bold">{Number(row.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center text-white-50">No remaining booking items to cancel.</div>
        )}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button className="btn btn-outline-secondary" onClick={() => setOpenCancel(false)}>
            Close
          </button>
          <button className="btn btn-warning text-dark fw-bold" disabled={!cancelRows.length} onClick={confirmCancel}>
            Confirm Cancel
          </button>
        </div>
      </Modal>

      <Modal
        open={!!editKey && !!txn}
        title={editKey?.startsWith("Payment") ? "Edit Payment" : editKey?.startsWith("Booking") ? "Edit Booking" : "Edit Direct Sale"}
        onClose={() => setEditKey(null)}
        size="lg"
      >
        {txn && editKey?.startsWith("Payment") && (
          <form onSubmit={saveEdit} className="row g-3">
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Amount *</label>
              <input name="amount" type="number" step="0.01" className="form-control bg-dark text-white border-secondary" defaultValue={Number(txn.amount || 0).toFixed(2)} required />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Method</label>
              <select name="method" className="form-select bg-dark text-white border-secondary" defaultValue={String(txn.method || "Cash")}>
                <option>Cash</option>
                <option>Bank</option>
                <option>Cheque</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Bill # (Ref)</label>
              <input name="manual_bill_no" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.manual_bill_no || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Bank Name</label>
              <input name="bank_name" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.bank_name || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Account Name</label>
              <input name="account_name" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.account_name || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Account Number</label>
              <input name="account_no" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.account_no || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Date</label>
              <input name="date_posted" type="datetime-local" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.date_posted || "").slice(0, 16)} required />
            </div>
            <div className="col-12">
              <label className="text-white-50 small fw-bold mb-1">Note</label>
              <textarea name="note" className="form-control bg-dark text-white border-secondary" rows={2} defaultValue={String(txn.note || "")} />
            </div>
            <div className="col-12">
              <button className="btn btn-warning text-dark fw-bold">Save Changes</button>
            </div>
          </form>
        )}
        {txn && editKey?.startsWith("Booking") && (
          <form onSubmit={saveEdit} className="row g-3">
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Manual Bill #</label>
              <input name="manual_bill_no" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.manual_bill_no || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Discount</label>
              <input name="discount" type="number" step="0.01" className="form-control bg-dark text-white border-secondary" defaultValue={Number(txn.discount || 0).toFixed(2)} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Discount Reason</label>
              <input name="discount_reason" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.discount_reason || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Date</label>
              <input name="date_posted" type="datetime-local" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.date_posted || "").slice(0, 16)} required />
            </div>
            <div className="col-12">
              <label className="text-white-50 small fw-bold mb-1">Note</label>
              <textarea name="note" className="form-control bg-dark text-white border-secondary" rows={2} defaultValue={String(txn.note || "")} />
            </div>
            <div className="col-12">
              <button className="btn btn-warning text-dark fw-bold">Save Changes</button>
            </div>
          </form>
        )}
        {txn && editKey?.startsWith("DirectSale") && (
          <form onSubmit={saveEdit} className="row g-3">
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Amount *</label>
              <input name="amount" type="number" step="0.01" className="form-control bg-dark text-white border-secondary" defaultValue={Number(txn.amount || 0).toFixed(2)} required />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Manual Bill #</label>
              <input name="manual_bill_no" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.manual_bill_no || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Category</label>
              <input name="category" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.category || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Payment Method</label>
              <input name="payment_method" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.payment_method || "")} />
            </div>
            <div className="col-md-6">
              <label className="text-white-50 small fw-bold mb-1">Date</label>
              <input name="date_posted" type="datetime-local" className="form-control bg-dark text-white border-secondary" defaultValue={String(txn.date_posted || "").slice(0, 16)} required />
            </div>
            <div className="col-12">
              <label className="text-white-50 small fw-bold mb-1">Note</label>
              <textarea name="note" className="form-control bg-dark text-white border-secondary" rows={2} defaultValue={String(txn.note || "")} />
            </div>
            <div className="col-12">
              <button className="btn btn-warning text-dark fw-bold">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
