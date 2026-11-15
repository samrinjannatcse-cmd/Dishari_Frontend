import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, openHtml, type Question } from "@/api/client";
import { conceptsOf, topicsOf, useQuestions, useTaxonomy } from "@/api/hooks";
import { useAuth } from "@/auth/Auth";
import { Icon } from "@/components/Icon";
import { Button, Chip, DiffBadge, Empty, ErrorBox, Field, Input, LevelBadge, Modal, PageHeader, Select, Skeleton, SkeletonRows, Stat, Textarea, useToast } from "@/components/ui";
import { Bar } from "@/components/viz";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease, Page } from "@/motion";

type Named = { name_en?: string | null; name_bn?: string | null } | null | undefined;

/* ================================================================== Tag review */
type Filter = "all" | "low" | "board" | "pending";

export function TagReview() {
  const { t, n, pick } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [sp] = useSearchParams();
  const job = sp.get("job") ? Number(sp.get("job")) : undefined;
  const [f, setF] = useState<Filter>("all");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<Question | null>(null);
  const [busy, setBusy] = useState(false);
  const base = { mine: true, bulk_job_id: job, page_size: 50 };
  const filt = f === "low" ? { status: "tagged,needs_review", min_conf_below: 0.6 } : f === "board" ? { status: "tagged,needs_review", board: true }
    : f === "pending" ? { status: "needs_review" } : { status: "tagged,needs_review" };
  const list = useQuestions({ ...base, ...filt } as never);
  const allMine = useQuestions({ ...base, page_size: 1 });
  const done = useQuestions({ ...base, status: "tagged,needs_review,verified", page_size: 1 });
  const items = list.data?.items || [];
  const total = allMine.data?.total || 0;
  const tagged = done.data?.total || 0;
  useEffect(() => setSel(new Set()), [f]);

  const confirm = async (ids: number[]) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await api<{ confirmed: number[] }>("/questions/confirm", { body: { ids } });
      toast(t("confirmed_n", { n: r.confirmed.length }));
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["questions"] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) { toast((e as ApiError).message, "err"); } finally { setBusy(false); }
  };
  const toggle = (id: number) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  return (
    <Page>
      <PageHeader title={t("nav_tag_review")} sub={t("tag_review_sub", { n: list.data?.total ?? 0 })} />
      <section className="card mb-5">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="flex-1 text-ink-2">{t("pipeline").split(", ").map((s, i) => <span key={s}>{i ? ", " : ""}{i === 2 ? <b className="text-ink">{s}</b> : s}</span>)}</span>
          <span className="text-ink-2">{t("tagging_done", { a: tagged, b: total })}</span>
        </div>
        <Bar label="" value={total ? tagged / total : 0} />
        <div className="mt-4 flex flex-wrap gap-2">
          {([["all", "all"], ["low", "f_low"], ["board", "f_board"], ["pending", "f_pending"]] as [Filter, StrKey][]).map(([k, l]) => <Chip key={k} active={f === k} onClick={() => setF(k)}>{t(l)}</Chip>)}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card !p-0 overflow-hidden">
          {list.isLoading ? <div className="p-5"><SkeletonRows /></div> : !items.length ? <div className="p-6"><Empty icon="check" title={t("no_data_yet")} /></div> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr>
                  <th className="w-10"><input type="checkbox" aria-label={t("all")} checked={sel.size > 0 && sel.size === items.length} onChange={(e) => setSel(e.target.checked ? new Set(items.map((q) => q.id)) : new Set())} className="h-4 w-4 accent-[#7A0F1E]" /></th>
                  <th>{t("question")}</th><th>{t("topic")}</th><th>{t("level")}</th><th>{t("difficulty")}</th><th>{t("confidence")}</th>
                </tr></thead>
                <tbody><AnimatePresence initial={false}>{items.map((q, i) => (
                  <motion.tr key={q.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}
                    className={`cursor-pointer ${open?.id === q.id ? "!bg-maroon-tint/70" : ""}`} onClick={() => setOpen(q)}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(q.id)} onChange={() => toggle(q.id)} className="h-4 w-4 accent-[#7A0F1E]" aria-label={`#${q.id}`} /></td>
                    <td className="max-w-[280px]"><span className="line-clamp-2">{q.stem}</span>
                      {q.board_match?.matched ? <span className="chip mt-1 border-maroon bg-maroon text-white">{t("board_year", { y: n(String((q.board_match as { year?: number }).year ?? "")) })}</span> : null}</td>
                    <td className="text-ink-2">{pick(q.topic as Named) || pick(q.concept as Named) || "–"}</td>
                    <td><LevelBadge code={q.cognitive_level?.id} short /></td>
                    <td><DiffBadge value={q.difficulty?.id} /></td>
                    <td className={`tabular-nums font-semibold ${q.min_confidence != null && q.min_confidence < 0.6 ? "text-err" : ""}`}>{q.min_confidence != null ? `${n(Math.round(q.min_confidence * 100))}%` : "–"}</td>
                  </motion.tr>
                ))}</AnimatePresence></tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            <Button icon="check" loading={busy} disabled={!sel.size} onClick={() => confirm([...sel])}>{t("confirm_selected")}{sel.size ? ` · ${n(sel.size)}` : ""}</Button>
            <Button variant="secondary" disabled={!items.length || busy} onClick={() => confirm(items.map((q) => q.id))}>{t("confirm_all")}</Button>
          </div>
        </section>
        <TagEditor q={open} onSaved={(q) => { setOpen(q); qc.invalidateQueries({ queryKey: ["questions"] }); }} />
      </div>
    </Page>
  );
}

