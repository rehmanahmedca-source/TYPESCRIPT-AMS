import { Link, useParams, useSearchParams } from "react-router-dom";
import { useApi } from "../useApi";
import { ymd } from "../format";

type Bill = {
  auto_bill_no?: string; manual_bill_no?: string; invoice_no?: string; date_posted?: string;
  client_name?: string; supplier_name?: string; amount?: number; paid_amount?: number; discount?: number; discount_reason?: string;
  method?: string; payment_type?: string; bank_name?: string; account_name?: string; account_no?: string;
  supplier_invoice_no?: string; driver_name?: string; note?: string;
};
type Item = { name?: string; material_name?: string; product_name?: string; mat_name?: string; qty: number; price_at_time: number };

function fmt(v: unknown) {
  const n = Number(v || 0);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export default function ViewBill() {
  const { billNo, type, id } = useParams<{ billNo?: string; type?: string; id?: string }>();
  const [sp] = useSearchParams();
  const src = sp.get("src") || "";
  const srcId = sp.get("src_id") || "";
  const print = sp.get("print") === "1";
  const path = type && id
    ? `/view_bill_detail/${type}/${id}`
    : `/view_bill/${encodeURIComponent(billNo || "")}?src=${encodeURIComponent(src)}&src_id=${encodeURIComponent(srcId)}`;
  const { data, error } = useApi<{
    type: string; bill: Bill; items: Item[]; client?: { name: string; code: string; address?: string; phone?: string };
    settings?: { company_name?: string; company_address?: string; company_phone?: string };
    previous_balance: number; transaction_type_label?: string;
  }>(path);

  if (error) return <div className="alert alert-danger m-4">{error}</div>;
  if (!data) return <div className="text-muted p-4">Opening bill…</div>;

  const bill = data.bill;
  const items = data.items || [];
  const typeName = data.type;
  const co = data.settings || {};
  const coName = co.company_name || "FAZAL BUILDING MATERIALS";
  const coAddr = co.company_address || "JALAL PUR SOBTIAN GUJRAT";
  const coPhone = co.company_phone || "+92331-0000993 | +92340-3872722";
  const docType = typeName === "Payment" ? "RECEIPT" : typeName === "MaterialReturn" ? "MATERIAL RETURN" : typeName === "GRN" ? "GOODS RECEIVED" : "INVOICE";
  const amt = Number(bill.amount || 0);
  const paid = Number(bill.paid_amount || 0);
  const disc = Number(bill.discount || 0);
  const prev = Number(data.previous_balance || 0);
  const pending = typeName === "GRN" ? amt - paid : amt - paid - disc;

  return (
    <div>
      <div className="card shadow-sm mx-auto border-0 d-print-none" style={{ maxWidth: 600, background: "#fff" }}>
        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Bill: {bill.manual_bill_no || bill.auto_bill_no || bill.invoice_no || "---"}</h5>
          <div className="d-flex gap-2">
            <button className="btn btn-warning btn-sm fw-bold text-dark" onClick={() => window.print()}><i className="bi bi-file-earmark-pdf" /> PDF</button>
            <button className="btn btn-success btn-sm fw-bold" onClick={() => window.print()}><i className="bi bi-printer" /> Print</button>
          </div>
        </div>
      </div>

      <div className="rcpt-wrapper mt-2">
        <div className="rcpt-header">
          <div>
            <div className="rcpt-co-name">{coName}</div>
            <div className="rcpt-co-sub">{coAddr}</div>
            <div className="rcpt-co-phone">{coPhone}</div>
          </div>
          <div className="rcpt-header-right">
            <div className="rcpt-doc-type">{docType}</div>
            {data.transaction_type_label && <div className="rcpt-tx-badge">{data.transaction_type_label}</div>}
            {bill.auto_bill_no && <div className="rcpt-doc-no">{bill.auto_bill_no}</div>}
            {bill.manual_bill_no && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>MB: {bill.manual_bill_no}</div>}
            <div className="rcpt-doc-date">{ymd(bill.date_posted)}</div>
          </div>
        </div>
        <div className="rcpt-body">
          <div className="rcpt-parties">
            <div>
              <div className="rcpt-party-label">{typeName === "GRN" ? "Supplier" : "Bill To"}</div>
              <div className="rcpt-party-name">{typeName === "GRN" ? (bill.supplier_name || "N/A") : (bill.client_name || data.client?.name || "N/A")}</div>
              {data.client?.code && <div className="rcpt-party-sub">Code: {data.client.code}</div>}
              {data.client?.address && <div className="rcpt-party-sub">{data.client.address}</div>}
              {data.client?.phone && <div className="rcpt-party-sub">{data.client.phone}</div>}
            </div>
          </div>
          {(bill.method || bill.payment_type || bill.bank_name || bill.note) && (
            <>
              <div className="rcpt-section-title">Transaction Details</div>
              <div className="rcpt-detail-box">
                {bill.method && <div className="rcpt-detail-row"><span className="rcpt-detail-label">Method</span><span className="rcpt-detail-val">{bill.method}</span></div>}
                {bill.payment_type && <div className="rcpt-detail-row"><span className="rcpt-detail-label">Payment Type</span><span className="rcpt-detail-val">{bill.payment_type}</span></div>}
                {bill.bank_name && <div className="rcpt-detail-row"><span className="rcpt-detail-label">Bank</span><span className="rcpt-detail-val">{bill.bank_name}</span></div>}
                {bill.driver_name && <div className="rcpt-detail-row"><span className="rcpt-detail-label">Delivery Person</span><span className="rcpt-detail-val">{bill.driver_name}</span></div>}
                {bill.note && <div className="rcpt-detail-row"><span className="rcpt-detail-label">Notes</span><span className="rcpt-detail-val">{bill.note}</span></div>}
              </div>
            </>
          )}
          <div className="rcpt-section-title">Items</div>
          <table className="rcpt-table">
            <thead><tr><th className="text-start">Description / Material</th><th className="text-end">Qty</th><th className="text-end">Rate</th><th className="text-end">Amount</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="text-start">{it.name || it.material_name || it.product_name || it.mat_name}</td>
                  <td className="text-end">{fmt(it.qty)}</td>
                  <td className="text-end">{fmt(it.price_at_time)}</td>
                  <td className="text-end">{fmt(Number(it.qty || 0) * Number(it.price_at_time || 0))}</td>
                </tr>
              ))}
              {!items.length && typeName === "Payment" && (
                <tr><td colSpan={4} className="text-center" style={{ fontStyle: "italic" }}>Payment Received{bill.method ? ` via ${bill.method}` : ""}</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="text-end">Current Bill Total:</td><td className="text-end">{fmt(amt)}</td></tr>
              {typeName === "DirectSale" && <tr><td colSpan={3} className="text-end">Previous Balance:</td><td className="text-end">{fmt(prev)}</td></tr>}
              {disc > 0 && <tr><td colSpan={3} className="text-end">Discount{bill.discount_reason ? `: ${bill.discount_reason}` : ""}:</td><td className="text-end">{fmt(disc)}</td></tr>}
              {["Booking", "DirectSale", "Invoice", "GRN"].includes(typeName) && (
                <>
                  <tr><td colSpan={3} className="text-end">Paid Amount:</td><td className="text-end">{fmt(paid)}</td></tr>
                  <tr><td colSpan={3} className="text-end">Bill Pending:</td><td className="text-end">{fmt(pending)}</td></tr>
                </>
              )}
            </tfoot>
          </table>
        </div>
        <div className="rcpt-footer">
          <div className="rcpt-sig-row">
            <div className="rcpt-sig-block"><div className="rcpt-sig-label">Receiver / Authorized Sign</div><div className="rcpt-sig-sub">(Sign Here)</div></div>
            <div className="rcpt-sig-block right-align"><div className="rcpt-sig-label">Company Stamp</div><div className="rcpt-sig-sub">(Stamp Here)</div></div>
          </div>
          <div className="rcpt-credits">Thank you for your business! &nbsp;•&nbsp; Software by AMS SYSTEM FOR EASE</div>
        </div>
      </div>

      <div className="text-center mt-3 mb-4 d-print-none">
        <Link to=".." className="btn btn-dark fw-bold me-2" onClick={(e) => { e.preventDefault(); history.back(); }}>Go Back</Link>
        <button className="btn btn-success fw-bold" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</button>
      </div>
      {print && <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 150); });" }} />}
    </div>
  );
}
