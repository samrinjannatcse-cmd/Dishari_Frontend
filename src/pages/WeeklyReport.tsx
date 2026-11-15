import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, openHtml } from "@/api/client";
import { useAuth } from "@/auth/Auth";
import { Icon } from "@/components/Icon";
import { Button, Chip, Empty, ErrorBox, PageHeader, Skeleton, Stat } from "@/components/ui";
import { LEVEL_FILL } from "@/components/viz";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease, Page } from "@/motion";

export type Weekly = {
  week_start: string; week_end: string; answered: number; correct: number; accuracy: number | null; previous_accuracy: number | null;
  change: number | null; minutes: number; active_days: number; streak_days: number;
  days: { date: string; answered: number; correct: number }[];
  by_level: Record<string, { correct: number; total: number }>; strongest_level: string | null; weakest_level: string | null;
  by_chapter: { chapter_id: string; name_en: string; name_bn: string; correct: number; total: number; accuracy: number }[];
  weak_concepts: { concept_id: string; name_en: string; name_bn: string; mastery: number }[];
  tests: { title: string; score: number; total: number }[];
  recommendations: { en: string[]; bn: string[] };
};

export const useWeekly = (sid?: number, offset = 0) =>
  useQuery({ queryKey: ["weekly", sid, offset], enabled: !!sid, queryFn: () => api<Weekly>(`/students/${sid}/weekly-report`, { query: { offset } }) });

/** Accuracy ring */
export function Ring({ value, size = 120, label }: { value: number | null; size?: number; label?: string }) {
  const { n } = useI18n();
  const pct = value == null ? 0 : value * 100;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <defs><linearGradient id="wr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E2B862" /><stop offset="1" stopColor="#7A0F1E" /></linearGradient></defs>
        <circle cx="50" cy="50" r="42" fill="none" stroke="#EFE5E0" strokeWidth="9" />
        <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#wr)" strokeWidth="9" strokeLinecap="round" strokeDasharray="264"
          initial={{ strokeDashoffset: 264 }} animate={{ strokeDashoffset: 264 - (264 * pct) / 100 }} transition={{ duration: 1.4, ease }} />
      </svg>
      <div className="text-center"><div className="text-2xl font-bold">{value == null ? "–" : `${n(Math.round(pct))}%`}</div>{label && <div className="text-[11px] text-ink-3">{label}</div>}</div>
    </div>
  );
}

/** 7-day activity strip (Sat → Fri) */
export function DayStrip({ days }: { days: Weekly["days"] }) {
  const { lang, n } = useI18n();
  const max = Math.max(1, ...days.map((d) => d.answered));
  return (
    <div className="flex items-end gap-2">
      {days.map((d, i) => {
        const dt = new Date(d.date + "T00:00:00");
        const day = dt.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "short" });
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5" title={`${d.answered}`}>
            <span className="text-[11px] font-semibold tabular-nums text-ink-2">{d.answered ? n(d.answered) : ""}</span>
            <div className="flex h-20 w-full items-end overflow-hidden rounded-lg bg-head">
              <motion.div className="w-full rounded-lg bg-gradient-to-t from-maroon to-[#E2566C]" initial={{ height: 0 }} animate={{ height: `${(100 * d.answered) / max}%` }} transition={{ delay: i * 0.06, duration: 0.7, ease }} />
            </div>
            <span className={`text-[11px] ${d.answered ? "font-bold text-maroon" : "text-ink-3"}`}>{day}</span>
          </div>
        );
      })}
    </div>
  );
}

