import { PageHeader, Card } from "../components/ui";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

export default function Dispatch() {
  const { data } = useApi<{
    sales: { id: number; client_name: string; auto_bill_no: string; date_posted: string; driver_name: string; amount: number; items: { product_name: string; qty: number }[] }[];
    drivers: { name: string }[];
  }>("/dispatch");
  return (
    <div>
      <PageHeader icon="bi-truck" title="Dispatch Board" subtitle="Recent outbound sales and assigned drivers" />
      <Card title="Outbound" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Client</th><th>Driver</th><th>Load</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {(data?.sales || []).map((s) => (
              <tr key={s.id}>
                <td className="text-warning">{s.auto_bill_no}</td>
                <td>{ymd(s.date_posted)}</td>
                <td>{s.client_name}</td>
                <td>{s.driver_name || "Self"}</td>
                <td>{(s.items || []).map((i) => `${i.product_name} × ${num(i.qty)}`).join(", ")}</td>
                <td className="text-end">{money(s.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
