import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { rs, ymd } from "../format";
import { useApi } from "../useApi";

export default function Expenditures() {
  const { data } = useApi<{ rows: { id: number; date_posted: string; transaction_type: string; amount: number; description: string; from_name: string; note: string }[]; total: number }>("/accounts/expenditures");
  return (
    <div>
      <PageHeader icon="bi-wallet2" title="Expenditures" subtitle="Personal & operating expenses">
        <Link to="/accounts" className="btn btn-outline-secondary btn-sm">Accounts</Link>
      </PageHeader>
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-rose"><div className="ui-tile-label">Total</div><div className="ui-tile-value">{rs(data?.total)}</div></div>
      </div>
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Category</th><th>From</th><th>Note</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.id}>
                <td>{ymd(r.date_posted)}</td>
                <td>{r.transaction_type}</td>
                <td>{r.from_name || "—"}</td>
                <td>{r.note || r.description}</td>
                <td className="text-end text-danger fw-bold">{rs(r.amount)}</td>
              </tr>
            ))}
            {!(data?.rows || []).length && <tr><td colSpan={5} className="text-center text-muted py-4">No expenditures.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
