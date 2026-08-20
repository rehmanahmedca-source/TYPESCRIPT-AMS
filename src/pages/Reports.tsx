import { PageHeader, Card } from "../components/ui";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

export default function Reports() {
  const { data } = useApi<{
    totalSalesVolume: number;
    totalCashCollected: number;
    totalCreditIssued: number;
    totalInventoryUnits: number;
    sales: { auto_bill_no: string; client_name: string; amount: number; paid_amount: number; date_posted: string }[];
    materials: { name: string; stock: number; unit: string }[];
  }>("/reports");
  return (
    <div>
      <PageHeader icon="bi-file-earmark-bar-graph" title="Executive Reports" subtitle="Sales volume, collections and inventory snapshot" />
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-green"><div className="ui-tile-label">Sales volume</div><div className="ui-tile-value">{money(data?.totalSalesVolume)}</div></div>
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Collected</div><div className="ui-tile-value">{money(data?.totalCashCollected)}</div></div>
        <div className="ui-tile border-rose"><div className="ui-tile-label">Credit issued</div><div className="ui-tile-value">{money(data?.totalCreditIssued)}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Units on hand</div><div className="ui-tile-value">{num(data?.totalInventoryUnits)}</div></div>
      </div>
      <Card title="Sales sample" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Client</th><th className="text-end">Amount</th><th className="text-end">Paid</th></tr></thead>
          <tbody>
            {(data?.sales || []).map((s, i) => (
              <tr key={i}>
                <td className="text-warning">{s.auto_bill_no}</td>
                <td>{ymd(s.date_posted)}</td>
                <td>{s.client_name}</td>
                <td className="text-end">{money(s.amount)}</td>
                <td className="text-end text-success">{money(s.paid_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