function TagEditor({ q, onSaved }: { q: Question | null; onSaved: (q: Question) => void }) {
  const { t, pick } = useI18n();
  const tax = useTaxonomy();
  const toast = useToast();
  const [v, setV] = useState({ chapter_id: "", concept_id: "", topic_id: "", cognitive_level: "", difficulty: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q) setV({ chapter_id: q.chapter?.id || "", concept_id: q.concept?.id || "", topic_id: q.topic?.id || "", cognitive_level: q.cognitive_level?.id || "", difficulty: q.difficulty?.id || "" });
  }, [q]);
  if (!q) return <section className="card grid place-items-center text-center text-sm text-ink-3"><div className="py-10"><Icon name="edit" className="mx-auto mb-2 h-8 w-8 text-maroon/50" />{t("pick_question")}</div></section>;
  const save = async () => {
    setBusy(true);
    try { onSaved(await api<Question>(`/questions/${q.id}`, { method: "PATCH", body: { ...v, topic_id: v.topic_id || null } })); toast(t("saved")); }
    catch (e) { toast((e as ApiError).message, "err"); } finally { setBusy(false); }
  };
  return (
    <motion.section key={q.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ ease }} className="card h-fit space-y-3 lg:sticky lg:top-20">
      <h2 className="h3">{t("edit_tags")}</h2>
      <p className="line-clamp-3 rounded-lg bg-head/70 p-2.5 text-sm">{q.stem}</p>
      <Field label={t("chapter")}><Select value={v.chapter_id} onChange={(e) => setV({ ...v, chapter_id: e.target.value, concept_id: "", topic_id: "" })}>
        <option value="">–</option>{tax.data?.chapters.map((c) => <option key={c.id} value={c.id}>{pick(c)}</option>)}</Select></Field>
      <Field label={t("concept")}><Select value={v.concept_id} onChange={(e) => setV({ ...v, concept_id: e.target.value, topic_id: "" })}>
        <option value="">–</option>{conceptsOf(tax.data, v.chapter_id).map((c) => <option key={c.id} value={c.id}>{pick(c)}</option>)}</Select></Field>
      <Field label={t("topic")}><Select value={v.topic_id} onChange={(e) => setV({ ...v, topic_id: e.target.value })}>
        <option value="">–</option>{topicsOf(tax.data, v.chapter_id, v.concept_id).map((c) => <option key={c.id} value={c.id}>{pick(c)}</option>)}</Select></Field>
      <Field label={t("level")}><Select value={v.cognitive_level} onChange={(e) => setV({ ...v, cognitive_level: e.target.value })}>
        {["K1", "K2", "K3", "K4"].map((k) => <option key={k} value={k}>{k} {t(k as StrKey)}</option>)}</Select></Field>
      <Field label={t("difficulty")}><Select value={v.difficulty} onChange={(e) => setV({ ...v, difficulty: e.target.value })}>
        {["Easy", "Medium", "Hard"].map((k) => <option key={k} value={k}>{t(k as StrKey)}</option>)}</Select></Field>
      <Button className="w-full" icon="check" loading={busy} disabled={!v.chapter_id || !v.concept_id} onClick={save}>{t("save_tags")}</Button>
      <Link to={`/app/questions/${q.id}`} className="block text-center text-sm font-semibold text-maroon hover:underline">{t("view")} →</Link>
    </motion.section>
  );
}

