import { useState, FormEvent } from "react";
import { api } from "../../api";
import { SettingsRow } from "./types";

export function CompanySettingsTab({
  settings,
  onUpdated
}: {
  settings: SettingsRow;
  onUpdated: (next: SettingsRow) => void;
}) {
  const [form, setForm] = useState<SettingsRow>(settings);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api<{ ok: boolean; settings: SettingsRow }>("/settings", {
        method: "POST",
        body: JSON.stringify(form)
      });
      if (res.ok && res.settings) {
        onUpdated(res.settings);
        setForm(res.settings);
        setFeedback({ type: "success", text: "Company settings updated successfully." });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: "error", text: "Failed to update company settings." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "An unexpected error occurred." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <div className="ui-card">
          <div className="ui-card-header">
            <h5>
              <i className="bi bi-building text-warning" /> Company Identity & Global Stock Rules
            </h5>
          </div>
          <div className="ui-card-body">
            {feedback && (
              <div
                className={`alert ${
                  feedback.type === "success" ? "alert-success" : "alert-danger"
                } py-2 px-3 mb-4 d-flex align-items-center gap-2`}
              >
                <i className={`bi ${feedback.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold small text-secondary">
                    Company Legal / Yard Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Ahmed Cement & Building Material Corp."
                    value={form.company_name || ""}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold small text-secondary">Official Phone Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. +92 300 1234567"
                    value={form.company_phone || ""}
                    onChange={(e) => setForm({ ...form, company_phone: e.target.value })}
                  />
                </div>

                <div className="col-md-8">
                  <label className="form-label fw-bold small text-secondary">Physical Address / Yard Location</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Main National Highway, Yard #4, Hub / Karachi"
                    value={form.company_address || ""}
                    onChange={(e) => setForm({ ...form, company_address: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-bold small text-secondary">Contact Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. info@ahmedcement.com"
                    value={form.company_email || ""}
                    onChange={(e) => setForm({ ...form, company_email: e.target.value })}
                  />
                </div>

                <div className="col-12"><hr className="border-secondary opacity-25 my-2" /></div>

                <div className="col-md-4">
                  <label className="form-label fw-bold small text-secondary">Primary Currency Symbol/Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="PKR, USD, SAR, AED..."
                    value={form.currency || "PKR"}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  />
                  <div className="form-text text-muted">Applied across all invoices, ledgers, and cash flow.</div>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-bold small text-secondary">Default Standard Tax Rate (%)</label>
                  <div className="input-group">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      className="form-control"
                      value={form.tax_rate ?? 0}
                      onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
                    />
                    <span className="input-group-text bg-dark-subtle text-secondary">%</span>
                  </div>
                  <div className="form-text text-muted">Default rate auto-applied to newly created invoices.</div>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-bold small text-secondary">Default Theme Mode</label>
                  <select
                    className="form-select"
                    value={form.ui_theme || "dark"}
                    onChange={(e) => setForm({ ...form, ui_theme: e.target.value })}
                  >
                    <option value="dark">Dark Slate (Default)</option>
                    <option value="light">Light Crisp</option>
                  </select>
                  <div className="form-text text-muted">System default appearance for new user sessions.</div>
                </div>

                <div className="col-12"><hr className="border-secondary opacity-25 my-2" /></div>

                <div className="col-12">
                  <div className="p-3 rounded-3 bg-body-tertiary border border-secondary border-opacity-25 d-flex align-items-center justify-content-between">
                    <div>
                      <div className="fw-bold text-light">Allow Global Negative Stock</div>
                      <div className="text-secondary small">
                        When enabled, dispatch and sales can be posted even if physical quantity drops below zero.
                      </div>
                    </div>
                    <div className="form-check form-switch fs-4 mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="negativeStockSwitch"
                        checked={!!form.allow_global_negative_stock}
                        onChange={(e) =>
                          setForm({ ...form, allow_global_negative_stock: e.target.checked ? 1 : 0 })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="col-12 mt-4 pt-2 d-flex align-items-center gap-3">
                  <button type="submit" disabled={saving} className="btn btn-warning px-4 fw-bold">
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" /> Saving Changes...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-save me-2" /> Save Company Settings
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setForm(settings)}
                    disabled={saving}
                  >
                    Reset Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="col-lg-4">
        <div className="ui-card mb-4">
          <div className="ui-card-header">
            <h5>
              <i className="bi bi-cpu text-warning" /> System Engine Architecture
            </h5>
          </div>
          <div className="ui-card-body">
            <div className="d-flex flex-column gap-3 small">
              <div className="d-flex justify-content-between border-bottom pb-2 border-secondary border-opacity-25">
                <span className="text-secondary">Runtime Environment</span>
                <span className="fw-bold text-light">Node.js + React 18 SPA</span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2 border-secondary border-opacity-25">
                <span className="text-secondary">Database Engine</span>
                <span className="fw-bold text-light">SQLite (Local Fast Storage)</span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2 border-secondary border-opacity-25">
                <span className="text-secondary">Database File</span>
                <code className="text-warning">instance/ahmed_cement.db</code>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2 border-secondary border-opacity-25">
                <span className="text-secondary">Ledger Engine</span>
                <span className="fw-bold text-success">Double-Entry Verified</span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2 border-secondary border-opacity-25">
                <span className="text-secondary">XLSX Engine</span>
                <span className="fw-bold text-light">Master + Raw Workbooks</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-secondary">Audit Trail Level</span>
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  Continuous Real-Time
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card-header">
            <h5>
              <i className="bi bi-shield-check text-warning" /> Security Policy
            </h5>
          </div>
          <div className="ui-card-body small text-secondary">
            <p className="mb-2">
              All mutating API requests are guarded with CSRF protection, secure cookie sessions, and granular permission enforcement.
            </p>
            <p className="mb-0">
              Only authorized staff accounts with <code>can_access_settings</code> can modify system parameters, manage users, or run maintenance routines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
