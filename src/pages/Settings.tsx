import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type Page as P, type User } from "@/api/client";
import { useAuth } from "@/auth/Auth";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Field, Input, PageHeader, Select, useToast } from "@/components/ui";
import { useI18n, type Digits, type TextSize } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { ease, Page } from "@/motion";
import { useChildren } from "./School";

type Sec = { id: string; label: StrKey; icon: IconName };

function Card({ id, title, children, delay = 0 }: { id: string; title: string; children: ReactNode; delay?: number }) {
  return (
    <motion.section id={id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, ease }} className="card scroll-mt-24 space-y-4">
      <h2 className="h2">{title}</h2>
      {children}
    </motion.section>
  );
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[15px]">
      <input type="checkbox" className="h-5 w-5 rounded accent-[#7A0F1E]" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}
    </label>
  );
}
function Radio({ name, value, cur, label, onChange }: { name: string; value: string; cur: string; label: string; onChange: (v: string) => void }) {
  return <label className="flex cursor-pointer items-center gap-3 text-[15px]"><input type="radio" name={name} className="h-5 w-5 accent-[#7A0F1E]" checked={cur === value} onChange={() => onChange(value)} />{label}</label>;
}

/** Save profile prefs (users.profile) one change at a time, quietly. */
function usePrefs() {
  const { user, refreshMe } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const prof = (user?.profile || {}) as Record<string, unknown>;
  const set = async (k: string, v: unknown) => {
    try { await api("/auth/me", { method: "PATCH", body: { profile: { [k]: v } } }); await refreshMe(); toast(t("saved")); }
    catch (e) { toast((e as ApiError).message, "err"); }
  };
  const b = (k: string, d = false) => (prof[k] === undefined ? d : Boolean(prof[k]));
  const s = (k: string, d = "") => (prof[k] == null ? d : String(prof[k]));
  return { set, b, s };
}

export default function Settings() {
  const { t } = useI18n();
  const { has } = useAuth();
  const admin = has("admin"), teacher = !admin && has("teacher", "moderator"), parent = has("parent"), student = has("student");
  const secs: Sec[] = [
    { id: "profile", label: admin ? "s_my_account" : "s_profile", icon: "user" },
    { id: "password", label: "s_password", icon: "shield" },
    ...(admin ? [{ id: "thresholds", label: "s_thresholds", icon: "target" }, { id: "security", label: "s_security", icon: "shield" },
      { id: "users", label: "s_users", icon: "users" }, { id: "model", label: "s_model_logs", icon: "cpu" }] as Sec[] : []),
    ...(parent ? [{ id: "children", label: "s_children", icon: "heart" }] as Sec[] : []),
    { id: "language", label: "s_language", icon: "globe" },
    { id: "notifications", label: "s_notifications", icon: "inbox" },
    ...(teacher ? [{ id: "tagging", label: "s_tagging", icon: "tag" }, { id: "exam", label: "s_exam_defaults", icon: "file" }] as Sec[] : []),
  ];
  const sub = admin ? t("acc_admin") : teacher ? t("acc_teacher") : parent ? t("acc_parent") : t("acc_student");
  const nav = useNavigate();
  const { logout } = useAuth();
  return (
    <Page>
      <PageHeader title={t("settings_title")} sub={sub} />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="card h-fit !p-2 lg:sticky lg:top-20">
          {secs.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition hover:bg-maroon-tint hover:text-maroon">
              <Icon name={s.icon} className="h-4 w-4" />{t(s.label)}
            </a>
          ))}
          <button onClick={() => { logout(); nav("/login"); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-err hover:bg-[#FBE9E9]"><Icon name="logout" className="h-4 w-4" />{t("logout")}</button>
        </nav>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <ProfileCard />
          <PasswordCard />
          {admin && <><Thresholds /><Security /><UsersCard /><ModelCard /></>}
          {parent && <ChildrenCard />}
          <LanguageCard />
          <Notifications role={admin ? "admin" : teacher ? "teacher" : parent ? "parent" : student ? "student" : "teacher"} />
          {teacher && <><TaggingCard /><ExamDefaults /></>}
        </div>
      </div>
    </Page>
  );
}

function ProfileCard() {
  const { t } = useI18n();
  const { user, has, refreshMe } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: "", phone: "", institution: "", class_level: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) setF({ name: user.name, phone: user.phone || "", institution: user.institution || "", class_level: user.class_level || "" }); }, [user]);
  const save = async () => {
    setBusy(true);
    try {
      await api("/auth/me", { method: "PATCH", body: { name: f.name, phone: f.phone || null, ...(has("parent") ? {} : { institution: f.institution || null }), ...(has("student") ? { class_level: f.class_level || null } : {}) } });
      await refreshMe(); toast(t("saved"));
    } catch (e) { toast((e as ApiError).message, "err"); } finally { setBusy(false); }
  };
  return (
    <Card id="profile" title={t(has("admin") ? "s_my_account" : "s_profile")}>
      <Field label={t("name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label={t("email")}><Input value={user?.email || ""} disabled /></Field>
      <Field label={t("phone")}><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      {has("student") && <Field label={t("class_level")}><Select value={f.class_level} onChange={(e) => setF({ ...f, class_level: e.target.value })}><option value="">–</option><option value="9">9</option><option value="10">10</option></Select></Field>}
      {!has("parent") && <Field label={t("institution")}><Input value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} /></Field>}
      <Button className="w-full" loading={busy} onClick={save}>{t("save")}</Button>
      <Link to="/app/profile" className="block text-center text-sm font-semibold text-maroon hover:underline">{t("profile")} →</Link>
    </Card>
  );
}

function PasswordCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ cur: "", pw: "", pw2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.pw !== f.pw2) { setErr(t("pw_mismatch")); return; }
    setBusy(true); setErr("");
    try { await api("/auth/change-password", { body: { current_password: f.cur, new_password: f.pw } }); toast(t("pw_changed")); setF({ cur: "", pw: "", pw2: "" }); }
    catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  };
  const reset = async () => { await api("/auth/forgot-password", { body: { email: user?.email }, auth: false }); toast(t("link_sent")); };
  return (
    <Card id="password" title={t("change_password")} delay={0.05}>
      <Field label={t("current_password")}><Input type="password" autoComplete="current-password" value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })} /></Field>
      <Field label={t("new_password")}><Input type="password" autoComplete="new-password" minLength={8} placeholder={t("pw_rule")} value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></Field>
      <Field label={t("confirm_pw")} error={err || undefined}><Input type="password" autoComplete="new-password" value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} /></Field>
      <Button className="w-full" loading={busy} disabled={!f.cur || f.pw.length < 8} onClick={save}>{t("update_password")}</Button>
      <button onClick={reset} className="text-sm font-medium text-maroon underline">{t("forgot_reset")}</button>
    </Card>
  );
}

function LanguageCard() {
  const { t, lang, setLang, digits, setDigits, textSize, setTextSize } = useI18n();
  const save = (l: "bn" | "en") => { setLang(l); api("/auth/me", { method: "PATCH", body: { language_pref: l } }).catch(() => {}); };
  return (
    <Card id="language" title={t("s_lang_display")}>
      <div className="space-y-2.5"><Radio name="lang" value="en" cur={lang} label="English" onChange={() => save("en")} /><Radio name="lang" value="bn" cur={lang} label="বাংলা" onChange={() => save("bn")} /></div>
      <Field label={t("numbers")}><Select value={digits} onChange={(e) => setDigits(e.target.value as Digits)}>
        <option value="auto">{t("digits_auto")}</option><option value="en">{t("digits_en")}</option><option value="bn">{t("digits_bn")}</option></Select></Field>
      <Field label={t("text_size")}><Select value={textSize} onChange={(e) => setTextSize(e.target.value as TextSize)}>
        <option value="normal">{t("ts_normal")}</option><option value="large">{t("ts_large")}</option><option value="xlarge">{t("ts_xlarge")}</option></Select></Field>
    </Card>
  );
}

function Notifications({ role }: { role: "admin" | "teacher" | "student" | "parent" }) {
  const { t } = useI18n();
  const p = usePrefs();
  const items: [string, StrKey, boolean][] = role === "teacher" || role === "admin"
    ? [["notify_tagging_done", "n_tagging_done", true], ["notify_omr_done", "n_omr_done", true], ["notify_weekly_summary", "n_weekly", false], ["notify_email", "n_email", false]]
    : role === "student"
      ? [["notify_new_result", "n_new_result", true], ["notify_exam_reminder", "n_exam_reminder", true], ["notify_teacher_feedback", "n_teacher_feedback", true], ["notify_email", "n_email", false]]
      : [["notify_in_app", "n_in_app", true], ["notify_email", "n_email", false]];
  return (
    <Card id="notifications" title={t("s_notifications")}>
      <div className="space-y-3">{items.map(([k, l, d]) => <Check key={k} label={t(l)} checked={p.b(k, d)} onChange={(v) => p.set(k, v)} />)}</div>
      {role === "parent" && <Field label={t("how_often")}><Select value={p.s("notify_frequency", "every_exam")} onChange={(e) => p.set("notify_frequency", e.target.value)}>
        <option value="every_exam">{t("f_every_exam")}</option><option value="weekly">{t("f_weekly")}</option><option value="monthly">{t("f_monthly")}</option></Select></Field>}
    </Card>
  );
}