/* ================================================================== OMR overview */
type OmrRow = { paper_id: number; title: string; questions: number; sheets: number; average: number | null; needs_check: number; last_upload: string | null };

export function OmrOverview() {
  const { t, n, date } = useI18n();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["omr-summary"], queryFn: () => api<OmrRow[]>("/omr/summary") });
  const rows = q.data || [];
  const sheets = rows.reduce((a, r) => a + r.sheets, 0);
  const graded = rows.filter((r) => r.average != null);
  const avg = graded.length ? graded.reduce((a, r) => a + (r.average || 0), 0) / graded.length : null;
  return (
    <Page>
      <PageHeader title={t("nav_omr")} sub={t("omr_overview_sub")} actions={<Link to="/app/papers"><Button icon="plus">{t("create_exam")}</Button></Link>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label={t("nav_exams")} value={<CountUp to={rows.length} />} icon="file" />
        <Stat label={t("sheets")} value={<CountUp to={sheets} />} icon="list" tone="gold" delay={0.05} />
        <Stat label={t("average")} value={avg != null ? <CountUp to={Math.round(avg * 100)} suffix="%" /> : "–"} icon="chart" tone="ok" delay={0.1} />
      </div>
      {q.isLoading ? <SkeletonRows /> : !rows.length ? <div className="card"><Empty icon="list" title={t("no_papers")} /></div> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>{t("nav_exams")}</th><th>{t("questions")}</th><th>{t("sheets")}</th><th>{t("average")}</th><th>{t("needs_check_n", { n: "" }).trim()}</th><th>{t("last_upload")}</th><th></th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <motion.tr key={r.paper_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="cursor-pointer" onClick={() => nav(`/app/papers/${r.paper_id}?view=omr`)}>
              <td className="font-semibold">{r.title}</td><td>{n(r.questions)}</td><td>{n(r.sheets)}</td>
              <td className="font-semibold">{r.average != null ? `${n(Math.round(r.average * 100))}%` : "–"}</td>
              <td>{r.needs_check ? <span className="chip border-warn/40 bg-[#FBF1DE] text-warn">{n(r.needs_check)}</span> : <span className="text-ink-3">–</span>}</td>
              <td className="text-ink-3">{date(r.last_upload)}</td>
              <td><span className="font-semibold text-maroon">{r.sheets ? t("open_l") : t("upload_omr")} →</span></td>
            </motion.tr>
          ))}</tbody>
        </table></div>
      )}
    </Page>
  );
}

/* ================================================================== Class report */
type Topic = { name_en: string | null; name_bn: string | null; accuracy: number; correct: number; total: number };
type Report = { title: string; students_count: number; average: number | null; need_attention: number; attention_below: number;
  level_accuracy: Record<string, number | null>; weak_topics: Topic[];
  students: { student_id: number; name: string; roll: string | null; score: number; weakest: Topic | null }[] };
type Sources = { tests: { id: number; title: string; submitted: number }[]; papers: { id: number; title: string; omr_sheets: number }[];
  groups: { id: number; name: string; members_count: number }[] };
const LV_TONE: Record<string, string> = { K1: "bg-[#E6EEF8] text-[#1E4F91]", K2: "bg-[#E3F1E3] text-[#2D6A2D]", K3: "bg-[#FBF1DE] text-[#8A5A00]", K4: "bg-[#EFE6F8] text-[#4B2A7A]" };

