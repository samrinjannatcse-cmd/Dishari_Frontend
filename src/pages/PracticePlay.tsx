import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl } from "@/api/client";
import { Icon } from "@/components/Icon";
import { optLabel } from "@/components/QuestionView";
import { Button, ErrorBox, LevelBadge, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { ease } from "@/motion";
import { Timer, useCountdown } from "./Tests";

type PQ = { position: number; id: number; language: string; stem: string; options: Record<string, string>; image_url?: string | null; chosen?: string | null; chapter?: { name_en?: string; name_bn?: string } | null; cognitive_level?: { id: string } | null };
const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 60, rotateY: d * -12 }),
  center: { opacity: 1, x: 0, rotateY: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -60, rotateY: d * 12 }),
};
type Session = { id: number; total: number; status: string; started_at: string; mode?: string; time_limit_min?: number | null; questions: PQ[] };

export default function PracticePlay() {
  const { id } = useParams();
  const { t, n, pick } = useI18n();
  const nav = useNavigate();
  const s = useQuery({ queryKey: ["practice", id], queryFn: () => api<Session>(`/practice/sessions/${id}`) });
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [ans, setAns] = useState<Record<number, string>>({});
  const times = useRef<Record<number, number>>({});
  const shown = useRef(Date.now());
  const [busy, setBusy] = useState(false);
  const key = `dishari.practice.${id}`;

  useEffect(() => { if (s.data?.status === "submitted") nav(`/app/practice/${id}/result`, { replace: true }); }, [s.data, id, nav]);
  useEffect(() => { try { const x = localStorage.getItem(key); if (x) setAns(JSON.parse(x)); } catch { /* ignore */ } }, [key]);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(ans)); } catch { /* ignore */ } }, [ans, key]);

  const qs = s.data?.questions || [];
  const q = qs[i];
  const go = (to: number) => {
    if (q) times.current[q.id] = (times.current[q.id] || 0) + (Date.now() - shown.current);
    shown.current = Date.now(); setDir(to > i ? 1 : -1); setI(to);
  };
  const choose = (k: string) => { setAns((a) => ({ ...a, [q.id]: k })); if (i < qs.length - 1) setTimeout(() => go(i + 1), 380); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!q) return;
      const m: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D", a: "A", b: "B", c: "C", d: "D" };
      if (m[e.key.toLowerCase()]) choose(m[e.key.toLowerCase()]);
      if (e.key === "ArrowRight" && i < qs.length - 1) go(i + 1);
      if (e.key === "ArrowLeft" && i > 0) go(i - 1);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  const exam = s.data?.mode === "exam" && !!s.data?.time_limit_min;
  const deadline = exam ? new Date(new Date(s.data!.started_at).getTime() + s.data!.time_limit_min! * 60000).toISOString() : null;
  const secs = useCountdown(deadline);
  useEffect(() => { if (exam && secs === 0) submit(true); }, [secs]); // eslint-disable-line
  const submit = async (auto = false) => {
    const left = qs.length - Object.keys(ans).length;
    if (!auto && left > 0 && !confirm(t("submit_confirm", { n: left }))) return;
    setBusy(true);
    if (q) times.current[q.id] = (times.current[q.id] || 0) + (Date.now() - shown.current);
    try {
      await api(`/practice/sessions/${id}/submit`, { body: { answers: Object.fromEntries(qs.map((x) => [x.id, ans[x.id] || null])), time_ms: times.current } });
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      nav(`/app/practice/${id}/result`);
    } finally { setBusy(false); }
  };

  if (s.error) return <ErrorBox error={s.error} />;
  if (!q) return <Skeleton className="h-[480px]" />;
  const done = Object.keys(ans).length;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-4">
        {exam && <Timer left={secs} total={(s.data?.time_limit_min || 1) * 60} />}
        <button onClick={() => nav("/app/practice")} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label={t("back")}><Icon name="left" /></button>
        <div className="flex-1">
          <div className="mb-1.5 flex justify-between text-sm"><b>{t("q_of", { i: i + 1, n: qs.length })}</b><span className="text-white/75">{n(done)}/{n(qs.length)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20"><motion.div className="h-full rounded-full bg-gradient-to-r from-gold to-maroon" animate={{ width: `${(100 * done) / qs.length}%` }} transition={{ ease }} /></div>
        </div>
      </div>
      <div className="relative [perspective:1400px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section key={q.id} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4, ease }}
            className="card !p-6 md:!p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">{q.chapter && <span>{pick(q.chapter)}</span>}<LevelBadge code={q.cognitive_level?.id} short /></div>
            <h1 className="text-xl font-medium leading-[1.7] md:text-2xl">{q.stem}</h1>
            {q.image_url && <img src={mediaUrl(q.image_url)!} alt="" className="mt-4 max-h-64 rounded-lg border border-line" />}
            <div role="radiogroup" className="mt-6 grid gap-3">
              {(["A", "B", "C", "D"] as const).map((k, j) => {
                const on = ans[q.id] === k;
                return (
                  <motion.button key={k} role="radio" aria-checked={on} onClick={() => choose(k)}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + j * 0.06 }} whileTap={{ scale: 0.98 }}
                    className={`group flex min-h-[56px] items-center gap-4 rounded-xl border-2 px-4 py-3 text-left text-[17px] transition ${on ? "border-maroon bg-maroon-tint" : "border-line bg-white hover:border-maroon/40 hover:bg-paper"}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 font-bold transition ${on ? "border-maroon bg-maroon text-white" : "border-line text-ink-2 group-hover:border-maroon/50"}`}>{optLabel(k, q.language)}</span>
                    <span className="flex-1">{q.options[k]}</span>
                    {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Icon name="check" className="h-5 w-5 text-maroon" /></motion.span>}
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <Button variant="secondary" disabled={i === 0} onClick={() => go(i - 1)} icon="left">{t("prev")}</Button>
        <div className="mx-auto hidden gap-1.5 sm:flex">{qs.map((x, j) => <button key={x.id} onClick={() => go(j)} aria-label={String(j + 1)} className={`h-2.5 rounded-full transition-all ${j === i ? "w-6 bg-white" : ans[x.id] ? "w-2.5 bg-gold" : "w-2.5 bg-white/30"}`} />)}</div>
        {i < qs.length - 1 ? <Button className="ml-auto" onClick={() => go(i + 1)}>{t("next")} →</Button> : <Button className="ml-auto" variant="gold" icon="check" loading={busy} onClick={() => submit()}>{t("submit")}</Button>}
      </div>
    </div>
  );
}
