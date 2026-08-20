import { useState, useEffect } from "react";
import { api } from "../../api";
import { AuditLogRow, LoginSessionRow } from "./types";

export function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [sessions, setSessions] = useState<LoginSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all");
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; logs: AuditLogRow[]; sessions: LoginSessionRow[] }>(
        "/settings/audit-logs"
      );
      if (res.ok) {
        setLogs(res.logs || []);
        setSessions(res.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load audit trail:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const usersList = Array.from(new Set(logs.map((l) => l.username).filter(Boolean)));

  const filteredLogs = logs.filter((l) => {
    const matchesUser = filterUser === "all" ? true : l.username === filterUser;
    const matchesSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.details || "").toLowerCase().includes(search.toLowerCase()) ||
      l.username.toLowerCase().includes(search.toLowerCase());
    return matchesUser && matchesSearch;
  });

  return (
    <div className="row g-4">
      {/* Audit Log Stream */}
      <div className="col-lg-8">
        <div className="ui-card">
          <div className="ui-card-header">
            <div className="d-flex align-items-center gap-2">
              <h5>
                <i className="bi bi-clock-history text-warning" /> Security & Activity Audit Trail
              </h5>
              <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
                {logs.length} logged events
              </span>
            </div>
            <button className="btn btn-outline-secondary btn-sm" title="Refresh logs" onClick={loadData}>
              <i className="bi bi-arrow-clockwise me-1" /> Refresh
            </button>
          </div>

          <div className="ui-card-body">
            {/* Filter toolbar */}
            <div className="row g-2 mb-3">
              <div className="col-md-7">
                <div className="input-group">
                  <span className="input-group-text bg-body-tertiary border-secondary border-opacity-25 text-secondary">
                    <i className="bi bi-search" />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search logs by action or details..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button className="btn btn-outline-secondary" onClick={() => setSearch("")}>
                      <i className="bi bi-x-lg" />
                    </button>
                  )}
                </div>
              </div>
              <div className="col-md-5">
                <select
                  className="form-select"
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                >
                  <option value="all">All Operators / Users</option>
                  {usersList.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Logs Table */}
            <div className="table-responsive border border-secondary border-opacity-25 rounded-3">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-dark text-secondary small text-uppercase">
                  <tr>
                    <th style={{ width: "160px" }}>Timestamp</th>
                    <th style={{ width: "120px" }}>Actor</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-secondary">
                        <span className="spinner-border spinner-border-sm me-2 text-warning" /> Loading audit
                        events...
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-secondary">
                        No audit records found.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-secondary small font-monospace">
                          {log.timestamp ? log.timestamp.replace("T", " ") : "Just now"}
                        </td>
                        <td>
                          <span className="badge bg-body-tertiary text-light border border-secondary border-opacity-25 px-2 py-1">
                            <i className="bi bi-person me-1 text-warning" />
                            {log.username}
                          </span>
                        </td>
                        <td>
                          <code className="text-warning small">{log.action}</code>
                        </td>
                        <td className="text-light small">{log.details || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Active User Sessions */}
      <div className="col-lg-4">
        <div className="ui-card">
          <div className="ui-card-header">
            <h5>
              <i className="bi bi-broadcast text-success" /> Active Operator Sessions
            </h5>
          </div>
          <div className="ui-card-body">
            {loading ? (
              <div className="text-center py-3 text-secondary">
                <span className="spinner-border spinner-border-sm me-2" /> Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-secondary small py-2">No active login sessions recorded.</div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-3 bg-body-tertiary border border-secondary border-opacity-25"
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="fw-bold text-light d-flex align-items-center gap-2">
                        <i className="bi bi-circle-fill text-success small" style={{ fontSize: "0.55rem" }} />
                        {s.username}
                      </span>
                      <span className="badge bg-warning-subtle text-warning border border-warning-subtle text-capitalize small">
                        {s.role}
                      </span>
                    </div>
                    <div className="text-secondary small" style={{ fontSize: "0.72rem" }}>
                      Last active: {s.last_seen_at ? s.last_seen_at.replace("T", " ") : "Online"}
                    </div>
                    {s.ip_address && (
                      <div className="text-muted small mt-1 font-monospace" style={{ fontSize: "0.7rem" }}>
                        IP: {s.ip_address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
