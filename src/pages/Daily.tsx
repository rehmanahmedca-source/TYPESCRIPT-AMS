import { useState } from "react";
import { PageHeader, Card } from "../components/ui";
import { num, ymd } from "../format";
import { useApi } from "../useApi";

export default function Daily() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data } = useApi<{ entries: { id: number; time: string; type: string; material: string; client: string; qty: number; bill_no: string; transaction_type: string }[] }>(`/daily?date=${date}`);
  return (
    <div>
      <PageHeader icon="bi-list-check" title="Daily Breakdown" subtitle="Stock movements from the entry table">
        <input type="date" className="form-control" style={{ width: 180 }} value={date} onChange={(e) => setDate(e.target.value)} />
      </PageHeader>
      <Card title={`Entries for ${ymd(date)}`} flush>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead><tr><th>Time</th><th>Type</th><th>Material</th><th>Party</th><th className="text-end">Qty</th><th>Bill</th><th>Source</th></tr></thead>
            <tbody>
              {(data?.entries || []).map((e) => (
                <tr key={e.id}>
                  <td>{e.time}</td>
                  <td className={e.type === "IN" ? "text-success fw-bold" : "text-danger fw-bold"}>{e.type}</td>
                  <td>{e.material}</td>
                  <td>{e.client}</td>
                  <td className="text-end">{num(e.qty)}</td>
                  <td>{e.bill_no}</td>
                  <td>{e.transaction_type}</td>
                </tr>
              ))}
              {!(data?.entries || []).length && <tr><td colSpan={7} className="ui-empty">No movements this day</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
