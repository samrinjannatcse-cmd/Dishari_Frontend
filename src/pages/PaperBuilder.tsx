import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PrintLayout from "./PrintLayout";
import OmrTab from "./OmrTab";
import { api, download, type Question } from "@/api/client";
import { useQuestions } from "@/api/hooks";
import { Icon } from "@/components/Icon";
import { Button, Chip, DiffBadge, Empty, ErrorBox, Input, LevelBadge, Modal, PageHeader, Skeleton, Tabs, useToast } from "@/components/ui";
import { LEVEL_FILL } from "@/components/viz";
import { useI18n } from "@/i18n/I18n";
import { ease, Page } from "@/motion";

type Item = { position: number; marks: number; question: Question };
type PaperFull = { id: number; title: string; language: string; status: string; duration_min: number | null; target: Record<string, number>; items: Item[]; item_count: number; meta?: Record<string, string> | null };
type Analysis = { question_count: number; levels: { level: string; count: number; percent: number; target: number | null; gap: number | null }[]; balanced: boolean; suggestions: { message_en: string; message_bn: string }[]; difficulty?: { label: string; count: number; percent: number }[] };

/** Actual vs target per level: animated bars with a target marker. */
export function BalanceBars({ a }: { a: Analysis }) {
  const { t, n } = useI18n();
  return (
    <div className="space-y-3">
      {a.levels.map((l, i) => (
        <div key={l.level}>
          <div className="mb-1 flex items-center justify-between text-sm"><span className="flex items-center gap-2"><LevelBadge code={l.level} /></span>
            <span className="tabular-nums text-ink-2">{n(l.percent)}%{l.target != null && <span className="text-ink-3"> / {n(l.target)}%</span>}</span></div>
          <div className="relative h-3 overflow-visible rounded-full bg-head">
            <motion.div className="h-full rounded-full" style={{ background: LEVEL_FILL[l.level] }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, l.percent)}%` }} transition={{ duration: 0.9, ease, delay: i * 0.08 }} />
            {l.target != null && <motion.i layout className="absolute -top-1 h-5 w-[3px] rounded-full bg-ink" style={{ left: `calc(${l.target}% - 1px)` }} title={t("target")} />}
          </div>
        </div>
      ))}
      <motion.div key={String(a.balanced)} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${a.balanced ? "bg-[#E3F1E3] text-ok" : "bg-[#FBF1DE] text-warn"}`}>
        <Icon name={a.balanced ? "check" : "alert"} className="h-4 w-4" />{a.balanced ? t("balanced") : t("unbalanced")}
      </motion.div>
    </div>
  );
}

export default function PaperBuilder() {
  const { id } = useParams();
  const { t, n, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const paper = useQuery({ queryKey: ["paper", id], queryFn: () => api<PaperFull>(`/papers/${id}`) });
  const analysis = useQuery({ queryKey: ["paper-analysis", id, paper.data?.items.length, paper.dataUpdatedAt], enabled: !!paper.data, queryFn: () => api<Analysis>(`/papers/${id}/analysis`) });
  const [order, setOrder] = useState<Item[]>([]);
  const [adding, setAdding] = useState(false);
  const [withKey, setWithKey] = useState(true);
  const [sp, setSp] = useSearchParams();
  const view = (["print", "omr"].includes(sp.get("view") || "") ? sp.get("view") : "questions") as "questions" | "print" | "omr";
  useEffect(() => { if (paper.data) setOrder(paper.data.items); }, [paper.data]);
  const p = paper.data;
  const final = p?.status === "final";
  const reload = (d: PaperFull) => { qc.setQueryData(["paper", id], d); qc.invalidateQueries({ queryKey: ["papers"] }); };

  const saveOrder = async () => { reload(await api<PaperFull>(`/papers/${id}/items/order`, { method: "PUT", body: { question_ids: order.map((i) => i.question.id) } })); };
  const remove = async (qid: number) => reload(await api<PaperFull>(`/papers/${id}/items/${qid}`, { method: "DELETE" }));
  const setStatus = async (s: string) => { reload(await api<PaperFull>(`/papers/${id}`, { method: "PATCH", body: { status: s } })); toast(t("saved")); };

  if (paper.error) return <ErrorBox error={paper.error} />;
  if (!p) return <Skeleton className="h-96" />;
  return (
    <Page>
      <PageHeader title={p.title} sub={`${t("items_n", { n: p.items.length })}${p.duration_min ? ` · ${n(p.duration_min)} ${lang === "bn" ? "মিনিট" : "min"}` : ""}`}
        actions={<>
          <Link to="/app/papers"><Button variant="ghost" icon="left">{t("back")}</Button></Link>
          {final ? <Button variant="secondary" onClick={() => setStatus("draft")}>{t("reopen")}</Button> : <Button variant="secondary" icon="check" onClick={() => setStatus("final")}>{t("mark_final")}</Button>}
          {!final && <Button icon="plus" onClick={() => setAdding(true)}>{t("add_questions")}</Button>}
        </>} />
      <Tabs value={view} onChange={(v) => setSp({ view: v }, { replace: true })} items={[{ id: "questions", label: t("tab_questions"), count: order.length }, { id: "print", label: t("tab_print") }, { id: "omr", label: t("tab_omr") }]} />
      {view === "print" ? <PrintLayout paper={p} /> : view === "omr" ? <OmrTab paperId={p.id} n={p.items.length} /> : (
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section>
          {!order.length ? <div className="card"><Empty icon="file" title={t("empty")} action={<Button icon="plus" onClick={() => setAdding(true)}>{t("add_questions")}</Button>} /></div> : (
            <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2.5">
              <AnimatePresence initial={false}>
                {order.map((it, i) => (
                  <Reorder.Item key={it.question.id} value={it} dragListener={!final} onDragEnd={saveOrder}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40, height: 0 }}
                    whileDrag={{ scale: 1.02, boxShadow: "0 20px 40px -20px rgba(122,15,30,.5)" }}
                    className="glass flex items-start gap-3 rounded-card p-4 text-ink">
                    {!final && <Icon name="grip" className="mt-1 h-5 w-5 shrink-0 cursor-grab text-ink-3" />}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-maroon text-xs font-bold text-white">{n(i + 1)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{it.question.stem}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2"><LevelBadge code={it.question.cognitive_level?.id} short /><DiffBadge value={it.question.difficulty?.id} /></div>
                    </div>
                    {!final && <button onClick={() => remove(it.question.id)} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-err/10 hover:text-err" aria-label={t("remove")}><Icon name="x" className="h-4 w-4" /></button>}
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </section>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="card">
            <h2 className="h3 mb-4">{t("balance")}</h2>
            {analysis.data ? <BalanceBars a={analysis.data} /> : <Skeleton className="h-40" />}
            {analysis.data?.suggestions.map((s, i) => <p key={i} className="mt-2 text-sm text-warn">• {lang === "bn" ? s.message_bn : s.message_en}</p>)}
          </section>
          <section className="card">
            <h2 className="h3 mb-3">{t("export")}</h2>
            <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={withKey} onChange={(e) => setWithKey(e.target.checked)} className="h-4 w-4 accent-maroon" />{t("with_key")}</label>
            <div className="grid gap-2">
              <Button icon="printer" disabled={!order.length} onClick={() => setSp({ view: "print" }, { replace: true })}>{t("tab_print")} · PDF</Button>
              <Button variant="secondary" icon="file" disabled={!order.length} onClick={() => download(`/papers/${id}/export`, { format: "docx", include_answers: withKey }, "paper.docx")}>{t("export_word")}</Button>
              <Button variant="ghost" icon="download" disabled={!order.length} onClick={() => download(`/papers/${id}/export`, { format: "xlsx", include_answers: withKey }, "paper.xlsx")}>{t("export_excel")}</Button>
            </div>
          </section>
        </aside>
      </div>)}
      <AddQuestions open={adding} onClose={() => setAdding(false)} have={order.map((o) => o.question.id)} paperId={Number(id)} onAdded={reload} />
    </Page>
  );
}

function AddQuestions({ open, onClose, have, paperId, onAdded }: { open: boolean; onClose: () => void; have: number[]; paperId: number; onAdded: (p: PaperFull) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  const list = useQuestions({ q: q || undefined, level: level || undefined, status: "tagged,verified,needs_review", page_size: 30 });
  const add = async () => { onAdded(await api<PaperFull>(`/papers/${paperId}/items`, { body: { question_ids: sel } })); setSel([]); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={t("add_questions")} wide>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" /><Input className="pl-9" placeholder={t("search_stem")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {["", "K1", "K2", "K3", "K4"].map((k) => <Chip key={k} active={level === k} onClick={() => setLevel(k)}>{k || t("all")}</Chip>)}
      </div>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {list.data?.items.map((x) => {
          const on = sel.includes(x.id), dis = have.includes(x.id);
          return (
            <button key={x.id} disabled={dis} onClick={() => setSel((s) => (on ? s.filter((i) => i !== x.id) : [...s, x.id]))}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${dis ? "opacity-40" : on ? "border-maroon bg-maroon-tint" : "border-line hover:border-maroon/40"}`}>
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${on ? "border-maroon bg-maroon text-white" : "border-line"}`}>{on && <Icon name="check" className="h-3.5 w-3.5" />}</span>
              <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-medium">{x.stem}</span><span className="mt-1 flex gap-2"><LevelBadge code={x.cognitive_level?.id} short /><DiffBadge value={x.difficulty?.id} /></span></span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4"><span className="text-sm text-ink-2">{t("selected_n", { n: sel.length })}</span><Button disabled={!sel.length} onClick={add} icon="plus">{t("add_to_paper")}</Button></div>
    </Modal>
  );
}
