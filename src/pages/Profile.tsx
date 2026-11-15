import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, mediaUrl } from "@/api/client";
import { useAuth } from "@/auth/Auth";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Field, Input, Select, Stat, Tabs, Textarea, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease, Page } from "@/motion";

type FieldDef = { k: string; label: StrKey; type?: "text" | "number" | "date" | "tel" | "textarea" | "select"; options?: [string, StrKey][]; wide?: boolean };
const COMMON: FieldDef[] = [
  { k: "gender", label: "gender", type: "select", options: [["female", "g_female"], ["male", "g_male"], ["other", "g_other"]] },
  { k: "district", label: "district" },
  { k: "address", label: "address", wide: true },
  { k: "bio", label: "bio", type: "textarea", wide: true },
];
const ROLE_FIELDS: Record<string, { title: StrKey; icon: IconName; fields: FieldDef[] }> = {
  teacher: { title: "professional_info", icon: "file", fields: [
    { k: "designation", label: "designation" }, { k: "teacher_id", label: "teacher_id" }, { k: "subjects", label: "subjects" },
    { k: "classes_taught", label: "classes_taught" }, { k: "department", label: "department" }, { k: "qualification", label: "qualification" },
    { k: "experience_years", label: "experience_years", type: "number" }] },
  moderator: { title: "professional_info", icon: "shield", fields: [
    { k: "designation", label: "designation" }, { k: "expertise", label: "expertise" }, { k: "subjects", label: "subjects" }, { k: "experience_years", label: "experience_years", type: "number" }] },
  admin: { title: "professional_info", icon: "settings", fields: [{ k: "designation", label: "designation" }, { k: "department", label: "department" }] },
  student: { title: "academic_info", icon: "book", fields: [
    { k: "roll", label: "roll" }, { k: "section", label: "section" },
    { k: "group", label: "group", type: "select", options: [["Science", "g_science"], ["Business", "g_business"], ["Humanities", "g_humanities"]] },
    { k: "board", label: "board_name", type: "select", options: ["Dhaka", "Rajshahi", "Chattogram", "Cumilla", "Jashore", "Barishal", "Sylhet", "Dinajpur", "Mymensingh", "Madrasah", "Technical"].map((b) => [b, b as StrKey]) },
    { k: "ssc_year", label: "ssc_year", type: "number" }, { k: "date_of_birth", label: "date_of_birth", type: "date" },
    { k: "guardian_name", label: "guardian_name" }, { k: "guardian_phone", label: "guardian_phone", type: "tel" },
    { k: "goal", label: "goal", type: "textarea", wide: true }] },
  parent: { title: "family_info", icon: "heart", fields: [
    { k: "relation", label: "relation", type: "select", options: [["mother", "relation"], ["father", "relation"], ["guardian", "relation"]] },
    { k: "occupation", label: "occupation" }, { k: "alt_phone", label: "alt_phone", type: "tel" }] },
};
const REL: Record<string, [string, string]> = { mother: ["Mother", "মা"], father: ["Father", "বাবা"], guardian: ["Guardian", "অভিভাবক"] };

type Stats = { member_since: string; last_login: string | null; teacher?: Record<string, number>; moderator?: Record<string, number>; student?: Record<string, number | null>; parent?: { children: number }; admin?: Record<string, number> };

