import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, download, openHtml } from "@/api/client";
import { Icon } from "@/components/Icon";
import { Button, Chip, Field, Input, Skeleton, Textarea, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { ease } from "@/motion";
import { NewTest } from "./Tests";

type Meta = { subject_name?: string; subject_code?: string; exam_name?: string; institution?: string; syllabus_year?: string; class_level?: string; instructions?: string };
type PaperLite = { id: number; title: string; language: string; status: string; items: unknown[]; meta?: Meta | null };

const SETS = ["ক", "খ", "গ", "ঘ"] as const;
const A4_W = 794; // CSS px at 96 dpi
const A4_H = 1123;

/** Board-style one-page paper: live A4 preview, sets ক–ঘ, print/PDF, Word, assign online. */
export default function PrintLayout({ paper }: { paper: PaperLite }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [meta, setMeta] = useState<Meta>({ exam_name: paper.title, ...(paper.meta || {}) });
  const [set, setSet] = useState<(typeof SETS)[number]>("ক");
  const [withKey, setWithKey] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assign, setAssign] = useState(false);
  const [scale, setScale] = useState(0.6);
  const box = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api<Response>(`/papers/${paper.id}/export`, { query: { format: "html", set, include_answers: withKey, embed: true }, raw: true });
      setHtml(await r.text());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [set, withKey, paper.items.length]); // eslint-disable-line
  useLayoutEffect(() => {
    const fit = () => { if (box.current) setScale(Math.min(1, (box.current.clientWidth - 2) / A4_W)); };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    window.addEventListener("resize", fit);
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
  }, [html]);

  const saveMeta = async () => {
    await api(`/papers/${paper.id}`, { method: "PATCH", body: { meta } });
    qc.invalidateQueries({ queryKey: ["paper", String(paper.id)] });
    toast(t("saved")); load();
  };
  const f = (k: keyof Meta, label: string, opts?: { wide?: boolean; area?: boolean; ph?: string }) => (
    <Field key={k} label={label} className={opts?.wide ? "sm:col-span-2" : ""}>
      {opts?.area ? <Textarea rows={3} value={meta[k] || ""} placeholder={opts.ph} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} />
        : <Input value={meta[k] || ""} placeholder={opts?.ph} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} />}
    </Field>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* live A4 page */}
      <div ref={box} className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white/85">{t("set_label")}:</span>
          {SETS.map((s) => <Chip key={s} active={set === s} onClick={() => setSet(s)}>{lang === "bn" ? s : "ABCD"[SETS.indexOf(s)]}</Chip>)}
          <label className="ml-2 flex items-center gap-2 text-sm text-white/85"><input type="checkbox" className="h-4 w-4 accent-[#E2B862]" checked={withKey} onChange={(e) => setWithKey(e.target.checked)} />{t("with_key")}</label>
          <span className="text-xs text-white/60">{t("sets_hint")}</span>
        </div>
        <div className="relative overflow-hidden rounded-card shadow-[0_30px_60px_-25px_rgba(0,0,0,.7)]" style={{ height: A4_H * scale * (withKey ? 1.6 : 1), width: A4_W * scale }}>
          {loading && !html && <Skeleton className="absolute inset-0" />}
          {html && (
            <motion.div key={set + String(withKey)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: loading ? 0.5 : 1, y: 0 }} transition={{ duration: 0.5, ease }} className="absolute inset-0">
              <div className="origin-top-left" style={{ width: A4_W, transform: `scale(${scale})` }}>
                <iframe title="paper" srcDoc={html} className="block border-0 bg-white" style={{ width: A4_W, height: A4_H * (withKey ? 1.6 : 1) }} />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* settings + actions */}
      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <section className="card">
          <h2 className="h3 mb-3">{t("export")}</h2>
          <div className="grid gap-2">
            <Button icon="printer" onClick={() => openHtml(`/papers/${paper.id}/export`, { format: "html", set, include_answers: withKey })}>{t("physical_exam")} · PDF</Button>
            <Button variant="secondary" icon="file" onClick={() => download(`/papers/${paper.id}/export`, { format: "docx", set, include_answers: withKey }, `paper_set_${set}.docx`)}>{t("export_word")}</Button>
            <Button variant="gold" icon="clock" onClick={() => setAssign(true)}>{t("assign_online")}</Button>
          </div>
          <p className="mt-2 text-xs text-ink-3">{t("assign_sub")}</p>
        </section>
        <section className="card">
          <h2 className="h3 flex items-center gap-2"><Icon name="edit" className="h-4 w-4 text-maroon" />{t("print_settings")}</h2>
          <p className="mb-3 mt-1 text-xs text-ink-3">{t("header_from_profile")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {f("institution", t("institution"), { wide: true })}
            {f("exam_name", t("exam_name"), { wide: true })}
            {f("subject_name", t("subject_name"))}
            {f("subject_code", t("subject_code"), { ph: "136" })}
            {f("class_level", t("class_level"), { ph: "10" })}
            {f("syllabus_year", t("syllabus_year"), { ph: "2026" })}
            {f("instructions", t("instructions"), { wide: true, area: true })}
          </div>
          <div className="mt-3 flex gap-2"><Button size="sm" icon="check" onClick={saveMeta}>{t("save_header")}</Button><Button size="sm" variant="ghost" icon="refresh" onClick={load}>{t("refresh_preview")}</Button></div>
        </section>
      </div>
      <NewTest open={assign} onClose={() => setAssign(false)} paperId={paper.id} classLevel={meta.class_level} title={meta.exam_name || paper.title} />
    </div>
  );
}
