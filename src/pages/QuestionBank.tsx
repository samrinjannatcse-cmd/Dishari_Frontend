import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, download, type S } from "@/api/client";
import { useDashboard, useQuestions, useTaxonomy, type QFilters } from "@/api/hooks";
import { Bar } from "@/components/viz";
import { Icon } from "@/components/Icon";
import { Button, Chip, DiffBadge, Empty, ErrorBox, Input, LevelBadge, Modal, PageHeader, Pager, Select, SkeletonRows, StatusBadge, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { ease, Page } from "@/motion";

export default function QuestionBank() {
  const { t, n, pick } = useI18n();
  const [sp, setSp] = useSearchParams();
  const tax = useTaxonomy();
  const nav = useNavigate();
  const [q, setQ] = useState(sp.get("q") || "");
  const [sel, setSel] = useState<number[]>([]);
  const [paperOpen, setPaperOpen] = useState(false);
  const f: QFilters = {
    q: sp.get("q") || undefined, status: sp.get("status") || undefined, language: sp.get("language") || undefined,
    chapter_id: sp.get("chapter_id") || undefined, level: sp.get("level") || undefined, difficulty: sp.get("difficulty") || undefined,
    mine: sp.get("mine") === "1" || undefined, board: sp.get("board") === "1" ? true : undefined,
    bulk_job_id: sp.get("bulk_job_id") ? Number(sp.get("bulk_job_id")) : undefined, page: Number(sp.get("page") || 1), page_size: 20,
  };
  const data = useQuestions(f);
  const set = (k: string, v?: string) => { const x = new URLSearchParams(sp); v ? x.set(k, v) : x.delete(k); if (k !== "page") x.delete("page"); setSp(x, { replace: true }); };
  useEffect(() => { const id = setTimeout(() => q !== (sp.get("q") || "") && set("q", q), 350); return () => clearTimeout(id); }); // eslint-disable-line
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const levels = (sp.get("level") || "").split(",").filter(Boolean);

  return (
    <Page>
      <PageHeader title={t("bank_title")} sub={t("bank_sub")} actions={<Link to="/app/tag"><Button icon="plus">{t("nav_tag")}</Button></Link>} />
      <div className="card mb-4 space-y-3 !p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" /><Input className="pl-9" placeholder={t("search_stem")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="!w-auto min-w-[180px]" value={f.chapter_id || ""} onChange={(e) => set("chapter_id", e.target.value)}>
            <option value="">{t("chapter")}: {t("all")}</option>
            {tax.data?.chapters.map((c) => <option key={c.id} value={c.id}>{n(Number(c.id))}. {pick(c)}</option>)}
          </Select>
          <Select className="!w-auto" value={f.status || ""} onChange={(e) => set("status", e.target.value)}>
            <option value="">{t("status")}: {t("all")}</option>
            {["tagged", "needs_review", "verified", "pending", "rejected"].map((s) => <option key={s} value={s}>{t(`st_${s}` as never)}</option>)}
          </Select>
          <Select className="!w-auto" value={f.language || ""} onChange={(e) => set("language", e.target.value)}>
            <option value="">{t("language")}: {t("all")}</option><option value="bn">{t("bangla")}</option><option value="en">{t("english")}</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["K1", "K2", "K3", "K4"].map((k) => <Chip key={k} active={levels.includes(k)} onClick={() => set("level", (levels.includes(k) ? levels.filter((x) => x !== k) : [...levels, k]).join(","))}>{k} · {t(k as never)}</Chip>)}
          <span className="mx-1 h-6 w-px bg-line" />
          <Chip active={f.mine} onClick={() => set("mine", f.mine ? undefined : "1")}>{t("only_mine")}</Chip>
          <Chip active={f.board} onClick={() => set("board", f.board ? undefined : "1")}>{t("only_board")}</Chip>
          {f.bulk_job_id && <Chip active onClick={() => set("bulk_job_id")}>#{f.bulk_job_id} ✕</Chip>}
          <span className="ml-auto text-sm text-ink-2">{data.data && t("results_n", { n: data.data.total })}</span>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0">
      {data.error && <ErrorBox error={data.error} onRetry={() => data.refetch()} />}
      {data.isLoading ? <SkeletonRows rows={8} /> : data.data && !data.data.items.length ? (
        <div className="card"><Empty title={t("empty")} icon="search" /></div>
      ) : data.data && (
        <>
          {/* desktop table */}
          <div className="table-wrap hidden md:block">
            <table className="tbl">
              <thead><tr><th className="w-10"></th><th>{t("question")}</th><th>{t("chapter")}</th><th>{t("level")}</th><th>{t("difficulty")}</th><th>{t("status")}</th></tr></thead>
              <motion.tbody initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.025 } } }}>
                {data.data.items.map((x) => (
                  <motion.tr key={x.id} variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0, transition: { ease } } }}
                    className={`cursor-pointer ${sel.includes(x.id) ? "!bg-maroon-tint" : ""}`} onClick={() => nav(`/app/questions/${x.id}`)}>
                    <td onClick={(e) => { e.stopPropagation(); toggle(x.id); }}><input type="checkbox" checked={sel.includes(x.id)} readOnly className="h-4 w-4 accent-maroon" /></td>
                    <td className="max-w-[420px]"><div className="line-clamp-2 font-medium">{x.stem}</div>
                      <div className="mt-0.5 flex gap-2 text-xs text-ink-3"><span>#{n(x.id)}</span><span>{x.language.toUpperCase()}</span>{Boolean(x.board_match?.matched) && <span className="text-gold">★ {String(x.board_match!.board)} {String(x.board_match!.year)}</span>}{x.image_url && <Icon name="image" className="h-3.5 w-3.5" />}</div></td>
                    <td className="max-w-[200px] text-ink-2"><span className="line-clamp-2">{x.chapter ? pick(x.chapter) : "–"}</span></td>
                    <td><LevelBadge code={x.cognitive_level?.id} short /></td>
                    <td><DiffBadge value={x.difficulty?.id} /></td>
                    <td><StatusBadge status={x.status} /></td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
          {/* phone cards */}
          <div className="space-y-3 md:hidden">
            {data.data.items.map((x) => (
              <Link key={x.id} to={`/app/questions/${x.id}`} className="card block !p-4">
                <div className="line-clamp-3 font-medium">{x.stem}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2"><LevelBadge code={x.cognitive_level?.id} short /><DiffBadge value={x.difficulty?.id} /><StatusBadge status={x.status} /></div>
              </Link>
            ))}
          </div>
          <Pager page={f.page || 1} total={data.data.total} pageSize={20} onPage={(p) => set("page", String(p))} />
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon="file" disabled={!sel.length} onClick={() => setPaperOpen(true)}>{t("create_exam")}{sel.length ? ` · ${n(sel.length)}` : ""}</Button>
        <Button variant="secondary" icon="download" onClick={() => download("/questions/export", { ...f, page: undefined, page_size: undefined }, "questions.xlsx")}>{t("export_excel_csv")}</Button>
      </div>
      </div>
      <BankStats />
      </div>

      {/* selection bar */}
      <AnimatePresence>
        {sel.length > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ ease }}
            className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-5 py-2.5 text-white shadow-lift md:bottom-6">
            <b>{t("selected_n", { n: sel.length })}</b>
            <Button size="sm" variant="gold" icon="file" onClick={() => setPaperOpen(true)}>{t("add_to_paper")}</Button>
            <button className="text-sm text-white/70 hover:text-white" onClick={() => setSel([])}>{t("clear")}</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AddToPaper open={paperOpen} ids={sel} onClose={() => setPaperOpen(false)} onDone={() => { setSel([]); setPaperOpen(false); }} />
    </Page>
  );
}

