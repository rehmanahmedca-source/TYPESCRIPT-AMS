import { Link, useParams } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function CashFlowDiffDetail() {
  const { id } = useParams<{ id: string }>();
  const { data } = useApi<{
    reconciliation: { id: number; adjustment_date: string; physical_cash_available: number; calculated_closing: number; difference: number; reason: string; note: string; created_by: string; edit_count: number };
    audit_trail: { id: number; changed_at: string; change_type: string; changed_by: string; old_physical_cash: number; new_physical_cash: number; old_difference: number; new_difference: number; old_reason: string; new_reason: string }[];
  }>(`/cash_flow_differences/${id}`);
  const r = data?.reconciliation;
  return (
    <div>
      <PageHeader icon="bi-receipt-cutoff" title="Reconciliation Detail" subtitle={`Date: ${r?.adjustment_date || ""}`}>
        <Link to="/cash_flow_differences" className="btn btn-outline-secondary btn-pill fw-bold"><i className="bi bi-arrow-left me-1" /> Back to List</Link>
      </PageHeader>
      <Card title="Reconciliation Summary">
        <div className="row">
          <div className="col-md-4"><div className="text-muted small">Workflow</div><div>{r?.physical_cash_available != null ? <span className="badge bg-success">New (Physical Cash Available)</span> : <span className="badge bg-warning text-dark">Legacy</span>}</div></div>
          <div className="col-md-4"><div className="text-muted small">Total Edits</div><div className="fw-bold">{r?.edit_count || 1}</div></div>
          <div className="col-md-4"><div className="text-muted small">Created By</div><div>{r?.created_by || "System"}</div></div>
        </div>
        <hr />
        <div className="row">
          <div className="col-md-6">
            <div className="p-3 rounded bg-light">
              <div className="d-flex justify-content-between"><span>Calculated Closing:</span><strong>{money(r?.calculated_closing)}</strong></div>
              <div className="d-flex justify-content-between"><span>Physical Cash:</span><strong>{money(r?.physical_cash_available)}</strong></div>
              <div className="d-flex justify-content-between border-top pt-2"><span>Difference:</span><strong className={Number(r?.difference) < 0 ? "text-danger" : "text-success"}>{money(r?.difference)}</strong></div>
            </div>
          </div>
          <div className="col-md-6"><div className="text-muted small">Reason</div><div className="p-3 rounded bg-light">{r?.reason || r?.note || "(No reason provided)"}</div></div>
        </div>
      </Card>
      <Card title="Audit Trail" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Timestamp</th><th>Change Type</th><th>Changed By</th><th className="text-end">Old Physical</th><th className="text-end">New Physical</th><th className="text-end">Old Diff</th><th className="text-end">New Diff</th><th>Old Reason</th><th>New Reason</th></tr></thead>
          <tbody>
            {(data?.audit_trail || []).map((a) => (
              <tr key={a.id}>
                <td className="small">{ymd(a.changed_at)}</td>
                <td><span className="badge bg-secondary">{a.change_type}</span></td>
                <td>{a.changed_by}</td>
                <td className="text-end">{a.old_physical_cash != null ? money(a.old_physical_cash) : "—"}</td>
                <td className="text-end">{a.new_physical_cash != null ? money(a.new_physical_cash) : "—"}</td>
                <td className="text-end">{a.old_difference != null ? money(a.old_difference) : "—"}</td>
                <td className="text-end">{a.new_difference != null ? money(a.new_difference) : "—"}</td>
                <td>{a.old_reason || "—"}</td>
                <td>{a.new_reason || "—"}</td>
              </tr>
            ))}
            {!data?.audit_trail?.length && <tr><td colSpan={9} className="ui-empty">No audit records found.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
