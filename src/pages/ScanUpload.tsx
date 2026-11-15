import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Question } from "@/api/client";
import { Icon } from "@/components/Icon";
import { optLabel } from "@/components/QuestionView";
import { Button, Empty, ErrorBox, FileDrop, Input, LevelBadge, StatusBadge, Textarea, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { ease } from "@/motion";

type Draft = { key: number; stem: string; options: Record<"A" | "B" | "C" | "D", string>; answer: string | null; language: "bn" | "en"; warnings: string[] };
type Extract = { count: number; needs_check: number; text: string; questions: Omit<Draft, "key">[] };

let k = 0;

export default function ScanUpload() {
  const { t, n } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [raw, setRaw] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [done, setDone] = useState<Question[] | null>(null);
  const cam = useRef<HTMLInputElement>(null);

  const read = async (f: File) => {
    setFile(f); setErr(null); setDrafts(null); setDone(null); setBusy(true);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await api<Extract>("/questions/extract", { form: fd });
      setRaw(r.text);
      setDrafts(r.questions.map((q) => ({ ...q, key: ++k, options: { A: q.options.A || "", B: q.options.B || "", C: q.options.C || "", D: q.options.D || "" } })));
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  const upd = (key: number, patch: Partial<Draft>) => setDrafts((ds) => ds!.map((d) => (d.key === key ? { ...d, ...patch, warnings: [] } : d)));
  const ready = (drafts || []).filter((d) => d.stem.trim() && Object.values(d.options).every((v) => v.trim()));
  const tagAll = async () => {
    setTagging(true);
    try {
      const res = await api<{ ok: boolean; question?: Question }[]>("/questions/tag", { body: { items: ready.map((d) => ({ language: d.language, stem: d.stem, options: d.options, answer: d.answer || null, source: file?.name })) } });
      const qs = res.filter((r) => r.ok && r.question).map((r) => r.question!);
      setDone(qs); toast(t("tagged_n", { n: qs.length })); qc.invalidateQueries({ queryKey: ["questions"] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) { toast((e as ApiError).message, "err"); } finally { setTagging(false); }
  };

  if (done) return (
    <section className="card">
      <div className="mb-4 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E3F1E3] text-ok"><Icon name="check" /></span><h2 className="h2 flex-1">{t("tagged_n", { n: done.length })}</h2>
        <Button variant="secondary" onClick={() => { setDone(null); setDrafts(null); setFile(null); }}>{t("upload")}</Button><Link to="/app/questions"><Button icon="database">{t("nav_bank")}</Button></Link></div>
      <div className="space-y-2">{done.map((q, i) => (
        <motion.div key={q.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{q.stem}</span><LevelBadge code={q.cognitive_level?.id} short /><StatusBadge status={q.status} />
        </motion.div>))}</div>
    </section>
  );

  return (
    <div className="space-y-5">
      {!drafts && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <FileDrop accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" onFile={read} busy={busy} label={busy ? t("reading_paper") : t("scan_drop")} sub={t("scan_rules")} />
            <Button variant="secondary" icon="image" className="w-full md:hidden" onClick={() => cam.current?.click()}>{t("take_photo")}</Button>
            <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); }} />
            {err && <ErrorBox error={err} />}
          </div>
          <div className="card relative overflow-hidden">
            <h3 className="h3">{t("scan_title")}</h3>
            <p className="mt-1 text-sm text-ink-2">{t("scan_sub")}</p>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              {(["image", "eye", "edit", "tag"] as const).map((ic, i) => (
                <motion.div key={ic} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }} className="rounded-lg bg-head p-2.5">
                  <Icon name={ic} className="mx-auto h-5 w-5 text-maroon" /><span className="mt-1 block">{[t("upload"), "OCR", t("edit"), t("nav_tag")][i]}</span>
                </motion.div>
              ))}
            </div>
            {busy && preview && (
              <div className="relative mt-4 overflow-hidden rounded-lg border border-line">
                <img src={preview} alt="" className="max-h-72 w-full object-contain" />
                <motion.div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-gold/50 to-transparent" animate={{ y: ["-60px", "300px"] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} />
              </div>
            )}
          </div>
        </div>
      )}

      {drafts && (
        <>
          <div className="card flex flex-wrap items-center gap-3 !p-4">
            <Icon name="eye" className="h-5 w-5 text-maroon" />
            <b>{t("found_n", { n: drafts.length })}</b>
            {drafts.some((d) => d.warnings.length) && <span className="chip border-warn/40 bg-[#FBF1DE] text-warn">{t("check_n", { n: drafts.filter((d) => d.warnings.length).length })}</span>}
            <span className="text-sm text-ink-3">{t("check_hint")}</span>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)}>{t("raw_text")}</Button>
            <Button variant="secondary" size="sm" icon="upload" onClick={() => { setDrafts(null); setFile(null); }}>{t("upload")}</Button>
            <Button icon="sparkle" loading={tagging} disabled={!ready.length} onClick={tagAll}>{t("tag_all", { n: ready.length })}</Button>
          </div>
          <AnimatePresence>{showRaw && <motion.pre initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="card max-h-64 overflow-auto whitespace-pre-wrap !p-4 text-xs">{raw}</motion.pre>}</AnimatePresence>
          {preview && <img src={preview} alt="" className="max-h-56 rounded-card border border-white/30 object-contain" />}
          {!drafts.length ? <div className="card"><Empty icon="image" title={t("no_found")} /></div> : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {drafts.map((d, i) => (
                  <motion.div key={d.key} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60, height: 0 }} transition={{ ease, delay: Math.min(i, 8) * 0.03 }}
                    className={`card !p-4 ${d.warnings.length ? "ring-2 ring-warn/60" : ""}`}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-maroon text-xs font-bold text-white">{n(i + 1)}</span>
                      <div className="flex rounded-full border border-line p-0.5 text-xs">{(["bn", "en"] as const).map((l) => <button key={l} onClick={() => upd(d.key, { language: l })} className={`rounded-full px-2.5 py-1 font-semibold ${d.language === l ? "bg-maroon text-white" : "text-ink-2"}`}>{l === "bn" ? "বাংলা" : "EN"}</button>)}</div>
                      {d.warnings.map((w) => <span key={w} className="chip border-warn/40 bg-[#FBF1DE] text-warn">{t(w as never)}</span>)}
                      <button className="ml-auto grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-err/10 hover:text-err" aria-label={t("remove")} onClick={() => setDrafts(drafts.filter((x) => x.key !== d.key))}><Icon name="trash" className="h-4 w-4" /></button>
                    </div>
                    <Textarea rows={2} value={d.stem} onChange={(e) => upd(d.key, { stem: e.target.value })} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {(["A", "B", "C", "D"] as const).map((o) => (
                        <div key={o} className="relative">
                          <button type="button" title={t("answer")} onClick={() => upd(d.key, { answer: d.answer === o ? null : o })}
                            className={`absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-xs font-bold ${d.answer === o ? "bg-ok text-white" : "bg-head text-ink-2"}`}>{d.answer === o ? <Icon name="check" className="h-3.5 w-3.5" /> : optLabel(o, d.language)}</button>
                          <Input className={`pl-11 ${!d.options[o].trim() ? "border-warn" : ""}`} value={d.options[o]} onChange={(e) => upd(d.key, { options: { ...d.options, [o]: e.target.value } })} />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <Button variant="secondary" icon="plus" onClick={() => setDrafts([...drafts, { key: ++k, stem: "", options: { A: "", B: "", C: "", D: "" }, answer: null, language: "bn", warnings: [] }])}>{t("add_question")}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
