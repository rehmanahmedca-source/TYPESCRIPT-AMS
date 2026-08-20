import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api";

type NavItem = {
  to?: string;
  icon?: string;
  label?: string;
  end?: boolean;
  group?: string;
  match?: (path: string) => boolean;
  children?: { to: string; icon: string; label: string; match?: (path: string) => boolean }[];
};

const NAV: NavItem[] = [
  { to: "/", icon: "bi-speedometer2", label: "Dashboard", end: true, match: (p) => p === "/" || p === "/dashboard" },
  { group: "Inventory" },
  { to: "/inventory/stock_summary", icon: "bi-graph-up", label: "Stock Summary", match: (p) => p.startsWith("/inventory/stock_summary") || p === "/stock" },
  { to: "/inventory/daily_transactions", icon: "bi-list-check", label: "Daily Breakdown", match: (p) => p.startsWith("/inventory/daily_transactions") || p === "/daily" },
  { to: "/tracking", icon: "bi-clock-history", label: "History", match: (p) => p.startsWith("/tracking") || p === "/history" },
  {
    label: "Transactions",
    icon: "bi-diagram-3",
    match: (p) => ["/grn", "/bookings", "/direct_sales", "/sales", "/material_returns", "/returns"].includes(p),
    children: [
      { to: "/grn", icon: "bi-box-arrow-in-down", label: "GRN (Receiving)" },
      { to: "/bookings", icon: "bi-bookmark-plus", label: "Bookings" },
      { to: "/direct_sales", icon: "bi-cart-check", label: "Sales", match: (p) => p === "/direct_sales" || p === "/sales" },
      { to: "/material_returns", icon: "bi-arrow-counterclockwise", label: "Material Return", match: (p) => p === "/material_returns" || p === "/returns" }
    ]
  },
  { to: "/payments", icon: "bi-cash-stack", label: "Payments" },
  { to: "/accounts", icon: "bi-calculator", label: "Accounts", match: (p) => p.startsWith("/accounts") },
  { to: "/cash_flow", icon: "bi-water", label: "Cash Flow", match: (p) => p.startsWith("/cash_flow") || p.startsWith("/cash-flow") },
  { to: "/delivery_rents", icon: "bi-truck", label: "Delivery Rent", match: (p) => p === "/delivery_rents" || p === "/delivery-rents" },
  { to: "/delivery_persons", icon: "bi-journal-check", label: "Delivery Person Ledger", match: (p) => p.startsWith("/delivery_person") || p.startsWith("/drivers") },
  { to: "/clients", icon: "bi-journal-text", label: "Client Ledger", match: (p) => p.startsWith("/clients") || p.startsWith("/ledger") },
  { to: "/suppliers", icon: "bi-journal-richtext", label: "Supplier Ledger", match: (p) => p.startsWith("/suppliers") && !p.includes("payments") },
  { to: "/accounts/payments/suppliers", icon: "bi-cash-stack", label: "Pay Supplier", match: (p) => p.startsWith("/accounts/payments/suppliers") },
  { to: "/decision_ledger", icon: "bi-clipboard-data", label: "Decision Ledger" },
  { to: "/pending_bills", icon: "bi-receipt", label: "Pending Bills", match: (p) => p === "/pending_bills" || p === "/pending" },
  { to: "/current_payables", icon: "bi-wallet2", label: "Current Payables", match: (p) => p === "/current_payables" || p === "/unpaid_transactions" },
  { to: "/profit_reports", icon: "bi-bar-chart-line", label: "Profit Reports", match: (p) => p === "/profit_reports" || p === "/profit-reports" },
  { to: "/notifications", icon: "bi-bell", label: "Notifications" },
  { to: "/import_export", icon: "bi-arrow-left-right", label: "Import & Export", match: (p) => p.startsWith("/import_export") || p.startsWith("/import-export") },
  { group: "Directory" },
  { to: "/materials", icon: "bi-tags", label: "Material Brands" },
  { to: "/delivery_persons", icon: "bi-person-badge", label: "Delivery Persons", match: (p) => p === "/delivery_persons" || p === "/drivers" },
  { group: "System" },
  { to: "/settings", icon: "bi-gear", label: "Settings" }
];

function pathActive(item: { to?: string; end?: boolean; match?: (path: string) => boolean }, path: string) {
  if (item.match) return item.match(path);
  if (!item.to) return false;
  if (item.end) return path === item.to;
  return path === item.to || path.startsWith(`${item.to}/`);
}

