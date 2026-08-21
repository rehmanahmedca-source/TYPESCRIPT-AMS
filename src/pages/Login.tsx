import { FormEvent, useState } from "react";
import { api } from "../api";

function savedUsername() {
  try {
    return localStorage.getItem("ams_remembered_username") || "";
  } catch {
    return "";
  }
}

function loggedOutNotice() {
  try {
    const visible = sessionStorage.getItem("ams_logged_out") === "1" || new URLSearchParams(window.location.search).get("logged_out") === "1";
    sessionStorage.removeItem("ams_logged_out");
    return visible;
  } catch {
    return false;
  }
}

export default function Login({ onLogin }: { onLogin: (user: Record<string, unknown>) => void }) {
  const [username, setUsername] = useState(savedUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => {
    try { return localStorage.getItem("ams_remember_me") === "true"; } catch { return false; }
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

  async function handleLogin(u: string, p: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: Record<string, unknown> }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: u.trim(), password: p, remember_me: remember })
      });
      try {
        if (remember) {
          localStorage.setItem("ams_remembered_username", u.trim());
          localStorage.setItem("ams_remember_me", "true");
        } else {
          localStorage.removeItem("ams_remembered_username");
          localStorage.setItem("ams_remember_me", "false");
        }
      } catch { /* storage may be disabled */ }
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid Credentials");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleLogin(username, password);
  }

  return (
    <main className="ams-login-page">
      <section className="ams-login-card" aria-labelledby="login-title">
        <div className="ams-login-theme-row">
          <button type="button" className="ams-login-theme" onClick={toggleTheme} aria-label="Toggle theme">
            <i className={`bi ${theme === "dark" ? "bi-moon-stars-fill" : "bi-brightness-high-fill"}`} />
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </div>

        <header className="ams-login-brand">
          <h1 id="login-title">
            <span className="brand-ams">AMS</span> <span className="brand-system">SYSTEM</span>
          </h1>
          <p>FOR EASE ACCESS</p>
        </header>

        {(notice || !error) && (
          <div className="ams-login-alert" role="status">
            {notice ? "You have been logged out." : "Please log in to access this page."}
          </div>
        )}
        {error && (
          <div className="ams-login-alert error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="ams-login-form">
          <div className="ams-login-field">
            <label htmlFor="username">USERNAME</label>
            <div className="ams-login-input">
              <i className="bi bi-person" />
              <input
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="ams-login-field">
            <label htmlFor="password">PASSWORD</label>
            <div className="ams-login-input">
              <i className="bi bi-lock" />
              <input
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <div className="ams-login-options">
            <label>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <span>Show password</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          </div>

          <button type="submit" className="ams-login-submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                SIGNING IN…
              </>
            ) : (
              "SECURE LOGIN"
            )}
          </button>
        </form>

        <footer>© 2026 AMS SYSTEM FOR EASE</footer>
      </section>
    </main>
  );
}
