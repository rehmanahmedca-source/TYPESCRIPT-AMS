import { FormEvent, useState } from "react";
import { PageHeader, Card } from "../components/ui";
import { downloadUrl } from "../api";

type ReportRow = { name: string; status: string; inserted: number; updated: number; skipped: number; failed: number; error?: string };

export default function ImportExport() {
  const [mode, setMode] = useState<"master" | "full_raw">("master");
  const [headline, setHeadline] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [err, setErr] = useState("");

  async function onImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    fd.set("mode", mode);
    const res = await fetch("/api/import", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok && !data.table_results) {
      setErr(data.error || "Import failed");
      return;
    }
    setHeadline(data.headline || "Import finished");
    setRows(data.table_results || []);
  }

  return (
    <div>
      <PageHeader icon="bi-arrow-left-right" title="Import & Export" subtitle="Same XLSX sheets as ams99 — master workbook and full raw SQL tables. No progress overlay." />
      <div className="row">
        <div className="col-lg-6">
          <Card title="Export XLSX">
            <p className="text-muted">Downloads start immediately in the browser. Nothing blocks the page.</p>
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-warning" onClick={() => downloadUrl("/export/master")}>
                <i className="bi bi-file-earmark-excel me-1" /> Master workbook
              </button>
              <button className="btn btn-outline-warning" onClick={() => downloadUrl("/export/full-raw")}>
                Full raw tables
              </button>
              <button className="btn btn-outline-secondary" onClick={() => downloadUrl("/export/template")}>
                Blank template
              </button>
            </div>
            <div className="small text-muted mt-3">
              Master sheets: Clients, Materials, Sales, SaleItems, Bookings, Payments, GRN, Dispatch, DeliveryPersons, Users, Accounts…
            </div>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Import XLSX">
            <form onSubmit={onImport}>
              <div className="mb-3">
                <label className="ui-label">Mode</label>
                <select className="form-select" value={mode} onChange={(e) => setMode(e.target.value as "master" | "full_raw")}>
                  <option value="master">Master sheets (Clients / Materials / …)</option>
                  <option value="full_raw">Full raw (one sheet per SQL table)</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="ui-label">Workbook</label>
                <input type="file" name="file" accept=".xlsx,.xls" className="form-control" required />
              </div>
              <button className="btn btn-success">Import now</button>
            </form>
            {err && <div className="text-danger mt-3">{err}</div>}
            {headline && <div className="text-success mt-3 fw-bold">{headline}</div>}
          </Card>
        </div>
      </div>
      {rows.length > 0 && (
        <Card title="Import report" flush>
          <table className="ui-table mb-0">
            <thead><tr><th>Sheet / table</th><th>Status</th><th>In</th><th>Upd</th><th>Skip</th><th>Fail</th><th>Note</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="fw-bold">{r.name}</td>
                  <td>{r.status}</td>
                  <td>{r.inserted}</td>
                  <td>{r.updated}</td>
                  <td>{r.skipped}</td>
                  <td className={r.failed ? "text-danger" : ""}>{r.failed}</td>
                  <td className="text-muted">{r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
