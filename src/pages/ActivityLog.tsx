import { PageHeader, Card } from "../components/ui";
import { useApi } from "../useApi";

export default function ActivityLog() {
  const { data } = useApi<{ logs: { id: string; username: string; action: string; details: string; timestamp: string }[] }>("/settings/audit-logs");
  return (
    <div>
      <PageHeader icon="bi-activity" title="Activity Log" subtitle="Recent system actions" />
      <Card flush>
        <table className="ui-table mb-0">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {(data?.logs || []).map((l) => (
              <tr key={l.id}>
                <td>{l.timestamp}</td>
                <td>{l.username}</td>
                <td>{l.action}</td>
                <td>{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
