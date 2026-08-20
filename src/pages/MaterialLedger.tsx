import { useParams } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

export default function MaterialLedger() {
  const { id } = useParams<{ id: string }>();
  const { data } = useApi<{
    material: { id: number; name: string; code: string; unit: string; unit_price: number; category_name: string };
    entries: { id: number; date: string; type: string; qty: number; material: string; client: string; bill_no: string; source_module: string; source_table: string }[];
    opening: number;
    closing: number;
    totalIn: number;
    totalOut: number;
  }>(`/materials/${id}/ledger`);

  const m = data?.material;
  const entries = data?.entries || [];

  return (
    <div>
      <PageHeader icon="bi-journal-text" title={`Material Ledger: ${m?.name || ""}`} subtitle={`${m?.category_name || ""} · ${m?.code || ""}`} />
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-green"><div className="ui-tile-label">Total In</div><div className="ui-tile-value text-success">{num(data?.totalIn)} {m?.unit}</div></div>
        <div className="ui-tile border-red"><div className="ui-tile-label">Total Out</div><div className="ui-tile-value text-danger">{num(data?.totalOut)} {m?.unit}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Net Stock</div><div className="ui-tile-value">{num(data?.closing)} {m?.unit}</div></div>
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Rate</div><div className="ui-tile-value">{money(m?.unit_price || 0)}</div></div>
      </div>
      <Card title={`Movement Ledger — ${entries.length} entries`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Type</th><th>Material</th><th className="text-end">Qty</th><th>Party</th><th>Bill</th><th>Source</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{ymd(e.date)}</td>
                <td><span className={`badge ${e.type === "IN" ? "bg-success" : "bg-danger"}`}>{e.type}</span></td>
                <td>{e.material}</td>
                <td className="text-end fw-bold">{num(e.qty)}</td>
                <td>{e.client || "—"}</td>
                <td className="text-warning">{e.bill_no}</td>
                <td><small className="text-muted">{e.source_module || e.source_table || "—"}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
