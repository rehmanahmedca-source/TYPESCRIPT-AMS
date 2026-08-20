import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { rs, ymd } from "../format";
import { useApi } from "../useApi";

export default function AuditTrail() {
  const [q, setQ] = useState("");
  const { data, reload } = useApi<{ rows: { id: number; date_posted: string; transaction_type: string; amount: number; description: string; from_name: string; to_name: string; is_void: number; note: string }[] }>(`/accounts/audit?q=${encodeURIComponent(q)}`);

  async function voidTx(id: number) {
    if (!confirm("Void this transaction?")) return;
    await api(`/accounts/transactions/${id}/void`, { method: "POST" });
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-shield-check" title="Audit Trail" subtitle="Every penny across accounts">
        <Link to="/accounts" className="btn btn-outline-secondary btn-sm">Accounts</Link>
      </PageHeader>
      <Card>
        <input className="form-control mb-3" placeholder="Description or note..." value={q} onChange={(e) => setQ(e.target.value)} />
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Description</th><th className="text-end">Amount</th><th></th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.id} className={r.is_void ? "opacity-50" : ""}>
                <td>{ymd(r.date_posted)}</td>
                <td>{r.transaction_type}</td>
                <td>{r.from_name || "—"}</td>
                <td>{r.to_name || "—"}</td>
                <td>{r.description || r.note}</td>
                <td className="text-end">{rs(r.amount)}</td>
                <td className="text-end">{!r.is_void && <button className="btn btn-sm btn-outline-danger" onClick={() => voidTx(r.id)}>Void</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
