import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useAuth, type Portal } from "@/auth/Auth";
import { Icon, type IconName } from "@/components/Icon";
import type { StrKey } from "@/i18n/strings";
import { Button, Field, Input, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { LangToggle } from "@/layout/AppShell";
import { ease, Reveal } from "@/motion";
import type { SceneProgress } from "@/three/OrbitScene";

const OrbitScene = lazy(() => import("@/three/OrbitScene"));

function AuthLayout({ title, sub, children, hero, heroSub }: { title: string; sub: string; children: ReactNode; hero?: string; heroSub?: string }) {
  const { t } = useI18n();
  const progress = useRef<SceneProgress>({ p1: 0, p2: 0 });
  useEffect(() => {
    // questions settle into their orbits, then the star pulses in and out
    const t1 = setTimeout(() => { progress.current.p1 = 1; }, 400);
    let on = false;
    const loop = setInterval(() => { on = !on; progress.current.p2 = on ? 0.85 : 0; }, 7000);
    return () => { clearTimeout(t1); clearInterval(loop); };
  }, []);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0E0306] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#4A0A17_0%,#1A050B_50%,#0E0306_80%)]" />
        <Suspense fallback={null}><OrbitScene progress={progress} density={0.6} className="absolute inset-0" /></Suspense>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center text-white">
          <Link to="/" aria-label={t("brand")}>
            <motion.div initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease }}
              whileHover={{ y: -4 }} className="logo-card px-8 py-6">
              <img src="/logo-full.webp" alt={t("brand")} className="h-44 w-auto xl:h-52" />
            </motion.div>
          </Link>
          <Reveal as="p" text={hero || t("login_hero")} className="mt-8 max-w-md text-2xl font-semibold leading-snug text-white/95" />
          <p className="mt-3 max-w-md text-sm text-white/75">{heroSub}</p>
        </div>
      </div>
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between p-5">
          <Link to="/" className="logo-card px-3 py-1.5 lg:invisible"><img src="/logo-full.webp" alt={t("brand")} className="h-10 w-auto" /></Link>
          <LangToggle dark />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="card w-full max-w-[440px] !p-7 md:!p-8">
            <h1 className="h1">{title}</h1>
            <p className="mt-1.5 text-ink-2">{sub}</p>
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

type PortalDef = { id: Portal; icon: IconName; title: StrKey; sub: StrKey; demo: string[]; grad: string };
const PORTALS: PortalDef[] = [
  { id: "staff", icon: "file", title: "portal_staff", sub: "portal_staff_sub", demo: ["teacher", "moderator"], grad: "from-[#E2B862] to-[#B8892B]" },
  { id: "student", icon: "play", title: "portal_student", sub: "portal_student_sub", demo: ["student"], grad: "from-[#F07A8C] to-[#C22B45]" },
  { id: "parent", icon: "heart", title: "portal_parent", sub: "portal_parent_sub", demo: ["parent"], grad: "from-[#9EC5F0] to-[#1E4F91]" },
  { id: "admin", icon: "settings", title: "portal_admin", sub: "portal_admin_sub", demo: ["admin"], grad: "from-[#B9A7D9] to-[#4B2A7A]" },
];
const PORTAL_KEY: Record<Portal, StrKey> = { staff: "portal_staff", student: "portal_student", parent: "portal_parent", admin: "portal_admin" };

