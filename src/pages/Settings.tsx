import { useState, useEffect } from "react";
import { PageHeader } from "../components/ui";
import { api } from "../api";
import { SettingsRow } from "./settings/types";
import { CompanySettingsTab } from "./settings/CompanySettingsTab";
import { PasswordTab } from "./settings/PasswordTab";
import { CategoriesTab } from "./settings/CategoriesTab";
import { UsersTab } from "./settings/UsersTab";
import { AuditLogsTab } from "./settings/AuditLogsTab";
import { ReconciliationTab } from "./settings/ReconciliationTab";
import { WipeTab } from "./settings/WipeTab";
import { Link } from "react-router-dom";

type ActiveTab = "company" | "password" | "categories" | "users" | "audit" | "reconciliation" | "wipe";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("company");
  const [settings, setSettings] = useState<SettingsRow>({});
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string }>({
    username: "Admin",
    role: "admin"
  });
  const [loading, setLoading] = useState(true);

  async function loadBootstrap() {
    setLoading(true);
    try {
      const data = await api<{ settings: SettingsRow; user: { username: string; role: string } }>("/bootstrap");
      if (data) {
        setSettings(data.settings || {});
        if (data.user) {
          setCurrentUser(data.user);
        }
      }
    } catch (err) {
      console.error("Failed to load settings bootstrap:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBootstrap();
  }, []);

  return (
    <div className="settings-page">
      <PageHeader
        icon="bi-gear-fill"
        title="Settings & System Administration"
        subtitle="Manage company defaults, user access controls, material categories, audit trail, reconciliation, and database maintenance."
      >
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
          <i className="bi bi-speedometer2" /> Back to Dashboard
        </Link>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          onClick={loadBootstrap}
        >
          <i className="bi bi-arrow-clockwise" /> Refresh All
        </button>
      </PageHeader>

      {/* Navigation Tabs Header */}
      <div className="mb-4">
        <ul className="nav nav-pills gap-2 flex-wrap p-2 rounded-3 bg-body-tertiary border border-secondary border-opacity-25">
          <li className="nav-item">
            <button
              className={`nav-link ${
                activeTab === "company" ? "active bg-warning text-dark fw-bold" : "text-light"
              } d-flex align-items-center gap-2 py-2 px-3`}
              onClick={() => setActiveTab("company")}
            >
              <i className="bi bi-building" /> Company & General
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${
                activeTab === "password" ? "active bg-warning text-dark fw-bold" : "text-light"
              } d-flex align-items-center gap-2 py-2 px-3`}
              onClick={() => setActiveTab("password")}
            >
              <i className="bi bi-key-fill" /> Change Password
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${
                activeTab === "categories" ? "active bg-warning text-dark fw-bold" : "text-light"
              } d-flex align-items-center gap-2 py-2 px-3`}
              onClick={() => setActiveTab("categories")}
            >
              <i className="bi bi-tags-fill" /> Material Categories
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${
                activeTab === "users" ? "active bg-warning text-dark fw-bold" : "text-light"
              } d-flex align-items-center gap-2 py-2 px-3`}
              onClick={() => setActiveTab("users")}
            >
              <i className="bi bi-people-fill" /> User Management
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${
                activeTab === "audit" ? "active bg-warning text-dark fw-bold" : "text-light"
              } d-flex align-items-center gap-2 py-2 px-3`}
              onClick={() => setActiveTab("audit")}
            >
              <i className="bi bi-clock-history" /> Audit Trail & Sessions
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${
                activeTab === "reconciliation" ? "active bg-warning text-dark fw-bold" : "text-light"
              } d-flex align-items-center gap-2 py-2 px-3`}
              onClick={() => setActiveTab("reconciliation")}
            >
              <i className="bi bi-patch-check-fill" /> Data Reconciliation
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${
                activeTab === "wipe" ? "active bg-danger text-white fw-bold" : "text-danger"
              } d-flex align-items-center gap-2 py-2 px-3`}
              onClick={() => setActiveTab("wipe")}
            >
              <i className="bi bi-trash3-fill" /> Maintenance & Wipe
            </button>
          </li>
        </ul>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="text-center py-5 text-secondary">
          <div className="spinner-border text-warning mb-2" role="status" />
          <div>Loading system settings and configurations...</div>
        </div>
      ) : (
        <div>
          {activeTab === "company" && (
            <CompanySettingsTab
              settings={settings}
              onUpdated={(updated) => setSettings(updated)}
            />
          )}

          {activeTab === "password" && (
            <PasswordTab currentUsername={currentUser.username} />
          )}

          {activeTab === "categories" && <CategoriesTab />}

          {activeTab === "users" && <UsersTab currentUsername={currentUser.username} />}

          {activeTab === "audit" && <AuditLogsTab />}

          {activeTab === "reconciliation" && <ReconciliationTab />}

          {activeTab === "wipe" && <WipeTab />}
        </div>
      )}
    </div>
  );
}
