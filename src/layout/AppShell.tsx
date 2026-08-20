import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api";

const NAV = [
  { to: "/", icon: "bi-speedometer2", label: "Dashboard", end: true },
  { group: "Inventory & Stock" },
  { to: "/stock", icon: "bi-graph-up", label: "Stock Summary" },
  { to: "/materials", icon: "bi-tags", label: "Brand Master" },
  { to: "/grn", icon: "bi-box-arrow-in-down", label: "GRN Receiving" },
  { to: "/daily", icon: "bi-list-check", label: "Daily Breakdown" },
  { group: "Sales & Fleet" },
  { to: "/sales", icon: "bi-cart-check", label: "Direct Sales" },
  { to: "/bookings", icon: "bi-bookmark-plus", label: "Bookings" },
  { to: "/returns", icon: "bi-arrow-counterclockwise", label: "Material Return" },
  { to: "/dispatch", icon: "bi-truck", label: "Dispatch Board" },
  { to: "/drivers", icon: "bi-person-badge", label: "Drivers & Fleet" },
  { to: "/delivery-rents", icon: "bi-truck-front", label: "Delivery Rents" },
  { group: "Parties & Ledgers" },
  { to: "/clients", icon: "bi-people", label: "Clients & Ledgers" },
  { to: "/suppliers", icon: "bi-building", label: "Suppliers & Ledgers" },
  { to: "/payments", icon: "bi-cash-stack", label: "Payments" },
  { to: "/pending", icon: "bi-receipt", label: "Pending Bills" },
  { group: "Finance & Cash" },
  { to: "/accounts", icon: "bi-calculator", label: "Accounts Hub" },
  { to: "/cash-flow", icon: "bi-water", label: "Cash Flow" },
  { to: "/cash-flow-differences", icon: "bi-clipboard-check", label: "Cash Differences" },
  { to: "/financial-details", icon: "bi-cash-coin", label: "Financial Details" },
  { to: "/reconciliation", icon: "bi-shield-check", label: "Cash Reconciliation" },
  { to: "/reports", icon: "bi-file-earmark-bar-graph", label: "Reports & Audit" },
  { to: "/profit-reports", icon: "bi-graph-up-arrow", label: "Profit Reports" },
  { group: "System" },
  { to: "/void-audit", icon: "bi-shield-exclamation", label: "Void Audit" },
  { to: "/import-export", icon: "bi-arrow-left-right", label: "Import & Export" },
  { to: "/settings", icon: "bi-gear", label: "Settings" }
];

export default function AppShell({
  today,
  user
}: {
  today: string;
  user: { username?: string; role?: string };
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "dark");
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      try { sessionStorage.setItem("ams_logged_out", "1"); } catch { /* storage may be disabled */ }
      window.dispatchEvent(new CustomEvent("ams:unauthorized"));
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem("ams_theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }

  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`} id="appSidebar">
        <div className="sidebar-header">
          <NavLink to="/" className="sidebar-brand">
            <i className="bi bi-box-seam-fill text-warning" />
            <span className="d-flex flex-column lh-sm">
              <span>AMS SYSTEM</span>
              <small className="sidebar-brand-subtitle">FOR EASE</small>
            </span>
          </NavLink>
          <button className="btn btn-sm btn-link text-muted d-lg-none p-0" onClick={() => setOpen(false)}>
            <i className="bi bi-x-lg fs-5" />
          </button>
        </div>
        <div className="sidebar-nav">
          {NAV.map((item) =>
            item.group ? (
              <div className="nav-group-title" key={item.group}>
                {item.group}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                <i className={`bi ${item.icon}`} /> {item.label}
              </NavLink>
            )
          )}
        </div>
        <div className="p-3 border-top border-secondary border-opacity-25 text-muted small d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-shield-check text-success" />
            <span>{user.username || "Admin"}</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-warning text-dark">{(user.role || "user").toUpperCase()}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={logout} title="Logout" aria-label="Logout">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="topbar">
          <div className="d-flex align-items-center gap-3">
            <button className="btn btn-sm btn-outline-secondary d-lg-none" onClick={() => setOpen(true)}>
              <i className="bi bi-list fs-5" />
            </button>
            <span className="fw-semibold text-warning d-none d-sm-inline">
              <i className="bi bi-building me-1" /> Ahmed Material System
            </span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small d-none d-md-inline">
              <i className="bi bi-calendar3 me-1" /> {today}
            </span>
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              <i className={`bi ${theme === "dark" ? "bi-sun" : "bi-moon-stars"}`} />
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </div>
        </header>
        <main className="main-content ui-v2">
          <Outlet />
        </main>
      </div>
    </>
  );
}
