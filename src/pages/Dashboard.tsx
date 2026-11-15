import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, openHtml } from "@/api/client";
import { useDashboard, useSummary, type Dashboard as D, type Summary } from "@/api/hooks";
import { useAuth } from "@/auth/Auth";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Empty, ErrorBox, Field, Select, Skeleton, Stat, StatusBadge } from "@/components/ui";
import { Bar, Columns, LevelMix, OrbitRings } from "@/components/viz";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease, Page, Tilt } from "@/motion";
import { TestCard, useTests } from "./Tests";
import { WeeklySummary } from "./WeeklyReport";
import { BoardEditor, PendingTeachers, type BoardQ } from "./admin/Admin";
import { FeedbackList, useChildren } from "./School";

export default function Dashboard() {
  const { user, has } = useAuth();
  const { t, n } = useI18n();
  const d = useDashboard();
  const staff = has("admin", "teacher", "moderator");
  const first = user?.name.split(" ")[0] || "";

  return (
    <Page>
      {/* greeting */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}
        className="glass-dark relative mb-6 overflow-hidden rounded-[20px] border p-6 text-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)] md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_85%_20%,rgba(233,168,79,.25),transparent_60%)]" />
        <div className="absolute -right-10 -top-16 opacity-90 md:right-6 md:-top-4"><OrbitRings data={d.data?.questions?.by_level || { K1: 3, K2: 3, K3: 2, K4: 1 }} size={260} /></div>
        <div className="relative max-w-xl">
          <p className="text-sm uppercase tracking-[.2em] text-gold-soft/90">{user?.roles.map((r) => t(`r_${r}` as StrKey)).join(" · ")}</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">{t(staff ? "welcome_name" : "hello", { n: staff ? user?.name || "" : first })}</h1>
          <p className="mt-2 text-white/80">{t("dash_sub")}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {staff && <Link to="/app/tag"><Button variant="gold" icon="tag">{t("nav_tag")}</Button></Link>}
            {has("moderator", "admin") && <Link to="/app/review"><Button variant="secondary" className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20" icon="shield">{t("nav_review")}{d.data?.review ? ` · ${n(d.data.review.queue)}` : ""}</Button></Link>}
            {has("student") && <Link to="/app/practice"><Button variant="gold" icon="play">{t("start_practice")}</Button></Link>}
            {has("parent") && <Link to="/app/children"><Button variant="gold" icon="heart">{t("nav_children")}</Button></Link>}
          </div>
        </div>
      </motion.section>

      {d.error && <ErrorBox error={d.error} onRetry={() => d.refetch()} />}
      {d.isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>}

      {d.data?.admin && <AdminHome d={d.data} />}
      {d.data?.teacher && !d.data.admin && <TeacherHome d={d.data} />}
      {d.data?.questions && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="card">
            <h2 className="h3 mb-4">{t("level_mix")}</h2>
            <LevelMix data={d.data.questions.by_level} />
          </section>
          <section className="card">
            <h2 className="h3 mb-4">{t("status_mix")}</h2>
            <div className="space-y-2.5">
              {["tagged", "needs_review", "verified", "pending", "rejected"].map((s) => (
                <div key={s} className="flex items-center gap-3"><StatusBadge status={s} /><span className="flex-1 border-b border-dotted border-line" /><b className="tabular-nums">{n(d.data!.questions!.by_status[s] || 0)}</b></div>
              ))}
            </div>
          </section>
        </div>
      )}

      {d.data?.student && user && <StudentHome recent={d.data.student.recent} uid={user.id} />}
      {has("parent") && !d.data?.student && <ParentHome />}
    </Page>
  );
}

