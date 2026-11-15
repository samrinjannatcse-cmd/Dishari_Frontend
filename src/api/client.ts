/**
 * Single HTTP client for the Dishari backend.
 * - Adds the JWT, refreshes once on TOKEN_EXPIRED, then retries.
 * - Every failure becomes ApiError with the backend's {code, message, fields}.
 */
import type { components } from "./schema";

export type S = components["schemas"];
export type User = S["UserOut"];
export type Question = S["QuestionOut"];
export type TagView = S["TagView"];
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:8000";
const BASE = `${API_URL}/v1`;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

const KEY = "dishari.tokens";
type Tokens = { access: string; refresh: string };

export const tokens = {
  get(): Tokens | null {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
  },
  set(t: Tokens | null) {
    try { t ? localStorage.setItem(KEY, JSON.stringify(t)) : localStorage.removeItem(KEY); } catch { /* private mode */ }
  },
};

let onLogout: () => void = () => {};
export const setLogoutHandler = (fn: () => void) => { onLogout = fn; };

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const t = tokens.get();
  if (!t) return false;
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: t.refresh }),
  }).then(async (r) => {
    if (!r.ok) return false;
    const d = await r.json();
    tokens.set({ access: d.access_token, refresh: d.refresh_token });
    return true;
  }).catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}

type Opts = { method?: string; body?: unknown; form?: FormData; query?: Record<string, unknown>; raw?: boolean; auth?: boolean };

export async function api<T = unknown>(path: string, o: Opts = {}, retry = true): Promise<T> {
  const url = new URL(BASE + path);
  Object.entries(o.query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const headers: Record<string, string> = {};
  const t = tokens.get();
  if (t && o.auth !== false) headers.Authorization = `Bearer ${t.access}`;
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(url, { method: o.method || (o.body || o.form ? "POST" : "GET"), headers, body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined) });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server");
  }
  if (res.status === 401 && retry && t) {
    const err = await res.clone().json().catch(() => ({}));
    if (err?.error?.code === "TOKEN_EXPIRED" && (await refresh())) return api<T>(path, o, false);
    if (path !== "/auth/login") { tokens.set(null); onLogout(); }
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new ApiError(res.status, e?.error?.code || "HTTP_" + res.status, e?.error?.message || res.statusText, e?.error?.fields || {});
  }
  if (o.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Download a file endpoint (template / export / results) with the token. */
export async function download(path: string, query?: Record<string, unknown>, fallbackName = "download") {
  const res = await api<Response>(path, { query, raw: true });
  const cd = res.headers.get("Content-Disposition") || "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName;
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Open an HTML endpoint (print view) in a new tab with the token. */
export async function openHtml(path: string, query?: Record<string, unknown>) {
  const w = window.open("", "_blank");
  const res = await api<Response>(path, { query, raw: true });
  const html = await res.text();
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  if (w) w.location.href = url; else window.location.href = url;
}

export const mediaUrl = (u?: string | null) => (u ? `${API_URL}${u}` : null);