export function ClassReports() {
  const { t, n, pick, lang } = useI18n();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const src = sp.get("src") || (sp.get("group") ? `group:${sp.get("group")}` : "all");
  const [kind, id] = src.split(":");
  const query = kind === "test" ? { test_id: id } : kind === "paper" ? { paper_id: id } : kind === "group" ? { group_id: id } : {};
  const sources = useQuery({ queryKey: ["report-sources"], queryFn: () => api<Sources>("/class-report/sources") });
  const rep = useQuery({ queryKey: ["class-report", src], queryFn: () => api<Report>("/class-report", { query }) });
  const [msg, setMsg] = useState("");
  const [to, setTo] = useState<"attention" | "all">("attention");
  const [busy, setBusy] = useState(false);
  const r = rep.data;
  const attention = (r?.students || []).filter((s) => s.score < (r?.attention_below ?? 0.5));
  const eff = to === "attention" && !attention.length ? "all" : to;
  const targets = eff === "attention" ? attention : r?.students || [];
  const send = async () => {
    setBusy(true);
    try {
      const x = await api<{ sent: number }>("/feedback", { body: { message: msg, student_ids: targets.map((s) => s.student_id), context: r?.title || null } });
      toast(t("feedback_sent", { n: x.sent })); setMsg("");
    } catch (e) { toast((e as ApiError).message, "err"); } finally { setBusy(false); }
  };
  return (
    <Page>
      <PageHeader title={t("class_report")} sub={r?.title || t("all_classes")} actions={
        <Select className="!w-auto min-w-[240px]" aria-label={t("report_for")} value={src} onChange={(e) => setSp({ src: e.target.value })}>
          <option value="all">{t("all_classes")}</option>
          {!!sources.data?.tests.length && <optgroup label={t("online_test")}>{sources.data.tests.map((x) => <option key={x.id} value={`test:${x.id}`}>{x.title} ({n(x.submitted)})</option>)}</optgroup>}
          {!!sources.data?.papers.length && <optgroup label={t("paper_omr")}>{sources.data.papers.map((x) => <option key={x.id} value={`paper:${x.id}`}>{x.title} ({n(x.omr_sheets)})</option>)}</optgroup>}
          {!!sources.data?.groups.length && <optgroup label={t("group_l")}>{sources.data.groups.map((x) => <option key={x.id} value={`group:${x.id}`}>{x.name} ({n(x.members_count)})</option>)}</optgroup>}
        </Select>} />
      {rep.error && <ErrorBox error={rep.error} />}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label={t("average")} value={r?.average != null ? <CountUp key={src} to={Math.round(r.average * 100)} suffix="%" /> : "–"} icon="chart" />
        <Stat label={t("students")} value={r ? <CountUp key={src} to={r.students_count} /> : "–"} icon="users" tone="gold" delay={0.05} />
        <Stat label={t("need_attention")} value={r ? <CountUp key={src} to={r.need_attention} /> : "–"} icon="alert" tone="warn" delay={0.1} />
      </div>
      {rep.isLoading ? <Skeleton className="h-72" /> : r && !r.students_count ? <div className="card"><Empty icon="chart" title={t("report_empty")} /></div> : r && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card space-y-4">
            <h2 className="h3">{t("weakest_topics")}</h2>
            {r.weak_topics.length ? r.weak_topics.map((w, i) => <Bar key={i} label={pick(w)} value={w.accuracy} right={`${n(Math.round(w.accuracy * 100))}%`} delay={i * 0.08} />) : <p className="text-sm text-ink-3">–</p>}
            <h2 className="h3 pt-2">{t("score_by_level")}</h2>
            <div className="flex flex-wrap gap-2">{Object.entries(r.level_accuracy).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5 text-sm"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${LV_TONE[k]}`}>{k}</span>{v != null ? `${n(Math.round(v * 100))}%` : "–"}</span>))}</div>
          </section>
          <section className="card space-y-4">
            <h2 className="h3">{t("students_attention")}</h2>
            <div className="overflow-hidden rounded-xl border border-line"><table className="tbl">
              <thead><tr><th>{t("students")}</th><th>{t("score")}</th><th>{t("weakest")}</th></tr></thead>
              <tbody>{(attention.length ? attention : r.students.slice(0, 5)).map((s) => (
                <tr key={s.student_id}><td className="font-medium">{s.name}{s.roll && <span className="ml-1.5 text-xs text-ink-3">#{n(s.roll)}</span>}</td>
                  <td className={s.score < r.attention_below ? "font-semibold text-err" : ""}>{n(Math.round(s.score * 100))}%</td><td className="text-ink-2">{pick(s.weakest) || "–"}</td></tr>))}</tbody>
            </table></div>
            <Field label={t("feedback")}><Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("feedback_ph")} /></Field>
            <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-ink-2">{t("send_to")}:</span>
              <Chip active={eff === "attention"} onClick={() => setTo("attention")}>{t("to_attention")} ({n(attention.length)})</Chip>
              <Chip active={eff === "all"} onClick={() => setTo("all")}>{t("to_all")} ({n(r.students.length)})</Chip></div>
            <div className="flex flex-wrap gap-2">
              <Button icon="check" loading={busy} disabled={!msg.trim() || !targets.length} onClick={send}>{t("send_feedback")}</Button>
              <Button variant="secondary" icon="download" onClick={() => openHtml("/class-report", { ...query, format: "html", lang })}>{t("download_pdf")}</Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}

/* ================================================================== Groups */
type Member = { id: number; name: string; email: string; class_level: string | null; section: string | null; roll: string | null };
type Group = { id: number; name: string; class_level: string | null; section: string | null; note: string | null; members_count: number; members?: Member[] };

export function Groups() {
  const { t, n } = useI18n();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["groups"], queryFn: () => api<Group[]>("/groups") });
  const [cur, setCur] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (cur == null && list.data?.length) setCur(list.data[0].id); }, [list.data, cur]);
  return (
    <Page>
      <PageHeader title={t("nav_groups")} sub={t("groups_sub")} actions={<Button icon="plus" onClick={() => setCreating(true)}>{t("new_group")}</Button>} />
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          {list.isLoading ? <Skeleton className="h-40" /> : !list.data?.length ? <div className="card"><Empty icon="users" title={t("no_groups")} action={<Button size="sm" onClick={() => setCreating(true)}>{t("new_group")}</Button>} /></div>
            : list.data.map((g, i) => (
              <motion.button key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => setCur(g.id)}
                className={`glass flex w-full items-center gap-3 rounded-card p-4 text-left text-ink transition ${cur === g.id ? "ring-2 ring-gold" : "hover:-translate-y-0.5"}`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-maroon text-white"><Icon name="users" /></span>
                <span className="min-w-0 flex-1"><b className="block truncate">{g.name}</b>
                  <span className="text-xs text-ink-3">{[g.class_level && `${t("class_level")} ${n(g.class_level)}`, g.section && `${t("section")} ${g.section}`].filter(Boolean).join(" · ") || "–"}</span></span>
                <span className="chip border-line bg-white text-ink-2">{n(g.members_count)}</span>
              </motion.button>
            ))}
        </div>
        {cur != null && <GroupDetail key={cur} id={cur} onDeleted={() => { setCur(null); qc.invalidateQueries({ queryKey: ["groups"] }); }} />}
      </div>
      {creating && <NewGroup onClose={() => setCreating(false)} onCreated={(g) => { setCreating(false); setCur(g.id); qc.invalidateQueries({ queryKey: ["groups"] }); }} />}
    </Page>
  );
}