export default function Profile() {
  const { user, refreshMe, logout, has } = useAuth();
  const { t, n, date, setLang, lang } = useI18n();
  const toast = useToast();
  const stats = useQuery({ queryKey: ["me-stats"], queryFn: () => api<Stats>("/auth/me/stats") });
  const [tab, setTab] = useState<"info" | "security" | "prefs">("info");
  const [base, setBase] = useState({ name: "", phone: "", institution: "", class_level: "", language_pref: "bn" });
  const [prof, setProf] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    setBase({ name: user.name, phone: user.phone || "", institution: user.institution || "", class_level: user.class_level || "", language_pref: user.language_pref });
    setProf(Object.fromEntries(Object.entries(user.profile || {}).map(([k, v]) => [k, v == null ? "" : String(v)])));
  }, [user]);
  if (!user) return null;
  const role = (["student", "parent", "teacher", "moderator", "admin"] as const).find((r) => user.roles.includes(r))!;
  const roleDefs = user.roles.filter((r) => ROLE_FIELDS[r]).map((r) => ROLE_FIELDS[r]);
  const seen = new Set<string>();
  const roleFields = roleDefs.flatMap((d) => d.fields).filter((f) => !seen.has(f.k) && seen.add(f.k));

  const save = async (e?: FormEvent) => {
    e?.preventDefault(); setBusy(true);
    try {
      const profile: Record<string, string | number | null> = {};
      [...COMMON, ...roleFields].forEach((f) => { const v = prof[f.k]; profile[f.k] = v === undefined || v === "" ? null : f.type === "number" ? Number(v) : v; });
      await api("/auth/me", { method: "PATCH", body: { ...base, phone: base.phone || null, institution: base.institution || null, class_level: base.class_level || null, profile } });
      await refreshMe(); setLang(base.language_pref as "bn" | "en"); toast(t("saved"));
    } catch (x) { toast((x as ApiError).message, "err"); } finally { setBusy(false); }
  };
  const avatar = async (f: File) => {
    const fd = new FormData(); fd.append("file", f);
    try { await api("/auth/me/avatar", { form: fd }); await refreshMe(); toast(t("saved")); } catch (x) { toast((x as ApiError).message, "err"); }
  };
  const input = (f: FieldDef) => {
    const v = prof[f.k] ?? "";
    const on = (val: string) => setProf({ ...prof, [f.k]: val });
    const label = f.k === "relation" ? t("relation") : t(f.label);
    return (
      <Field key={f.k} label={label} className={f.wide ? "sm:col-span-2" : ""}>
        {f.type === "textarea" ? <Textarea rows={3} value={v} onChange={(e) => on(e.target.value)} />
          : f.type === "select" ? <Select value={v} onChange={(e) => on(e.target.value)}><option value="">–</option>{f.options!.map(([val, l]) => <option key={val} value={val}>{f.k === "relation" ? REL[val][lang === "bn" ? 1 : 0] : f.k === "board" ? val : t(l)}</option>)}</Select>
          : <Input type={f.type || "text"} value={v} onChange={(e) => on(e.target.value)} />}
      </Field>
    );
  };

  const s = stats.data;
  const tiles: [string, number | null | undefined, IconName][] = [
    ...(s?.teacher ? [[t("st_questions"), s.teacher.questions, "database"], [t("st_papers"), s.teacher.papers, "file"], [t("st_tests"), s.teacher.tests, "clock"], [t("st_takers"), s.teacher.test_takers, "users"]] as [string, number, IconName][] : []),
    ...(s?.moderator ? [[t("st_reviews"), s.moderator.reviews, "shield"]] as [string, number, IconName][] : []),
    ...(s?.student ? [[t("st_practice"), s.student.practice_sets, "play"], [t("st_answered"), s.student.questions_answered, "target"], [t("st_tests"), s.student.tests_taken, "clock"], [t("streak"), s.student.streak_days, "sparkle"]] as [string, number, IconName][] : []),
    ...(s?.parent ? [[t("st_children"), s.parent.children, "heart"]] as [string, number, IconName][] : []),
    ...(s?.admin ? [[t("users_total"), s.admin.users, "users"]] as [string, number, IconName][] : []),
  ];

  return (
    <Page>
      {/* header */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }} className="glass-dark relative mb-6 overflow-hidden rounded-[20px] border p-6 text-white md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_260px_at_85%_10%,rgba(233,168,79,.3),transparent_60%)]" />
        <div className="relative flex flex-wrap items-center gap-5">
          <label className="group relative cursor-pointer">
            {user.avatar_url ? <img src={mediaUrl(user.avatar_url)!} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-gold/70" />
              : <span className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#E2B862] to-gold text-3xl font-bold text-[#2A1A00] ring-4 ring-white/30">{user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>}
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-xs font-semibold opacity-0 transition group-hover:opacity-100"><Icon name="image" className="h-6 w-6" /></span>
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) avatar(f); }} />
            <span className="sr-only">{t("change_photo")}</span>
          </label>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <p className="text-white/75">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{user.roles.map((r) => <span key={r} className="chip border-white/30 bg-white/15 text-white">{t(`r_${r}` as StrKey)}</span>)}
              {user.institution && <span className="chip border-white/30 bg-white/10 text-white/90">{user.institution}{user.class_level ? ` · ${t("class_level")} ${n(user.class_level)}` : ""}</span>}</div>
          </div>
          <div className="text-right text-sm text-white/70">{t("member_since")}: {date(s?.member_since)}<br />{t("last_login")}: {date(s?.last_login)}</div>
        </div>
      </motion.section>

      {tiles.length > 0 && <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map(([l, v, ic], i) => <Stat key={l} label={l} value={<CountUp to={Number(v || 0)} />} icon={ic} delay={i * 0.05} tone={(["maroon", "gold", "info", "ok"] as const)[i % 4]} />)}</div>}

      <Tabs value={tab} onChange={setTab} items={[{ id: "info", label: t("personal_info") }, { id: "security", label: t("security") }, { id: "prefs", label: t("preferences") }]} />

      {tab === "info" && (
        <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Section title={t("personal_info")} icon="user">
              <Field label={t("name")}><Input value={base.name} onChange={(e) => setBase({ ...base, name: e.target.value })} /></Field>
              <Field label={t("phone")}><Input type="tel" value={base.phone} onChange={(e) => setBase({ ...base, phone: e.target.value })} /></Field>
              {role !== "parent" && <Field label={t("institution")}><Input value={base.institution} onChange={(e) => setBase({ ...base, institution: e.target.value })} /></Field>}
              {role === "student" && <Field label={t("class_level")}><Select value={base.class_level} onChange={(e) => setBase({ ...base, class_level: e.target.value })}><option value="">–</option>{["9", "10"].map((c) => <option key={c} value={c}>{n(Number(c))}</option>)}</Select></Field>}
              {COMMON.map(input)}
            </Section>
            {roleDefs.length > 0 && <Section title={t(roleDefs[0].title)} icon={roleDefs[0].icon}>{roleFields.map(input)}</Section>}
            <Button type="submit" size="lg" loading={busy} icon="check">{t("save")}</Button>
          </div>
          <div className="space-y-6">
            {has("student") && <LinkCode code={user.link_code} />}
            {has("parent") && <ParentChildren />}
          </div>
        </form>
      )}
      {tab === "security" && <Security onDone={logout} />}
      {tab === "prefs" && (
        <Section title={t("preferences")} icon="settings">
          <Field label={t("language")}><Select value={base.language_pref} onChange={(e) => setBase({ ...base, language_pref: e.target.value })}><option value="bn">বাংলা</option><option value="en">English</option></Select></Field>
          <div className="space-y-3 sm:col-span-2">
            {([["notify_weekly_report", "notify_weekly"], ["notify_email", "notify_email"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center justify-between rounded-lg border border-line bg-white px-4 py-3">
                <span>{t(l)}</span>
                <button type="button" role="switch" aria-checked={prof[k] === "true"} onClick={() => setProf({ ...prof, [k]: prof[k] === "true" ? "false" : "true" })}
                  className={`relative h-6 w-11 rounded-full transition ${prof[k] === "true" ? "bg-maroon" : "bg-line"}`}><motion.i layout className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${prof[k] === "true" ? "right-0.5" : "left-0.5"}`} /></button>
              </label>
            ))}
          </div>
          <Button className="sm:col-span-2 w-fit" loading={busy} onClick={() => save()}>{t("save")}</Button>
        </Section>
      )}
    </Page>
  );
}

function Section({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="h3 mb-4 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-maroon-tint text-maroon"><Icon name={icon} className="h-4 w-4" /></span>{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function LinkCode({ code }: { code?: string | null }) {
  const { t } = useI18n();
  const { refreshMe } = useAuth();
  const toast = useToast();
  return (
    <section className="card relative overflow-hidden">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-gold/30 to-maroon/20 blur-xl" />
      <h2 className="h3 flex items-center gap-2"><Icon name="heart" className="h-4 w-4 text-maroon" />{t("link_code")}</h2>
      <p className="mt-1 text-sm text-ink-2">{t("link_code_hint")}</p>
      <div className="mt-4 flex items-center gap-2">
        <motion.code key={code} initial={{ rotateX: 90 }} animate={{ rotateX: 0 }} className="flex-1 rounded-xl bg-maroon px-4 py-3 text-center font-mono text-2xl font-bold tracking-[.35em] text-white">{code || "------"}</motion.code>
        <Button type="button" variant="secondary" onClick={() => { navigator.clipboard?.writeText(code || ""); toast(t("copied")); }}>{t("copy")}</Button>
      </div>
      <button type="button" className="mt-3 text-sm font-semibold text-maroon hover:underline" onClick={async () => { await api("/auth/me/link-code", { method: "POST" }); await refreshMe(); }}>{t("new_code")}</button>
    </section>
  );
}

function ParentChildren() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const kids = useQuery({ queryKey: ["children"], queryFn: () => api<{ id: number; name: string; class_level: string | null; institution: string | null; avatar_url: string | null }[]>("/parents/me/children") });
  const [code, setCode] = useState("");
  const link = async () => {
    try { await api("/parents/me/children", { body: { link_code: code } }); setCode(""); qc.invalidateQueries({ queryKey: ["children"] }); qc.invalidateQueries({ queryKey: ["me-stats"] }); toast(t("linked")); }
    catch (e) { toast((e as ApiError).message, "err"); }
  };
  return (
    <section className="card">
      <h2 className="h3 mb-3 flex items-center gap-2"><Icon name="heart" className="h-4 w-4 text-maroon" />{t("nav_children")}</h2>
      <div className="space-y-2">{kids.data?.map((k) => (
        <Link key={k.id} to="/app/children" className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 hover:border-maroon/40">
          {k.avatar_url ? <img src={mediaUrl(k.avatar_url)!} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-maroon-tint font-bold text-maroon">{k.name[0]}</span>}
          <span className="flex-1"><b className="block text-sm">{k.name}</b><span className="text-xs text-ink-3">{[k.institution, k.class_level].filter(Boolean).join(" · ")}</span></span><Icon name="right" className="h-4 w-4 text-ink-3" />
        </Link>))}</div>
      <div className="mt-4 flex gap-2"><Input placeholder={t("child_code")} value={code} maxLength={6} className="font-mono uppercase tracking-[.25em]" onChange={(e) => setCode(e.target.value)} /><Button type="button" icon="plus" disabled={code.length < 6} onClick={link}>{t("link_child")}</Button></div>
      <p className="mt-1 text-xs text-ink-3">{t("child_code_hint")}</p>
    </section>
  );
}

function Security({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const change = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    try { await api("/auth/change-password", { body: pw }); toast(t("pw_changed")); onDone(); } catch (x) { setErr(x as ApiError); }
  };
  return (
    <form onSubmit={change} className="card max-w-lg space-y-4">
      <h2 className="h3">{t("change_password")}</h2>
      <Field label={t("current_password")} error={err?.fields?.current_password ? err.message : undefined}><Input type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
      <Field label={t("new_password")} hint={t("pw_rule")}><Input type="password" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
      <Button type="submit" variant="secondary">{t("change_password")}</Button>
    </form>
  );
}
