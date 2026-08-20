import { useState } from "react";
import { PageHeader, Card } from "../components/ui";
import { money, ymd } from "../format";
import { useApi } from "../useApi";
import { api } from "../api";
import { FormEvent } from "react";

export default function CashFlowDifferences() {
  const { data, reload } = useApi<{
    differences: { id: number; adjustment_date: string; physical_cash_available: number; calculated_closing: number; difference: number; reason: string; created_by: string }[];
    cashDrawerBalance: number;
  }>("/cash-flow-differences");

  const [showForm, setShowForm] = useState(false);

  async function addAdjustment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/cash-flow-differences", {
      method: "POST",
      body: JSON.stringify({
        physical_cash: fd.get("physical_cash"),
        notes: fd.get("notes")
      })
    });
    e.currentTarget.reset();
    setShowForm(false);
    reload();
  }

  const diffs = data?.differences || [];

  return (
    <div>
      <PageHeader icon="bi-clipboard-check" title="Cash Flow Differences" subtitle="Physical cash reconciliation history">
        <span className="badge bg-warning text-dark">Drawer Balance: {money(data?.cashDrawerBalance)}</span>
        <button className="btn btn-warning btn-pill ms-2" onClick={() => setShowForm(!showForm)}>
          <i className="bi bi-plus-circle me-1" /> Record Difference
        </button>
      </PageHeader>

      {showForm && (
        <Card title="Record Cash Difference">
          <form onSubmit={addAdjustment}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="ui-label">Physical Cash Available</label>
                <input name="physical_cash" type="number" step="0.01" className="form-control" required />
              </div>
              <div className="col-md-8">
                <label className="ui-label">Reason / Notes</label>
                <input name="notes" className="form-control" placeholder="Reason for difference" />
              </div>
              <div className="col-12">
                <button className="btn btn-warning">Save Adjustment</button>
              </div>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Difference History — ${diffs.length} adjustments`} flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th className="text-end">Physical Cash</th><th className="text-end">Calculated</th><th className="text-end">Difference</th><th>Reason</th><th>By</th></tr></thead>
          <tbody>
            {diffs.map((d) => (
              <tr key={d.id}>
                <td>{ymd(d.adjustment_date)}</td>
                <td className="text-end">{money(d.physical_cash_available)}</td>
                <td className="text-end">{money(d.calculated_closing)}</td>
                <td className="text-end fw-bold">
                  <span className={d.difference === 0 ? "text-success" : "text-danger"}>
                    {money(d.difference)}
                  </span>
                </td>
                <td>{d.reason || "—"}</td>
                <td><small className="text-muted">{d.created_by || "—"}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
