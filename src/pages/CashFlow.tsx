import { PageHeader, Card } from "../components/ui";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function CashFlow() {
  const { data } = useApi<{
    flows: { id: number; date_posted: string; transaction_type: string; amount: number; description: string; from_name: string; to_name: string }[];
    totalInflow: number;
    totalOutflow: number;
    netFlow: number;
  }>("/cash-flow");
  return (
    <div>
      <PageHeader icon="bi-water" title="Cash Flow Statement" subtitle="Receipts, payments and transfers from the account ledger" />
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-green"><div className="ui-tile-label">Inflow</div><div className="ui-tile-value">{money(data?.totalInflow)}</div></div>
        <div className="ui-tile border-rose"><div className="ui-tile-label">Outflow</div><div className="ui-tile-value">{money(data?.totalOutflow)}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Net</div><div className="ui-tile-value">{money(data?.netFlow)}</div></div>
      </div>
      <Card title="Movements" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Type</th><th>From / To</th><th>Description</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {(data?.flows || []).map((f) => (
              <tr key={f.id}>
                <td>{ymd(f.date_posted)}</td>
                <td>{f.transaction_type}</td>
                <td>{[f.from_name, f.to_name].filter(Boolean).join(" → ") || "—"}</td>
                <td>{f.description}</td>
                <td className="text-end">{money(f.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
