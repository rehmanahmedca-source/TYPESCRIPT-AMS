import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function MixedReport() {
  const { data } = useApi<{ sales: { id: number; date_posted: string; auto_bill_no: string; manual_bill_no: string; client_name: string; amount: number; items: { product_name: string; qty: number; price_at_time: number }[] }[] }>("/mixed_transactions");
  return (
    <div>
      <PageHeader icon="bi-shuffle" title="Mixed Transactions Report" subtitle="Sales containing both Booked (Reserved) and Due/Cash items in one bill.">
        <Link to="/direct_sales" className="btn btn-outline-light btn-sm fw-bold"><i className="bi bi-arrow-left me-1" /> Back to Sales</Link>
      </PageHeader>
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Bill No</th><th>Client</th><th>Booked Items (Qty)</th><th>Due Items (Qty @ Rate)</th><th className="text-end">Due Amount</th></tr></thead>
          <tbody>
            {(data?.sales || []).map((s) => (
              <tr key={s.id}>
                <td>{ymd(s.date_posted)}</td>
                <td><Link to={`/view_bill/${encodeURIComponent(s.manual_bill_no || s.auto_bill_no)}`} className="text-warning fw-bold">{s.manual_bill_no || s.auto_bill_no}</Link></td>
                <td className="fw-bold">{s.client_name}</td>
                <td><ul className="list-unstyled mb-0 small">{(s.items || []).filter((i) => Number(i.price_at_time) === 0).map((i, n) => <li key={n}>{i.product_name}: <strong>{i.qty}</strong></li>)}</ul></td>
                <td><ul className="list-unstyled mb-0 small">{(s.items || []).filter((i) => Number(i.price_at_time) > 0).map((i, n) => <li key={n}>{i.product_name}: <strong>{i.qty}</strong> @ {i.price_at_time}</li>)}</ul></td>
                <td className="text-end fw-bold text-success">{money(s.amount)}</td>
              </tr>
            ))}
            {!data?.sales?.length && <tr><td colSpan={6} className="text-center py-5 text-muted">No mixed transactions found.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
