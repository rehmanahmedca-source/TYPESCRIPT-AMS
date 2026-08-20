import { useState } from "react";
import { PageHeader, Card } from "../components/ui";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function FinancialDetails() {
  const [type, setType] = useState<"cash" | "credit">("cash");
  const { data } = useApi<{
    cash: { id: number; date_posted: string; client_name: string; amount: number; paid_amount: number; auto_bill_no: string; manual_bill_no: string }[];
    credit: { id: number; date_posted: string; client_name: string; amount: number; discount: number; paid_amount: number; auto_bill_no: string; manual_bill_no: string }[];
    totalCash: number;
    totalCredit: number;
  }>("/financial-details");

  const items = type === "cash" ? (data?.cash || []) : (data?.credit || []);
  const total = type === "cash" ? (data?.totalCash || 0) : (data?.totalCredit || 0);

  return (
    <div>
      <PageHeader icon="bi-cash-stack" title="Financial Details" subtitle="Daily cash and credit breakdown">
        <div className="btn-group">
          <button className={`btn ${type === "cash" ? "btn-success" : "btn-outline-success"}`} onClick={() => setType("cash")}>
            Cash: {money(data?.totalCash)}
          </button>
          <button className={`btn ${type === "credit" ? "btn-danger" : "btn-outline-danger"}`} onClick={() => setType("credit")}>
            Credit: {money(data?.totalCredit)}
          </button>
        </div>
      </PageHeader>

      <div className="ui-kpi-grid mb-4">
        <div className={`ui-tile ${type === "cash" ? "border-green" : "border-red"}`}>
          <div className="ui-tile-label">{type === "cash" ? "Cash Received" : "Credit Issued"}</div>
          <div className={`ui-tile-value ${type === "cash" ? "text-success" : "text-danger"}`}>{money(total)}</div>
        </div>
      </div>

      <Card title={`${type === "cash" ? "Cash" : "Credit"} Transactions — ${items.length} entries`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Bill</th><th>Client</th><th className="text-end">Amount</th>{type === "cash" ? <th className="text-end">Paid</th> : <th className="text-end">Discount</th>}<th className="text-end">Due</th></tr></thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id}>
                <td>{ymd(item.date_posted)}</td>
                <td className="text-warning">{item.auto_bill_no || item.manual_bill_no}</td>
                <td>{item.client_name}</td>
                <td className="text-end">{money(item.amount)}</td>
                {type === "cash" ? <td className="text-end text-success">{money(item.paid_amount)}</td> : <td className="text-end">{money(item.discount)}</td>}
                <td className="text-end text-danger">{money(Math.max(0, item.amount - (item.discount || 0) - item.paid_amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
