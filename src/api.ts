export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function cookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`;
  const hit = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : "";
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = String(init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = cookie("ams_csrf");
    if (csrf) headers.set("X-AMS-CSRF", csrf);
  }
  const res = await fetch(`/api${path}`, { ...init, method, headers, credentials: "same-origin" });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/me") {
      window.dispatchEvent(new CustomEvent("ams:unauthorized"));
    }
    throw new ApiError((data && typeof data === "object" && data.error) || String(data) || res.statusText, res.status);
  }
  return data as T;
}

export function downloadUrl(path: string) {
  window.location.href = `/api${path}`;
}
