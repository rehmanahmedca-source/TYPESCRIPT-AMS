import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

export default function Dispatch() {
  const { data, reload } = useApi<{
    sales: { id: number; client_name: string; auto_bill_no: string; date_posted: string; driver_name: string; amount: number; items: { product_name: string; qty: number }[] }[];
    entries: { id: number; date: string; client: string; material: string; qty: number; bill_no: string; auto_bill_no: string }[];
    drivers: { name: string }[];
    clients?: { id: number; name: string; code: string }[];
    materials?: { id: number; name: string }[];
  }>("/dispatch");
  const clientsApi = useApi<{ clients: { id: number; name: string; code: string }[] }>(data?.clients ? null : "/clients");
  const matsApi = useApi<{ materials: { id: number; name: string }[] }>(data?.materials ? null : "/materials");
  const [err, setErr] = useState("");
  const [hasBill, setHasBill] = useState(true);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    try {
      await api("/dispatch", {
        method: "POST",
        body: JSON.stringify({
          type: "OUT",
          client: fd.get("client"),
          material: fd.get("material"),
          qty: fd.get("qty"),
          bill_no: fd.get("bill_no"),
          has_bill: hasBill,
          create_invoice: fd.get("create_invoice") === "1",
          track_as_cash: fd.get("track_as_cash") === "on",
          nimbus_no: fd.get("nimbus_no"),
          date: fd.get("date")
        })
      });
      e.currentTarget.reset();
      reload();
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  const clients = data?.clients || clientsApi.data?.clients || [];
  const materials = data?.materials || matsApi.data?.materials || [];

  return (
    <div>
      <PageHeader icon="bi-truck" title="Booking Delivery (Dispatch)" subtitle="Dispatch stock against existing client bookings." />
      <div className="row justify-content-center">
        <div className="col-md-7">
          <Card>
            {err && <div className="alert alert-danger py-2">{err}</div>}
            <form onSubmit={submit}>
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="ui-label">Client (Name or Code)</label>
                  <input name="client" className="form-control" list="dispClients" required placeholder="Search by name or code..." />
                  <datalist id="dispClients">{clients.map((c) => <option key={c.id} value={c.name}>{c.code}</option>)}</datalist>
                </div>
                <div className="col-md-6">
                  <label className="ui-label">Material Brand</label>
                  <input name="material" className="form-control" list="dispMats" required placeholder="Type brand name..." />
                  <datalist id="dispMats">{materials.map((m) => <option key={m.id} value={m.name} />)}</datalist>
                </div>
                <div className="col-md-6"><label className="ui-label">Quantity (Bags)</label><input type="number" name="qty" className="form-control fw-bold" required /></div>
                <div className="col-md-6">
                  <label className="ui-label">Bill / Invoice No.</label>
                  <div className="input-group">
                    <input name="bill_no" className="form-control" placeholder="Optional" readOnly={!hasBill} />
                    <span className="input-group-text">
                      <label className="mb-0 small"><input type="checkbox" className="form-check-input me-1" checked={hasBill} onChange={(e) => setHasBill(e.target.checked)} /> Has Bill</label>
                    </span>
                  </div>
                </div>
                <div className="col-12">
                  <label className="me-3"><input type="checkbox" name="create_invoice" value="1" className="form-check-input me-1" /> Create Invoice</label>
                  <label><input type="checkbox" name="track_as_cash" className="form-check-input me-1" /> Record as Cash Delivery (Track in Pending Bills)</label>
                </div>
                <div className="col-12"><label className="ui-label">Nimbus Number</label><input name="nimbus_no" className="form-control" /></div>
                <div className="col-12 d-flex gap-2">
                  <Link to="/tracking?type=OUT&has_bill=1" className="btn btn-outline-info btn-sm">View Billed Dispatches</Link>
                  <Link to="/tracking?type=OUT&has_bill=0" className="btn btn-outline-warning btn-sm">View Cash Dispatches</Link>
                </div>
                <div className="col-12 d-flex justify-content-between">
                  <span className="small text-muted">Dispatch Date:</span>
                  <input type="date" name="date" className="form-control" style={{ width: "auto" }} defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="col-12 d-flex gap-2">
                  <button type="reset" className="btn btn-outline-secondary w-50 rounded-pill fw-bold">Reset</button>
                  <button type="submit" className="btn btn-info text-dark w-50 rounded-pill fw-bold"><i className="bi bi-send-check me-2" /> Confirm</button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      </div>
      <Card title="Recent outbound" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Client</th><th>Driver</th><th>Load</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {(data?.sales || []).map((s) => (
              <tr key={s.id}>
                <td className="text-warning">{s.auto_bill_no}</td>
                <td>{ymd(s.date_posted)}</td>
                <td>{s.client_name}</td>
                <td>{s.driver_name || "Self"}</td>
                <td>{(s.items || []).map((i) => `${i.product_name} × ${num(i.qty)}`).join(", ")}</td>
                <td className="text-end">{money(s.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
