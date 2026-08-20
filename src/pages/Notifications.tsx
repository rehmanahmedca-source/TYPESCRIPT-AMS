import { FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function Notifications() {
  const { data, reload } = useApi<{
    counts: { total: number; pending: number; very_high: number; high: number; medium: number; low: number };
    rows: { bill: { id: number; client_name: string; client_code: string; bill_no: string }; amount: number; risk_level: string; risk_level_key: string; active_remind_at?: string; last_contact_at?: string; last_contact_response?: string; contact_count: number }[];
    reminders: unknown[];
    staff_emails: { id: number; email: string; is_active: number }[];
  }>("/notifications");

  async function addEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/notifications/emails", { method: "POST", body: JSON.stringify({ email: fd.get("email") }) });
    e.currentTarget.reset();
    reload();
  }

  const c = data?.counts || { total: 0, pending: 0, very_high: 0, high: 0, medium: 0, low: 0 };

  return (
    <div>
      <PageHeader icon="bi-bell" title="Notifications" subtitle="Due follow-ups, risk queue and staff emails">
        <Link to="/notifications/upcoming" className="btn btn-outline-success btn-sm fw-bold">
          Upcoming Reminders <span className="badge bg-warning text-dark ms-1">{data?.reminders?.length || 0}</span>
        </Link>
      </PageHeader>
      <div className="row g-3 mb-3">
        {[
          ["Total", c.total],
          ["Pending", c.pending],
          ["Very High", c.very_high],
          ["High", c.high],
          ["Medium", c.medium],
          ["Low", c.low],
          ["Active Reminders", data?.reminders?.length || 0]
        ].map(([label, val]) => (
          <div className="col" key={String(label)}>
            <div className="card p-2"><small className="text-muted">{label}</small><div className="fw-bold">{val}</div></div>
          </div>
        ))}
      </div>
      <div className="row g-3">
        <div className="col-lg-8">
          <Card title="Due Follow-up Queue" flush>
            <table className="ui-table mb-0">
              <thead><tr><th>Client</th><th>Bill</th><th className="text-end">Amount</th><th>Risk</th><th>Next Reminder</th><th>Last Response</th><th>Contacts</th></tr></thead>
              <tbody>
                {(data?.rows || []).map((r) => (
                  <tr key={r.bill.id}>
                    <td>
                      <div className="fw-bold text-warning">{r.bill.client_name}</div>
                      <div className="small text-muted">{r.bill.client_code}</div>
                    </td>
                    <td>{r.bill.bill_no || "---"}</td>
                    <td className="text-end">{money(r.amount)}</td>
                    <td><span className={`badge ${r.risk_level_key === "low" ? "bg-success" : r.risk_level_key === "medium" ? "bg-warning text-dark" : "bg-danger"}`}>{r.risk_level}</span></td>
                    <td>{ymd(r.active_remind_at) || "Not set"}</td>
                    <td>{r.last_contact_response || "No history"}</td>
                    <td><span className="badge bg-info text-dark">{r.contact_count || 0}</span></td>
                  </tr>
                ))}
                {!(data?.rows || []).length && <tr><td colSpan={7} className="text-center text-muted py-4">No records</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Staff Emails (Daily PDF)">
            <form className="d-flex gap-2 mb-3" onSubmit={addEmail}>
              <input name="email" type="email" className="form-control" placeholder="staff@company.com" required />
              <button className="btn btn-warning text-dark btn-sm">Add</button>
            </form>
            {(data?.staff_emails || []).map((e) => (
              <div key={e.id} className="d-flex justify-content-between mb-2">
                <small>{e.email}</small>
              </div>
            ))}
            {!(data?.staff_emails || []).length && <small className="text-muted">No email addresses added.</small>}
          </Card>
        </div>
      </div>
    </div>
  );
}
