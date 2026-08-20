import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { db, one, run } from "./db.ts";
import { pkNow } from "./money.ts";

export type AuthUser = {
  id: number;
  username: string;
  role: string;
  status: string;
  [permission: string]: unknown;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      authSessionId?: string;
    }
  }
}

const SESSION_COOKIE = "ams_session";
const CSRF_COOKIE = "ams_csrf";
const SESSION_DAYS = 14;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const secret = process.env.SECRET_KEY || crypto.randomBytes(32).toString("hex");

function csrfFor(sid: string) {
  return crypto.createHmac("sha256", secret).update(sid).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicUser(user: AuthUser) {
  const { password_hash: _hash, password_plain: _plain, ...safe } = user;
  return safe;
}

function readSession(req: Request): AuthUser | undefined {
  const sid = String(req.cookies?.[SESSION_COOKIE] || "");
  if (!/^[a-f0-9]{40}$/.test(sid)) return undefined;
  const row = one<AuthUser & { sid: string; ended_at?: string; last_seen_at?: string }>(
    `SELECT u.*, s.sid, s.ended_at, s.last_seen_at
       FROM user_login_session s
       JOIN user u ON u.id = s.user_id
      WHERE s.sid = ? AND s.ended_at IS NULL
      LIMIT 1`,
    [sid]
  );
  if (!row || String(row.status || "").toLowerCase() !== "active") return undefined;
  const lastSeen = row.last_seen_at ? Date.parse(String(row.last_seen_at).replace(" ", "T") + "Z") : Date.now();
  if (Date.now() - lastSeen > SESSION_DAYS * 86400_000) {
    run("UPDATE user_login_session SET ended_at = ? WHERE sid = ?", [pkNow(), sid]);
    return undefined;
  }
  req.authSessionId = sid;
  return row;
}

export function attachAuth(req: Request, _res: Response, next: NextFunction) {
  req.authUser = readSession(req);
  if (req.authUser && req.authSessionId) {
    run("UPDATE user_login_session SET last_seen_at = ? WHERE sid = ?", [pkNow(), req.authSessionId]);
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) return res.status(401).json({ ok: false, error: "Authentication required" });
  if (MUTATING.has(req.method)) {
    const cookie = String(req.cookies?.[CSRF_COOKIE] || "");
    const header = String(req.get("x-ams-csrf") || "");
    const expected = csrfFor(req.authSessionId || "");
    if (!cookie || !header || !safeEqual(cookie, header) || !safeEqual(header, expected)) {
      return res.status(403).json({ ok: false, error: "Invalid CSRF token" });
    }
  }
  next();
}

const PERMISSION_BY_PREFIX: Array<[string, string]> = [
  ["/settings", "can_access_settings"],
  ["/security", "can_access_settings"],
  ["/backup", "can_access_settings"],
  ["/material-categories", "can_manage_materials"],
  ["/users", "can_access_settings"],
  ["/import", "can_import_export"],
  ["/export", "can_import_export"],
  ["/accounts", "can_manage_accounts"],
  ["/cash-flow", "can_view_cash_flow"],
  ["/reconciliation/scan", "can_access_settings"],
  ["/reconciliation/purge", "can_access_settings"],
  ["/reconciliation", "can_view_cash_flow"],
  ["/materials", "can_manage_materials"],
  ["/daily", "can_view_daily"],
  ["/grn", "can_manage_grn"],
  ["/bookings", "can_manage_bookings"],
  ["/add_booking", "can_manage_bookings"],
  ["/sales", "can_manage_sales"],
  ["/returns", "can_manage_sales"],
  ["/payments", "can_manage_payments"],
  ["/pending-bills", "can_manage_pending_bills"],
  ["/clients", "can_manage_clients"],
  ["/suppliers", "can_manage_suppliers"],
  ["/drivers", "can_manage_delivery_persons"],
  ["/delivery-rents", "can_view_delivery_rent"],
  ["/reports", "can_view_reports"],
  ["/profit-reports", "can_view_reports"]
];

export function enforcePermission(req: Request, res: Response, next: NextFunction) {
  const user = req.authUser!;
  if (["admin", "root"].includes(String(user.role || "").toLowerCase())) return next();
  const match = PERMISSION_BY_PREFIX.find(([prefix]) => req.path.startsWith(prefix));
  if (!match || Boolean(user[match[1]])) return next();
  return res.status(403).json({ ok: false, error: "You do not have permission for this action" });
}

export const authApi = Router();

authApi.get("/me", (req, res) => {
  if (!req.authUser || !req.authSessionId) return res.status(401).json({ ok: false, error: "Authentication required" });
  const csrf = csrfFor(req.authSessionId);
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.SESSION_COOKIE_SECURE === "1",
    maxAge: SESSION_DAYS * 86400_000,
    path: "/"
  });
  res.json({ ok: true, user: publicUser(req.authUser), csrf });
});

authApi.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const user = one<AuthUser & { password_hash?: string; password_plain?: string }>(
    "SELECT * FROM user WHERE lower(trim(username)) = lower(?) ORDER BY id LIMIT 1",
    [username]
  );
  let valid = false;
  if (user && password) {
    try {
      valid = Boolean(user.password_hash && bcrypt.compareSync(password, user.password_hash));
    } catch {
      valid = false;
    }
    if (!valid) valid = user.password_plain === password || user.password_hash === password;
  }
  if (!user || !valid) return res.status(401).json({ ok: false, error: "Invalid Credentials" });
  if (String(user.status || "").toLowerCase() !== "active") {
    return res.status(403).json({ ok: false, error: "Account suspended" });
  }
  if (user.password_plain || user.password_hash === password) {
    run("UPDATE user SET password_hash = ?, password_plain = NULL WHERE id = ?", [bcrypt.hashSync(password, 12), user.id]);
  }
  const sid = crypto.randomBytes(20).toString("hex");
  const now = pkNow();
  run(
    `INSERT INTO user_login_session (sid, user_id, username, role, ip, user_agent, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sid, user.id, user.username, user.role, req.ip, String(req.get("user-agent") || "").slice(0, 300), now, now]
  );
  const secure = process.env.SESSION_COOKIE_SECURE === "1";
  const remember = req.body?.remember_me === true || req.body?.remember_me === 1 || req.body?.remember_me === "1";
  const persistent = remember ? { maxAge: SESSION_DAYS * 86400_000 } : {};
  res.cookie(SESSION_COOKIE, sid, { httpOnly: true, sameSite: "lax", secure, path: "/", ...persistent });
  const csrf = csrfFor(sid);
  res.cookie(CSRF_COOKIE, csrf, { httpOnly: false, sameSite: "lax", secure, path: "/", ...persistent });
  res.json({ ok: true, user: publicUser(user), csrf });
});

authApi.post("/logout", requireAuth, (req, res) => {
  if (req.authSessionId) run("UPDATE user_login_session SET ended_at = ? WHERE sid = ?", [pkNow(), req.authSessionId]);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
  res.json({ ok: true });
});