function NewGroup({ onClose, onCreated }: { onClose: () => void; onCreated: (g: Group) => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: "", class_level: "10", section: "", add_matching: true });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try { onCreated(await api<Group>("/groups", { body: { ...f, section: f.section || null, class_level: f.class_level || null } })); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t("new_group")}>
      <div className="space-y-4">
        <Field label={t("group_name")} error={err?.fields?.name}><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={`${t("class_level")} 10 · A`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("class_level")}><Select value={f.class_level} onChange={(e) => setF({ ...f, class_level: e.target.value })}><option value="">–</option><option value="9">9</option><option value="10">10</option></Select></Field>
          <Field label={t("section")}><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} placeholder="A" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#7A0F1E]" checked={f.add_matching} onChange={(e) => setF({ ...f, add_matching: e.target.checked })} />{t("add_matching")}</label>
        {err && !err.fields?.name && <p className="text-sm text-err">{err.message}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("cancel")}</Button><Button loading={busy} disabled={!f.name.trim()} onClick={save}>{t("save")}</Button></div>
      </div>
    </Modal>
  );
}

function GroupDetail({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const { t, n } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const g = useQuery({ queryKey: ["group", id], queryFn: () => api<Group>(`/groups/${id}`) });
  const [q, setQ] = useState("");
  const found = useQuery({ queryKey: ["stu-search", q], queryFn: () => api<Member[]>("/students/search", { query: { q } }), enabled: q.trim().length >= 2 });
  const ids = useMemo(() => new Set((g.data?.members || []).map((m) => m.id)), [g.data]);
  const setMembers = async (next: number[]) => {
    try { qc.setQueryData(["group", id], await api<Group>(`/groups/${id}/members`, { method: "PUT", body: { student_ids: next } })); qc.invalidateQueries({ queryKey: ["groups"] }); }
    catch (e) { toast((e as ApiError).message, "err"); }
  };
  const del = async () => {
    if (!window.confirm(t("delete_group_q"))) return;
    await api(`/groups/${id}`, { method: "DELETE" }); onDeleted();
  };
  if (g.isLoading || !g.data) return <Skeleton className="h-80" />;
  return (
    <motion.section initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ ease }} className="card space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="h2 flex-1">{g.data.name}</h2>
        <Link to={`/app/class-reports?src=group:${id}`}><Button size="sm" variant="secondary" icon="chart">{t("group_report")}</Button></Link>
        <Button size="sm" variant="ghost" icon="trash" onClick={del}>{t("delete")}</Button>
      </div>
      <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("find_students")} /></div>
      <AnimatePresence>{q.trim().length >= 2 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-xl border border-line">
          {(found.data || []).slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0">
              <span className="flex-1"><b>{s.name}</b> <span className="text-ink-3">{s.class_level && `· ${t("class_level")} ${n(s.class_level)}`} {s.section && `· ${s.section}`} {s.roll && `· #${n(s.roll)}`}</span></span>
              {ids.has(s.id) ? <span className="chip border-ok/30 bg-[#E3F1E3] text-ok">✓</span> : <Button size="sm" variant="secondary" onClick={() => setMembers([...ids, s.id])}>{t("add")}</Button>}
            </div>
          ))}
          {found.data && !found.data.length && <p className="p-3 text-sm text-ink-3">–</p>}
        </motion.div>)}</AnimatePresence>
      <div className="label">{t("members")} · {n(g.data.members_count)}</div>
      {!g.data.members?.length ? <Empty icon="users" title={t("no_data_yet")} /> : (
        <div className="overflow-hidden rounded-xl border border-line"><table className="tbl">
          <thead><tr><th>{t("name")}</th><th>{t("roll")}</th><th>{t("class_level")}</th><th>{t("section")}</th><th></th></tr></thead>
          <tbody>{g.data.members.map((m) => (
            <tr key={m.id}><td className="font-medium">{m.name}<span className="block text-xs text-ink-3">{m.email}</span></td><td>{m.roll ? n(m.roll) : "–"}</td>
              <td>{m.class_level ? n(m.class_level) : "–"}</td><td>{m.section || "–"}</td>
              <td><button className="text-sm font-semibold text-err hover:underline" onClick={() => setMembers([...ids].filter((x) => x !== m.id))}>{t("remove")}</button></td></tr>))}</tbody>
        </table></div>
      )}
    </motion.section>
  );
}

