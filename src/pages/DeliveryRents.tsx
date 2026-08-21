import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Modal } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

type Row = {
  id: number; created_at?: string; sale_date?: string; driver_name: string; client_name: string;
  bags_delivered: number; rent_amount: number; paid_total: number; due_total: number;
  auto_bill_no?: string; manual_bill_no?: string;
};

export default function DeliveryRents() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [driver, setDriver] = useState("");
  const q = [`date_from=${from}`, `date_to=${to}`, `driver=${encodeURIComponent(driver)}`].filter((x) => !x.endsWith("=")).join("&");
  const { data, reload } = useApi<{
    rows: Row[]; drivers: { id: number; name: string }[]; accounts: { id: number; name: string; category: string; balance: number }[];
    total_rent: number; total_paid: number; total_waived: number; total_due: number; totals_by_driver: { name: string; amt: number }[];
  }>(`/delivery-rents${q ? `?${q}` : ""}`);
  const [pay, setPay] = useState<Row | null>(null);

  async function savePay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pay) return;
    const fd = new FormData(e.currentTarget);
    await api(`/delivery-rents/${pay.id}/pay`, {
      method: "POST",
      body: JSON.stringify({
        paid_amount: fd.get("paid_amount"),
        waive_off_amount: fd.get("waive_off_amount"),
        method: fd.get("method"),
        payment_account_id: fd.get("payment_account_id"),
        date: fd.get("date"),
        reference: fd.get("reference"),
        note: fd.get("note")
      })
    });
    setPay(null);
    reload();
  }

  const methodWant = (m: string) => (m === "Cash" ? "cash" : "bank");

  return (
    <div>
      <PageHeader icon="bi-truck" title="Delivery Person Rent" subtitle="Bill-linked driver rent, payments and waive-offs">
        <Link to="/direct_sales" className="btn btn-outline-light btn-sm fw-bold"><i className="bi bi-arrow-left me-1" /> Sales</Link>
      </PageHeader>
      <div className="ui-card mb-4">
        <div className="ui-card-body">
          <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); reload(); }}>
            <div className="col-md-3"><label className="ui-label">FROM DATE</label><input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="col-md-3"><label className="ui-label">TO DATE</label><input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="col-md-3">
              <label className="ui-label">DELIVERY PERSON</label>
              <select className="form-select" value={driver} onChange={(e) => setDriver(e.target.value)}>
                <option value="">All Drivers</option>
                {(data?.drivers || []).map((d) => <option key={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-md-2 d-grid"><button className="btn btn-warning text-dark fw-bold">Apply</button></div>
          </form>
        </div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-md-6"><div className="ui-card"><div className="ui-card-body text-center"><div className="small text-muted">Total Bill-Linked Rent</div><div className="text-warning fw-bold fs-4">{money(data?.total_rent)}</div></div></div></div>
        <div className="col-md-6"><div className="ui-card"><div className="ui-card-body"><div className="small text-muted mb-2">By Driver</div>{(data?.totals_by_driver || []).map((t) => <div className="d-flex justify-content-between" key={t.name}><span className="text-info">{t.name}</span><span className="text-warning fw-bold">{money(t.amt)}</span></div>)}</div></div></div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-md-4"><div className="ui-card"><div className="ui-card-body text-center"><div className="small text-muted">Total Paid</div><div className="text-success fw-bold fs-4">{money(data?.total_paid)}</div></div></div></div>
        <div className="col-md-4"><div className="ui-card"><div className="ui-card-body text-center"><div className="small text-muted">Total Waive-Off (Profit)</div><div className="text-info fw-bold fs-4">{money(data?.total_waived)}</div></div></div></div>
        <div className="col-md-4"><div className="ui-card"><div className="ui-card-body text-center"><div className="small text-muted">Total Due</div><div className="text-danger fw-bold fs-4">{money(data?.total_due)}</div></div></div></div>
      </div>
      <div className="ui-card">
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Bill</th><th>Driver</th><th>Client</th><th>Bags</th><th>Rent</th><th>Paid</th><th>Due</th><th className="text-end">Action</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.id}>
                <td>{ymd(r.created_at || r.sale_date)}</td>
                <td>{r.manual_bill_no || r.auto_bill_no || "—"}</td>
                <td className="text-info fw-bold">{r.driver_name}</td>
                <td>{r.client_name}</td>
                <td>{r.bags_delivered || 0}</td>
                <td className="text-warning fw-bold">{money(r.rent_amount)}</td>
                <td className="text-success fw-bold">{money(r.paid_total)}</td>
                <td className="text-danger fw-bold">{money(r.due_total)}</td>
                <td className="text-end">
                  <button className="btn btn-outline-success btn-sm me-1" onClick={() => setPay(r)}>Pay Now</button>
                  <button className="btn btn-outline-danger btn-sm" onClick={async () => { if (!confirm("Permanently delete this rent entry?")) return; await api(`/delivery-rents/${r.id}/void`, { method: "POST" }); reload(); }}>Delete</button>
                </td>
              </tr>
            ))}
            {!data?.rows?.length && <tr><td colSpan={9} className="text-center py-4 text-muted">No delivery rent entries found.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={!!pay} title="Pay Delivery Rent" onClose={() => setPay(null)} footer={<button form="payRent" className="btn btn-warning text-dark fw-bold w-100" type="submit">Save Payment</button>}>
        {pay && (
          <form id="payRent" onSubmit={savePay}>
            <div className="mb-2 small">Driver: <span className="text-info">{pay.driver_name}</span></div>
            <div className="mb-2 small">Bill: {pay.manual_bill_no || pay.auto_bill_no}</div>
            <div className="mb-3 small">Due Now: <span className="text-danger fw-bold">{money(pay.due_total)}</span></div>
            <div className="row g-2">
              <div className="col-6"><label className="ui-label">PAID AMOUNT</label><input type="number" step="any" min="0" name="paid_amount" className="form-control" defaultValue={0} /></div>
              <div className="col-6"><label className="ui-label">WAIVE-OFF (PROFIT)</label><input type="number" step="any" min="0" name="waive_off_amount" className="form-control" defaultValue={0} /></div>
              <div className="col-6">
                <label className="ui-label">PAYMENT METHOD</label>
                <select name="method" className="form-select" id="rentMethod"><option>Cash</option><option>Bank</option><option>Check</option><option>Online</option></select>
              </div>
              <div className="col-6">
                <label className="ui-label">PAY FROM ACCOUNT</label>
                <select name="payment_account_id" className="form-select">
                  <option value="">Select account…</option>
                  {(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>[{(a.category || "cash").toUpperCase()}] {a.name} ({money(a.balance)})</option>)}
                </select>
              </div>
              <div className="col-12"><label className="ui-label">DATE</label><input type="date" name="date" className="form-control" /></div>
              <div className="col-12"><label className="ui-label">REFERENCE</label><input name="reference" className="form-control" /></div>
              <div className="col-12"><label className="ui-label">NOTE</label><input name="note" className="form-control" /></div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
