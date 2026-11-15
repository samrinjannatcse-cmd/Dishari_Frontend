import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api, ApiError, download, mediaUrl, openHtml } from "@/api/client";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Chip, Empty, FileDrop, Input, Modal, Skeleton, Stat, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease } from "@/motion";

type Res = { id: number; filename: string; set: string | null; set_bn: string | null; roll: string | null; student_id: number | null; student_name: string | null;
  answers: Record<string, string | null>; score: number | null; total: number; flags: string[]; image_url: string | null; edited: boolean };
type List = { results: Res[]; count: number; average: number | null; highest: number | null; needs_check: number };
const SETS = ["ক", "খ", "গ", "ঘ"];
const BN: Record<string, string> = { A: "ক", B: "খ", C: "গ", D: "ঘ" };

export default function OmrTab({ paperId, n }: { paperId: number; n: number }) {
  const { t, n: num, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ["omr", paperId], queryFn: () => api<List>(`/papers/${paperId}/omr`) });
  const [busy, setBusy] = useState(0);
  const [open, setOpen] = useState<Res | null>(null);
  const [setForSheet, setSetForSheet] = useState<string | null>(null);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(files.length);
    try {
      const fd = new FormData();
      files.slice(0, 60).forEach((f) => fd.append("files", f));
      const r = await api<{ results: Res[]; errors: { filename: string; message: string }[] }>(`/papers/${paperId}/omr`, { form: fd });
      toast(t("sheets_read", { n: r.results.length }) + (r.errors.length ? ` · ${t("sheets_failed", { n: r.errors.length })}` : ""), r.errors.length ? "info" : "ok");
      r.errors.forEach((e) => toast(`${e.filename}: ${e.message}`, "err"));
      qc.invalidateQueries({ queryKey: ["omr", paperId] });
    } catch (e) { toast((e as ApiError).message, "err"); } finally { setBusy(0); }
  };
  const steps: [IconName, StrKey][] = [["printer", "omr_step1"], ["edit", "omr_step2"], ["upload", "omr_step3"], ["chart", "omr_step4"]];
  const d = list.data;
  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="h3 flex-1">{t("omr_title")}</h2>
          <span className="text-sm text-ink-2">{t("set_label")}:</span>
          <Chip active={setForSheet === null} onClick={() => setSetForSheet(null)}>{t("all")}</Chip>
          {SETS.map((s, i) => <Chip key={s} active={setForSheet === s} onClick={() => setSetForSheet(s)}>{lang === "bn" ? s : "ABCD"[i]}</Chip>)}
          <Button icon="printer" onClick={() => openHtml(`/papers/${paperId}/omr-sheet`, { set: setForSheet || undefined })}>{t("print_omr")}</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {steps.map(([ic, l], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, ease }} className="flex items-center gap-3 rounded-xl bg-head/70 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-maroon text-white"><Icon name={ic} /></span>
              <span className="text-sm"><b className="text-maroon">{num(i + 1)}.</b> {t(l)}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-4">
          <MultiDrop busy={busy} onFiles={upload} />
          {d && d.count > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t("average")} value={d.average != null ? <CountUp to={Math.round(d.average * 100)} suffix="%" /> : "–"} icon="chart" tone="gold" />
              <Stat label={t("highest")} value={d.highest != null ? <CountUp to={Math.round(d.highest * 100)} suffix="%" /> : "–"} icon="sparkle" tone="ok" />
            </div>
          )}
        </div>
        <section className="card">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="h3 flex-1">{t("results")} {d && <span className="text-sm font-normal text-ink-3">· {num(d.count)}</span>}</h2>
            {!!d?.needs_check && <span className="chip border-warn/40 bg-[#FBF1DE] text-warn">{t("needs_check_n", { n: d.needs_check })}</span>}
            {!!d?.count && <Button size="sm" variant="secondary" icon="download" onClick={() => download(`/papers/${paperId}/omr/export`, undefined, "omr_results.xlsx")}>Excel</Button>}
          </div>
          {list.isLoading ? <Skeleton className="h-40" /> : !d?.count ? <Empty icon="file" title={t("omr_none")} /> : (
            <div className="table-wrap !shadow-none"><table className="tbl">
              <thead><tr><th>{t("roll")}</th><th>{t("name")}</th><th>{t("set_label")}</th><th>{t("score")}</th><th></th></tr></thead>
              <tbody><AnimatePresence initial={false}>{d.results.map((r) => (
                <motion.tr key={r.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="cursor-pointer" onClick={() => setOpen(r)}>
                  <td className="font-mono font-semibold">{r.roll ?? "–"}</td>
                  <td>{r.student_name || <span className="chip border-warn/40 bg-[#FBF1DE] text-warn">{t("unmatched")}</span>}</td>
                  <td>{r.set ? (lang === "bn" ? r.set_bn : r.set) : <span className="text-err">?</span>}</td>
                  <td><b>{r.score != null ? `${num(r.score)}/${num(r.total)}` : "–"}</b>{r.flags.length > 0 && <Icon name="alert" className="ml-1.5 inline h-4 w-4 text-warn" />}{r.edited && <Icon name="edit" className="ml-1 inline h-3.5 w-3.5 text-ink-3" />}</td>
                  <td><Icon name="right" className="h-4 w-4 text-ink-3" /></td>
                </motion.tr>
              ))}</AnimatePresence></tbody>
            </table></div>
          )}
        </section>
      </div>
      {open && <Detail r={open} n={n} onClose={() => setOpen(null)} onSaved={(x) => { setOpen(x); qc.invalidateQueries({ queryKey: ["omr", paperId] }); }} />}
    </div>
  );
}

