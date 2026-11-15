import { useQuery } from "@tanstack/react-query";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { Icon } from "@/components/Icon";
import { optLabel } from "@/components/QuestionView";
import { Button, ErrorBox, LevelBadge, PageHeader, Skeleton } from "@/components/ui";
import { LEVEL_FILL } from "@/components/viz";
import { useI18n } from "@/i18n/I18n";
import { CountUp, ease, Page } from "@/motion";
import { ReportTag } from "./QuestionDetail";

type R = {
  id: number; total: number; score: number; submitted_at: string; breakdown: { by_level: Record<string, { correct: number; total: number }>; weak_levels: string[] };
  review: { position: number; question: { id: number; stem: string; language: string; options: Record<string, string>; cognitive_level?: { id: string } | null }; chosen: string | null; correct_answer: string | null; is_correct: boolean; explanation?: string | null }[];
};

function ScoreRing({ pct }: { pct: number }) {
  const v = useMotionValue(0);
  const dash = useTransform(v, (x) => `${x * 2.83} 283`);
  useEffect(() => { const c = animate(v, pct, { duration: 1.6, ease }); return () => c.stop(); }, [pct, v]);
  return (
    <svg viewBox="0 0 100 100" className="h-44 w-44 -rotate-90">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E2B862" /><stop offset="1" stopColor="#7A0F1E" /></linearGradient></defs>
      <circle cx="50" cy="50" r="45" fill="none" stroke="#EFE9E1" strokeWidth="8" />
      <motion.circle cx="50" cy="50" r="45" fill="none" stroke="url(#rg)" strokeWidth="8" strokeLinecap="round" style={{ strokeDasharray: dash }} />
    </svg>
  );
}

export default function PracticeResult() {
  const { id } = useParams();
  const { t, n, date } = useI18n();
  const r = useQuery({ queryKey: ["practice-result", id], queryFn: () => api<R>(`/practice/sessions/${id}`) });
  const [report, setReport] = useState<number | null>(null);
  if (r.error) return <ErrorBox error={r.error} />;
  if (!r.data?.review) return <Skeleton className="h-96" />;
  const d = r.data;
  const pct = Math.round((100 * d.score) / Math.max(1, d.total));
  return (
    <Page>
      <PageHeader title={t("result_title")} sub={date(d.submitted_at)} actions={<><Link to="/app/practice"><Button variant="secondary" icon="refresh">{t("practice_again")}</Button></Link><Link to="/app/progress"><Button icon="chart">{t("see_progress")}</Button></Link></>} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="card flex flex-col items-center text-center">
          <div className="relative grid place-items-center">
            <ScoreRing pct={pct} />
            <div className="absolute text-center"><div className="text-4xl font-bold"><CountUp to={d.score} /><span className="text-xl text-ink-3"> / {n(d.total)}</span></div><div className="text-sm text-ink-2"><CountUp to={pct} suffix="%" /></div></div>
            {pct >= 80 && Array.from({ length: 14 }).map((_, i) => (
              <motion.i key={i} className="absolute h-2 w-2 rounded-full" style={{ background: i % 2 ? "#E2B862" : "#C63A50" }}
                initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(i) * 130, y: Math.sin(i * 1.7) * 110, opacity: 0, rotate: 180 }} transition={{ duration: 1.6, delay: 1.2, ease: "easeOut" }} />
            ))}
          </div>
          <h2 className="h3 mb-3 mt-6 self-start">{t("by_level")}</h2>
          <div className="w-full space-y-2.5">
            {Object.entries(d.breakdown.by_level).map(([k, v], i) => (
              <div key={k} className="grid grid-cols-[44px_1fr_52px] items-center gap-3 text-sm">
                <b>{k}</b>
                <div className="h-3 overflow-hidden rounded-full bg-head"><motion.div className="h-full rounded-full" style={{ background: LEVEL_FILL[k] }} initial={{ width: 0 }} animate={{ width: v.total ? `${(100 * v.correct) / v.total}%` : 0 }} transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease }} /></div>
                <span className="text-right tabular-nums text-ink-2">{v.total ? `${n(v.correct)}/${n(v.total)}` : "–"}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 w-full rounded-lg bg-head px-3 py-2 text-left text-sm">{d.breakdown.weak_levels.length ? t("weak_hint", { l: d.breakdown.weak_levels.map((k) => `${k} (${t(k as never)})`).join(", ") }) : t("all_good")}</p>
        </section>
        <section className="card">
          <h2 className="h3 mb-3">{t("answers_review")}</h2>
          <ul className="divide-y divide-line">
            {d.review.map((a, i) => (
              <motion.li key={a.position} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-3 py-4">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${a.is_correct ? "bg-[#E3F1E3] text-ok" : "bg-[#FBE7E5] text-err"}`}><Icon name={a.is_correct ? "check" : "x"} className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{n(a.position)}. {a.question.stem}</p>
                  <p className="mt-1 text-sm text-ink-2">
                    {t("your_answer")}: <b className={a.is_correct ? "text-ok" : "text-err"}>{a.chosen ? `${optLabel(a.chosen, a.question.language)}) ${a.question.options[a.chosen]}` : t("unanswered")}</b>
                    {!a.is_correct && a.correct_answer && <> · {t("correct_answer")}: <b className="text-ok">{optLabel(a.correct_answer, a.question.language)}) {a.question.options[a.correct_answer]}</b></>}
                  </p>
                  {a.explanation && <p className="mt-1 text-sm text-ink-3">{a.explanation}</p>}
                  <div className="mt-2 flex items-center gap-3"><LevelBadge code={a.question.cognitive_level?.id} short />{!a.is_correct && <button className="text-xs font-semibold text-maroon hover:underline" onClick={() => setReport(a.question.id)}>{t("report_tag")}</button>}</div>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>
      </div>
      {report && <ReportTag qid={report} open onClose={() => setReport(null)} />}
    </Page>
  );
}
