import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/Auth";
import { Icon } from "@/components/Icon";
import { optLabel } from "@/components/QuestionView";
import { Button, Empty, ErrorBox, Field, Input, LevelBadge, Modal, PageHeader, Select, Skeleton, Stat, Tabs, Textarea, useToast } from "@/components/ui";
import { LEVEL_FILL } from "@/components/viz";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease, Page, Tilt } from "@/motion";
import { Ring } from "./WeeklyReport";

export type TestT = {
  id: number; title: string; instructions?: string | null; class_level?: string | null; start_at: string; end_at: string; duration_min: number;
  question_count: number | null; state: "upcoming" | "live" | "in_progress" | "submitted" | "missed"; show_answers: string; submitted?: number;
  attempt?: { started_at: string; deadline_at: string; submitted_at: string | null; score: number | null; total: number; late: boolean };
};
const STATE_STYLE: Record<string, string> = {
  live: "bg-[#E3F1E3] text-ok border-ok/30", in_progress: "bg-[#FBF1DE] text-warn border-warn/40", upcoming: "bg-[#E8EFF8] text-info border-info/30",
  submitted: "bg-head text-ink-2 border-line", missed: "bg-[#FBE7E5] text-err border-err/30",
};

export function useTests() { return useQuery({ queryKey: ["tests"], queryFn: () => api<TestT[]>("/tests"), refetchInterval: 30_000 }); }

function when(d: string, lang: string) {
  return new Date(d).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TestCard({ x, i = 0 }: { x: TestT; i?: number }) {
  const { t, lang, n } = useI18n();
  const nav = useNavigate();
  const action = x.state === "live" ? ["start_test", () => confirm(t("confirm_start")) && nav(`/app/tests/${x.id}/take`)] as const
    : x.state === "in_progress" ? ["resume_test", () => nav(`/app/tests/${x.id}/take`)] as const
    : x.state === "submitted" ? ["view_result", () => nav(`/app/tests/${x.id}/result`)] as const : null;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease }}>
      <Tilt className="h-full rounded-card" max={5}>
        <div className="glass relative flex h-full flex-col overflow-hidden rounded-card p-5 text-ink">
          {x.state === "live" && <motion.span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-ok" animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} />}
          <span className={`chip mb-3 self-start ${STATE_STYLE[x.state]}`}>{t(`t_${x.state}` as StrKey)}</span>
          <h3 className="font-semibold">{x.title}</h3>
          <div className="mt-2 space-y-1 text-sm text-ink-2">
            <div className="flex items-center gap-2"><Icon name="clock" className="h-4 w-4" />{n(x.duration_min)} {t("minutes")} · {t("questions_n", { n: x.question_count ?? 0 })}</div>
            <div>{t("starts_at")}: {when(x.start_at, lang)}</div><div>{t("ends_at")}: {when(x.end_at, lang)}</div>
          </div>
          {x.attempt?.score != null && <div className="mt-3 text-2xl font-bold text-maroon">{n(x.attempt.score)} / {n(x.attempt.total)}</div>}
          {action && <Button className="mt-4" variant={x.state === "live" ? "primary" : "secondary"} icon={x.state === "submitted" ? "eye" : "play"} onClick={action[1]}>{t(action[0])}</Button>}
        </div>
      </Tilt>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ list (student & teacher) */
export default function Tests() {
  const { has } = useAuth();
  return has("admin", "teacher", "moderator") ? <TeacherTests /> : <StudentTests />;
}

function StudentTests() {
  const { t } = useI18n();
  const tests = useTests();
  const [tab, setTab] = useState<"now" | "upcoming" | "done">("now");
  const groups = useMemo(() => {
    const d = tests.data || [];
    return { now: d.filter((x) => x.state === "live" || x.state === "in_progress"), upcoming: d.filter((x) => x.state === "upcoming"), done: d.filter((x) => x.state === "submitted" || x.state === "missed") };
  }, [tests.data]);
  return (
    <Page>
      <PageHeader title={t("tests_title")} sub={t("tests_sub_student")} actions={<Link to="/app/practice?mode=exam"><Button variant="gold" icon="clock">{t("mock_test")}</Button></Link>} />
      <Tabs value={tab} onChange={setTab} items={[{ id: "now", label: t("t_live"), count: groups.now.length }, { id: "upcoming", label: t("t_upcoming"), count: groups.upcoming.length }, { id: "done", label: t("t_submitted"), count: groups.done.length }]} />
      {tests.error && <ErrorBox error={tests.error} />}
      {tests.isLoading ? <Skeleton className="h-48" /> : !groups[tab].length ? <div className="card"><Empty icon="clock" title={t("no_tests")} sub={t("mock_test_sub")} action={<Link to="/app/practice?mode=exam"><Button icon="clock">{t("mock_test")}</Button></Link>} /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{groups[tab].map((x, i) => <TestCard key={x.id} x={x} i={i} />)}</div>
      )}
    </Page>
  );
}