/* ================================================================== Feedback (parent + student) */
type Fb = { id: number; from_name: string | null; context: string | null; message: string; created_at: string; read: boolean };
export function useChildren(enabled = true) {
  return useQuery({ queryKey: ["children"], queryFn: () => api<{ id: number; name: string; class_level: string | null; section: string | null }[]>("/parents/me/children"), enabled });
}

export function FeedbackList({ sid, limit = 20 }: { sid: number; limit?: number }) {
  const { t, date } = useI18n();
  const fb = useQuery({ queryKey: ["feedback", sid, limit], queryFn: () => api<Fb[]>(`/students/${sid}/feedback`, { query: { limit } }) });
  if (fb.isLoading) return <Skeleton className="h-20" />;
  if (!fb.data?.length) return <p className="text-sm text-ink-3">{t("no_feedback")}</p>;
  return (
    <div className="space-y-3">{fb.data.map((f, i) => (
      <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-line bg-white/70 p-3">
        <p className="text-[15px]">{f.message}</p>
        <p className="mt-1 text-xs text-ink-3">{f.from_name && t("from_l", { n: f.from_name })}{f.context && ` · ${f.context}`} · {date(f.created_at)}</p>
      </motion.div>))}</div>
  );
}

export function FeedbackPage() {
  const { t, n } = useI18n();
  const { user, has } = useAuth();
  const kids = useChildren(has("parent"));
  const [sid, setSid] = useState<number | null>(null);
  const cur = has("parent") ? sid ?? kids.data?.[0]?.id ?? null : user?.id ?? null;
  return (
    <Page>
      <PageHeader title={t("teacher_feedback")} />
      {has("parent") && (kids.data?.length ? (
        <Field label={t("child")} className="mb-4 max-w-sm"><Select value={cur ?? ""} onChange={(e) => setSid(Number(e.target.value))}>{kids.data.map((k) => <option key={k.id} value={k.id}>{k.name}{k.class_level ? `, ${t("class_level")} ${n(k.class_level)}` : ""}</option>)}</Select></Field>
      ) : kids.data && <div className="card"><Empty icon="heart" title={t("no_child")} action={<Link to="/app/settings"><Button size="sm">{t("add_child_code")}</Button></Link>} /></div>)}
      {cur != null && <section className="card"><FeedbackList sid={cur} limit={50} /></section>}
    </Page>
  );
}
