import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money, num } from "../format";
import { useApi } from "../useApi";

type Row = {
  client: { id: number; name: string; code: string; category: string };
  financial: { balance: number };
  materials: { name: string; booked: number; dispatched: number; remaining: number; unit_price: number; booked_cost: number; dispatched_cost: number; remaining_cost: number }[];
  material_totals: { total_remaining_qty: number; total_reserved_cost: number };
};

export default function DecisionLedger() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [balance, setBalance] = useState("all");
  const qs = `q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&balance=${balance}`;
  const { data } = useApi<{
    data: Row[];
    overall_material_summary: { name: string; booked: number; dispatched: number; remaining: number }[];
    overall_remaining_total: number;
    total: number;
    page: number;
    total_pages: number;
    categories: string[];
  }>(`/decision-ledger?${qs}`);

  return (
    <div>
      <PageHeader icon="bi-clipboard-data" title="Decision Ledger" subtitle="Consolidated view of all client financials and material status" />
      <Card title="Overall Material Summary" flush>
        <div className="table-responsive">
          <table className="ui-table mb-0 text-center">
            <thead>
              <tr>
                <th className="text-start">Metric</th>
                {(data?.overall_material_summary || []).map((m) => <th key={m.name}>{m.name}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-start fw-bold">Total Booked</td>
                {(data?.overall_material_summary || []).map((m) => <td key={m.name}>{num(m.booked)}</td>)}
              </tr>
              <tr>
                <td className="text-start fw-bold">Total Dispatched</td>
                {(data?.overall_material_summary || []).map((m) => <td key={m.name}>{num(m.dispatched)}</td>)}
              </tr>
              <tr>
                <td className="text-start fw-bold">Total Remaining</td>
                {(data?.overall_material_summary || []).map((m) => <td key={m.name} className="text-danger">{num(m.remaining)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Client Financials & Material Status">
        <div className="row g-3 mb-3">
          <div className="col-md-4"><input className="form-control" placeholder="Name or code..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="col-md-3">
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {(data?.categories || []).map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" value={balance} onChange={(e) => setBalance(e.target.value)}>
              <option value="all">All</option>
              <option value="debit">Due (Owed)</option>
              <option value="credit">Advance (Paid Extra)</option>
              <option value="zero">Settled</option>
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead><tr><th>Client</th><th>Category</th><th className="text-end">Pending</th><th>Material Status (Booked / Disp / Rem)</th><th className="text-end">Action</th></tr></thead>
            <tbody>
              {(data?.data || []).map((row) => (
                <tr key={row.client.id}>
                  <td>
                    <div className="fw-bold">{row.client.name}</div>
                    <div className="small text-muted">{row.client.code}</div>
                  </td>
                  <td><span className="badge bg-secondary">{row.client.category}</span></td>
                  <td className={`text-end fw-bold ${row.financial.balance > 0 ? "text-danger" : "text-success"}`}>{money(row.financial.balance)}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      {(row.materials || []).map((m) => (
                        <div key={m.name} className="badge bg-dark border text-start p-2">
                          <div className="text-warning fw-bold">{m.name}</div>
                          <div>B:{num(m.booked)} D:{num(m.dispatched)} R:{num(m.remaining)}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="text-end">
                    <Link to={`/clients/${row.client.id}`} className="btn btn-sm btn-outline-info rounded-pill">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