export function WeeklySummary({ sid, compact }: { sid: number; compact?: boolean }) {
  const { t, n, lang, pick } = useI18n();
  const [offset, setOffset] = useState(0);
  const r = useWeekly(sid, offset);
  const d = r.data;
  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="h3 flex-1">{t("report_title")} {d && <span className="ml-1 text-sm font-normal text-ink-3">{d.week_start} → {d.week_end}</span>}</h2>
        {!compact && [0, 1, 2, 3].map((o) => <Chip key={o} active={offset === o} onClick={() => setOffset(o)}>{o === 0 ? t("this_week") : o === 1 ? t("last_week") : t("weeks_ago", { n: o })}</Chip>)}
        <Button size="sm" variant="ghost" icon="printer" onClick={() => openHtml(`/students/${sid}/weekly-report`, { offset, format: "html", lang })}>{t("print_report")}</Button>
        {compact && <Link to="/app/report"><Button size="sm" variant="secondary">{t("open_report")}</Button></Link>}
      </div>
      {r.error ? <ErrorBox error={r.error} /> : !d ? <Skeleton className="h-48" /> : (
        <div className="space-y-5">
          <div className="grid items-center gap-5 md:grid-cols-[auto_1fr]">
            <Ring value={d.accuracy} size={compact ? 116 : 140} label={t("accuracy")} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([[t("answered"), d.answered, "target"], [t("active_days"), d.active_days, "clock"], [t("streak"), d.streak_days, "sparkle"], [t("minutes"), d.minutes, "history"]] as const).map(([l, v, ic]) => (
                <div key={l} className="rounded-xl bg-head/70 p-3"><Icon name={ic} className="h-4 w-4 text-maroon" /><div className="mt-1 text-2xl font-bold"><CountUp to={v} /></div><div className="text-xs text-ink-2">{l}</div></div>
              ))}
            </div>
          </div>
          {d.change != null && (
            <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${d.change >= 0 ? "bg-[#E3F1E3] text-ok" : "bg-[#FBE7E5] text-err"}`}>
              {d.change >= 0 ? "▲" : "▼"} {n(Math.abs(Math.round(d.change * 100)))}% {t("vs_last_week")}
            </p>
          )}
          <div><div className="label mb-2">{t("daily_activity")}</div><DayStrip days={d.days} /></div>
          {!compact && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <div className="label mb-2">{t("by_level")}</div>
                {Object.entries(d.by_level).map(([k, v], i) => (
                  <div key={k} className="mb-2 grid grid-cols-[110px_1fr_56px] items-center gap-3 text-sm">
                    <span><b>{k}</b> <span className="text-ink-3">{t(k as StrKey)}</span></span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-head"><motion.div className="h-full rounded-full" style={{ background: LEVEL_FILL[k] }} initial={{ width: 0 }} animate={{ width: v.total ? `${(100 * v.correct) / v.total}%` : 0 }} transition={{ delay: i * 0.08, duration: 0.8, ease }} /></div>
                    <span className="text-right tabular-nums text-ink-2">{v.total ? `${n(v.correct)}/${n(v.total)}` : "–"}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="label mb-2">{t("by_chapter")}</div>
                {d.by_chapter.length ? d.by_chapter.slice(0, 6).map((c) => (
                  <div key={c.chapter_id} className="mb-2 flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{pick(c) || c.chapter_id}</span>
                    <span className={`chip border-transparent ${c.accuracy < 0.5 ? "bg-[#FBE7E5] text-err" : c.accuracy < 0.75 ? "bg-[#FBF1DE] text-warn" : "bg-[#E3F1E3] text-ok"}`}>{n(Math.round(c.accuracy * 100))}%</span></div>
                )) : <p className="text-sm text-ink-3">–</p>}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-gold/40 bg-gradient-to-br from-[#FBF3DF] to-white p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold"><Icon name="sparkle" className="h-4 w-4 text-gold" />{t("suggestions")}</div>
            <ul className="space-y-1.5 text-sm">{(lang === "bn" ? d.recommendations.bn : d.recommendations.en).map((x, i) => <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}>• {x}</motion.li>)}</ul>
            {!compact && d.weak_concepts.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{d.weak_concepts.map((c) => <span key={c.concept_id} className="chip border-err/30 bg-white text-err">{pick(c)}</span>)}</div>}
          </div>
          {!compact && d.tests.length > 0 && (
            <div><div className="label mb-2">{t("nav_tests")}</div>{d.tests.map((x, i) => <div key={i} className="flex justify-between border-b border-line py-2 text-sm last:border-0"><span>{x.title}</span><b>{n(x.score)}/{n(x.total)}</b></div>)}</div>
          )}
        </div>
      )}
    </section>
  );
}

export default function WeeklyReportPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user) return null;
  return (
    <Page>
      <PageHeader title={t("report_title")} sub={t("report_sub")} />
      <WeeklySummary sid={user.id} />
    </Page>
  );
}

export { Empty, Stat };
