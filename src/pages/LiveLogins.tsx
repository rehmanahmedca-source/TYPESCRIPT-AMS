import { PageHeader, Card } from "../components/ui";
import { useApi } from "../useApi";

export default function LiveLogins() {
  const { data } = useApi<{ sessions: { id: number; username: string; role: string; ip: string; user_agent: string; created_at: string; last_seen_at: string; ended_at?: string }[] }>("/settings/audit-logs");
  return (
    <div>
      <PageHeader icon="bi-person-check" title="Live logins" subtitle="Active and recent sessions" />
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>User</th><th>Role</th><th>IP</th><th>Started</th><th>Last seen</th><th>Status</th></tr></thead>
          <tbody>
            {(data?.sessions || []).map((s) => (
              <tr key={s.id}>
                <td className="fw-bold">{s.username}</td>
                <td>{s.role}</td>
                <td>{s.ip}</td>
                <td>{s.created_at}</td>
                <td>{s.last_seen_at}</td>
                <td>{s.ended_at ? "Ended" : <span className="badge bg-success">Live</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
