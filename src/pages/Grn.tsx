import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

type Item = { name: string; qty: string; rate: string };
type GrnRow = {
  id: number; supplier: string; supplier_id?: number; auto_bill_no: string; manual_bill_no: string;
  date_posted: string; note: string; itemTotal: number; paid_amount: number; discount: number;
  loading_cost: number; freight_cost: number; other_expense: number; adjustment_amount?: number;
  payment_type?: string; payment_account_id?: number; tax_percent?: number; tax_amount?: number; tax_type?: string;
  bank_name?: string; account_name?: string; account_no?: string; supplier_invoice_no?: string; bill_date?: string; due_date?: string;
  is_void: number;
  items: { id: number; mat_name: string; qty: number; price_at_time: number; is_void?: number }[];
};

export default function Grn() {
  const { id } = useParams<{ id?: string }>();
  const { data, reload } = useApi<{
    grns: GrnRow[];
    suppliers: { id: number; name: string }[];
    materials: { id: number; name: string; code: string; unit_price: number }[];
    accounts: { id: number; name: string; category: string; bank_name?: string; account_holder_name?: string; account_number?: string }[];
    today?: string;
  }>("/grn");
  const [open, setOpen] = useState(Boolean(id));
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState<"expenses" | "tax" | "bill" | "comments">("expenses");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState("Credit");
  const [accountId, setAccountId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [search, setSearch] = useState("");
  const [selName, setSelName] = useState("");
  const [selPrice, setSelPrice] = useState("");
  const [selQty, setSelQty] = useState("1");
  const [lines, setLines] = useState<Item[]>([]);
  const [loadingCost, setLoadingCost] = useState("0");
  const [freight, setFreight] = useState("0");
  const [other, setOther] = useState("0");
  const [adj, setAdj] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [taxPct, setTaxPct] = useState("");
  const [taxAmt, setTaxAmt] = useState("");
  const [taxType, setTaxType] = useState("Asset");
  const [invNo, setInvNo] = useState("");
  const [manualBill, setManualBill] = useState("");
  const [billDate, setBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");
  const [bal, setBal] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [addSup, setAddSup] = useState(false);
  const [editId, setEditId] = useState<number | null>(id ? Number(id) : null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id || !data) return;
    const g = (data.grns || []).find((x) => x.id === Number(id));
    if (!g) return;
    fillFrom(g);
    setOpen(true);
    setStep(3);
  }, [id, data]);

  function fillFrom(g: GrnRow) {
    setEditId(g.id);
    setSupplierId(String(g.supplier_id || ""));
    setSupplierName(g.supplier || "");
    setDate(ymd(g.date_posted) || date);
    setPaymentType(g.payment_type || "Credit");
    setAccountId(String(g.payment_account_id || ""));
    setBankName(g.bank_name || "");
    setAccountName(g.account_name || "");
    setAccountNo(g.account_no || "");
    setLines((g.items || []).filter((i) => !i.is_void).map((i) => ({ name: i.mat_name, qty: String(i.qty), rate: String(i.price_at_time) })));
    setLoadingCost(String(g.loading_cost || 0));
    setFreight(String(g.freight_cost || 0));
    setOther(String(g.other_expense || 0));
    setAdj(String(g.adjustment_amount || 0));
    setDiscount(String(g.discount || 0));
    setTaxPct(String(g.tax_percent || ""));
    setTaxAmt(String(g.tax_amount || ""));
    setTaxType(g.tax_type || "Asset");
    setInvNo(g.supplier_invoice_no || "");
    setManualBill(g.manual_bill_no || "");
    setBillDate(g.bill_date || "");
    setDueDate(g.due_date || "");
    setPaid(String(g.paid_amount || ""));
    setNote(g.note || "");
  }

  async function pickSupplier(name: string, sid: string) {
    setSupplierName(name);
    setSupplierId(sid);
    if (sid) {
      try {
        const d = await api<{ balance: number }>(`/supplier_balance/${sid}`);
        setBal(d.balance);
      } catch { setBal(null); }
    }
  }

  function addLine() {
    if (!selName || Number(selQty) < 0) return alert("Please select an item and enter valid quantity.");
    setLines([...lines, { name: selName, qty: selQty, rate: selPrice }]);
    setSelName(""); setSelPrice(""); setSelQty("1"); setSearch("");
  }

  const itemTotal = lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.rate || 0), 0);
  const grand = Math.max(0, itemTotal - Number(discount || 0));

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const payload = {
      supplier_id: supplierId,
      supplier: supplierName,
      date,
      payment_type: paymentType,
      payment_account_id: accountId,
      bank_name: bankName,
      account_name: accountName,
      account_no: accountNo,
      items: lines,
      loading_cost: loadingCost,
      freight_cost: freight,
      other_expense: other,
      adjustment_amount: adj,
      discount,
      tax_percent: taxPct,
      tax_amount: taxAmt,
      tax_type: taxType,
      supplier_invoice_no: invNo,
      manual_bill_no: manualBill,
      bill_date: billDate,
      due_date: dueDate,
      paid_amount: paid,
      note
    };
    try {
      if (editId) await api(`/grn/${editId}`, { method: "POST", body: JSON.stringify(payload) });
      else await api("/grn", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setEditId(null);
      setLines([]);
      setStep(1);
      reload();
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  async function voidGrn(g: GrnRow) {
    if (!confirm("Are you sure you want to delete this GRN? This will reverse the stock addition.")) return;
    await api(`/grn/${g.id}/void`, { method: "POST" });
    reload();
  }

  const filtered = (data?.grns || []).filter((g) => {
    if (q && !`${g.supplier} ${g.auto_bill_no} ${g.manual_bill_no}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (start && ymd(g.date_posted) < start) return false;
    if (end && ymd(g.date_posted) > end) return false;
    return true;
  });
  const showPayAcc = paymentType === "Cash" || paymentType === "Bank Transfer";
  const showBank = paymentType === "Bank Transfer";
  const accs = (data?.accounts || []).filter((a) => {
    if (paymentType === "Cash") return a.category === "cash";
    if (paymentType === "Bank Transfer") return a.category === "bank";
    return true;
  });

  return (
    <div>
      <PageHeader icon="bi-box-arrow-in-down" title="GRN (Goods Receipt Note)" subtitle="3-step receiving wizard — posts stock IN immediately">
        <button className="btn btn-primary" onClick={() => { setOpen(!open); setEditId(null); setStep(1); }}><i className="bi bi-plus-lg" /> Add New Record</button>
      </PageHeader>
      {err && <div className="alert alert-danger">{err}</div>}

      {open && (
        <div className="card mb-4">
          <div className="card-header bg-primary text-white">{editId ? `Edit Record` : "Add New Record"}</div>
          <div className="card-body">
            <form onSubmit={save}>
              <div className="step-section">
                <h5 className="border-bottom pb-2">Step 1: Select Supplier and Mode of Payment</h5>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Supplier Name</label>
                    <div className="input-group">
                      <input className="form-control" list="grnSuppliers" required placeholder="Select or Type Supplier" value={supplierName} onChange={(e) => { setSupplierName(e.target.value); const s = (data?.suppliers || []).find((x) => x.name === e.target.value); if (s) pickSupplier(s.name, String(s.id)); }} />
                      <button type="button" className="btn btn-outline-primary" onClick={() => setAddSup(true)}><i className="bi bi-plus-lg" /></button>
                    </div>
                    <datalist id="grnSuppliers">{(data?.suppliers || []).map((s) => <option key={s.id} value={s.name} />)}</datalist>
                    {bal != null && (
                      <div className="mt-2">
                        {bal > 0 ? <span className="badge bg-danger">Payable: {bal.toFixed(2)}</span> : bal < 0 ? <span className="badge bg-success">Advance: {Math.abs(bal).toFixed(2)}</span> : <span className="badge bg-secondary">Settled: 0.00</span>}
                      </div>
                    )}
                  </div>
                  <div className="col-md-4"><label className="form-label">Date</label><input type="date" className="form-control" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div className="col-md-4">
                    <label className="form-label">Payment Type</label>
                    <select className="form-select" required value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                      <option>Credit</option><option>Cash</option><option>Bank Transfer</option>
                    </select>
                  </div>
                </div>
                {showPayAcc && (
                  <div className="row g-3 mt-2">
                    <div className="col-md-6">
                      <label className="form-label">Pay From Account</label>
                      <select className="form-select" value={accountId} onChange={(e) => {
                        setAccountId(e.target.value);
                        const a = accs.find((x) => String(x.id) === e.target.value);
                        if (a && paymentType === "Bank Transfer") {
                          setBankName(a.bank_name || "");
                          setAccountName(a.account_holder_name || a.name);
                          setAccountNo(a.account_number || "");
                        }
                      }}>
                        <option value="">— Select Cash/Bank Account —</option>
                        {accs.map((a) => <option key={a.id} value={a.id}>[{(a.category || "cash").toUpperCase()}] {a.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {showBank && (
                  <div className="row g-3 mt-2">
                    <div className="col-md-4"><label className="form-label">Bank Name</label><input className="form-control" value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
                    <div className="col-md-4"><label className="form-label">Account Holder Name</label><input className="form-control" value={accountName} onChange={(e) => setAccountName(e.target.value)} /></div>
                    <div className="col-md-4"><label className="form-label">Account Number</label><input className="form-control" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} /></div>
                  </div>
                )}
                {step === 1 && <div className="mt-3 text-end"><button type="button" className="btn btn-success" onClick={() => { if (!supplierName) return alert("Please fill all required fields."); setStep(2); }}>Next <i className="bi bi-arrow-down" /></button></div>}
              </div>

              {step >= 2 && (
                <div className="mt-4">
                  <h5 className="border-bottom pb-2">Step 2: Select Items for the Goods Receipt Note</h5>
                  <div className="input-group">
                    <span className="input-group-text"><i className="bi bi-search" /></span>
                    <input className="form-control" placeholder="Start typing or scanning item code..." value={search} list="grnMats" onChange={(e) => {
                      setSearch(e.target.value);
                      const m = (data?.materials || []).find((x) => x.name === e.target.value || x.code === e.target.value);
                      if (m) { setSelName(m.name); setSelPrice(String(m.unit_price || 0)); setSelQty("1"); setStep(3); }
                    }} />
                  </div>
                  <datalist id="grnMats">{(data?.materials || []).map((m) => <option key={m.id} value={m.name}>{m.code}</option>)}</datalist>
                </div>
              )}

              {step >= 3 && (
                <div className="mt-4">
                  <h5 className="border-bottom pb-2">Step 3: Enter Cost price & GRN quantity</h5>
                  <div className="row g-3 align-items-end mb-3 p-3 rounded grn-step3-highlight">
                    <div className="col-md-3"><label className="form-label">Selected Item</label><input className="form-control" readOnly value={selName} /></div>
                    <div className="col-md-2"><label className="form-label">Cost Price</label><input type="number" className="form-control" value={selPrice} onChange={(e) => setSelPrice(e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">Quantity</label><input type="number" className="form-control fw-bold" value={selQty} onChange={(e) => setSelQty(e.target.value)} /></div>
                    <div className="col-md-3">
                      <button type="button" className="btn btn-primary w-100" onClick={addLine}><i className="bi bi-plus-lg" /> Add</button>
                      <button type="button" className="btn btn-outline-primary w-100 mt-2" onClick={() => { setSelName(""); setSelPrice(""); setSelQty("1"); setSearch(""); }}>Reset</button>
                    </div>
                  </div>
                  <table className="table table-bordered" id="grnItemsTable">
                    <thead className="table-dark"><tr><th>Item</th><th>Quantity</th><th>Price</th><th>Total</th><th>Action</th></tr></thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={i}>
                          <td><input className="form-control form-control-sm" readOnly value={l.name} /></td>
                          <td><input type="number" className="form-control fw-bold" value={l.qty} onChange={(e) => { const n = [...lines]; n[i].qty = e.target.value; setLines(n); }} /></td>
                          <td><input type="number" className="form-control form-control-sm" value={l.rate} onChange={(e) => { const n = [...lines]; n[i].rate = e.target.value; setLines(n); }} /></td>
                          <td className="text-end fw-bold">{num(Number(l.qty || 0) * Number(l.rate || 0))}</td>
                          <td><button type="button" className="btn btn-danger btn-sm" onClick={() => setLines(lines.filter((_, j) => j !== i))}><i className="bi bi-trash" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="table-secondary fw-bold"><td colSpan={3} className="text-end">Total Amount:</td><td>{num(grand)}</td><td /></tr></tfoot>
                  </table>
                  <ul className="nav nav-tabs">
                    {(["expenses", "tax", "bill", "comments"] as const).map((t) => (
                      <li className="nav-item" key={t}><button type="button" className={`nav-link ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t === "expenses" ? "Expenses" : t === "tax" ? "Tax Details" : t === "bill" ? "Bill Details" : "Comments"}</button></li>
                    ))}
                  </ul>
                  <div className="p-3 border border-top-0 mb-3">
                    {tab === "expenses" && (
                      <div className="row g-3">
                        <div className="col-md-3"><label>Load Expense</label><input type="number" className="form-control" value={loadingCost} onChange={(e) => setLoadingCost(e.target.value)} /></div>
                        <div className="col-md-3"><label>Freight Expense</label><input type="number" className="form-control" value={freight} onChange={(e) => setFreight(e.target.value)} /></div>
                        <div className="col-md-3"><label>Other Expense</label><input type="number" className="form-control" value={other} onChange={(e) => setOther(e.target.value)} /></div>
                        <div className="col-md-3"><label>Adjustment Amount</label><input type="number" className="form-control" value={adj} onChange={(e) => setAdj(e.target.value)} /></div>
                        <div className="col-md-3"><label>Discount</label><input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
                      </div>
                    )}
                    {tab === "tax" && (
                      <div className="row g-3">
                        <div className="col-md-4"><label>Purchase Tax %</label><input type="number" className="form-control" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} /></div>
                        <div className="col-md-4"><label>Purchase Tax Amount</label><input type="number" className="form-control" value={taxAmt} onChange={(e) => setTaxAmt(e.target.value)} /></div>
                        <div className="col-md-4"><label>Purchase Tax Type</label><select className="form-select" value={taxType} onChange={(e) => setTaxType(e.target.value)}><option>Asset</option><option>Expense</option><option>Purchase(Adv Tax)</option></select></div>
                      </div>
                    )}
                    {tab === "bill" && (
                      <div className="row g-3">
                        <div className="col-md-3"><label>Supp Invoice No.</label><input className="form-control" value={invNo} onChange={(e) => setInvNo(e.target.value)} /></div>
                        <div className="col-md-3"><label>Bill No.</label><input className="form-control" value={manualBill} onChange={(e) => setManualBill(e.target.value)} /></div>
                        <div className="col-md-3"><label>Bill Date</label><input type="date" className="form-control" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></div>
                        <div className="col-md-3"><label>Due Date</label><input type="date" className="form-control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                        <div className="col-md-3"><label className="text-success fw-bold">Paid Amount</label><input type="number" className="form-control border-success" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
                      </div>
                    )}
                    {tab === "comments" && <div><label>Comments</label><textarea className="form-control" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>}
                  </div>
                  <div className="text-end"><button className="btn btn-primary btn-lg" type="submit"><i className="bi bi-save" /> Save GRN</button></div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>GRN Records</span>
          <div className="d-flex gap-2">
            <input type="date" className="form-control form-control-sm" value={start} onChange={(e) => setStart(e.target.value)} />
            <input type="date" className="form-control form-control-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
            <input className="form-control form-control-sm" placeholder="Search Supplier or Bill..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead><tr><th>GRN #</th><th>Date</th><th>Supplier</th><th>Items</th><th>Total Qty</th><th>Discount</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.auto_bill_no && <span className="badge bg-info text-dark me-1">{g.auto_bill_no}</span>}
                    {g.manual_bill_no && <span className="badge bg-warning text-dark">{g.manual_bill_no}</span>}
                  </td>
                  <td>{ymd(g.date_posted)}</td>
                  <td>{g.supplier}</td>
                  <td>{(g.items || []).filter((i) => !i.is_void).length}</td>
                  <td>{(g.items || []).reduce((a, i) => a + Number(i.qty || 0), 0)}</td>
                  <td>{Number(g.discount || 0).toFixed(2)}</td>
                  <td>
                    <Link to={`/view_bill/${encodeURIComponent(g.manual_bill_no || g.auto_bill_no)}?src=grn&src_id=${g.id}`} className="btn btn-sm btn-info me-1" title="View"><i className="bi bi-eye" /></Link>
                    <Link to={`/view_bill/${encodeURIComponent(g.manual_bill_no || g.auto_bill_no)}?src=grn&src_id=${g.id}&print=1`} className="btn btn-sm btn-secondary me-1" title="Print"><i className="bi bi-printer" /></Link>
                    <Link to={`/edit_grn/${g.id}`} className="btn btn-sm btn-warning me-1" title="Edit"><i className="bi bi-pencil" /></Link>
                    <button className="btn btn-sm btn-danger" onClick={() => voidGrn(g)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={addSup} title="Add New Supplier" onClose={() => setAddSup(false)} footer={<button form="addSupForm" className="btn btn-warning" type="submit">Save Supplier</button>}>
        <form id="addSupForm" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const r = await api<{ id: number }>("/suppliers", { method: "POST", body: JSON.stringify({ name: fd.get("name"), phone: fd.get("phone"), address: fd.get("address"), opening_balance: fd.get("opening_balance") }) });
          pickSupplier(String(fd.get("name")), String(r.id));
          setAddSup(false);
          reload();
        }}>
          <label className="form-label">Name</label><input name="name" className="form-control mb-2" required />
          <label className="form-label">Phone</label><input name="phone" className="form-control mb-2" />
          <label className="form-label">Address</label><input name="address" className="form-control mb-2" />
          <label className="form-label">Opening Balance</label><input name="opening_balance" type="number" step="0.01" className="form-control" defaultValue={0} />
        </form>
      </Modal>
    </div>
  );
}