function MultiDrop({ busy, onFiles }: { busy: number; onFiles: (f: File[]) => void }) {
  const { t } = useI18n();
  return (
    <div>
      <FileDrop accept="image/png,image/jpeg,image/webp" busy={!!busy} onFiles={onFiles} label={busy ? t("reading_sheets", { n: busy }) : t("omr_drop")} sub={t("omr_rules")} />
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-field border border-white/30 bg-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/20">
        <Icon name="image" className="h-4 w-4" />{t("upload")} / {t("take_photo")}
        <input type="file" multiple accept="image/*" capture="environment" hidden onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      </label>
    </div>
  );
}

function Detail({ r, n, onClose, onSaved }: { r: Res; n: number; onClose: () => void; onSaved: (r: Res) => void }) {
  const { t, n: num, lang } = useI18n();
  const toast = useToast();
  const [roll, setRoll] = useState(r.roll || "");
  const save = async (body: Record<string, unknown>) => {
    try { onSaved(await api<Res>(`/omr-results/${r.id}`, { method: "PATCH", body })); toast(t("saved")); } catch (e) { toast((e as ApiError).message, "err"); }
  };
  const L = (k: string) => (lang === "bn" ? BN[k] : k);
  return (
    <Modal open onClose={onClose} title={`${t("roll")} ${r.roll ?? "?"} · ${r.student_name ?? t("unmatched")}`} wide>
      <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="label mb-2">{t("detected")}</div>
          {r.image_url ? <a href={mediaUrl(r.image_url)!} target="_blank" rel="noreferrer"><img src={mediaUrl(r.image_url)!} alt="" className="w-full rounded-lg border border-line" /></a> : null}
          <p className="mt-2 text-xs text-ink-3">{t("fix_hint")}</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><div className="label mb-1">{t("set_label")}</div><div className="flex gap-1.5">{["A", "B", "C", "D"].map((s) => <Chip key={s} active={r.set === s} onClick={() => save({ set: s })}>{L(s)}</Chip>)}</div></div>
            <div className="flex items-end gap-2"><div><div className="label mb-1">{t("roll")}</div><Input className="w-28 font-mono" value={roll} onChange={(e) => setRoll(e.target.value)} /></div><Button size="sm" variant="secondary" onClick={() => save({ roll })}>{t("save")}</Button></div>
            <div className="ml-auto text-right"><div className="label">{t("score")}</div><div className="text-2xl font-bold text-maroon">{r.score != null ? `${num(r.score)}/${num(r.total)}` : "–"}</div></div>
          </div>
          {r.flags.length > 0 && <div className="flex flex-wrap gap-1.5">{r.flags.map((f) => <span key={f} className="chip border-warn/40 bg-[#FBF1DE] text-warn">{f}</span>)}</div>}
          <div className="grid max-h-[46vh] grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
            {Array.from({ length: n }, (_, i) => String(i + 1)).map((q) => (
              <div key={q} className="flex items-center gap-1.5 text-sm">
                <b className="w-6 text-right">{num(Number(q))}</b>
                {["A", "B", "C", "D"].map((k) => (
                  <button key={k} onClick={() => save({ answers: { [q]: r.answers[q] === k ? null : k } })}
                    className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold transition ${r.answers[q] === k ? "border-ink bg-ink text-white" : "border-line text-ink-3 hover:border-maroon"}`}>{L(k)}</button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
