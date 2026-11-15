import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type Question } from "@/api/client";
import { conceptsOf, topicsOf, useTaxonomy } from "@/api/hooks";
import { useAuth } from "@/auth/Auth";
import { Icon } from "@/components/Icon";
import { Stem, TagPanel } from "@/components/QuestionView";
import { Button, ErrorBox, Field, Modal, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { Page } from "@/motion";

export default function QuestionDetail() {
  const { id } = useParams();
  const { t, n, date } = useI18n();
  const { user, has } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["question", id], queryFn: () => api<Question>(`/questions/${id}`) });
  const hist = useQuery({ queryKey: ["question-history", id], queryFn: () => api<{ predictions: { id: number; model_version: string; created_at: string }[]; reviews: { id: number; action: string; reason: string | null; created_at: string }[] }>(`/questions/${id}/history`) });
  const [edit, setEdit] = useState(false);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState("");
  const refresh = (x: Question) => { qc.setQueryData(["question", id], x); qc.invalidateQueries({ queryKey: ["questions"] }); qc.invalidateQueries({ queryKey: ["question-history", id] }); };
  const canEdit = q.data && (has("admin", "moderator") || q.data.created_by === user?.id);

  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e) { toast((e as ApiError).message, "err"); } finally { setBusy(""); } };

  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /></div>;
  const x = q.data;
  return (
    <Page>
      <PageHeader title={`${t("question")} #${n(x.id)}`} sub={`${x.language === "bn" ? t("bangla") : t("english")} · ${date(x.created_at)}${x.source ? " · " + x.source : ""}`}
        actions={<>
          <Link to="/app/questions"><Button variant="ghost" icon="left">{t("back")}</Button></Link>
          <Button variant="secondary" icon="flag" onClick={() => setReport(true)}>{t("report_tag")}</Button>
          {canEdit && <Button variant="secondary" icon="edit" onClick={() => setEdit(true)}>{t("edit_tags")}</Button>}
        </>} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <section className="card"><Stem q={x} />{x.explanation && <p className="mt-4 rounded-lg bg-head p-3 text-sm"><b>{t("explanation")}:</b> {x.explanation}</p>}</section>
          {canEdit && (
            <section className="card flex flex-wrap items-center gap-2 !p-4">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-field border border-line px-3 text-sm font-semibold hover:border-maroon/50">
                <Icon name="image" className="h-4 w-4" />{x.image_url ? t("edit") : t("add_figure")}
                <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) run("img", async () => { const fd = new FormData(); fd.append("file", f); refresh(await api<Question>(`/questions/${x.id}/image`, { form: fd })); }); }} />
              </label>
              {x.image_url && <Button size="sm" variant="ghost" onClick={() => run("img", async () => refresh(await api<Question>(`/questions/${x.id}/image`, { method: "DELETE" })))}>{t("remove")} {t("figure")}</Button>}
              {!(x.status === "verified" && x.tag_source === "moderator") && <Button size="sm" variant="ghost" icon="refresh" loading={busy === "retag"} onClick={() => run("retag", async () => { refresh(await api<Question>(`/questions/${x.id}/retag`, { method: "POST" })); toast(t("saved")); })}>{t("retag")}</Button>}
              <Button size="sm" variant="danger" icon="trash" className="ml-auto" onClick={() => confirm(t("delete_confirm")) && run("del", async () => { await api(`/questions/${x.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["questions"] }); nav("/app/questions"); })}>{t("delete")}</Button>
            </section>
          )}
        </div>
        <div className="space-y-4">
          <section className="card"><TagPanel q={x} /></section>
          <section className="card">
            <h2 className="h3 mb-3 flex items-center gap-2"><Icon name="history" className="h-4 w-4" />{t("history")}</h2>
            <ol className="relative space-y-3 border-l border-line pl-5 text-sm">
              {[...(hist.data?.reviews || []).map((r) => ({ at: r.created_at, k: "r", text: `${r.action}${r.reason ? " — " + r.reason : ""}` })),
                ...(hist.data?.predictions || []).map((p) => ({ at: p.created_at, k: "p", text: `${t("model")} ${p.model_version}` }))]
                .sort((a, b) => b.at.localeCompare(a.at)).map((e, i) => (
                  <li key={i}><span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${e.k === "r" ? "bg-maroon" : "bg-gold"}`} /><span className="font-medium">{e.text}</span><span className="block text-xs text-ink-3">{date(e.at)}</span></li>
                ))}
            </ol>
          </section>
        </div>
      </div>
      {edit && <EditTags q={x} onClose={() => setEdit(false)} onSaved={(nq) => { refresh(nq); setEdit(false); toast(t("saved")); }} />}
      <ReportTag qid={x.id} open={report} onClose={() => setReport(false)} />
    </Page>
  );
}

