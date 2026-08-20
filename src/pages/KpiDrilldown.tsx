import { Link, useParams } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { rs, ymd } from "../format";
import { useApi } from "../useApi";

const TITLES: Record<string, string> = {
  client_payments: "Client Payments (KPI Drill-Down)",
  supplier_payments: "Supplier Payments (KPI Drill-Down)",
  expenditures: "Expenditures (KPI Drill-Down)",
  receipts: "Receipts (KPI Drill-Down)",
  cash_money: "Total Cash (KPI Drill-Down)",
  company_money: "Company Money (KPI Drill-Down)",
  bank_accounts: "Bank Accounts",
  cash_accounts: "Cash Accounts"
};

export default function KpiDrilldown() {
  const { kind } = useParams();
  const key = String(kind || "");
  const { data } = useApi<{ rows: Record<string, unknown>[]; total?: number; title?: string }>(`/accounts/kpi/${key}`);
  const title = TITLES[key] || data?.title || "KPI Drill-Down";
  const rows = data?.rows || [];
  const cols = rows[0] ? Object.keys(rows[0]).filter((c) => c !== "id") : [];

  return (
    <div>
      <PageHeader icon="bi-graph-up" title={title} subtitle="Accounts KPI detail">
        <Link to="/accounts" className="btn btn-outline-secondary btn-sm">Accounts</Link>
      </PageHeader>
      {data?.total != null && (
        <div className="ui-kpi-grid mb-4">
          <div className="ui-tile border-amber"><div className="ui-tile-label">Total</div><div className="ui-tile-value">{rs(data.total)}</div></div>
        </div>
      )}
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, " ")}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => {
                  const v = r[c];
                  const isAmt = /amount|balance/.test(c);
                  const isDate = /date/.test(c);
                  return <td key={c} className={isAmt ? "text-end" : ""}>{isAmt ? rs(v) : isDate ? ymd(String(v || "")) : String(v ?? "—")}</td>;
                })}
              </tr>
            ))}
            {!rows.length && <tr><td className="text-center text-muted py-4">No records found.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
