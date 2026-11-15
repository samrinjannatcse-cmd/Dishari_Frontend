import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/Auth";
import { Icon, type IconName } from "@/components/Icon";
import { useMlStatus } from "@/api/hooks";
import { api, mediaUrl } from "@/api/client";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { Ribbons } from "@/motion";

type Item = { to: string; label: StrKey; icon: IconName; mobile?: boolean; badge?: "pending" | "feedback" };
const TEACHER: Item[] = [
  { to: "/app", label: "nav_dashboard", icon: "home", mobile: true },
  { to: "/app/bulk", label: "nav_upload_mcq", icon: "upload" },
  { to: "/app/tag-review", label: "nav_tag_review", icon: "check", mobile: true },
  { to: "/app/tag", label: "nav_tag", icon: "tag" },
  { to: "/app/questions", label: "nav_bank", icon: "database", mobile: true },
  { to: "/app/papers", label: "nav_exams", icon: "file", mobile: true },
  { to: "/app/tests", label: "nav_tests", icon: "clock" },
  { to: "/app/omr", label: "nav_omr", icon: "list" },
  { to: "/app/class-reports", label: "nav_class_reports", icon: "chart" },
  { to: "/app/groups", label: "nav_groups", icon: "users" },
  { to: "/app/ai", label: "nav_ai", icon: "cpu" },
  { to: "/app/settings", label: "nav_settings", icon: "settings", mobile: true },
];
const ADMIN: Item[] = [
  { to: "/app", label: "nav_dashboard", icon: "home", mobile: true },
  { to: "/app/admin?tab=users", label: "nav_users", icon: "users", mobile: true, badge: "pending" },
  { to: "/app/admin?tab=board", label: "nav_board", icon: "book", mobile: true },
  { to: "/app/admin?tab=taxonomy", label: "nav_taxonomy", icon: "layers" },
  { to: "/app/review", label: "nav_review", icon: "shield" },
  { to: "/app/questions", label: "nav_bank", icon: "database" },
  { to: "/app/settings", label: "nav_settings", icon: "settings", mobile: true },
  { to: "/app/admin?tab=models", label: "nav_model", icon: "cpu" },
  { to: "/app/admin?tab=audit", label: "nav_logs", icon: "history" },
];
const STUDENT: Item[] = [
  { to: "/app", label: "nav_home", icon: "home", mobile: true },
  { to: "/app/tests", label: "nav_exams", icon: "clock", mobile: true },
  { to: "/app/practice", label: "nav_practice", icon: "play" },
  { to: "/app/report", label: "nav_reports", icon: "chart", mobile: true },
  { to: "/app/progress", label: "nav_progress", icon: "target" },
  { to: "/app/profile", label: "profile", icon: "user", mobile: true },
  { to: "/app/settings", label: "nav_settings", icon: "settings" },
];
const PARENT: Item[] = [
  { to: "/app", label: "nav_home", icon: "home", mobile: true },
  { to: "/app/children", label: "nav_results", icon: "chart", mobile: true },
  { to: "/app/feedback", label: "nav_feedback", icon: "edit", mobile: true, badge: "feedback" },
  { to: "/app/profile", label: "profile", icon: "user", mobile: true },
  { to: "/app/settings", label: "nav_settings", icon: "settings" },
];
export function navFor(roles: string[]): Item[] {
  const r = new Set(roles);
  if (r.has("admin")) return ADMIN;
  if (r.has("teacher") || r.has("moderator")) {
    return r.has("moderator") ? [...TEACHER.slice(0, 3), { to: "/app/review", label: "nav_review", icon: "shield" }, ...TEACHER.slice(3)] : TEACHER;
  }
  if (r.has("parent")) return PARENT;
  return STUDENT;
}
function isActive(to: string, path: string, search: string) {
  const [p, q] = to.split("?");
  if (q) return path === p && new URLSearchParams(search).get("tab") === new URLSearchParams(q).get("tab");
  return p === "/app" ? path === "/app" : path === p || path.startsWith(p + "/");
}

export function LangToggle({ dark }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <div role="group" aria-label="Language" className={`relative flex h-9 items-center rounded-full border p-0.5 text-xs font-semibold ${dark ? "border-white/25 bg-white/10" : "border-line bg-white"}`}>
      {(["en", "bn"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`relative z-10 h-8 rounded-full px-3 transition ${lang === l ? "text-white" : dark ? "text-white/80" : "text-ink-2"}`}>
          {lang === l && <motion.span layoutId="lang-pill" className="absolute inset-0 -z-10 rounded-full bg-maroon" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
          {l === "en" ? "EN" : "বাংলা"}
        </button>
      ))}
    </div>
  );
}

