import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type S } from "@/api/client";
import { Icon } from "@/components/Icon";
import { Button, Empty, ErrorBox, Field, FileDrop, Input, Modal, PageHeader, Select, SkeletonRows } from "@/components/ui";
import { LevelMix } from "@/components/viz";
import { useI18n } from "@/i18n/I18n";
import { ease, Page, Tilt } from "@/motion";
import { BalanceBars } from "./PaperBuilder";

type Paper = S["PaperOut"];

export default function Papers() {
  const { t, n, date } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const papers = useQuery({ queryKey: ["papers"], queryFn: () => api<{ items: Paper[]; total: number }>("/papers", { query: { page_size: 100 } }) });
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState(false);
  const [f, setF] = useState({ title: "", exam_type: "class_test", duration_min: "30", language: "bn", K1: 30, K2: 30, K3: 25, K4: 15 });
  const [busy, setBusy] = useState(false);
  const sum = f.K1 + f.K2 + f.K3 + f.K4;
  const create = async () => {
    setBusy(true);
    try {
      const p = await api<Paper>("/papers", { body: { title: f.title || t("class_test"), exam_type: f.exam_type, language: f.language, duration_min: Number(f.duration_min) || null, target: { K1: f.K1, K2: f.K2, K3: f.K3, K4: f.K4 } } });
      qc.invalidateQueries({ queryKey: ["papers"] }); nav(`/app/papers/${p.id}`);
    } finally { setBusy(false); }
  };
  return (
    <Page>
      <PageHeader title={t("papers_title")} sub={t("papers_sub")} actions={<><Button variant="secondary" icon="target" onClick={() => setCheck(true)}>{t("analyse_upload")}</Button><Button icon="plus" onClick={() => setOpen(true)}>{t("new_paper")}</Button></>} />
      {papers.error && <ErrorBox error={papers.error} />}
      {papers.isLoading ? <SkeletonRows rows={4} /> : !papers.data?.items.length ? (
        <div className="card"><Empty icon="file" title={t("empty")} action={<Button icon="plus" onClick={() => setOpen(true)}>{t("new_paper")}</Button>} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {papers.data.items.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ease }}>
              <Tilt className="h-full rounded-card" max={6}>
                <Link to={`/app/papers/${p.id}`} className="glass group relative flex h-full flex-col overflow-hidden rounded-card p-5 text-ink">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-[#C63A50] to-maroon" />
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-maroon-tint text-maroon"><Icon name="file" /></span>
                    <div className="min-w-0 flex-1"><h3 className="truncate font-semibold group-hover:text-maroon">{p.title}</h3><p className="text-sm text-ink-3">{date(p.updated_at)}</p></div>
                    <span className={`chip ${p.status === "final" ? "border-ok/30 bg-[#E3F1E3] text-ok" : "border-line bg-head text-ink-2"}`}>{t(p.status === "final" ? "final" : "draft")}</span>
                  </div>
                  <div className="mt-5 flex items-end justify-between text-sm text-ink-2"><span>{t("items_n", { n: p.item_count })}</span>{p.duration_min && <span className="flex items-center gap-1"><Icon name="clock" className="h-4 w-4" />{n(p.duration_min)}′</span>}</div>
                </Link>
              </Tilt>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("new_paper")}>
        <div className="space-y-3">
          <Field label={t("paper_title")}><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("class_test")} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("exam_type")}><Select value={f.exam_type} onChange={(e) => setF({ ...f, exam_type: e.target.value })}><option value="class_test">{t("class_test")}</option><option value="model_test">{t("model_test")}</option><option value="term_exam">{t("term_exam")}</option></Select></Field>
            <Field label={t("duration")}><Input type="number" min={5} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /></Field>
            <Field label={t("language")}><Select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="bn">{t("bangla")}</option><option value="en">{t("english")}</option></Select></Field>
          </div>
          <Field label={`${t("target_mix")} · ${n(sum)}%`} error={sum !== 100 ? "≠ 100%" : undefined}>
            <div className="grid grid-cols-4 gap-2">{(["K1", "K2", "K3", "K4"] as const).map((k) => (
              <label key={k} className="text-xs font-semibold text-ink-2">{k}<Input type="number" min={0} max={100} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></label>
            ))}</div>
          </Field>
          <LevelMix data={{ K1: f.K1, K2: f.K2, K3: f.K3, K4: f.K4 }} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button loading={busy} disabled={sum !== 100} onClick={create}>{t("new_paper")}</Button></div>
        </div>
      </Modal>
      <AnalyseUpload open={check} onClose={() => setCheck(false)} />
    </Page>
  );
}

type Analysis = { question_count: number; levels: { level: string; count: number; percent: number; target: number | null; gap: number | null }[]; balanced: boolean; suggestions: { message_en: string; message_bn: string }[] };

function AnalyseUpload({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [res, setRes] = useState<{ analysis: Analysis } | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (file: File) => {
    setBusy(true); setErr(null);
    try { const fd = new FormData(); fd.append("file", file); setRes(await api("/papers/analyse-upload", { form: fd })); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => { setRes(null); onClose(); }} title={t("analyse_upload")} wide>
      <p className="mb-4 text-sm text-ink-2">{t("analyse_upload_sub")}</p>
      {!res && <FileDrop accept=".xlsx,.csv" onFile={go} busy={busy} label={t("drop_file")} sub={t("file_rules")} />}
      {err && <div className="mt-3"><ErrorBox error={err} /></div>}
      {res && <div className="space-y-4"><BalanceBars a={res.analysis} />
        {res.analysis.suggestions.map((s, i) => <p key={i} className="rounded-lg bg-[#FBF1DE] px-3 py-2 text-sm text-warn">{lang === "bn" ? s.message_bn : s.message_en}</p>)}
        <Button variant="secondary" onClick={() => setRes(null)}>{t("upload")}</Button></div>}
    </Modal>
  );
}