function TaggingCard() {
  const { t, n } = useI18n();
  const p = usePrefs();
  return (
    <Card id="tagging" title={t("s_tagging_prefs")}>
      <Field label={t("default_mcq_lang")}><Select value={p.s("tag_default_lang", "auto")} onChange={(e) => p.set("tag_default_lang", e.target.value)}>
        <option value="auto">{t("detect_auto")}</option><option value="bn">বাংলা</option><option value="en">English</option></Select></Field>
      <Check label={t("highlight_low", { p: n(60) })} checked={p.b("tag_highlight_low", true)} onChange={(v) => p.set("tag_highlight_low", v)} />
      <Check label={t("suggest_board")} checked={p.b("tag_suggest_board", true)} onChange={(v) => p.set("tag_suggest_board", v)} />
    </Card>
  );
}

function ExamDefaults() {
  const { t } = useI18n();
  const p = usePrefs();
  const [marks, setMarks] = useState(p.s("exam_marks_per_q", "1"));
  return (
    <Card id="exam" title={t("s_exam_defaults")}>
      <Field label={t("marks_per_q")}><Input type="number" min={1} max={5} value={marks} onChange={(e) => setMarks(e.target.value)} onBlur={() => p.set("exam_marks_per_q", Number(marks) || 1)} /></Field>
      <Field label={t("paper_lang")}><Select value={p.s("exam_paper_lang", "bn")} onChange={(e) => p.set("exam_paper_lang", e.target.value)}><option value="bn">বাংলা</option><option value="en">English</option></Select></Field>
      <Check label={t("negative_marking")} checked={p.b("exam_negative")} onChange={(v) => p.set("exam_negative", v)} />
    </Card>
  );
}

/* ---------------------------------------------------------------- admin */
type Sys = { board_match_threshold: number; review_threshold: number; max_upload_rows: number; max_upload_mb: number;
  access_token_minutes: number; refresh_token_days: number; lock_after_failed: number; login_rate_limit: boolean };
function useSys() { return useQuery({ queryKey: ["sys-settings"], queryFn: () => api<Sys>("/admin/settings") }); }

function Thresholds() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useSys();
  const [f, setF] = useState<Partial<Sys>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (s.data) setF(s.data); }, [s.data]);
  const save = async () => {
    setBusy(true);
    try { qc.setQueryData(["sys-settings"], await api<Sys>("/admin/settings", { method: "PUT", body: { board_match_threshold: f.board_match_threshold, review_threshold: f.review_threshold, max_upload_rows: f.max_upload_rows, max_upload_mb: f.max_upload_mb } })); toast(t("saved")); }
    catch (e) { const x = e as ApiError; toast(Object.values(x.fields || {})[0] || x.message, "err"); } finally { setBusy(false); }
  };
  const num = (k: keyof Sys, step = "1") => <Input type="number" step={step} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />;
  return (
    <Card id="thresholds" title={t("s_thresholds")}>
      <Field label={t("board_match_sim")}>{num("board_match_threshold", "0.01")}</Field>
      <Field label={t("low_conf_below")}>{num("review_threshold", "0.01")}</Field>
      <Field label={t("max_q_upload")}>{num("max_upload_rows")}</Field>
      <Field label={t("max_file_mb")}>{num("max_upload_mb")}</Field>
      <Button className="w-full" loading={busy} onClick={save}>{t("save_thresholds")}</Button>
    </Card>
  );
}

function Security() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useSys();
  const put = async (body: Partial<Sys>) => {
    try { qc.setQueryData(["sys-settings"], await api<Sys>("/admin/settings", { method: "PUT", body })); toast(t("saved")); } catch (e) { toast((e as ApiError).message, "err"); }
  };
  if (!s.data) return <Card id="security" title={t("s_security")}><div className="skeleton h-40" /></Card>;
  return (
    <Card id="security" title={t("s_security")}>
      <Field label={t("access_session")}><Select value={s.data.access_token_minutes} onChange={(e) => put({ access_token_minutes: Number(e.target.value) })}>
        {[15, 30, 60, 120, 480].map((m) => <option key={m} value={m}>{m < 60 ? t("minutes_n", { n: m }) : t("hours_n", { n: m / 60 })}</option>)}</Select></Field>
      <Field label={t("refresh_session")}><Select value={s.data.refresh_token_days} onChange={(e) => put({ refresh_token_days: Number(e.target.value) })}>
        {[1, 7, 14, 30].map((d) => <option key={d} value={d}>{t("days_n", { n: d })}</option>)}</Select></Field>
      <Field label={t("lock_after")}><Select value={s.data.lock_after_failed} onChange={(e) => put({ lock_after_failed: Number(e.target.value) })}>
        {[3, 5, 10, 0].map((d) => <option key={d} value={d}>{d ? t("attempts_n", { n: d }) : t("never")}</option>)}</Select></Field>
      <Check label={t("rate_limit")} checked={s.data.login_rate_limit} onChange={(v) => put({ login_rate_limit: v })} />
    </Card>
  );
}