export default function AppShell() {
  const { user, has, logout } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const ml = useMlStatus();
  const items = navFor(user?.roles || []);
  const pending = useQuery({ queryKey: ["dashboard"], queryFn: () => api<{ admin?: { pending_teachers?: number } }>("/dashboard"), enabled: has("admin") });
  const pendingN = pending.data?.admin?.pending_teachers || 0;
  const roleLabel = user?.roles.map((r) => t(`r_${r}` as StrKey)).join(" · ");
  const initials = (user?.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen text-white">
      {/* top bar */}
      <header className="glass-dark sticky top-0 z-40 h-14 border-b">
        <div className="flex h-full items-center gap-3 px-4 md:px-6">
          <Link to="/app" className="logo-card flex items-center px-2.5 py-1 md:hidden" aria-label={t("brand")}>
            <img src="/logo-full.webp" alt={t("brand")} className="h-9 w-auto" />
          </Link>
          <span className="hidden text-sm text-white/70 md:block">{roleLabel}</span>
          <span className="flex-1" />
          {ml.data && (
            <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:flex ${ml.data.status === "ready" ? "bg-white/90 text-ok" : "bg-white/90 text-err"}`}>
              <span className="relative flex h-2 w-2"><span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${ml.data.status === "ready" ? "bg-ok" : "bg-err"}`} /><span className={`relative inline-flex h-2 w-2 rounded-full ${ml.data.status === "ready" ? "bg-ok" : "bg-err"}`} /></span>
              {t("model")}: {ml.data.status === "ready" ? ml.data.version : t("offline")}
            </span>
          )}
          <LangToggle dark />
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-white/10" aria-haspopup="menu" aria-expanded={menu}>
              {user?.avatar_url ? <img src={mediaUrl(user.avatar_url)!} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/40" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#E2B862] to-gold text-xs font-bold text-[#2A1A00] ring-2 ring-white/30">{initials}</span>}
              <span className="hidden text-left leading-tight lg:block"><span className="block text-sm font-semibold">{user?.name}</span><span className="block text-[11px] text-white/60">{roleLabel}</span></span>
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-card border border-line bg-white text-ink shadow-lift" onMouseLeave={() => setMenu(false)}>
                  <div className="border-b border-line px-4 py-3 text-sm"><b className="block">{user?.name}</b><span className="text-ink-3">{user?.email}</span></div>
                  <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-head" onClick={() => { setMenu(false); nav("/app/profile"); }}><Icon name="user" className="h-4 w-4" />{t("profile")}</button>
                  <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-head" onClick={() => { setMenu(false); nav("/app/settings"); }}><Icon name="settings" className="h-4 w-4" />{t("nav_settings")}</button>
                  <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-err hover:bg-head" onClick={() => { logout(); nav("/login"); }}><Icon name="logout" className="h-4 w-4" />{t("logout")}</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* side menu (desktop) */}
        <aside className="glass-dark sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[236px] shrink-0 flex-col overflow-y-auto border-r p-3 md:flex">
          <Link to="/app" aria-label={t("brand")}>
            <motion.div whileHover={{ y: -2, rotate: -0.6 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="logo-card mb-4 grid place-items-center px-4 py-3">
              <img src="/logo-full.webp" alt={t("brand")} className="h-[86px] w-auto" />
            </motion.div>
          </Link>
          <nav className="flex flex-col gap-1">
            {items.map((i) => {
              const on = isActive(i.to, loc.pathname, loc.search);
              const badge = i.badge === "pending" ? pendingN : 0;
              return (
                <Link key={i.to} to={i.to} aria-current={on ? "page" : undefined} className={`relative flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium transition ${on ? "text-[#2A1A00]" : "text-white/75 hover:bg-white/[.07] hover:text-white"}`}>
                  {on && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-field bg-gradient-to-r from-[#E9C46A] to-[#E2B862] shadow-[0_8px_20px_-8px_rgba(233,168,79,.8)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <Icon name={i.icon} className="relative h-[18px] w-[18px]" />
                  <span className="relative flex-1">{t(i.label)}</span>
                  {badge > 0 && <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-maroon">{badge}</span>}
                </Link>
              );
            })}
          </nav>
          <p className="mt-auto pt-4 text-center text-[11px] uppercase tracking-[.18em] text-white/45">{t("tagline")}</p>
        </aside>

        {/* content */}
        <main className="relative min-w-0 flex-1 pb-24 md:pb-10">
          <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-80"><Ribbons dark /></div>
          <div className="relative mx-auto max-w-content px-4 pt-6 md:px-8 md:pt-8">
            <AnimatePresence mode="wait"><Outlet key={loc.pathname} /></AnimatePresence>
          </div>
        </main>
      </div>

      {/* bottom bar (phones) */}
      <nav className="glass-dark fixed inset-x-0 bottom-0 z-40 flex h-16 border-t md:hidden">
        {items.filter((i) => i.mobile).slice(0, 5).map((i) => {
          const on = isActive(i.to, loc.pathname, loc.search);
          return (
            <Link key={i.to} to={i.to} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-gold-soft" : "text-white/60"}`}>
              {on && <motion.span layoutId="tab-dot" className="absolute top-1 h-1 w-6 rounded-full bg-gold-soft" />}
              <Icon name={i.icon} className="h-5 w-5" /><span className="max-w-full truncate px-1">{t(i.label)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
