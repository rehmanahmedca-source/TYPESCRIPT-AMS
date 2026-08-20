import { FormEvent } from "react";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function Reconciliation() {
  const { data, reload } = useApi<{
    reconciliations: { id: number; adjustment_date: string; physical_cash_available: number; calculated_closing: number; difference: number; reason: string }[];
    cashDrawerBalance: number;
  }>("/reconciliation");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/reconciliation", {
      method: "POST",
      body: JSON.stringify({ physical_cash: fd.get("physical_cash"), notes: fd.get("notes") })
    });
    e.currentTarget.reset();
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-clipboard-check" title="Cash Flow Differences" subtitle="Physical drawer vs system cash">
        <span className="badge bg-warning text-dark">Drawer {money(data?.cashDrawerBalance)}</span>
      </PageHeader>
      <Card title="Evening audit">
        <form className="row g-3" onSubmit={onSubmit}>
          <div className="col-md-3"><label className="ui-label">Physical cash</label><input name="physical_cash" type="number" className="form-control" required /></div>
          <div className="col-md-7"><label className="ui-label">Notes</label><input name="notes" className="form-control" /></div>
          <div className="col-md-2 d-flex align-items-end"><button className="btn btn-warning w-100">Save audit</button></div>
        </form>
      </Card>
      <Card title="History" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th className="text-end">System</th><th className="text-end">Physical</th><th className="text-end">Diff</th><th>Notes</th></tr></thead>
          <tbody>
            {(data?.reconciliations || []).map((r) => (
              <tr key={r.id}>
                <td>{ymd(r.adjustment_date)}</td>
                <td className="text-end">{money(r.calculated_closing)}</td>
                <td className="text-end">{money(r.physical_cash_available)}</td>
                <td className={`text-end fw-bold ${Number(r.difference) === 0 ? "text-success" : "text-danger"}`}>{money(r.difference)}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
