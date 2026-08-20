export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const TOKEN_KEY = "ams_session_token";
const CSRF_KEY = "ams_csrf_token";

export function getAuthToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token?: string, csrf?: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (csrf) localStorage.setItem(CSRF_KEY, csrf);
    else if (!token) localStorage.removeItem(CSRF_KEY);
  } catch {
    // storage may be disabled
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CSRF_KEY);
  } catch {
    // storage may be disabled
  }
}

function cookie(name: string) {
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    const hit = document.cookie.split("; ").find((part) => part.startsWith(prefix));
    return hit ? decodeURIComponent(hit.slice(prefix.length)) : "";
  } catch {
    return "";
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = String(init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAuthToken();
  if (token) {
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    if (!headers.has("X-AMS-Session")) headers.set("X-AMS-Session", token);
  }

  const csrf = cookie("ams_csrf") || (() => {
    try { return localStorage.getItem(CSRF_KEY) || ""; } catch { return ""; }
  })();
  if (csrf && !headers.has("X-AMS-CSRF")) {
    headers.set("X-AMS-CSRF", csrf);
  }

  const res = await fetch(`/api${path}`, { ...init, method, headers, credentials: "include" });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/me") {
      clearAuthToken();
      window.dispatchEvent(new CustomEvent("ams:unauthorized"));
    }
    const message = (data && typeof data === "object" && "error" in data && typeof (data as any).error === "string")
      ? (data as any).error
      : (typeof data === "string" && data.length < 200 ? data : res.statusText || `Request failed with status ${res.status}`);
    throw new ApiError(message, res.status);
  }

  if (data && typeof data === "object" && "token" in data && typeof (data as any).token === "string") {
    setAuthToken((data as any).token, typeof (data as any).csrf === "string" ? (data as any).csrf : undefined);
  }

  return data as T;
}

export async function downloadUrl(path: string, fallbackFilename?: string) {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["X-AMS-Session"] = token;
    }
    const res = await fetch(`/api${path}`, { headers, credentials: "include" });
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    let filename = fallbackFilename || "download.xlsx";
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (match && match[1]) filename = decodeURIComponent(match[1]);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  } catch {
    const token = getAuthToken();
    const sep = path.includes("?") ? "&" : "?";
    window.location.href = token ? `/api${path}${sep}token=${encodeURIComponent(token)}` : `/api${path}`;
  }
}
