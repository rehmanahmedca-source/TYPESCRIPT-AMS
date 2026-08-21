import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { ymd } from "../format";
import { useApi } from "../useApi";

export default function UpcomingReminders() {
  const { data, reload } = useApi<{ reminders: { id: number; remind_at: string; note: string; client_name?: string; bill_no?: string }[] }>("/notifications/upcoming");
  return (
    <div>
      <PageHeader icon="bi-clock-history" title="Upcoming Reminders" subtitle="Scheduled follow-ups">
        <Link to="/notifications" className="btn btn-outline-secondary btn-sm">Notifications</Link>
      </PageHeader>
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>When</th><th>Client</th><th>Bill</th><th>Note</th><th /></tr></thead>
          <tbody>
            {(data?.reminders || []).map((r) => (
              <tr key={r.id}>
                <td className="text-warning fw-bold">{ymd(r.remind_at)}</td>
                <td>{r.client_name || "—"}</td>
                <td>{r.bill_no || "—"}</td>
                <td>{r.note}</td>
                <td className="text-nowrap">
                  <button className="btn btn-sm btn-outline-success me-1" onClick={async () => { await api(`/notifications/ack_reminder/${r.id}`, { method: "POST" }); reload(); }}>Ack</button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={async () => { await api(`/notifications/close_reminder/${r.id}`, { method: "POST" }); reload(); }}>Close</button>
                </td>
              </tr>
            ))}
            {!(data?.reminders || []).length && <tr><td colSpan={5} className="text-center text-muted py-4">No upcoming reminders.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
