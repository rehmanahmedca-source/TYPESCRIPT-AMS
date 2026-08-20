import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

type Entry = {
  id: number;
  date: string;
  time: string;
  type: string;
  client: string;
  client_code: string;
  material: string;
  qty: number;
  auto_bill_no: string;
  bill_no: string;
  nimbus_no: string;
  unit_rate?: number;
  created_by: string;
  is_void: number;
  source_type?: string;
};

export default function History() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [client, setClient] = useState("");
  const [material, setMaterial] = useState("");
  const [bill, setBill] = useState("");
  const [applied, setApplied] = useState("");
  const qs = applied;
  const { data, reload } = useApi<{
    entries: Entry[];
    total_qty: number;
    pagination: { page: number; pages: number; total: number };
    clients: { code: string; name: string }[];
    materials: { name: string }[];
  }>(qs ? `/history?${qs}` : "/history?idle=1");
  const [edit, setEdit] = useState<Entry | null>(null);

  function apply(e: FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (from) p.set("start_date", from);
    if (to) p.set("end_date", to);
    if (type) p.set("type", type);
    if (client) p.set("client", client);
    if (material) p.set("material", material);
    if (bill) p.set("bill_no", bill);
    setApplied(p.toString() || "filtered=1");
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;
    const fd = new FormData(e.currentTarget);
    await api(`/history/entries/${edit.id}`, { method: "POST", body: JSON.stringify(Object.fromEntries(fd.entries())) });
    setEdit(null);
    reload();
  }

  async function voidRow(row: Entry) {
    if (!confirm("Permanently delete this transaction?")) return;
    const kind = row.source_type === "Payment" || row.type === "PAYMENT" ? "Payment" : "Entry";
    await api(`/daily/transactions/${kind.toLowerCase()}/${row.id}/void`, { method: "POST" });
    reload();
  }

  const filtered = Boolean(applied);

  return (
    <div>
      <PageHeader icon="bi-clock-history" title="History & Search" subtitle={filtered ? `Filtered: ${data?.pagination?.total ?? 0}` : "Search stock movements, bookings and payments"}>
        <Link to="/" className="btn btn-outline-secondary btn-sm"><i className="bi bi-arrow-left me-1" /> Back</Link>
      </PageHeader>
      <Card title="Advanced Filter">
        <form className="row g-3 align-items-end" onSubmit={apply}>
          <div className="col-6 col-md-2"><label className="ui-label">From</label><input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="col-6 col-md-2"><label className="ui-label">To</label><input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="col-6 col-md-2">
            <label className="ui-label">Type</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="IN">IN (Receiving)</option>
              <option value="OUT">OUT (Dispatch)</option>
              <option value="BOOKING">BOOKING (Reserved)</option>
              <option value="PAYMENT">PAYMENT</option>
            </select>
          </div>
          <div className="col-6 col-md-3"><label className="ui-label">Client</label><input className="form-control" placeholder="Type to filter..." value={client} onChange={(e) => setClient(e.target.value)} list="histClients" /></div>
          <datalist id="histClients">{(data?.clients || []).map((c) => <option key={c.code} value={c.name} />)}</datalist>
          <div className="col-6 col-md-3"><label className="ui-label">Material</label><input className="form-control" placeholder="Type material..." value={material} onChange={(e) => setMaterial(e.target.value)} list="histMats" /></div>
          <datalist id="histMats">{(data?.materials || []).map((m) => <option key={m.name} value={m.name} />)}</datalist>
          <div className="col-6 col-md-2"><label className="ui-label">Bill No</label><input className="form-control" placeholder="Search Bill No..." value={bill} onChange={(e) => setBill(e.target.value)} /></div>
          <div className="col-12 col-md-2"><button className="btn btn-primary w-100 fw-bold">Filter</button></div>
        </form>
      </Card>
      {!filtered ? (
        <Card>
          <div className="text-center py-5">
            <i className="bi bi-search display-1 text-warning mb-3" />
            <h4 className="fw-bold mb-3">Search Entries</h4>
            <p className="text-muted mb-0">Use the filter options above to find transactions.</p>
            <p className="text-muted">Select a date range, client, material, or use the search box.</p>
          </div>
        </Card>
      ) : (
        <Card extra={<span className="text-muted small">TOTAL BAGS: <b>{data?.total_qty || 0}</b></span>} flush>
          <div className="table-responsive">
            <table className="ui-table mb-0">
              <thead>
                <tr>
                  <th>Date</th><th>Time</th><th>Type</th><th>Client</th><th>Code</th><th>Material</th>
                  <th>Qty</th><th>Auto Bill</th><th>Manual Bill</th><th>Nimbus No</th><th>Unit Rate</th><th>By</th><th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.entries || []).map((e) => (
                  <tr key={`${e.type}-${e.id}`} className={e.is_void ? "opacity-50" : ""}>
                    <td className="fw-bold text-warning">{e.date || ymd(e.date)}</td>
                    <td>{e.time || "—"}</td>
                    <td>
                      {e.is_void ? <span className="badge bg-danger">DELETED</span> : (
                        <span className={`badge rounded-pill ${e.type === "IN" ? "bg-success" : e.type === "OUT" ? "bg-info text-dark" : e.type === "PAYMENT" ? "bg-primary" : "bg-warning text-dark"}`}>{e.type}</span>
                      )}
                    </td>
                    <td className="fw-bold">{e.client || "---"}</td>
                    <td>{e.client_code || "---"}</td>
                    <td className="text-warning fw-bold">{e.material || "---"}</td>
                    <td className="fw-bold">{e.type === "PAYMENT" ? money(e.qty) : `${e.type === "IN" ? "+" : "-"}${Number(e.qty || 0)}`}</td>
                    <td>{e.auto_bill_no || "---"}</td>
                    <td>{e.bill_no || "---"}</td>
                    <td>{e.nimbus_no || "---"}</td>
                    <td>{e.unit_rate ? money(e.unit_rate) : "---"}</td>
                    <td>{e.created_by || "System"}</td>
                    <td className="text-end">
                      {!e.is_void && e.type !== "BOOKING" && e.type !== "PAYMENT" && (
                        <button className="btn btn-warning btn-sm text-dark me-1" onClick={() => setEdit(e)}>Edit</button>
                      )}
                      {!e.is_void && <button className="btn btn-outline-danger btn-sm" onClick={() => voidRow(e)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Modal open={!!edit} title="Edit Entry" onClose={() => setEdit(null)} footer={<button form="histEdit" className="btn btn-warning" type="submit">Update Record</button>}>
        {edit && (
          <form id="histEdit" onSubmit={saveEdit}>
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label">Date</label><input name="date" type="date" className="form-control" defaultValue={edit.date} /></div>
              <div className="col-md-4"><label className="form-label">Time</label><input name="time" type="time" className="form-control" defaultValue={edit.time} /></div>
              <div className="col-md-4">
                <label className="form-label">Type</label>
                <select name="type" className="form-select" defaultValue={edit.type}>
                  <option value="IN">IN (Receiving)</option>
                  <option value="OUT">OUT (Dispatch)</option>
                </select>
              </div>
              <div className="col-md-6"><label className="form-label">Material Brand</label><input name="material" className="form-control" defaultValue={edit.material} /></div>
              <div className="col-md-6"><label className="form-label">Client</label><input name="client" className="form-control" defaultValue={edit.client_code || edit.client} /></div>
              <div className="col-md-4"><label className="form-label">Quantity</label><input name="qty" type="number" className="form-control" defaultValue={edit.qty} /></div>
              <div className="col-md-4"><label className="form-label">Bill No</label><input name="bill_no" className="form-control" defaultValue={edit.bill_no} /></div>
              <div className="col-md-4"><label className="form-label">Nimbus No</label><input name="nimbus_no" className="form-control" defaultValue={edit.nimbus_no} /></div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
