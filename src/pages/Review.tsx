import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api, ApiError, type Page as P, type Question } from "@/api/client";
import { Icon } from "@/components/Icon";
import { Stem, TagPanel } from "@/components/QuestionView";
import { Button, Chip, Empty, ErrorBox, Field, Modal, PageHeader, Skeleton, Textarea, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { ease, Page } from "@/motion";
import { EditTags } from "./QuestionDetail";

const fly = {
  enter: { opacity: 0, y: 30, rotateX: -10 },
  center: { opacity: 1, y: 0, rotateX: 0, x: 0, rotate: 0 },
  exit: (d: number) => ({ x: d * 520, rotate: d * 14, opacity: 0, transition: { duration: 0.45, ease } }),
};

export default function Review() {
  const { t, n } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [lang, setLang] = useState("");
  const queue = useQuery({ queryKey: ["review-queue", lang], queryFn: () => api<P<Question>>("/reviews/queue", { query: { language: lang || undefined, page_size: 20 } }) });
  const reports = useQuery({ queryKey: ["tag-reports"], queryFn: () => api<P<{ id: number; question_id: number; field: string; comment: string }>>("/tag-reports", { query: { page_size: 50 } }) });
  const [idx, setIdx] = useState(0);
  const [exit, setExit] = useState<1 | -1 | 0>(0);
  const [change, setChange] = useState(false);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const items = queue.data?.items || [];
  const cur = items[idx];
  const curReports = reports.data?.items.filter((r) => r.question_id === cur?.id) || [];

  const advance = (dir: 1 | -1) => {
    setExit(dir);
    setTimeout(() => {
      if (idx + 1 >= items.length) { setIdx(0); qc.invalidateQueries({ queryKey: ["review-queue"] }); } else setIdx(idx + 1);
      qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["tag-reports"] });
    }, 10);
  };
  const act = async (action: "accept" | "reject", why?: string) => {
    if (!cur) return;
    setBusy(true);
    try { await api(`/reviews/${cur.id}`, { body: { action, reason: why || null } }); toast(action === "accept" ? t("accept") + " ✓" : t("reject")); setReject(false); setReason(""); advance(action === "accept" ? 1 : -1); }
    catch (e) { toast((e as ApiError).message, "err"); } finally { setBusy(false); }
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (change || reject || !cur || (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "a") act("accept"); else if (e.key === "c") setChange(true); else if (e.key === "r") setReject(true); else if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, items.length - 1));
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  return (
    <Page>
      <PageHeader title={t("review_title")} sub={t("review_sub")}
        actions={<div className="flex items-center gap-2">{["", "bn", "en"].map((l) => <Chip key={l} active={lang === l} onClick={() => { setLang(l); setIdx(0); }}>{l ? (l === "bn" ? t("bangla") : t("english")) : t("all")}</Chip>)}</div>} />
      {queue.error && <ErrorBox error={queue.error} />}
      {queue.isLoading ? <Skeleton className="h-96" /> : !cur ? (
        <div className="card"><Empty icon="check" title={t("queue_empty")} /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="relative min-h-[420px] [perspective:1200px]">
            {/* stacked cards behind */}
            {items.slice(idx + 1, idx + 3).map((x, i) => (
              <div key={x.id} className="absolute inset-x-0 top-0 h-full rounded-card border border-line bg-white shadow-card" style={{ transform: `translateY(${(i + 1) * 12}px) scale(${1 - (i + 1) * 0.035})`, opacity: 0.6 - i * 0.25, zIndex: -i - 1 }} />
            ))}
            <AnimatePresence mode="popLayout" custom={exit}>
              <motion.div key={cur.id} custom={exit}
                variants={fly} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.5, ease }}
                drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
                onDragEnd={(_, info) => { if (info.offset.x > 160) act("accept"); else if (info.offset.x < -160) setReject(true); }}
                className="relative cursor-grab rounded-card border border-line bg-white p-6 shadow-lift active:cursor-grabbing">
                <div className="mb-4 flex items-center justify-between text-sm text-ink-3"><span>#{n(cur.id)} · {cur.language.toUpperCase()}</span><span>{n(idx + 1)} / {n(queue.data?.total || 0)}</span></div>
                <Stem q={cur} />
                {curReports.length > 0 && (
                  <div className="mt-4 rounded-lg border border-err/30 bg-[#FBE7E5] p-3 text-sm">
                    <b className="flex items-center gap-1.5 text-err"><Icon name="flag" className="h-4 w-4" />{t("reported_by_users")}</b>
                    {curReports.map((r) => <p key={r.id} className="mt-1 text-ink-2">• {r.field}{r.comment ? ` — ${r.comment}` : ""}</p>)}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <aside className="space-y-4">
            <section className="card"><h2 className="label mb-3 uppercase tracking-wider">{t("model_suggestion")}</h2><TagPanel q={cur} /></section>
            <section className="card space-y-2">
              <h2 className="label mb-1 uppercase tracking-wider">{t("your_decision")}</h2>
              <Button className="w-full" icon="check" loading={busy} onClick={() => act("accept")}>{t("accept")} <kbd className="ml-auto rounded bg-white/20 px-1.5 text-xs">A</kbd></Button>
              <Button className="w-full" variant="secondary" icon="edit" onClick={() => setChange(true)}>{t("change")} <kbd className="ml-auto rounded bg-maroon-tint px-1.5 text-xs">C</kbd></Button>
              <Button className="w-full" variant="danger" icon="x" onClick={() => setReject(true)}>{t("reject")} <kbd className="ml-auto rounded bg-err/10 px-1.5 text-xs">R</kbd></Button>
              <button className="w-full pt-1 text-center text-sm text-ink-3 hover:text-ink" onClick={() => setIdx((i) => (i + 1) % items.length)}>{t("skip")} →</button>
            </section>
            {!!reports.data?.total && <p className="text-center text-sm text-white/80">{t("open_reports")}: <b>{n(reports.data.total)}</b></p>}
          </aside>
        </div>
      )}
      {change && cur && <EditTags q={cur} endpoint={`/reviews/${cur.id}`} reasonRequired onClose={() => setChange(false)} onSaved={() => { setChange(false); toast(t("saved")); advance(1); }} />}
      <Modal open={reject} onClose={() => setReject(false)} title={t("reject")}>
        <Field label={t("reason")}><Textarea rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setReject(false)}>{t("cancel")}</Button><Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => act("reject", reason)}>{t("reject")}</Button></div>
      </Modal>
    </Page>
  );
}