function AddToPaper({ open, ids, onClose, onDone }: { open: boolean; ids: number[]; onClose: () => void; onDone: () => void }) {
  const { t, n } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const papers = useQuery({ queryKey: ["papers"], enabled: open, queryFn: () => api<{ items: S["PaperOut"][] }>("/papers", { query: { page_size: 50 } }) });
  const [title, setTitle] = useState("");
  const add = async (pid: number) => {
    await api(`/papers/${pid}/items`, { body: { question_ids: ids } });
    qc.invalidateQueries({ queryKey: ["papers"] }); toast(t("saved")); onDone(); nav(`/app/papers/${pid}`);
  };
  const create = async () => { const p = await api<S["PaperOut"]>("/papers", { body: { title: title || t("class_test") } }); await add(p.id); };
  return (
    <Modal open={open} onClose={onClose} title={t("add_to_paper")}>
      <div className="space-y-2">
        {papers.data?.items.filter((p) => p.status === "draft").map((p) => (
          <button key={p.id} onClick={() => add(p.id)} className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left hover:border-maroon/50 hover:bg-maroon-tint/40">
            <Icon name="file" className="h-4 w-4 text-maroon" /><span className="flex-1 font-medium">{p.title}</span><span className="text-sm text-ink-3">{t("items_n", { n: p.item_count })}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2 border-t border-line pt-4">
        <Input placeholder={t("paper_title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button icon="plus" onClick={create}>{t("new_paper")}</Button>
      </div>
      <p className="mt-2 text-xs text-ink-3">{t("selected_n", { n: ids.length })} · {n(ids.length)}</p>
    </Modal>
  );
}

function BankStats() {
  const { t, n } = useI18n();
  const d = useDashboard();
  const lv = d.data?.questions?.by_level || {};
  const tot = Object.entries(lv).filter(([k]) => k !== "untagged").reduce((a, [, v]) => a + v, 0);
  return (
    <aside className="card space-y-4 xl:sticky xl:top-20">
      <h2 className="h3">{t("bank_stats")}</h2>
      {["K1", "K2", "K3", "K4"].map((k, i) => <Bar key={k} label={`${k} · ${t(k as never)}`} value={tot ? (lv[k] || 0) / tot : 0} right={n(lv[k] || 0)} delay={i * 0.08} />)}
      <h2 className="h3 pt-2">{t("exam_builder")}</h2>
      <p className="text-sm text-ink-2">{t("exam_builder_note")}</p>
      <Link to="/app/papers"><Button variant="secondary" className="w-full" icon="file">{t("nav_exams")}</Button></Link>
    </aside>
  );
}
