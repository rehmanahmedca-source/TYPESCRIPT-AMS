import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money, num } from "../format";
import { useApi } from "../useApi";

export default function ProfitReports() {
  const { data } = useApi<{
    totalSales: number;
    totalCost: number;
    grossProfit: number;
    profitMargin: number;
    salesByCategory: { category: string; amount: number; count: number }[];
    topClients: { name: string; amount: number; count: number }[];
    topMaterials: { name: string; amount: number; qty: number }[];
  }>("/profit-reports");

  return (
    <div>
      <PageHeader icon="bi-graph-up-arrow" title="Profit Reports" subtitle="Sales analysis and profitability metrics">
        <Link to="/reports" className="btn btn-outline-secondary btn-pill">← Back to Reports</Link>
      </PageHeader>

      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-green"><div className="ui-tile-label">Total Sales</div><div className="ui-tile-value text-success">{money(data?.totalSales)}</div></div>
        <div className="ui-tile border-red"><div className="ui-tile-label">Total Cost</div><div className="ui-tile-value text-danger">{money(data?.totalCost)}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Gross Profit</div><div className="ui-tile-value">{money(data?.grossProfit)}</div></div>
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Profit Margin</div><div className="ui-tile-value">{(data?.profitMargin || 0).toFixed(1)}%</div></div>
      </div>

      <div className="row">
        <div className="col-lg-6">
          <Card title="Sales by Category" flush>
            <table className="ui-table mb-0">
              <thead><tr><th>Category</th><th className="text-end">Amount</th><th className="text-end">Count</th></tr></thead>
              <tbody>
                {(data?.salesByCategory || []).map((c) => (
                  <tr key={c.category}>
                    <td className="fw-bold">{c.category}</td>
                    <td className="text-end">{money(c.amount)}</td>
                    <td className="text-end">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Top Clients" flush>
            <table className="ui-table mb-0">
              <thead><tr><th>Client</th><th className="text-end">Amount</th><th className="text-end">Transactions</th></tr></thead>
              <tbody>
                {(data?.topClients || []).map((c) => (
                  <tr key={c.name}>
                    <td className="fw-bold">{c.name}</td>
                    <td className="text-end">{money(c.amount)}</td>
                    <td className="text-end">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Card title="Top Materials by Revenue" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Material</th><th className="text-end">Revenue</th><th className="text-end">Quantity</th></tr></thead>
          <tbody>
            {(data?.topMaterials || []).map((m) => (
              <tr key={m.name}>
                <td className="fw-bold">{m.name}</td>
                <td className="text-end">{money(m.amount)}</td>
                <td className="text-end">{num(m.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
