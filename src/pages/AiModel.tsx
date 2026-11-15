import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useRef, useState } from "react";
import { api, ApiError } from "@/api/client";
import { useMlStatus } from "@/api/hooks";
import { Icon, type IconName } from "@/components/Icon";
import { Button, ConfBar, DiffBadge, ErrorBox, Field, Input, LevelBadge, PageHeader, Stat, Textarea } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease, Page } from "@/motion";
import type { SceneProgress } from "@/three/OrbitScene";

const OrbitScene = lazy(() => import("@/three/OrbitScene"));

type Pred = { id: string; chapter?: { id: string; name?: string; confidence: number }; concept?: { id: string; name?: string; confidence: number }; topic?: { id: string; name?: string; confidence: number };
  cognitive_level?: { label: string; name?: string; confidence: number }; difficulty?: { label: string; confidence: number; source: string }; model_version: string; warnings: string[]; error?: { code: string; message: string } };

export default function AiModel() {
  const { t, n, date } = useI18n();
  const ml = useMlStatus();
  const models = useQuery({ queryKey: ["ml-models"], queryFn: () => api<{ id: number; version: string; impl: string; metrics: Record<string, number>; notes: string; is_active: boolean; deployed_at: string }[]>("/ml/models") });
  const ag = useQuery({ queryKey: ["agreement"], queryFn: () => api<{ reviewed: number; acceptance_rate: number | null; level_macro_f1: number | null }>("/ml/agreement") });
  const progress = useRef<SceneProgress>({ p1: 1, p2: 0 });
  const active = models.data?.find((m) => m.is_active);
  const mock = (ml.data?.version || "").startsWith("mock");
  const steps: [IconName, StrKey][] = [["file", "ai_step1"], ["cpu", "ai_step2"], ["target", "ai_step3"], ["shield", "ai_step4"]];

  return (
    <Page>
      <PageHeader title={t("ai_title")} sub={t("ai_sub")} />
      <section className="glass-dark relative mb-6 overflow-hidden rounded-[20px] border text-white">
        <div className="absolute inset-0 opacity-90"><Suspense fallback={null}><OrbitScene progress={progress} density={0.35} className="absolute inset-0" /></Suspense></div>
        <div className="relative grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
          <div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${ml.data?.status === "ready" ? "bg-white/90 text-ok" : "bg-white/90 text-err"}`}>
              <span className={`h-2 w-2 rounded-full ${ml.data?.status === "ready" ? "bg-ok" : "bg-err"}`} />{ml.data?.status === "ready" ? t("ready") : t("offline")}
            </span>
            <h2 className="mt-3 text-3xl font-bold">{ml.data?.version || "–"}</h2>
            <code className="mt-1 block text-sm text-white/70">{ml.data?.impl}</code>
            {mock && <p className="mt-3 max-w-md rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85">{t("demo_model_note")}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 self-end">
            {[[t("threshold"), ml.data ? n(ml.data.review_threshold, { minimumFractionDigits: 2 }) : "–"], [t("reviewed_n"), ag.data ? <CountUp to={ag.data.reviewed} /> : "–"],
              [t("acceptance"), ag.data?.acceptance_rate != null ? <CountUp to={Math.round(ag.data.acceptance_rate * 100)} suffix="%" /> : "–"], [t("macro_f1"), ag.data?.level_macro_f1 != null ? n(ag.data.level_macro_f1) : "–"]].map(([l, v], i) => (
              <div key={i} className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur"><div className="text-xs text-white/70">{l}</div><div className="text-xl font-bold">{v}</div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="card mb-6">
        <h2 className="h3 mb-4">{t("ai_how")}</h2>
        <div className="relative grid gap-4 md:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-6 hidden h-0.5 bg-head md:block"><motion.i className="block h-full bg-gradient-to-r from-gold to-maroon" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1.6, ease }} /></div>
          {steps.map(([ic, l], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.2 }} className="relative text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-maroon text-white shadow-lift"><Icon name={ic} /></div>
              <div className="mt-2 font-semibold">{t(l)}</div>
              <div className="text-xs text-ink-3">{[`${t("chapter")} · ${t("concept")} · ${t("topic")}`, "K1–K4 · " + t("difficulty"), `< ${ml.data?.review_threshold ?? 0.6} → ${t("st_needs_review")}`, `${t("st_verified")} · ${t("board_match")}`][i]}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Playground />
        <div className="space-y-6">
          <section className="card">
            <h2 className="h3 mb-3">{t("metrics")}</h2>
            {active && Object.keys(active.metrics || {}).length ? (
              <div className="grid grid-cols-2 gap-3">{Object.entries(active.metrics).map(([k, v], i) => <Stat key={k} label={k} value={typeof v === "number" && v <= 1 ? `${n(Math.round(v * 100))}%` : String(v)} icon="target" delay={i * 0.05} />)}</div>
            ) : <p className="text-sm text-ink-2">{t("metrics_none")}</p>}
          </section>
          <section className="card">
            <h2 className="h3 mb-3">{t("versions")}</h2>
            {models.data?.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-0">
                <span className={`h-2.5 w-2.5 rounded-full ${m.is_active ? "bg-ok shadow-[0_0_0_4px_rgba(45,106,45,.15)]" : "bg-line"}`} /><b>{m.version}</b><code className="truncate text-xs text-ink-3">{m.impl}</code><span className="ml-auto whitespace-nowrap text-ink-3">{date(m.deployed_at)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </Page>
  );
}

function Playground() {
  const { t, n, lang } = useI18n();
  const [f, setF] = useState({ language: lang as "bn" | "en", stem: lang === "bn" ? "৫ কেজি ভরের বস্তুর উপর ১০ নিউটন বল প্রয়োগ করলে ত্বরণ কত হবে?" : "A 10 N force acts on a 5 kg body. What is its acceleration?", A: lang === "bn" ? "০.৫ মি/সে²" : "0.5 m/s²", B: lang === "bn" ? "২ মি/সে²" : "2 m/s²", C: lang === "bn" ? "৫ মি/সে²" : "5 m/s²", D: lang === "bn" ? "৫০ মি/সে²" : "50 m/s²" });
  const [res, setRes] = useState<{ latency_ms: number; outputs: Pred[] } | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [json, setJson] = useState(false);
  const run = async () => {
    setBusy(true); setErr(null);
    try { setRes(await api("/ml/predict", { body: [{ id: "try-1", language: f.language, stem: f.stem, options: { A: f.A, B: f.B, C: f.C, D: f.D } }] })); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  const o = res?.outputs[0];
  return (
    <section className="card">
      <div className="mb-3 flex items-center gap-2"><h2 className="h3 flex-1">{t("ai_try")}</h2><span className="text-xs text-ink-3">{t("ai_try_sub")}</span></div>
      <div className="space-y-3">
        <div className="flex rounded-full border border-line p-0.5 text-sm w-fit">{(["bn", "en"] as const).map((l) => <button key={l} onClick={() => setF({ ...f, language: l })} className={`h-8 rounded-full px-3 font-semibold ${f.language === l ? "bg-maroon text-white" : "text-ink-2"}`}>{l === "bn" ? t("bangla") : t("english")}</button>)}</div>
        <Field label={t("stem")}><Textarea rows={2} value={f.stem} onChange={(e) => setF({ ...f, stem: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">{(["A", "B", "C", "D"] as const).map((k) => <Input key={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}</div>
        <Button icon="cpu" loading={busy} onClick={run}>{t("run")}</Button>
        {err && <ErrorBox error={err} />}
        <AnimatePresence>
          {o && (
            <motion.div key={res!.latency_ms + o.model_version} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5 rounded-xl border border-line bg-white p-4">
              {o.error ? <p className="text-err">{o.error.code}: {o.error.message}</p> : <>
                {([["chapter", o.chapter], ["concept", o.concept], ["topic", o.topic]] as const).map(([k, v]) => v && (
                  <div key={k} className="grid grid-cols-[90px_1fr] gap-2 text-sm"><span className="label">{t(k)}</span><div><b>{v.name}</b> <code className="text-xs text-ink-3">{v.id}</code><ConfBar value={v.confidence} className="mt-1 max-w-xs" /></div></div>
                ))}
                <div className="grid grid-cols-[90px_1fr] gap-2 text-sm"><span className="label">{t("level")}</span><div><LevelBadge code={o.cognitive_level?.label} /><ConfBar value={o.cognitive_level?.confidence} className="mt-1 max-w-xs" /></div></div>
                <div className="grid grid-cols-[90px_1fr] gap-2 text-sm"><span className="label">{t("difficulty")}</span><div><DiffBadge value={o.difficulty?.label} /><ConfBar value={o.difficulty?.confidence} className="mt-1 max-w-xs" /></div></div>
              </>}
              <div className="flex items-center gap-3 border-t border-line pt-2 text-xs text-ink-3"><span>{t("latency")}: {n(res!.latency_ms)} ms</span><span>{o.model_version}</span><button className="ml-auto font-semibold text-maroon" onClick={() => setJson(!json)}>{t("show_json")}</button></div>
              {json && <pre className="max-h-64 overflow-auto rounded-lg bg-[#1F1F1F] p-3 text-xs text-[#F4D58A]">{JSON.stringify(o, null, 2)}</pre>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