export default function AppShell({
  today,
  user
}: {
  today: string;
  user: { username?: string; role?: string };
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "light");
  const location = useLocation();
  const path = location.pathname;
  const txOpenDefault = ["/grn", "/bookings", "/direct_sales", "/sales", "/material_returns", "/returns"].includes(path);
  const [txOpen, setTxOpen] = useState(txOpenDefault);

  useEffect(() => {
    setOpen(false);
    if (txOpenDefault) setTxOpen(true);
  }, [path, txOpenDefault]);

  useEffect(() => {
    const nav = document.querySelector(".sidebar-nav-container") as HTMLElement | null;
    if (!nav) return;
    const saved = Number(localStorage.getItem("sidebar_scroll_top") || 0);
    if (saved) nav.scrollTop = saved;
    const onScroll = () => localStorage.setItem("sidebar_scroll_top", String(nav.scrollTop || 0));
    nav.addEventListener("scroll", onScroll);
    return () => nav.removeEventListener("scroll", onScroll);
  }, []);

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      try { sessionStorage.setItem("ams_logged_out", "1"); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("ams:unauthorized"));
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem("ams_theme", next); } catch { /* ignore */ }
    setTheme(next);
  }

  const initial = useMemo(() => String(user.username || "A").slice(0, 1).toUpperCase(), [user.username]);

  return (
    <>
      <div className="mobile-header">
        <button className="btn btn-link p-0" type="button" onClick={() => setOpen(true)} aria-label="Open menu">
          <i className="bi bi-list fs-2" />
        </button>
        <h5 className="fw-bold mb-0">AMS <span className="text-warning">SYSTEM</span></h5>
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="theme-switch" onClick={toggleTheme}>
            <i className={`bi ${theme === "dark" ? "bi-moon-stars-fill" : "bi-brightness-high-fill"}`} />
            <span className="theme-label">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={logout}>
            <i className="bi bi-box-arrow-right" />
          </button>
        </div>
      </div>

      <div className={`sidebar-overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar shadow ${open ? "show" : ""}`} id="sidebar">
        <div className="p-4 text-center border-bottom border-secondary border-opacity-25">
          <NavLink to="/" className="text-decoration-none" onClick={() => setOpen(false)}>
            <h4 className="fw-bold mb-0" style={{ color: "var(--text-primary)" }}>
              AMS <span className="text-warning">SYSTEM</span>
            </h4>
            <small className="text-uppercase d-block" style={{ fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>
              FOR EASE
            </small>
          </NavLink>
        </div>

        <div className="sidebar-nav-container">
          <nav className="py-3">
            {NAV.map((item, idx) => {
              if (item.group) {
                return (
                  <div key={`${item.group}-${idx}`} className="nav-group-title">
                    {item.group}
                  </div>
                );
              }
              if (item.children) {
                const groupActive = pathActive(item, path);
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      className={`nav-link nav-toggle-btn ${groupActive || txOpen ? "active" : ""}`}
                      onClick={() => setTxOpen((v) => !v)}
                    >
                      <span className="nav-toggle-label">
                        <i className={`bi ${item.icon}`} /> {item.label}
                      </span>
                      <i className={`bi bi-chevron-down nav-caret ${txOpen || groupActive ? "rotated" : ""}`} />
                    </button>
                    <div className={`nav-submenu ${txOpen || groupActive ? "show" : ""}`}>
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={() => `nav-link ${pathActive(child, path) ? "active" : ""}`}
                          onClick={() => setOpen(false)}
                        >
                          <i className={`bi ${child.icon}`} /> {child.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <NavLink
                  key={`${item.to}-${item.label}`}
                  to={item.to!}
                  end={item.end}
                  className={() => `nav-link ${pathActive(item, path) ? "active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  <i className={`bi ${item.icon}`} /> {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-top border-secondary">
          <div className="d-flex align-items-center mb-3 px-2">
            <div
              className="bg-warning rounded-circle me-2 d-flex align-items-center justify-content-center text-dark fw-bold"
              style={{ width: 32, height: 32, flexShrink: 0 }}
            >
              {initial}
            </div>
            <div className="overflow-hidden">
              <div className="fw-bold small text-truncate" style={{ color: "var(--text-primary)" }}>{user.username || "Admin"}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{(user.role || "admin").toUpperCase()}</div>
            </div>
          </div>
          <button type="button" className="theme-switch w-100 mb-2 justify-content-center" onClick={toggleTheme}>
            <i className={`bi ${theme === "dark" ? "bi-moon-stars-fill" : "bi-sun-fill"}`} />
            <span className="theme-label">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <button type="button" className="btn btn-outline-danger w-100 btn-sm fw-bold py-2 rounded-pill" onClick={logout}>
            <i className="bi bi-box-arrow-right me-2" /> Logout
          </button>
          <div className="text-center mt-2" style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{today}</div>
        </div>
      </aside>

      <div className="main-content ui-v2">
        <div className="container-fluid px-0 px-sm-2">
          <Outlet />
        </div>
      </div>
    </>
  );
}
