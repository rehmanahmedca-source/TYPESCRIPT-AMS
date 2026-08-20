import { FormEvent, useState } from "react";
import { api } from "../api";

export default function Login({ onLogin }: { onLogin: (user: Record<string, unknown>) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ user: Record<string, unknown> }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") })
      });
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3 auth-page">
      <div className="card border-0 shadow-lg auth-card" style={{ width: "100%", maxWidth: 430 }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div className="display-5 text-warning mb-2"><i className="bi bi-box-seam-fill" /></div>
            <h1 className="h3 mb-1">AMS SYSTEM</h1>
            <p className="text-muted mb-0">Ahmed Material System</p>
          </div>
          {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="username">Username</label>
              <input id="username" name="username" className="form-control form-control-lg" autoComplete="username" autoFocus required />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="form-control form-control-lg" autoComplete="current-password" required />
            </div>
            <button className="btn btn-warning btn-lg w-100 fw-bold" disabled={busy}>
              {busy ? "Signing in…" : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