function TeacherHome({ d }: { d: D }) {
  const { t, n, pick } = useI18n();
  const tc = d.teacher!;
  const actions: [string, StrKey, IconName, boolean][] = [["/app/bulk", "upload_mcqs_btn", "upload", true], ["/app/tag-review", "review_tags", "check", false],
    ["/app/papers", "create_exam", "file", false], ["/app/omr", "upload_omr", "list", false]];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("pending_review")} value={<CountUp to={tc.pending_review} />} icon="shield" tone="warn" />
        <Stat label={t("question_bank")} value={<CountUp to={tc.bank} />} icon="database" delay={0.05} />
        <Stat label={t("nav_exams")} value={<CountUp to={tc.exams} />} icon="file" tone="gold" delay={0.1} />
        <Stat label={t("class_average")} value={tc.class_average != null ? <CountUp to={Math.round(tc.class_average * 100)} suffix="%" /> : "–"} icon="chart" tone="ok" delay={0.15} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h3 mb-4">{t("quick_actions")}</h2>
          <div className="space-y-3">{actions.map(([to, l, ic, primary], i) => (
            <motion.div key={to} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06, ease }}>
              <Link to={to}><Button variant={primary ? "primary" : "secondary"} icon={ic} className="w-full justify-center" size="lg">{t(l)}</Button></Link>
            </motion.div>))}</div>
        </section>
        <section className="card space-y-4">
          <div className="flex items-center"><h2 className="h3 flex-1">{t("class_weak_topics")}</h2><Link to="/app/class-reports" className="text-sm font-semibold text-maroon">{t("nav_class_reports")} →</Link></div>
          {tc.weak_topics.length ? tc.weak_topics.map((w, i) => <Bar key={i} label={pick(w)} value={w.accuracy} right={`${n(Math.round(w.accuracy * 100))}%`} delay={0.15 + i * 0.1} />)
            : <Empty icon="chart" title={t("no_data_yet")} sub={t("report_empty")} />}
        </section>
      </div>
      <section className="card mt-4">
        <div className="mb-3 flex items-center"><h2 className="h3 flex-1">{t("recent_uploads")}</h2><Link to="/app/bulk" className="text-sm font-semibold text-maroon">{t("nav_upload_mcq")} →</Link></div>
        {!tc.recent_uploads.length ? <p className="py-4 text-center text-sm text-ink-3">{t("no_data_yet")}</p> : (
          <div className="overflow-hidden rounded-xl border border-line"><table className="tbl">
            <thead><tr><th>{t("file")}</th><th>{t("questions")}</th><th>{t("status")}</th><th></th></tr></thead>
            <tbody>{tc.recent_uploads.map((j) => {
              const doneJob = j.status === "done";
              return (
                <tr key={j.id}><td className="font-medium">{j.filename}</td><td>{n(j.total)}</td>
                  <td>{doneJob ? t("ready_review") : t("tagging_pct", { p: n(j.total ? Math.round((100 * j.processed) / j.total) : 0) })}</td>
                  <td><Link to={doneJob ? `/app/tag-review?job=${j.id}` : "/app/bulk"} className="font-medium text-maroon underline">{doneJob ? t("review_v") : t("view")}</Link></td></tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}

function AdminHome({ d }: { d: D }) {
  const { t, n } = useI18n();
  const a = d.admin!;
  const sys = useQuery({ queryKey: ["sys-settings"], queryFn: () => api<{ board_match_threshold: number; review_threshold: number }>("/admin/settings") });
  const board = useQuery({ queryKey: ["board", "", 1, "home"], queryFn: () => api<{ items: BoardQ[]; total: number }>("/board-questions", { query: { page_size: 5 } }) });
  const [edit, setEdit] = useState<BoardQ | "new" | null>(null);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("users_l")} value={<CountUp to={a.users} />} icon="users" />
        <Stat label={t("board_questions")} value={<CountUp to={a.board_questions} />} icon="book" tone="gold" delay={0.05} />
        <Stat label={t("questions_tagged")} value={<CountUp to={a.questions_tagged} />} icon="tag" tone="ok" delay={0.1} />
        <Stat label={t("teacher_corrections")} value={<CountUp to={a.teacher_corrections} />} icon="edit" tone="info" delay={0.15} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_1fr]">
        <div className="space-y-4">
          <PendingTeachers compact />
          <section className="card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="h3 flex-1">{t("board_bank")}</h2>
              <Link to="/app/admin?tab=board"><Button variant="secondary" size="sm" icon="upload">{t("upload_excel_csv")}</Button></Link>
              <Button size="sm" icon="plus" onClick={() => setEdit("new")}>{t("add_question")}</Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-line"><table className="tbl">
              <thead><tr><th>{t("board")}</th><th>{t("year")}</th><th>{t("q_no")}</th><th>{t("question")}</th><th>{t("action")}</th></tr></thead>
              <tbody>{(board.data?.items || []).map((b) => (
                <tr key={b.id}><td className="font-medium">{b.board}</td><td>{n(String(b.year))}</td><td>{b.q_no ? n(b.q_no) : "–"}</td><td className="max-w-[240px]"><span className="line-clamp-1">{b.stem}</span></td>
                  <td className="whitespace-nowrap"><button className="text-maroon underline" onClick={() => setEdit(b)}>{t("edit")}</button></td></tr>))}</tbody>
            </table></div>
            {!!board.data && board.data.total > 5 && <Link to="/app/admin?tab=board" className="mt-3 block text-center text-sm font-semibold text-maroon">{t("all")} · {n(board.data.total)} →</Link>}
          </section>
        </div>
        <section className="card h-fit space-y-4">
          <div className="flex items-center"><h2 className="h3 flex-1">{t("thresholds")}</h2><Link to="/app/settings#thresholds" className="text-sm font-semibold text-maroon">{t("edit")} →</Link></div>
          <Bar label={`${t("th_board_match")} (${n(sys.data?.board_match_threshold ?? 0.85)})`} value={sys.data?.board_match_threshold ?? 0.85} />
          <Bar label={`${t("th_low_conf")} (${n(sys.data?.review_threshold ?? 0.6)})`} value={sys.data?.review_threshold ?? 0.6} delay={0.1} />
          <h3 className="h3 pt-2">{t("nav_users")} · {t("nav_taxonomy")}</h3>
          <p className="text-sm text-ink-2">{t("users_tax_note")}</p>
          <h3 className="h3">{t("nav_model")}</h3>
          <p className="text-sm text-ink-2">{t("model_note")}</p>
        </section>
      </div>
      {edit && <BoardEditor item={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

/** Design-file cards shared by the student and parent homes. */
function SummaryCards({ s, parent }: { s: Summary; parent?: boolean }) {
  const { t, n, pick, date } = useI18n();
  const l = s.latest;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="label">{t(parent ? "latest_score" : "latest_result")}</div>
        {l ? <>
          <div className="mt-1 text-4xl font-bold tabular-nums text-ink"><CountUp to={l.score} /> <span className="text-2xl text-ink-3">/ {n(l.total)}</span></div>
          <p className="mt-1 text-sm text-ink-2">{l.title || t("practice_l")} · {date(l.when)}{l.class_average != null && <> · {t("class_avg_n", { p: `${n(Math.round(l.class_average * 100))}%` })}</>}</p>
        </> : <p className="mt-2 text-sm text-ink-3">{t("no_data_yet")}</p>}
      </motion.section>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card">
        <h2 className="h3 mb-3">{t(parent ? "needs_help" : "weak_topics")}</h2>
        {s.weak_topics.length ? <div className="flex flex-wrap gap-2">{s.weak_topics.map((w) => <span key={w.concept_id} className="rounded-full border border-line bg-white px-3 py-1 text-sm">{pick(w)}</span>)}</div>
          : <p className="text-sm text-ink-3">{t("no_data_yet")}</p>}
        {!!s.weak_levels.length && <p className="mt-3 text-sm text-ink-2">{t("levels_need_practice", { l: s.weak_levels.join(", ") })}</p>}
      </motion.section>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
        <h2 className="h3 mb-4">{t(parent ? "weekly_trend" : "progress_l")}</h2>
        {s.progress.length ? <Columns items={s.progress.map((p) => ({ value: p.pct }))} /> : <p className="text-sm text-ink-3">{t("no_data_yet")}</p>}
      </motion.section>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card">
        <div className="mb-3 flex items-center"><h2 className="h3 flex-1">{t("teacher_feedback")}</h2>{s.unread_feedback > 0 && <span className="chip border-maroon bg-maroon text-white">{n(s.unread_feedback)}</span>}</div>
        <FeedbackList sid={s.student.id} limit={2} />
      </motion.section>
      {!parent && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card md:col-span-2">
          <h2 className="h3 mb-2">{t("upcoming_exam")}</h2>
          {s.upcoming.length ? s.upcoming.map((u) => (
            <Link key={u.id} to="/app/tests" className="flex items-center gap-3 border-b border-line py-2 last:border-0 hover:text-maroon">
              <Icon name="clock" className="h-4 w-4 text-maroon" /><span className="flex-1">{u.title}</span><span className="text-sm text-ink-3">{date(u.start_at)} · {n(u.duration_min)}′</span></Link>))
            : <p className="text-sm text-ink-3">{t("no_upcoming")}</p>}
        </motion.section>
      )}
    </div>
  );
}

function ParentHome() {
  const { t, n, lang } = useI18n();
  const kids = useChildren();
  const [sid, setSid] = useState<number | null>(null);
  const cur = sid ?? kids.data?.[0]?.id ?? null;
  const s = useSummary(cur);
  if (kids.data && !kids.data.length) return <div className="card"><Empty icon="heart" title={t("no_child")} action={<Link to="/app/settings#children"><Button size="sm">{t("add_child_code")}</Button></Link>} /></div>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("child")} className="min-w-[240px] flex-1 [&_.label]:text-white/80"><Select value={cur ?? ""} onChange={(e) => setSid(Number(e.target.value))}>
          {(kids.data || []).map((k) => <option key={k.id} value={k.id}>{k.name}{k.class_level ? `, ${t("class_level")} ${n(k.class_level)}` : ""}</option>)}</Select></Field>
        {cur && <Button variant="secondary" icon="download" onClick={() => openHtml(`/students/${cur}/weekly-report`, { format: "html", lang })}>{t("download_report_pdf")}</Button>}
      </div>
      {s.isLoading ? <Skeleton className="h-64" /> : s.data && <SummaryCards s={s.data} parent />}
    </div>
  );
}

function StudentHome({ recent, uid }: { recent: { id: number; score: number; total: number; submitted_at: string }[]; uid: number }) {
  const { t, n, date } = useI18n();
  const tests = useTests();
  const open = (tests.data || []).filter((x) => ["live", "in_progress", "upcoming"].includes(x.state)).slice(0, 3);
  const cards: [string, StrKey, StrKey, IconName, string][] = [
    ["/app/practice", "nav_practice", "practice_sub", "play", "from-[#F07A8C] to-[#C22B45]"],
    ["/app/practice?mode=exam", "mock_test", "mock_test_sub", "clock", "from-[#E2B862] to-[#B8892B]"],
    ["/app/tests", "nav_tests", "tests_sub_student", "target", "from-[#9EC5F0] to-[#1E4F91]"],
    ["/app/report", "nav_report", "report_sub", "chart", "from-[#8FD19E] to-[#2D6A2D]"],
  ];
  const sum = useSummary(uid);
  return (
    <div className="space-y-6">
      {sum.data && <SummaryCards s={sum.data} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([to, l, sub, ic, g], i) => (
          <motion.div key={to} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, ease }}>
            <Tilt className="h-full rounded-card" max={8}>
              <Link to={to} className="glass group flex h-full flex-col gap-3 rounded-card p-5 text-ink">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lift ${g}`}><Icon name={ic} className="h-6 w-6" /></span>
                <b className="text-lg">{t(l)}</b><span className="text-sm text-ink-2">{t(sub)}</span>
                <span className="mt-auto text-sm font-semibold text-maroon transition group-hover:translate-x-1">→</span>
              </Link>
            </Tilt>
          </motion.div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <WeeklySummary sid={uid} compact />
        <div className="space-y-6">
          <section className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="h3">{t("nav_tests")}</h2><Link to="/app/tests" className="text-sm font-semibold text-maroon">{t("open_report").split(" ")[0]} →</Link></div>
            {open.length ? <div className="space-y-3">{open.map((x, i) => <TestCard key={x.id} x={x} i={i} />)}</div> : <p className="py-4 text-center text-sm text-ink-3">{t("no_tests")}</p>}
          </section>
          <section className="card">
            <div className="mb-2 flex items-center justify-between"><h2 className="h3">{t("recent_practice")}</h2><Link to="/app/progress" className="text-sm font-semibold text-maroon">{t("see_progress")} →</Link></div>
            {recent.length ? recent.map((r) => (
              <Link key={r.id} to={`/app/practice/${r.id}/result`} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0 hover:text-maroon">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-maroon-tint text-xs font-bold text-maroon">{n(Math.round((100 * r.score) / r.total))}%</span>
                <span className="flex-1 text-sm">{n(r.score)} / {n(r.total)}</span><span className="text-xs text-ink-3">{date(r.submitted_at)}</span>
              </Link>
            )) : <p className="py-4 text-center text-sm text-ink-3">{t("no_practice")}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
