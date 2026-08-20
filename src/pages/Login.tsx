import { FormEvent, useState } from "react";
import { api } from "../api";

function savedUsername() {
  try {
    return localStorage.getItem("ams_remembered_username") || "Admin";
  } catch {
    return "Admin";
  }
}

function loggedOutNotice() {
  try {
    const visible = sessionStorage.getItem("ams_logged_out") === "1";
    sessionStorage.removeItem("ams_logged_out");
    return visible;
  } catch {
    return false;
  }
}

export default function Login({ onLogin }: { onLogin: (user: Record<string, unknown>) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => {
    try { return Boolean(localStorage.getItem("ams_remembered_username")); } catch { return false; }
  });
  const [notice] = useState(loggedOutNotice);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "light");

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem("ams_theme", next); } catch { /* storage may be disabled */ }
    setTheme(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim();
    try {
      const result = await api<{ user: Record<string, unknown> }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: form.get("password"), remember_me: remember })
      });
      try {
        if (remember) localStorage.setItem("ams_remembered_username", username);
        else localStorage.removeItem("ams_remembered_username");
      } catch { /* storage may be disabled */ }
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ams-login-page">
      <section className="ams-login-card" aria-labelledby="login-title">
        <div className="ams-login-theme-row">
          <button type="button" className="ams-login-theme" onClick={toggleTheme}>
            <i className={`bi ${theme === "dark" ? "bi-moon-stars-fill" : "bi-brightness-high-fill"}`} />
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>

        <header className="ams-login-brand">
          <h1 id="login-title"><span className="brand-ams">AMS</span> <span className="brand-system">SYSTEM</span></h1>
          <p>FOR EASE ACCESS</p>
        </header>

        {notice && <div className="ams-login-alert" role="status">You have been logged out.</div>}
        {error && <div className="ams-login-alert error" role="alert">{error}</div>}

        <form onSubmit={submit} className="ams-login-form">
          <div className="ams-login-field">
            <label htmlFor="username">USERNAME</label>
            <div className="ams-login-input">
              <i className="bi bi-person" />
              <input id="username" name="username" defaultValue={savedUsername()} autoComplete="username" autoFocus required />
            </div>
          </div>

          <div className="ams-login-field">
            <label htmlFor="password">PASSWORD</label>
            <div className="ams-login-input">
              <i className="bi bi-lock" />
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
            </div>
          </div>

          <div className="ams-login-options">
            <label><input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> <span>Show password</span></label>
            <label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> <span>Remember me</span></label>
          </div>

          <button className="ams-login-submit" disabled={busy}>
            {busy ? <><span className="spinner-border spinner-border-sm" /> SIGNING IN…</> : <><i className="bi bi-shield-lock" /> SECURE LOGIN</>}
          </button>
        </form>

        <footer>© {new Date().getFullYear()} AMS SYSTEM FOR EASE</footer>
      </section>
    </main>
  );
}