function PortalTabs({ value, onChange }: { value: Portal; onChange: (p: Portal) => void }) {
  const { t } = useI18n();
  return (
    <div role="tablist" aria-label={t("choose_portal")} className="grid grid-cols-4 gap-2">
      {PORTALS.map((p) => {
        const on = value === p.id;
        return (
          <motion.button key={p.id} role="tab" aria-selected={on} type="button" onClick={() => onChange(p.id)} whileTap={{ scale: 0.97 }}
            className={`relative overflow-hidden rounded-xl border px-1 py-3 text-center transition ${on ? "border-maroon bg-white shadow-[0_10px_24px_-12px_rgba(122,15,30,.6)]" : "border-line/70 bg-white/50 hover:bg-white/80"}`}>
            {on && <motion.span layoutId="portal-glow" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-[#C63A50] to-maroon" />}
            <span className={`mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white ${p.grad} ${on ? "" : "opacity-70"}`}><Icon name={p.icon} className="h-5 w-5" /></span>
            <span className={`mt-1.5 block truncate text-[13px] font-bold ${on ? "text-maroon" : "text-ink-2"}`}>{t(p.title)}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [sp, setSp] = useSearchParams();
  const portal = (["staff", "student", "parent", "admin"].includes(sp.get("as") || "") ? sp.get("as") : "staff") as Portal;
  const setPortal = (p: Portal) => { setSp({ as: p }, { replace: true }); setErr(null); };
  const def = PORTALS.find((p) => p.id === portal)!;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await login(email, password, portal); nav(loc.state?.from || "/app", { replace: true }); }
    catch (x) { setErr(x as ApiError); setShake((s) => s + 1); }
    finally { setBusy(false); }
  };
  const right = err?.code === "WRONG_PORTAL" ? (err.fields?.portal as Portal) : null;
  return (
    <AuthLayout title={t("login")} sub={t("choose_portal")} hero={t("login_hero")} heroSub={t("tagline")}>
      <PortalTabs value={portal} onChange={setPortal} />
      <AnimatePresence mode="wait">
        <motion.div key={portal} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
          <p className="mb-4 mt-4 flex items-center gap-2 text-sm text-ink-2"><Icon name={def.icon} className="h-4 w-4 text-maroon" />{t(def.sub)}</p>
          <motion.form key={shake} onSubmit={submit} className="space-y-4" animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.4 }}>
            <Field label={t("email")} error={err?.fields?.email}><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label={<span className="flex justify-between"><span>{t("password")}</span><Link to="/forgot-password" className="font-medium text-maroon hover:underline">{t("forgot")}</Link></span>}>
              <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {right ? (
              <div className="rounded-lg border border-warn/40 bg-[#FBF1DE] p-3 text-sm text-warn">
                {t("wrong_portal", { p: t(PORTAL_KEY[right]) })}
                <button type="button" className="ml-2 font-semibold underline" onClick={() => setPortal(right)}>{t("switch_to", { p: t(PORTAL_KEY[right]) })}</button>
              </div>
            ) : err && ["ACCOUNT_PENDING", "ACCOUNT_REJECTED", "ACCOUNT_LOCKED"].includes(err.code) ? (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2.5 rounded-lg border p-3 text-sm ${err.code === "ACCOUNT_PENDING" ? "border-info/30 bg-[#E6EEF8] text-info" : "border-warn/40 bg-[#FBF1DE] text-warn"}`}>
                <Icon name={err.code === "ACCOUNT_PENDING" ? "clock" : "alert"} className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err.code === "ACCOUNT_PENDING" ? t("acc_pending") : err.code === "ACCOUNT_REJECTED" ? t("acc_rejected") : t("acc_locked", { m: err.fields?.minutes || "15" })}
                  {err.fields?.reason && <span className="mt-1 block font-semibold">{t("reason")}: {err.fields.reason}</span>}</span>
              </motion.div>
            ) : err && !err.fields?.email && <p className="flex items-center gap-1.5 text-sm text-err"><Icon name="alert" className="h-4 w-4" />{err.message}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>{t("login")} · {t(def.title)}</Button>
          </motion.form>
          <p className="mt-5 text-center text-sm text-ink-2">
            {portal === "admin" ? t("admin_no_signup") : <>{t("new_here")} <Link to={`/register?as=${portal === "staff" ? "teacher" : portal}`} className="font-semibold text-maroon hover:underline">{t("register")}</Link></>}
          </p>
          {import.meta.env.DEV && (
            <div className="mt-5 rounded-card border border-dashed border-line p-3">
              <div className="label mb-2">{t("demo_accounts")}</div>
              <div className="flex flex-wrap gap-2">
                {def.demo.map((r) => (
                  <button key={r} type="button" onClick={() => { setEmail(`${r}@dishari.com`); setPassword("Dishari@123"); }}
                    className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-2 transition hover:border-maroon hover:text-maroon">{t(`r_${r}` as StrKey)}</button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthLayout>
  );
}

type RegRole = "teacher" | "student" | "parent";
const REG_ROLES: { id: RegRole; p: PortalDef }[] = [
  { id: "teacher", p: PORTALS[0] }, { id: "student", p: PORTALS[1] }, { id: "parent", p: PORTALS[2] },
];

export function Register() {
  const { t, lang } = useI18n();
  const { register } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const init = sp.get("as");
  const [role, setRole] = useState<RegRole>(init === "parent" ? "parent" : init === "student" ? "student" : "teacher");
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "", institution: "", class_level: "", child_link_code: "",
    subjects: "", classes_taught: "", designation: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const extra = role === "student" ? { institution: f.institution || null, class_level: f.class_level || null }
      : role === "parent" ? { child_link_code: f.child_link_code || null }
      : { institution: f.institution, subjects: f.subjects || null, classes_taught: f.classes_taught || null, designation: f.designation || null };
    try {
      const r = await register({ name: f.name, email: f.email, password: f.password, role, language_pref: lang, phone: f.phone || null, ...extra });
      if ("pending" in r) setSent(true); else nav("/app", { replace: true });
    } catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  };
  if (sent) return (
    <AuthLayout title={t("request_sent")} sub={f.email} hero={t("register_hero")}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease }} className="text-center">
        <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
          className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#E2B862] to-gold text-white shadow-lift"><Icon name="clock" className="h-8 w-8" /></motion.div>
        <p className="text-ink-2">{t("request_sent_sub")}</p>
        <Link to="/login?as=staff"><Button className="mt-6 w-full" size="lg">{t("login")}</Button></Link>
      </motion.div>
    </AuthLayout>
  );
  return (
    <AuthLayout title={t("i_am_a")} sub={t("register_as")} hero={t("register_hero")} heroSub={t("tagline")}>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {REG_ROLES.map(({ id, p }) => (
          <motion.button key={id} type="button" whileTap={{ scale: 0.97 }} onClick={() => { setRole(id); setErr(null); }}
            className={`relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border px-2 py-2.5 text-center text-[13px] font-semibold transition ${role === id ? "border-maroon bg-white text-maroon shadow-card" : "border-line/70 bg-white/50 text-ink-2"}`}>
            {role === id && <motion.span layoutId="reg-glow" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-[#C63A50] to-maroon" />}
            <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-white ${p.grad}`}><Icon name={p.icon} className="h-4 w-4" /></span>{t(p.title)}
          </motion.button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("name")} error={err?.fields?.name}><Input required minLength={2} value={f.name} onChange={set("name")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("email")} error={err?.fields?.email}><Input type="email" required value={f.email} onChange={set("email")} placeholder="name@example.com" /></Field>
          <Field label={<>{t("phone")} <span className="font-normal text-ink-3">({t("optional")})</span></>}><Input type="tel" value={f.phone} onChange={set("phone")} /></Field>
        </div>
        <Field label={t("password")} hint={t("pw_rule")} error={err?.fields?.password}><Input type="password" required minLength={8} value={f.password} onChange={set("password")} /></Field>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={role} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="space-y-4 overflow-hidden">
            {role === "teacher" && (
              <>
                <Field label={t("institution_req")} error={err?.fields?.institution ? t("institution_req") : undefined}><Input required value={f.institution} onChange={set("institution")} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("subjects_taught")}><Input value={f.subjects} onChange={set("subjects")} placeholder={lang === "bn" ? "পদার্থবিজ্ঞান" : "Physics"} /></Field>
                  <Field label={t("classes_taught_l")}><Input value={f.classes_taught} onChange={set("classes_taught")} placeholder="9, 10" /></Field>
                </div>
                <Field label={<>{t("designation_l")} <span className="font-normal text-ink-3">({t("optional")})</span></>}><Input value={f.designation} onChange={set("designation")} /></Field>
                <p className="flex items-start gap-2 rounded-lg bg-head/70 p-2.5 text-xs text-ink-2"><Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />{t("teacher_needs_approval")}</p>
              </>
            )}
            {role === "student" && (
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <Field label={<>{t("institution")} <span className="font-normal text-ink-3">({t("optional")})</span></>}><Input value={f.institution} onChange={set("institution")} /></Field>
                <Field label={t("class_level")}><select className="input" value={f.class_level} onChange={set("class_level")}><option value="">–</option><option value="9">9</option><option value="10">10</option></select></Field>
              </div>
            )}
            {role === "parent" && (
              <Field label={<>{t("child_code")} <span className="font-normal text-ink-3">({t("optional")})</span></>} hint={t("child_code_hint")} error={err?.fields?.child_link_code ? err.message : undefined}>
                <Input value={f.child_link_code} onChange={set("child_link_code")} className="font-mono uppercase tracking-[.3em]" maxLength={6} />
              </Field>
            )}
          </motion.div>
        </AnimatePresence>
        {role !== "teacher" && <p className="text-xs text-ink-3">{t("reg_role_hint")}</p>}
        {err && !Object.keys(err.fields || {}).length && <p className="text-sm text-err">{err.message}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t("register")}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">{t("have_account")} <Link to={`/login?as=${role === "teacher" ? "staff" : role}`} className="font-semibold text-maroon hover:underline">{t("login")}</Link></p>
    </AuthLayout>
  );
}

export function Forgot() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<{ debug_reset_token?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { setDone(await api("/auth/forgot-password", { body: { email }, auth: false })); } finally { setBusy(false); }
  };
  return (
    <AuthLayout title={t("forgot_title")} sub={t("forgot_sub")}>
      {done ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[#E3F1E3] text-ok"><Icon name="check" className="h-7 w-7" /></div>
          <p>{t("link_sent")}</p>
          {done.debug_reset_token && <Link to={`/reset-password?token=${encodeURIComponent(done.debug_reset_token)}`} className="mt-4 inline-block text-sm font-semibold text-maroon underline">{t("dev_token")}</Link>}
        </motion.div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("email")}><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>{t("send_link")}</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-maroon hover:underline">← {t("login")}</Link></p>
    </AuthLayout>
  );
}

export function Reset() {
  const { t } = useI18n();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api("/auth/reset-password", { body: { token: sp.get("token") || "", new_password: pw }, auth: false }); toast(t("pw_changed")); nav("/login"); }
    catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  };
  return (
    <AuthLayout title={t("set_password")} sub={t("pw_rule")}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("new_password")} error={err?.message}><Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t("set_password")}</Button>
      </form>
    </AuthLayout>
  );
}
