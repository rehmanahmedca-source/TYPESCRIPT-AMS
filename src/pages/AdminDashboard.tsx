import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";

const LINKS = [
  ["/settings", "Settings", "Users, company, wipe and permissions"],
  ["/activity_log", "Activity Log", "Who did what, and when"],
  ["/login_sessions", "Live logins", "Open sessions"],
  ["/system_report", "System Report", "Schema, counts and health"],
  ["/void_audit", "Deleted / Suspended Audit", "Restore voided records"],
  ["/import_export", "Import / Export", "Master and full-raw workbooks"]
];

export default function AdminDashboard() {
  return (
    <div>
      <PageHeader icon="bi-shield-lock" title="Admin Dashboard" subtitle="System administration, modules and maintenance" />
      <div className="row g-3">
        {LINKS.map(([to, title, sub]) => (
          <div className="col-md-4" key={to}>
            <Link to={to} className="quick-action">
              <div>
                <div className="qa-title">{title}</div>
                <div className="qa-sub">{sub}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>
      <Card title="Loaded Modules">
        <p className="text-muted mb-0">Inventory, Sales, Bookings, GRN, Payments, Accounts, Cash Flow, Ledgers, Notifications, Import/Export, Settings.</p>
      </Card>
    </div>
  );
}
