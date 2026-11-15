import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Question } from "@/api/client";
import { useMlStatus } from "@/api/hooks";
import { Icon } from "@/components/Icon";
import { optLabel, Scanning, TagPanel } from "@/components/QuestionView";
import { Button, Empty, Field, Input, PageHeader, Textarea, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { ease, Page } from "@/motion";

type Form = { language: "bn" | "en"; stem: string; options: Record<"A" | "B" | "C" | "D", string>; answer: string; source: string; explanation: string };
const blank = (language: "bn" | "en"): Form => ({ language, stem: "", options: { A: "", B: "", C: "", D: "" }, answer: "", source: "", explanation: "" });

export default function TagQuestion() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const ml = useMlStatus();
  const [f, setF] = useState<Form>(blank(lang));
  const [img, setImg] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [result, setResult] = useState<Question | null>(null);
  const [board, setBoard] = useState<{ matched: boolean; board?: string; year?: number; score?: number } | null>(null);
  const stemRef = useRef<HTMLTextAreaElement>(null);

  // live board-bank check while typing (debounced)
  useEffect(() => {
    if (f.stem.trim().length < 15) { setBoard(null); return; }
    const id = setTimeout(() => {
      api<typeof board>("/board-questions/check", { query: { language: f.language, stem: f.stem } }).then(setBoard).catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [f.stem, f.language]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setRowErr(null); setResult(null);
    try {
      const body = { items: [{ language: f.language, stem: f.stem, options: f.options, answer: f.answer || null, source: f.source || null, explanation: f.explanation || null, figure_dependent: !!img }] };
      const [r] = await api<{ ok: boolean; question?: Question; error?: { code: string; message: string } }[]>("/questions/tag", { body });
      if (!r.ok || !r.question) { setRowErr(r.error?.message || "Error"); return; }
      let q = r.question;
      if (img) { const fd = new FormData(); fd.append("file", img); q = await api<Question>(`/questions/${q.id}/image`, { form: fd }); }
      await new Promise((res) => setTimeout(res, 500)); // let the scan animation breathe
      setResult(q);
      toast(t("tag_saved"));
      qc.invalidateQueries({ queryKey: ["questions"] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  };
  const reset = () => { setF(blank(f.language)); setImg(null); setResult(null); setBoard(null); stemRef.current?.focus(); };
  const complete = f.stem.trim() && Object.values(f.options).every((v) => v.trim());

  return (
    <Page>
      <PageHeader title={t("tag_title")} sub={t("tag_sub")} />
      {ml.data && ml.data.status !== "ready" && <p className="mb-4 flex items-center gap-2 rounded-card border border-err/30 bg-[#FBE7E5] px-4 py-3 text-sm text-err"><Icon name="alert" className="h-4 w-4" />{t("model_offline")}</p>}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <form onSubmit={submit} className="card space-y-4">
          <div className="flex items-center gap-3">
            <span className="label">{t("language")}</span>
            <div className="flex rounded-full border border-line p-0.5 text-sm">
              {(["bn", "en"] as const).map((l) => (
                <button type="button" key={l} onClick={() => setF({ ...f, language: l })} className={`h-8 rounded-full px-3 font-semibold transition ${f.language === l ? "bg-maroon text-white" : "text-ink-2"}`}>{l === "bn" ? t("bangla") : t("english")}</button>
              ))}
            </div>
          </div>
          <Field label={t("stem")} error={err?.fields?.stem}>
            <Textarea ref={stemRef} rows={3} required value={f.stem} placeholder={f.language === "bn" ? "যেমন: নিচের কোনটি ভেক্টর রাশি?" : "e.g. Which of the following is a vector quantity?"} onChange={(e) => setF({ ...f, stem: e.target.value })} />
          </Field>
          <AnimatePresence>
            {board?.matched && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2 rounded-lg border border-gold/50 bg-[#FBF3DF] px-3 py-2 text-sm"><Icon name="sparkle" className="h-4 w-4 text-gold" /><b>{t("possible_board")}:</b> {board.board} {board.year}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((k) => (
              <Field key={k} label={t("option", { k: optLabel(k, f.language) })}>
                <div className="relative">
                  <Input required value={f.options[k]} className={`pl-11 ${f.answer === k ? "border-ok ring-4 ring-ok/10" : ""}`} onChange={(e) => setF({ ...f, options: { ...f.options, [k]: e.target.value } })} />
                  <button type="button" title={t("answer")} onClick={() => setF({ ...f, answer: f.answer === k ? "" : k })}
                    className={`absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-xs font-bold transition ${f.answer === k ? "bg-ok text-white" : "bg-head text-ink-2 hover:bg-maroon-tint"}`}>
                    {f.answer === k ? <Icon name="check" className="h-3.5 w-3.5" /> : optLabel(k, f.language)}
                  </button>
                </div>
              </Field>
            ))}
          </div>
          <p className="-mt-1 text-xs text-ink-3">{t("answer")}: {f.answer ? optLabel(f.answer, f.language) : `— (${t("optional")})`}</p>
          <details className="group rounded-lg border border-line px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-semibold text-ink-2">{t("source")} · {t("explanation")} · {t("figure")} <span className="font-normal text-ink-3">({t("optional")})</span></summary>
            <div className="mt-3 space-y-3">
              <Field label={t("source")}><Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></Field>
              <Field label={t("explanation")}><Textarea rows={2} value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} /></Field>
              <Field label={t("add_figure")}>
                <div className="flex items-center gap-3">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-field border border-line bg-white px-3 text-sm font-semibold hover:border-maroon/50">
                    <Icon name="image" className="h-4 w-4" />{img ? img.name : t("upload")}
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => setImg(e.target.files?.[0] || null)} />
                  </label>
                  {img && <><img src={URL.createObjectURL(img)} alt="" className="h-12 rounded border border-line" /><button type="button" className="text-sm text-err" onClick={() => setImg(null)}>{t("remove")}</button></>}
                </div>
              </Field>
            </div>
          </details>
          {(rowErr || (err && !err.fields?.stem)) && <p className="flex items-center gap-1.5 text-sm text-err"><Icon name="alert" className="h-4 w-4" />{rowErr || err?.message}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="lg" icon="sparkle" loading={busy} disabled={!complete}>{t("btn_tag")}</Button>
            {(result || f.stem) && <Button type="button" variant="ghost" onClick={reset}>{t("clear")}</Button>}
          </div>
        </form>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <AnimatePresence mode="wait">
            {busy ? <motion.div key="s" exit={{ opacity: 0 }}><Scanning /></motion.div>
              : result ? (
                <motion.div key={result.id} initial={{ opacity: 0, y: 20, rotateX: -8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.6, ease }} className="card [transform-perspective:900px]">
                  <TagPanel q={result} />
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                    <Button onClick={reset} icon="plus">{t("tag_another")}</Button>
                    <Link to={`/app/questions/${result.id}`}><Button variant="secondary" icon="eye">{t("open_question")}</Button></Link>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card border-dashed">
                  <Empty icon="tag" title={t("result_here")} sub={t("result_here_sub")} />
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </div>
    </Page>
  );
}
