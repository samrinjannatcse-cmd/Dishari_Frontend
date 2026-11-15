import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, setLogoutHandler, tokens, type User } from "@/api/client";
import { useI18n } from "@/i18n/I18n";

export type Role = "admin" | "teacher" | "moderator" | "student" | "parent";
export type Portal = "staff" | "student" | "parent" | "admin";
export type Pending = { pending: true; message: string; message_bn: string };

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string, portal?: Portal) => Promise<User>;
  register: (body: Record<string, unknown>) => Promise<User | Pending>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  has: (...r: Role[]) => boolean;
};
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

type TokenOut = { access_token: string; refresh_token: string; user: User };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const { setLang } = useI18n();

  const clear = useCallback(() => { tokens.set(null); setUser(null); }, []);
  useEffect(() => setLogoutHandler(clear), [clear]);

  useEffect(() => {
    if (!tokens.get()) { setReady(true); return; }
    api<User>("/auth/me").then(setUser).catch(clear).finally(() => setReady(true));
  }, [clear]);

  const accept = (d: TokenOut) => {
    tokens.set({ access: d.access_token, refresh: d.refresh_token });
    setUser(d.user);
    if (d.user.language_pref === "bn" || d.user.language_pref === "en") setLang(d.user.language_pref);
    return d.user;
  };

  const value: Ctx = {
    user, ready,
    login: async (email, password, portal) => accept(await api<TokenOut>("/auth/login", { body: { email, password, portal }, auth: false })),
    register: async (body) => {
      const r = await api<TokenOut | Pending>("/auth/register", { body, auth: false });
      return "pending" in r ? r : accept(r);
    },
    logout: () => { api("/auth/logout", { method: "POST" }).catch(() => {}); clear(); },
    refreshMe: async () => setUser(await api<User>("/auth/me")),
    has: (...r) => !!user && r.some((x) => user.roles.includes(x)),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, ready, has } = useAuth();
  const loc = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !has(...roles)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
