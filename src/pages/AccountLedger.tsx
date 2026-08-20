import { useParams, Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function AccountLedger() {
  const { id } = useParams<{ id: string }>();
  const { data } = useApi<{
    account: { id: number; name: string; category: string; account_type: string; opening_balance: number; balance: number };
    transactions: { id: number; date_posted: string; transaction_type: string; amount: number; description: string; from_name: string; to_name: string; is_void: number }[];
    opening: number;
    closing: number;
    totalIn: number;
    totalOut: number;
  }>(`/accounts/${id}/ledger`);

  const acc = data?.account;
  const txs = data?.transactions || [];

  return (
    <div>
      <PageHeader icon="bi-journal-check" title={`Account Ledger: ${acc?.name || ""}`} subtitle={`${acc?.category || ""} · ${acc?.account_type || ""}`}>
        <Link to="/accounts" className="btn btn-outline-secondary btn-pill">← Back to Accounts</Link>
      </PageHeader>
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Opening Balance</div><div className="ui-tile-value">{money(data?.opening)}</div></div>
        <div className="ui-tile border-green"><div className="ui-tile-label">Total In</div><div className="ui-tile-value text-success">{money(data?.totalIn)}</div></div>
        <div className="ui-tile border-red"><div className="ui-tile-label">Total Out</div><div className="ui-tile-value text-danger">{money(data?.totalOut)}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Closing Balance</div><div className="ui-tile-value">{money(data?.closing)}</div></div>
      </div>
      <Card title={`Transaction History — ${txs.length} transactions`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Description</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id} className={t.is_void ? "text-muted" : ""}>
                <td>{ymd(t.date_posted)}</td>
                <td><span className="badge bg-secondary">{t.transaction_type}</span></td>
                <td>{t.from_name || "—"}</td>
                <td>{t.to_name || "—"}</td>
                <td>{t.description}</td>
                <td className="text-end fw-bold">{money(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
