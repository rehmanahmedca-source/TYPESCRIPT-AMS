import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { rs, ymd } from "../format";
import { useApi } from "../useApi";

export default function Reconciliations() {
  const { data } = useApi<{ rows: { id: number; account_name?: string; reconciliation_date: string; expected_balance: number; actual_balance: number; difference: number; status: string }[] }>("/accounts/reconciliations");
  return (
    <div>
      <PageHeader icon="bi-clipboard-check" title="Account Reconciliations" subtitle="History of account reconciliation snapshots">
        <Link to="/accounts" className="btn btn-outline-secondary btn-sm">Accounts</Link>
      </PageHeader>
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Account</th><th className="text-end">Expected</th><th className="text-end">Actual</th><th className="text-end">Difference</th><th>Status</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.id}>
                <td>{ymd(r.reconciliation_date)}</td>
                <td>{r.account_name || "—"}</td>
                <td className="text-end">{rs(r.expected_balance)}</td>
                <td className="text-end">{rs(r.actual_balance)}</td>
                <td className="text-end">{rs(r.difference)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {!(data?.rows || []).length && <tr><td colSpan={6} className="text-center text-muted py-4">No reconciliations yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
