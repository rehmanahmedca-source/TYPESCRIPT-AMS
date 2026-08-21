import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function HoldBills() {
  const { data, reload } = useApi<{ drafts: { id: number; client_name: string; category: string; manual_bill_no: string; item_count: number; total_qty: number; total_amount: number; created_at: string; created_by: string }[] }>("/direct_sales/hold");
  return (
    <div>
      <PageHeader icon="bi-pause-circle" title="Hold Bills" subtitle="Unsaved direct-sale drafts">
        <Link to="/direct_sales" className="btn btn-outline-light btn-sm">Back to Sales</Link>
      </PageHeader>
      <Card title="Drafts" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Client</th><th>Category</th><th>Bill</th><th>Items</th><th>Qty</th><th className="text-end">Amount</th><th>By</th><th /></tr></thead>
          <tbody>
            {(data?.drafts || []).map((d) => (
              <tr key={d.id}>
                <td>{ymd(d.created_at)}</td>
                <td>{d.client_name}</td>
                <td>{d.category}</td>
                <td>{d.manual_bill_no || "—"}</td>
                <td>{d.item_count}</td>
                <td>{d.total_qty}</td>
                <td className="text-end">{money(d.total_amount)}</td>
                <td>{d.created_by}</td>
                <td className="text-nowrap">
                  <Link to={`/direct_sales?resume=${d.id}`} className="btn btn-sm btn-outline-warning me-1">Resume</Link>
                  <button className="btn btn-sm btn-outline-danger" onClick={async () => { await api(`/direct_sales/hold/${d.id}/delete`, { method: "POST" }); reload(); }}>Delete</button>
                </td>
              </tr>
            ))}
            {!data?.drafts?.length && <tr><td colSpan={9} className="ui-empty">No held bills.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
