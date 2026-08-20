import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { rs, ymd } from "../format";
import { useApi } from "../useApi";

export default function AccountTransfers() {
  const { data } = useApi<{ rows: { id: number; date_posted: string; amount: number; description: string; from_name: string; to_name: string; is_void: number }[] }>("/accounts/transfers");
  return (
    <div>
      <PageHeader icon="bi-arrow-left-right" title="Account Transfers" subtitle="Inter-account transfers">
        <Link to="/accounts" className="btn btn-outline-secondary btn-sm">Accounts</Link>
        <Link to="/accounts/transfers/add" className="btn btn-warning btn-sm fw-bold">New Transfer</Link>
      </PageHeader>
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>From</th><th>To</th><th>Description</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.id} className={r.is_void ? "opacity-50" : ""}>
                <td>{ymd(r.date_posted)}</td>
                <td>{r.from_name}</td>
                <td>{r.to_name}</td>
                <td>{r.description}</td>
                <td className="text-end">{rs(r.amount)}</td>
              </tr>
            ))}
            {!(data?.rows || []).length && <tr><td colSpan={5} className="text-center text-muted py-4">No transfers.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
