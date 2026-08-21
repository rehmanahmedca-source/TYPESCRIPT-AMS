import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { ymd } from "../format";
import { useApi } from "../useApi";

export default function DataLabBasket() {
  const { data } = useApi<{ rows: { id: number; bill_no: string; inv_date: string; inv_client: string; fin_client: string; inv_material: string; inv_qty: number; status: string; match_score: number }[] }>("/data_lab/basket");
  return (
    <div>
      <PageHeader icon="bi-basket" title="Recon Basket" subtitle="Triangulation matches from Data Lab">
        <Link to="/data_lab" className="btn btn-outline-secondary btn-sm">Back to Data Lab</Link>
      </PageHeader>
      <Card title="Basket" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Bill</th><th>Date</th><th>Inv Client</th><th>Fin Client</th><th>Material</th><th>Qty</th><th>Score</th><th>Status</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.id}>
                <td>{r.bill_no}</td><td>{ymd(r.inv_date)}</td><td>{r.inv_client}</td><td>{r.fin_client}</td>
                <td>{r.inv_material}</td><td>{r.inv_qty}</td><td>{r.match_score}</td><td>{r.status}</td>
              </tr>
            ))}
            {!data?.rows?.length && <tr><td colSpan={8} className="ui-empty">Basket is empty.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
