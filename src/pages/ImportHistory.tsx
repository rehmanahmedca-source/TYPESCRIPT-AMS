import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api, downloadUrl } from "../api";
import { ymd } from "../format";
import { useApi } from "../useApi";

export default function ImportHistory() {
  const { data, reload } = useApi<{ reports: { name: string; created_at: string; mode: string; tenant_name: string; status: string; inserted: number; updated: number; skipped: number; failed: number; warnings: number; tables: string; source_file: string; row_count: number }[] }>("/import_export/full_raw_import_history");
  return (
    <div>
      <PageHeader icon="bi-clock-history" title="Full Raw Import History" subtitle="Reports stored from previous full-raw imports">
        <button className="btn btn-outline-danger btn-sm" onClick={async () => { if (!confirm("Delete all import reports?")) return; await api("/import_export/full_raw_import_history", { method: "POST", body: JSON.stringify({ action: "delete_all" }) }); reload(); }}>Delete all</button>
        <Link to="/import_export" className="btn btn-outline-light btn-sm">Back</Link>
      </PageHeader>
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Report</th><th>Created</th><th>Mode</th><th>Tenant</th><th>Status</th><th>Inserted</th><th>Updated</th><th>Skipped</th><th>Failed</th><th>Source File</th><th>Rows</th><th /></tr></thead>
          <tbody>
            {(data?.reports || []).map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td><td>{ymd(r.created_at)}</td><td>{r.mode}</td><td>{r.tenant_name}</td>
                <td><span className={`badge ${r.status === "ok" || r.status === "COMPLETED" ? "bg-success" : "bg-warning text-dark"}`}>{r.status || "-"}</span></td>
                <td>{r.inserted}</td><td>{r.updated}</td><td>{r.skipped}</td>
                <td className={r.failed ? "text-danger fw-bold" : ""}>{r.failed || 0}</td>
                <td>{r.source_file}</td><td>{r.row_count}</td>
                <td className="text-nowrap">
                  {String(r.name).endsWith(".csv") && <button className="btn btn-sm btn-outline-info me-1" onClick={() => downloadUrl(`/import_export/full_raw_import_history/${encodeURIComponent(r.name)}`)}>Download</button>}
                  {String(r.name).endsWith(".csv") && <button className="btn btn-sm btn-outline-danger" onClick={async () => { await api("/import_export/full_raw_import_history", { method: "POST", body: JSON.stringify({ action: "delete_selected", report: [r.name] }) }); reload(); }}>Delete</button>}
                </td>
              </tr>
            ))}
            {!data?.reports?.length && <tr><td colSpan={12} className="text-center text-muted">No reports found.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
