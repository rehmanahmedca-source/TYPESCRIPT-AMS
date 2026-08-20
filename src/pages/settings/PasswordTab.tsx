import { useState, FormEvent } from "react";
import { api } from "../../api";

export function PasswordTab({ currentUsername }: { currentUsername?: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (newPassword.length < 4) {
      setFeedback({ type: "error", text: "New password must be at least 4 characters long." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    setSaving(true);
    try {
      const res = await api<{ ok: boolean; message?: string; error?: string }>("/settings/password", {
        method: "POST",
        body: JSON.stringify({
          newPassword,
          targetUsername: currentUsername
        })
      });

      if (res.ok) {
        setFeedback({ type: "success", text: res.message || "Password changed successfully." });
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to update password." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "An unexpected error occurred." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <div className="ui-card">
          <div className="ui-card-header">
            <h5>
              <i className="bi bi-key-fill text-warning" /> Update Administrator Credentials
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
              <div className="mb-3">
                <label className="form-label fw-bold small text-secondary">Target User Account</label>
                <input
                  type="text"
                  disabled
                  className="form-control bg-body-tertiary"
                  value={currentUsername || "Admin"}
                />
                <div className="form-text text-muted">Currently active operator session.</div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold small text-secondary">
                  New Password <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={4}
                    className="form-control"
                    placeholder="Enter new password (min 4 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold small text-secondary">
                  Confirm New Password <span className="text-danger">*</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={4}
                  className="form-control"
                  placeholder="Re-enter new password to verify"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="d-flex align-items-center gap-3">
                <button type="submit" disabled={saving} className="btn btn-warning px-4 fw-bold">
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" /> Updating Password...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-shield-lock me-2" /> Change Password
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setNewPassword("");
                    setConfirmPassword("");
                    setFeedback(null);
                  }}
                  disabled={saving}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="ui-card">
          <div className="ui-card-header">
            <h5>
              <i className="bi bi-info-circle text-warning" /> Password & Access Guidelines
            </h5>
          </div>
          <div className="ui-card-body small text-secondary">
            <ul className="ps-3 mb-3 d-flex flex-column gap-2">
              <li>
                Passwords are automatically hashed with industry standard <strong>bcrypt</strong> before being stored in the database.
              </li>
              <li>
                Updating your password takes effect immediately for new login attempts.
              </li>
              <li>
                The default seeded administrative account is <code>Admin</code> with password <code>admin</code>.
              </li>
              <li>
                To manage passwords or permission sets for other staff members, please navigate to the <strong>User Management</strong> tab.
              </li>
            </ul>
            <div className="alert alert-secondary bg-body-tertiary border-secondary border-opacity-25 py-2 px-3 mb-0 small">
              <i className="bi bi-lock-fill text-warning me-2" />
              Keep your credentials confidential and never share administrator logins.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
