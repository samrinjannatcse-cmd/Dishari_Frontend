import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/api/client";
import { useAuth } from "@/auth/Auth";
import { Empty, ErrorBox, PageHeader, Skeleton, Stat } from "@/components/ui";
import { LEVEL_FILL } from "@/components/viz";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease, Page } from "@/motion";

type Prog = {
  sessions: { id: number; submitted_at: string; score: number; total: number; percent: number }[];
  by_level: Record<string, { correct: number; total: number }>;
  by_chapter: Record<string, { correct: number; total: number; name_en?: string; name_bn?: string }>;
};
type Mastery = { concepts: { concept_id: string; name_en: string; name_bn: string; answered: number; mastery: number; label: string }[] };
const M_STYLE: Record<string, string> = { weak: "bg-[#FBE7E5] text-err", developing: "bg-[#FBF1DE] text-warn", strong: "bg-[#E3F1E3] text-ok", insufficient_evidence: "bg-head text-ink-3" };

export default function Progress({ studentId, embedded }: { studentId?: number; embedded?: boolean }) {
  const { sid } = useParams();
  const { user } = useAuth();
  const { t, n, pick, date } = useI18n();
  const id = studentId ?? (sid ? Number(sid) : user?.id);
  const p = useQuery({ queryKey: ["progress", id], enabled: !!id, queryFn: () => api<Prog>(`/students/${id}/progress`) });
  const m = useQuery({ queryKey: ["mastery", id], enabled: !!id, queryFn: () => api<Mastery>(`/students/${id}/mastery`) });

  const body = (() => {
    if (p.error) return <ErrorBox error={p.error} />;
    if (!p.data) return <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>;
    const d = p.data;
    if (!d.sessions.length) return <div className="card"><Empty icon="chart" title={t("no_practice")} /></div>;
    const lv = Object.entries(d.by_level).filter(([, v]) => v.total).map(([k, v]) => [k, v.correct / v.total] as const).sort((a, b) => b[1] - a[1]);
    const avg = Math.round(d.sessions.reduce((s, x) => s + x.percent, 0) / d.sessions.length);
    const chart = d.sessions.map((s, i) => ({ i: n(i + 1), pct: s.percent, date: date(s.submitted_at) }));
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("sessions_done")} value={<CountUp to={d.sessions.length} />} icon="target" />
          <Stat label={t("avg_score")} value={<CountUp to={avg} suffix="%" />} icon="chart" tone="gold" delay={0.05} />
          <Stat label={t("best_level")} value={lv[0] ? `${lv[0][0]}` : "–"} icon="sparkle" tone="ok" delay={0.1} />
          <Stat label={t("weakest_level")} value={lv.length ? `${lv[lv.length - 1][0]}` : "–"} icon="alert" tone="warn" delay={0.15} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className="card">
            <h2 className="h3 mb-4">{t("score_trend")}</h2>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7A0F1E" stopOpacity={0.35} /><stop offset="1" stopColor="#7A0F1E" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#EFE9E1" vertical={false} />
                  <XAxis dataKey="i" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => n(v)} />
                  <Tooltip formatter={(v: number) => [`${n(v)}%`, t("score")]} labelFormatter={(_, pl) => pl?.[0]?.payload?.date} contentStyle={{ borderRadius: 10, border: "1px solid #C8C8C8" }} />
                  <Area type="monotone" dataKey="pct" stroke="#7A0F1E" strokeWidth={2.5} fill="url(#ar)" dot={{ r: 4, fill: "#B8892B", strokeWidth: 0 }} animationDuration={1400} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card">
            <h2 className="h3 mb-4">{t("by_level")}</h2>
            <div className="flex h-56 items-end justify-around gap-3">
              {["K1", "K2", "K3", "K4"].map((k, i) => {
                const v = d.by_level[k]; const pct = v?.total ? (100 * v.correct) / v.total : 0;
                return (
                  <div key={k} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-sm font-semibold tabular-nums">{v?.total ? `${n(Math.round(pct))}%` : "–"}</span>
                    <motion.div className="w-full max-w-[56px] rounded-t-xl" style={{ background: `linear-gradient(to top, ${LEVEL_FILL[k]}, ${LEVEL_FILL[k]}aa)` }} initial={{ height: 0 }} animate={{ height: `${Math.max(4, pct)}%` }} transition={{ delay: 0.2 + i * 0.1, duration: 0.9, ease }} />
                    <b className="text-sm">{k}</b><span className="-mt-2 text-[11px] text-ink-3">{t(k as StrKey)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card">
            <h2 className="h3 mb-3">{t("by_chapter")}</h2>
            <div className="space-y-2.5">
              {Object.entries(d.by_chapter).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v], i) => (
                <div key={k} className="text-sm">
                  <div className="mb-1 flex justify-between gap-2"><span className="truncate">{n(Number(k) || 0)}. {pick(v)}</span><span className="tabular-nums text-ink-2">{n(v.correct)}/{n(v.total)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-head"><motion.div className="h-full rounded-full bg-gradient-to-r from-gold to-maroon" initial={{ width: 0 }} animate={{ width: `${(100 * v.correct) / v.total}%` }} transition={{ delay: i * 0.05, duration: 0.8, ease }} /></div>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <h2 className="h3">{t("mastery")}</h2>
            <p className="mb-3 text-xs text-ink-3">{t("mastery_note")}</p>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {m.data?.concepts.map((c) => (
                <div key={c.concept_id} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{pick(c)}</span>
                  <span className="tabular-nums text-ink-3">{n(c.answered)}</span>
                  <span className={`chip border-transparent ${M_STYLE[c.label]}`}>{t(`m_${c.label}` as StrKey)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  })();
  if (embedded) return body;
  return <Page><PageHeader title={t("progress_title")} />{body}</Page>;
}
