import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { ymd } from "../format";
import { useApi } from "../useApi";
import { api } from "../api";

type VoidRecord = {
  id: number;
  entity: string;
  title: string;
  details: string;
  date_posted: string;
  amount?: number;
};

export default function VoidAudit() {
  const [section, setSection] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [activeQ, setActiveQ] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("all");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const queryUrl = `/void_audit?section=${encodeURIComponent(activeSection)}&q=${encodeURIComponent(activeQ)}`;

  const { data, reload, loading } = useApi<{
    records: VoidRecord[];
    voidedSales: VoidRecord[];
    voidedBookings: VoidRecord[];
    voidedGrns: VoidRecord[];
    voidedPayments: VoidRecord[];
    voidedReturns: VoidRecord[];
    voidedPendingBills: VoidRecord[];
  }>(queryUrl);

  const records = data?.records || [];

  async function handleRestore(record: VoidRecord) {
    if (!confirm(`Restore this ${record.entity} record (#${record.id})?`)) return;
    try {
      setRestoringId(`${record.entity}-${record.id}`);
      await api(`/void_audit/restore/${record.entity}/${record.id}`, { method: "POST" });
      setMessage(`Successfully restored ${record.entity} record #${record.id}.`);
      setTimeout(() => setMessage(""), 4000);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoringId(null);
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActiveSection(section);
    setActiveQ(q);
  }

  function handleReset() {
    setSection("all");
    setQ("");
    setActiveSection("all");
    setActiveQ("");
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <PageHeader
          icon="bi-shield-exclamation"
          title="Void Audit Trail"
          subtitle="Track and restore all voided transactions for compliance and review"
        />
        <Link to="/settings" className="btn btn-outline-light btn-sm fw-bold">
          <i className="bi bi-arrow-left me-1"></i> Back to Settings
        </Link>
      </div>

      {message && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          <i className="bi bi-check-circle me-2"></i>
          {message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-red cursor-pointer" onClick={() => { setSection("direct_sale"); setActiveSection("direct_sale"); }}>
          <div className="ui-tile-label">Voided Sales</div>
          <div className="ui-tile-value text-danger">{(data?.voidedSales || []).length}</div>
        </div>
        <div className="ui-tile border-rose cursor-pointer" onClick={() => { setSection("booking"); setActiveSection("booking"); }}>
          <div className="ui-tile-label">Voided Bookings</div>
          <div className="ui-tile-value text-danger">{(data?.voidedBookings || []).length}</div>
        </div>
        <div className="ui-tile border-amber cursor-pointer" onClick={() => { setSection("grn"); setActiveSection("grn"); }}>
          <div className="ui-tile-label">Voided GRNs</div>
          <div className="ui-tile-value text-warning">{(data?.voidedGrns || []).length}</div>
        </div>
        <div className="ui-tile border-indigo cursor-pointer" onClick={() => { setSection("payment"); setActiveSection("payment"); }}>
          <div className="ui-tile-label">Voided Payments</div>
          <div className="ui-tile-value text-warning">{(data?.voidedPayments || []).length}</div>
        </div>
      </div>

      {/* Filter Form matching void_audit.html */}
      <form onSubmit={handleFilterSubmit} className="card border-0 shadow-sm p-3 mb-4" style={{ background: "#1e293b", border: "2px solid #475569 !important", borderRadius: "12px" }}>
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-4">
            <label className="text-white-50 small fw-bold mb-1">SECTION / MODULE</label>
            <select className="form-select bg-dark text-white border-secondary" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="all">All Sections</option>
              <option value="direct_sale">Direct Sales</option>
              <option value="booking">Bookings</option>
              <option value="grn">GRN (Goods Receipt)</option>
              <option value="payment">Payments</option>
              <option value="return">Material Returns</option>
              <option value="pending_bill">Pending Bills</option>
            </select>
          </div>
          <div className="col-12 col-md-5">
            <label className="text-white-50 small fw-bold mb-1">SEARCH</label>
            <input
              type="text"
              className="form-control bg-dark text-white border-secondary"
              placeholder="Entity, client, bill, material..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="col-6 col-md-2 d-grid">
            <button type="submit" className="btn btn-warning btn-sm text-dark fw-bold py-2">
              <i className="bi bi-filter me-1"></i> Apply
            </button>
          </div>
          <div className="col-6 col-md-1 d-grid">
            <button type="button" className="btn btn-outline-light btn-sm fw-bold py-2" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* Audit Table */}
      <Card title={`Voided Records — ${records.length} records`} flush>
        <div className="table-responsive">
          <table className="ui-table mb-0 align-middle">
            <thead style={{ background: "#0f172a" }}>
              <tr>
                <th className="py-3 ps-3 text-white-50">Entity</th>
                <th className="py-3 text-white-50">Title / Reference</th>
                <th className="py-3 text-white-50">Details</th>
                <th className="py-3 text-white-50">Date</th>
                <th className="py-3 pe-3 text-end text-white-50">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-white-50">
                    {loading ? "Loading audit records..." : "No voided records found."}
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => (
                  <tr key={`${r.entity}-${r.id}-${idx}`}>
                    <td className="ps-3">
                      <span className={`badge ${
                        r.entity === "DirectSale" ? "bg-danger" :
                        r.entity === "Booking" ? "bg-warning text-dark" :
                        r.entity === "GRN" ? "bg-info text-dark" :
                        r.entity === "Payment" ? "bg-success" :
                        "bg-secondary"
                      }`}>
                        {r.entity}
                      </span>
                    </td>
                    <td className="text-white fw-bold">{r.title}</td>
                    <td className="text-white-50 small">{r.details}</td>
                    <td className="text-warning small">{ymd(r.date_posted)}</td>
                    <td className="pe-3 text-end">
                      <button
                        type="button"
                        className="btn btn-outline-success btn-sm fw-bold rounded-pill"
                        disabled={restoringId === `${r.entity}-${r.id}`}
                        onClick={() => handleRestore(r)}
                        title="Restore this voided record"
                      >
                        {restoringId === `${r.entity}-${r.id}` ? (
                          <span className="spinner-border spinner-border-sm me-1" role="status" />
                        ) : (
                          <i className="bi bi-arrow-counterclockwise me-1" />
                        )}
                        Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