function UsersCard() {
  const { t } = useI18n();
  const toast = useToast();
  const [q, setQ] = useState("");
  const found = useQuery({ queryKey: ["users", q, "", 1], queryFn: () => api<P<User>>("/users", { query: { q, page_size: 5 } }), enabled: q.trim().length >= 2 });
  const [pick, setPick] = useState<User | null>(null);
  const reset = async () => { if (pick) { await api(`/users/${pick.id}/send-reset`, { method: "POST" }); toast(t("link_sent")); } };
  const unlock = async () => { if (pick) { await api(`/users/${pick.id}/unlock`, { method: "POST" }); toast(t("saved")); } };
  return (
    <Card id="users" title={t("s_users")}>
      <Field label={t("find_user")}><Input value={q} onChange={(e) => { setQ(e.target.value); setPick(null); }} placeholder={`${t("name")} / ${t("email")}`} /></Field>
      {!!found.data?.items.length && !pick && (
        <div className="overflow-hidden rounded-xl border border-line">{found.data.items.map((u) => (
          <button key={u.id} onClick={() => setPick(u)} className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-head">
            <b className="flex-1">{u.name}</b><span className="text-ink-3">{u.email}</span></button>))}</div>
      )}
      {pick && <p className="rounded-lg bg-head/70 px-3 py-2 text-sm"><b>{pick.name}</b> · {pick.email}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" disabled={!pick} onClick={reset}>{t("send_reset")}</Button>
        <Button variant="secondary" disabled={!pick} onClick={unlock}>{t("unlock")}</Button>
      </div>
      <Link to="/app/admin?tab=users" className="block text-center text-sm font-semibold text-maroon hover:underline">{t("manage_users")} →</Link>
    </Card>
  );
}

function ModelCard() {
  const { t, date } = useI18n();
  const m = useQuery({ queryKey: ["admin-models"], queryFn: () => api<{ id: number; version: string; is_active: boolean; deployed_at: string | null }[]>("/admin/models") });
  const act = m.data?.find((x) => x.is_active);
  return (
    <Card id="model" title={t("s_model_logs")}>
      <Field label={t("model_in_use")}><Select value={act?.id ?? ""} disabled>{(m.data || []).map((x) => <option key={x.id} value={x.id}>{x.version}{x.is_active ? ` · ${t("active_model")}` : ""}</option>)}</Select></Field>
      {act && <p className="text-sm text-ink-2">{date(act.deployed_at)}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link to="/app/admin?tab=models"><Button variant="secondary" className="w-full" icon="cpu">{t("nav_model")}</Button></Link>
        <Link to="/app/admin?tab=audit"><Button variant="secondary" className="w-full" icon="history">{t("open_logs")}</Button></Link>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- parent */
function ChildrenCard() {
  const { t, n } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const kids = useChildren();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const add = async () => {
    setErr("");
    try { await api("/parents/me/children", { body: { link_code: code } }); setCode(""); qc.invalidateQueries({ queryKey: ["children"] }); toast(t("saved")); }
    catch (e) { setErr((e as ApiError).message); }
  };
  const remove = async (id: number) => { await api(`/parents/me/children/${id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["children"] }); };
  return (
    <Card id="children" title={t("s_children")}>
      {(kids.data || []).map((k) => (
        <div key={k.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/70 p-3 text-sm">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-maroon-tint font-bold text-maroon">{k.name[0]}</span>
          <span className="flex-1">{k.name}{k.class_level ? `, ${t("class_level")} ${n(k.class_level)}` : ""}</span>
          <Button size="sm" variant="secondary" onClick={() => remove(k.id)}>{t("remove_child")}</Button>
        </div>
      ))}
      <Field label={t("add_child_code")} error={err || undefined}><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("enter_link_code")} className="font-mono uppercase tracking-[.2em]" maxLength={6} /></Field>
      <Button className="w-full" disabled={code.trim().length < 4} onClick={add}>{t("add")}</Button>
    </Card>
  );
}
