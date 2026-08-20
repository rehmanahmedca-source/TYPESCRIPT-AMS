import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money, num, ymd } from "../format";
import { useApi } from "../useApi";

export default function DeliveryRents() {
  const { data } = useApi<{
    rents: { id: number; delivery_person_name: string; amount: number; date: string; sale_id: number; note: string; is_void: number }[];
    drivers: { id: number; name: string }[];
  }>("/delivery-rents");

  const rents = data?.rents || [];

  return (
    <div>
      <PageHeader icon="bi-truck" title="Delivery Rents" subtitle="Driver rental charges and allocations">
        <Link to="/drivers" className="btn btn-outline-secondary btn-pill">← Back to Drivers</Link>
      </PageHeader>

      <Card title={`Rental Records — ${rents.length} entries`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Driver</th><th className="text-end">Amount</th><th>Sale ID</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>
            {rents.map((r) => (
              <tr key={r.id} className={r.is_void ? "text-muted" : ""}>
                <td>{ymd(r.date)}</td>
                <td className="fw-bold">{r.delivery_person_name}</td>
                <td className="text-end">{money(r.amount)}</td>
                <td><Link to={`/sales`} className="text-warning">Sale #{r.sale_id}</Link></td>
                <td>{r.note || "—"}</td>
                <td>{r.is_void ? <span className="badge bg-secondary">Void</span> : <span className="badge bg-success">Active</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
