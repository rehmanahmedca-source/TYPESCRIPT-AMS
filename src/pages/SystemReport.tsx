import { PageHeader, Card } from "../components/ui";
import { useApi } from "../useApi";

export default function SystemReport() {
  const { data } = useApi<{ tables: { name: string; rows: number }[]; users: number; clients: number; materials: number; sales: number; bookings: number; payments: number; accounts: number }>("/system-report");
  return (
    <div>
      <PageHeader icon="bi-clipboard2-data" title="System Report" subtitle="Live database counts and module health" />
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile"><div className="ui-tile-label">Users</div><div className="ui-tile-value">{data?.users || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Clients</div><div className="ui-tile-value">{data?.clients || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Materials</div><div className="ui-tile-value">{data?.materials || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Sales</div><div className="ui-tile-value">{data?.sales || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Bookings</div><div className="ui-tile-value">{data?.bookings || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Payments</div><div className="ui-tile-value">{data?.payments || 0}</div></div>
        <div className="ui-tile"><div className="ui-tile-label">Accounts</div><div className="ui-tile-value">{data?.accounts || 0}</div></div>
      </div>
      <Card title="Tables" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Table</th><th className="text-end">Rows</th></tr></thead>
          <tbody>
            {(data?.tables || []).map((t) => (
              <tr key={t.name}><td>{t.name}</td><td className="text-end">{t.rows}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