function TeacherTests() {
  const { t, n, lang } = useI18n();
  const tests = useTests();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<number | null>(null);
  return (
    <Page>
      <PageHeader title={t("tests_title")} sub={t("tests_sub_teacher")} actions={<Button icon="plus" onClick={() => setOpen(true)}>{t("new_test")}</Button>} />
      {tests.isLoading ? <Skeleton className="h-48" /> : !tests.data?.length ? <div className="card"><Empty icon="clock" title={t("empty")} action={<Button icon="plus" onClick={() => setOpen(true)}>{t("new_test")}</Button>} /></div> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>{t("paper_title")}</th><th>{t("status")}</th><th>{t("starts_at")}</th><th>{t("ends_at")}</th><th>{t("class_level")}</th><th>{t("results")}</th><th></th></tr></thead>
          <tbody>{tests.data.map((x) => (
            <tr key={x.id}>
              <td className="font-medium">{x.title}<div className="text-xs text-ink-3">{t("questions_n", { n: x.question_count ?? 0 })} · {n(x.duration_min)}′</div></td>
              <td><span className={`chip ${STATE_STYLE[x.state === "submitted" || x.state === "missed" ? "submitted" : x.state]}`}>{t(x.state === "missed" || x.state === "submitted" ? "t_submitted" : `t_${x.state}` as StrKey)}</span></td>
              <td className="whitespace-nowrap text-ink-2">{when(x.start_at, lang)}</td><td className="whitespace-nowrap text-ink-2">{when(x.end_at, lang)}</td>
              <td>{x.class_level || t("all")}{(x as TestT & { section?: string }).section ? ` · ${(x as TestT & { section?: string }).section}` : ""}</td><td><b>{n(x.submitted ?? 0)}</b></td>
              <td><button className="font-semibold text-maroon hover:underline" onClick={() => setView(x.id)}>{t("results")}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <NewTest open={open} onClose={() => setOpen(false)} />
      {view && <TestResults id={view} onClose={() => setView(null)} />}
    </Page>
  );
}

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function NewTest({ open, onClose, paperId, classLevel, title }: { open: boolean; onClose: () => void; paperId?: number; classLevel?: string; title?: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const papers = useQuery({ queryKey: ["papers"], enabled: open, queryFn: () => api<{ items: { id: number; title: string; item_count: number }[] }>("/papers", { query: { page_size: 100 } }) });
  const now = new Date();
  const [f, setF] = useState({ paper_id: paperId ? String(paperId) : "", title: title || "", class_level: classLevel || "", section: "", instructions: "", start: local(now), end: local(new Date(now.getTime() + 86400000)), duration_min: 30, shuffle: true, show_answers: "after_end" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api("/tests", { body: { paper_id: Number(f.paper_id), title: f.title || null, class_level: f.class_level || null, section: f.section || null, instructions: f.instructions || null, start_at: new Date(f.start).toISOString(), end_at: new Date(f.end).toISOString(), duration_min: f.duration_min, shuffle: f.shuffle, show_answers: f.show_answers } });
      qc.invalidateQueries({ queryKey: ["tests"] }); toast(t("saved")); onClose();
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("new_test")}>
      <div className="space-y-3">
        {!paperId && <Field label={t("from_paper")}><Select value={f.paper_id} onChange={(e) => setF({ ...f, paper_id: e.target.value })}><option value="">–</option>{papers.data?.items.map((p) => <option key={p.id} value={p.id} disabled={!p.item_count}>{p.title} ({p.item_count})</option>)}</Select></Field>}
        <Field label={<>{t("paper_title")} <span className="font-normal text-ink-3">({t("optional")})</span></>}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("starts_at")}><Input type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label={t("ends_at")} error={err?.fields?.end_at}><Input type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <Field label={t("duration")}><Input type="number" min={1} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></Field>
          <Field label={t("class_optional")}><Input value={f.class_level} placeholder="10" onChange={(e) => setF({ ...f, class_level: e.target.value })} /></Field>
          <Field label={t("section_optional")}><Input value={f.section} placeholder="A" onChange={(e) => setF({ ...f, section: e.target.value })} /></Field>
        </div>
        {paperId && <p className="-mt-1 text-xs text-ink-3">{t("assign_sub")}</p>}
        <Field label={t("show_answers")}><Select value={f.show_answers} onChange={(e) => setF({ ...f, show_answers: e.target.value })}>{["after_submit", "after_end", "never"].map((k) => <option key={k} value={k}>{t(`sa_${k}` as StrKey)}</option>)}</Select></Field>
        <Field label={t("instructions")}><Textarea rows={2} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-maroon" checked={f.shuffle} onChange={(e) => setF({ ...f, shuffle: e.target.checked })} />{t("shuffle")}</label>
        {err && <p className="text-sm text-err">{err.message}</p>}
        <div className="flex justify-end gap-2 pt-1"><Button variant="ghost" onClick={onClose}>{t("cancel")}</Button><Button loading={busy} disabled={!f.paper_id} onClick={save}>{t("new_test")}</Button></div>
      </div>
    </Modal>
  );
}

function TestResults({ id, onClose }: { id: number; onClose: () => void }) {
  const { t, n, date } = useI18n();
  const r = useQuery({ queryKey: ["test-results", id], queryFn: () => api<{ test: TestT; submitted: number; started: number; average: number | null; highest: number | null; by_level: Record<string, { correct: number; total: number }>; students: { student_id: number; name: string; class_level: string | null; score: number | null; total: number; submitted_at: string | null; late: boolean }[] }>(`/tests/${id}/results`) });
  const d = r.data;
  return (
    <Modal open onClose={onClose} title={d?.test.title || t("results")} wide>
      {!d ? <Skeleton className="h-48" /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t("submitted_n", { n: d.submitted })} value={<CountUp to={d.submitted} />} icon="users" />
            <Stat label={t("average")} value={d.average != null ? <CountUp to={Math.round(d.average * 100)} suffix="%" /> : "–"} icon="chart" tone="gold" />
            <Stat label={t("highest")} value={d.highest != null ? <CountUp to={Math.round(d.highest * 100)} suffix="%" /> : "–"} icon="sparkle" tone="ok" />
          </div>
          <div>{Object.entries(d.by_level).map(([k, v]) => (
            <div key={k} className="mb-2 grid grid-cols-[50px_1fr_60px] items-center gap-3 text-sm"><b>{k}</b>
              <div className="h-2.5 overflow-hidden rounded-full bg-head"><motion.div className="h-full" style={{ background: LEVEL_FILL[k] }} initial={{ width: 0 }} animate={{ width: v.total ? `${(100 * v.correct) / v.total}%` : 0 }} /></div>
              <span className="text-right text-ink-2">{v.total ? `${n(Math.round((100 * v.correct) / v.total))}%` : "–"}</span></div>
          ))}</div>
          <div className="table-wrap"><table className="tbl"><thead><tr><th>#</th><th>{t("name")}</th><th>{t("class_level")}</th><th>{t("score")}</th><th>{t("date")}</th></tr></thead>
            <tbody>{d.students.map((s, i) => <tr key={s.student_id}><td>{n(i + 1)}</td><td className="font-medium">{s.name}</td><td>{s.class_level || "–"}</td><td><b>{s.score != null ? `${n(s.score)}/${n(s.total)}` : t("t_in_progress")}</b>{s.late && <span className="chip ml-2 border-warn/40 bg-[#FBF1DE] text-warn">{t("late")}</span>}</td><td className="text-ink-3">{date(s.submitted_at)}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ take a test (timed) */
type Started = TestT & { questions: { position: number; id: number; language: string; stem: string; options: Record<string, string>; image_url?: string | null; cognitive_level?: { id: string } | null }[]; answers: Record<string, string>; server_time: string };

export function useCountdown(deadline?: string | null, skew = 0) {
  const [left, setLeft] = useState<number>(Infinity);
  useEffect(() => {
    if (!deadline) return;
    const end = new Date(deadline).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((end - (Date.now() + skew)) / 1000)));
    tick(); const id = setInterval(tick, 500); return () => clearInterval(id);
  }, [deadline, skew]);
  return left;
}

export function Timer({ left, total }: { left: number; total: number }) {
  const { n, t } = useI18n();
  if (!isFinite(left)) return null;
  const m = Math.floor(left / 60), s = left % 60, low = left < 60, warn = left < 300;
  return (
    <motion.div animate={low ? { scale: [1, 1.06, 1] } : {}} transition={{ repeat: low ? Infinity : 0, duration: 1 }}
      className={`flex items-center gap-2 rounded-full px-4 py-2 font-bold tabular-nums shadow-lift ${low ? "bg-err text-white" : warn ? "bg-gold text-[#2A1A00]" : "bg-white text-maroon"}`} aria-live="polite" title={t("time_left")}>
      <Icon name="clock" className="h-4 w-4" />{n(m).padStart(2, n(0))}:{n(s).padStart(2, n(0))}
      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-black/10 sm:block"><i className="block h-full bg-current" style={{ width: `${(100 * left) / Math.max(1, total)}%` }} /></span>
    </motion.div>
  );
}

export function TestTake() {
  const { id } = useParams();
  const { t, n, pick } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const [d, setD] = useState<Started | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [ans, setAns] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const skew = useRef(0);
  useEffect(() => {
    api<Started>(`/tests/${id}/start`, { method: "POST" }).then((r) => { skew.current = new Date(r.server_time).getTime() - Date.now(); setD(r); setAns(r.answers || {}); })
      .catch((e: ApiError) => (e.code === "ALREADY_SUBMITTED" ? nav(`/app/tests/${id}/result`, { replace: true }) : setErr(e)));
  }, [id, nav]);
  const left = useCountdown(d?.attempt?.deadline_at, skew.current);
  const submit = async (auto = false) => {
    if (busy) return;
    if (!auto && d && Object.keys(ans).length < d.questions.length && !confirm(t("submit_confirm", { n: d.questions.length - Object.keys(ans).length }))) return;
    setBusy(true);
    try { await api(`/tests/${id}/submit`, { body: { answers: ans } }); nav(`/app/tests/${id}/result`, { replace: true }); }
    catch (e) { toast((e as ApiError).message, "err"); setBusy(false); }
  };
  useEffect(() => { if (left === 0 && d) { toast(t("time_up"), "info"); submit(true); } }, [left]); // eslint-disable-line
  // autosave every 15 s when something changed
  const dirty = useRef(false);
  useEffect(() => { dirty.current = true; setSaved(false); }, [ans]);
  useEffect(() => {
    const idv = setInterval(async () => { if (!dirty.current || !d) return; dirty.current = false; try { await api(`/tests/${id}/answers`, { method: "PUT", body: { answers: ans } }); setSaved(true); } catch { /* retry next tick */ } }, 15000);
    return () => clearInterval(idv);
  }, [ans, d, id]);

  if (err) return <ErrorBox error={err} />;
  if (!d) return <Skeleton className="h-96" />;
  const q = d.questions[i];
  const total = d.duration_min * 60;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="sticky top-16 z-20 mb-5 flex items-center gap-3">
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold">{d.title}</h1><span className="text-sm text-white/70">{t("q_of", { i: i + 1, n: d.questions.length })}{saved && <> · <Icon name="check" className="inline h-3.5 w-3.5" /> {t("autosaved")}</>}</span></div>
        <Timer left={left} total={total} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
        <AnimatePresence mode="wait">
          <motion.section key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease }} className="card !p-6">
            <div className="mb-3 flex items-center gap-2 text-sm text-ink-3"><b className="text-maroon">{n(i + 1)}</b><LevelBadge code={q.cognitive_level?.id} short /></div>
            <h2 className="text-xl font-medium leading-[1.7]">{q.stem}</h2>
            <div className="mt-5 grid gap-3">
              {(["A", "B", "C", "D"] as const).map((k) => {
                const on = ans[q.id] === k;
                return (
                  <button key={k} onClick={() => setAns({ ...ans, [q.id]: k })} className={`flex min-h-[54px] items-center gap-4 rounded-xl border-2 px-4 text-left transition ${on ? "border-maroon bg-maroon-tint" : "border-line bg-white hover:border-maroon/40"}`}>
                    <span className={`grid h-9 w-9 place-items-center rounded-full border-2 font-bold ${on ? "border-maroon bg-maroon text-white" : "border-line text-ink-2"}`}>{optLabel(k, q.language)}</span>{q.options[k]}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-between"><Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)} icon="left">{t("prev")}</Button>
              {i < d.questions.length - 1 ? <Button onClick={() => setI(i + 1)}>{t("next")} →</Button> : <Button variant="gold" icon="check" loading={busy} onClick={() => submit()}>{t("submit")}</Button>}</div>
          </motion.section>
        </AnimatePresence>
        <aside className="card h-fit !p-4">
          <div className="label mb-2">{t("questions")}</div>
          <div className="grid grid-cols-5 gap-1.5">{d.questions.map((x, j) => <button key={x.id} onClick={() => setI(j)} className={`h-9 rounded-lg text-sm font-semibold ${j === i ? "bg-maroon text-white" : ans[x.id] ? "bg-gold/80 text-[#2A1A00]" : "bg-head text-ink-2"}`}>{n(j + 1)}</button>)}</div>
          <Button className="mt-4 w-full" variant="gold" icon="check" loading={busy} onClick={() => submit()}>{t("submit")}</Button>
          <span className="hidden">{pick(null)}</span>
        </aside>
      </div>
    </div>
  );
}

export function TestResult() {
  const { id } = useParams();
  const { t, n, date } = useI18n();
  const r = useQuery({ queryKey: ["test-result", id], queryFn: () => api<TestT & { breakdown: { by_level: Record<string, { correct: number; total: number }> }; answers_visible: boolean; answers_visible_from: string | null; review: { position: number; question: { stem: string; language: string; options: Record<string, string> }; chosen: string | null; correct_answer: string; is_correct: boolean }[] }>(`/tests/${id}/my-result`) });
  if (r.error) return <ErrorBox error={r.error} />;
  const d = r.data;
  if (!d) return <Skeleton className="h-96" />;
  const a = d.attempt!;
  return (
    <Page>
      <PageHeader title={d.title} sub={date(a.submitted_at)} actions={<Link to="/app/tests"><Button variant="secondary" icon="left">{t("nav_tests")}</Button></Link>} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="card flex flex-col items-center gap-4 text-center">
          <Ring value={a.total ? (a.score ?? 0) / a.total : null} size={160} label={`${n(a.score ?? 0)} / ${n(a.total)}`} />
          <div className="w-full">{Object.entries(d.breakdown?.by_level || {}).map(([k, v]) => (
            <div key={k} className="mb-2 grid grid-cols-[40px_1fr_48px] items-center gap-2 text-sm"><b>{k}</b><div className="h-2.5 overflow-hidden rounded-full bg-head"><motion.div className="h-full" style={{ background: LEVEL_FILL[k] }} initial={{ width: 0 }} animate={{ width: v.total ? `${(100 * v.correct) / v.total}%` : 0 }} /></div><span className="text-ink-2">{v.total ? `${n(v.correct)}/${n(v.total)}` : "–"}</span></div>
          ))}</div>
        </section>
        <section className="card">
          <h2 className="h3 mb-3">{t("answers_review")}</h2>
          {!d.answers_visible ? <Empty icon="clock" title={t("answers_later")} sub={d.answers_visible_from ? date(d.answers_visible_from) : undefined} /> : d.review.map((x) => (
            <div key={x.position} className="flex gap-3 border-b border-line py-3 last:border-0">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${x.is_correct ? "bg-[#E3F1E3] text-ok" : "bg-[#FBE7E5] text-err"}`}><Icon name={x.is_correct ? "check" : "x"} className="h-4 w-4" /></span>
              <div><p className="font-medium">{n(x.position)}. {x.question.stem}</p>
                <p className="text-sm text-ink-2">{t("your_answer")}: <b className={x.is_correct ? "text-ok" : "text-err"}>{x.chosen ? `${optLabel(x.chosen, x.question.language)}) ${x.question.options[x.chosen]}` : t("unanswered")}</b>
                  {!x.is_correct && <> · {t("correct_answer")}: <b className="text-ok">{optLabel(x.correct_answer, x.question.language)}) {x.question.options[x.correct_answer]}</b></>}</p></div>
            </div>
          ))}
        </section>
      </div>
    </Page>
  );
}