export function EditTags({ q, onClose, onSaved, endpoint, reasonRequired }: { q: Question; onClose: () => void; onSaved: (q: Question) => void; endpoint?: string; reasonRequired?: boolean }) {
  const { t, pick, n } = useI18n();
  const { has } = useAuth();
  const tax = useTaxonomy();
  const [v, setV] = useState({ chapter_id: q.chapter?.id || "", concept_id: q.concept?.id || "", topic_id: q.topic?.id || "", cognitive_level: q.cognitive_level?.id || "", difficulty: q.difficulty?.id || "" });
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    const tags = Object.fromEntries(Object.entries(v).filter(([, x]) => x));
    try {
      const r = endpoint ? await api<Question>(endpoint, { body: { action: "change", tags, reason } }) : await api<Question>(`/questions/${q.id}`, { method: "PATCH", body: tags });
      onSaved(r);
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t("edit_tags")}>
      <div className="space-y-3">
        <Field label={t("chapter")}><Select value={v.chapter_id} onChange={(e) => setV({ ...v, chapter_id: e.target.value, concept_id: "", topic_id: "" })}><option value="">–</option>{tax.data?.chapters.map((c) => <option key={c.id} value={c.id}>{n(Number(c.id))}. {pick(c)}</option>)}</Select></Field>
        <Field label={t("concept")}><Select value={v.concept_id} onChange={(e) => setV({ ...v, concept_id: e.target.value, topic_id: "" })}><option value="">–</option>{conceptsOf(tax.data, v.chapter_id).map((c) => <option key={c.id} value={c.id}>{c.id} · {pick(c)}</option>)}</Select></Field>
        <Field label={t("topic")}><Select value={v.topic_id} onChange={(e) => setV({ ...v, topic_id: e.target.value })}><option value="">–</option>{topicsOf(tax.data, v.chapter_id, v.concept_id).map((c) => <option key={c.id} value={c.id}>{c.id} · {pick(c)}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("level")}><Select value={v.cognitive_level} onChange={(e) => setV({ ...v, cognitive_level: e.target.value })}>{["K1", "K2", "K3", "K4"].map((k) => <option key={k} value={k}>{k} · {t(k as never)}</option>)}</Select></Field>
          <Field label={t("difficulty")}><Select value={v.difficulty} onChange={(e) => setV({ ...v, difficulty: e.target.value })}>{["Easy", "Medium", "Hard"].map((k) => <option key={k} value={k}>{t(k as never)}</option>)}</Select></Field>
        </div>
        {reasonRequired && <Field label={t("reason")} error={err?.code === "REASON_REQUIRED" ? t("reason_req") : undefined}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
        {!reasonRequired && !has("admin", "moderator") && <p className="text-sm text-warn">{t("teacher_edit_note")}</p>}
        {err && err.code !== "REASON_REQUIRED" && <p className="text-sm text-err">{err.message}</p>}
        <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={onClose}>{t("cancel")}</Button><Button loading={busy} onClick={save} disabled={reasonRequired && !reason.trim()}>{t("save")}</Button></div>
      </div>
    </Modal>
  );
}

export function ReportTag({ qid, open, onClose }: { qid: number; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [field, setField] = useState("cognitive_level");
  const [comment, setComment] = useState("");
  const send = async () => { await api("/tag-reports", { body: { question_id: qid, field, comment } }); toast(t("report_sent")); setComment(""); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={t("report_tag")}>
      <div className="space-y-3">
        <Field label={t("which_tag")}><Select value={field} onChange={(e) => setField(e.target.value)}>
          {[["chapter", t("chapter")], ["concept", t("concept")], ["topic", t("topic")], ["cognitive_level", t("level")], ["difficulty", t("difficulty")], ["answer", t("answer")], ["other", t("other")]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select></Field>
        <Field label={t("comment")}><Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("cancel")}</Button><Button icon="flag" onClick={send}>{t("send")}</Button></div>
      </div>
    </Modal>
  );
}
