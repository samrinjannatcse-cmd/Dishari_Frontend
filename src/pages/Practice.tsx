import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useTaxonomy } from "@/api/hooks";
import { Icon } from "@/components/Icon";
import { Button, Chip, ErrorBox, PageHeader, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { ease, Page, Tilt } from "@/motion";

export default function Practice() {
  const { t, n, pick, lang, date } = useI18n();
  const tax = useTaxonomy();
  const nav = useNavigate();
  const [chapters, setChapters] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [sp] = useSearchParams();
  const [mode, setMode] = useState<"practice" | "exam">(sp.get("mode") === "exam" ? "exam" : "practice");
  const [limit, setLimit] = useState(15);
  const [size, setSize] = useState(10);
  const [qlang, setQlang] = useState<"bn" | "en">(lang);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const hist = useQuery({ queryKey: ["practice-history"], queryFn: () => api<{ items: { id: number; status: string; score: number | null; total: number; started_at: string }[] }>("/practice/sessions", { query: { page_size: 6 } }) });
  const tog = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const start = async () => {
    setBusy(true); setErr(null);
    try { const s = await api<{ id: number }>("/practice/sessions", { body: { language: qlang, chapter_ids: chapters, levels, size, mode, time_limit_min: mode === "exam" ? limit : null } }); nav(`/app/practice/${s.id}`); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Page>
      <PageHeader title={t("practice_title")} sub={t("practice_sub")} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="h3">{t("choose_chapters")}</h2>{chapters.length > 0 && <button className="text-sm text-maroon" onClick={() => setChapters([])}>{t("clear")}</button>}</div>
            {!tax.data ? <Skeleton className="h-40" /> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {tax.data.chapters.map((c, i) => {
                  const on = chapters.includes(c.id);
                  return (
                    <motion.button key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => tog(chapters, setChapters, c.id)}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${on ? "border-maroon bg-maroon-tint" : "border-line bg-white hover:border-maroon/40"}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? "bg-maroon text-white" : "bg-head text-ink-2"}`}>{n(Number(c.id))}</span>
                      <span className="line-clamp-2 font-medium">{pick(c)}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-ink-3">{chapters.length ? `${n(chapters.length)} ${t("choose_chapters")}` : t("any_chapter")}</p>
          </section>
          <section className="card">
            <h2 className="h3 mb-3">{t("choose_levels")}</h2>
            <div className="flex flex-wrap gap-2">{["K1", "K2", "K3", "K4"].map((k) => <Chip key={k} active={levels.includes(k)} onClick={() => tog(levels, setLevels, k)}>{k} · {t(k as never)}</Chip>)}</div>
            <p className="mt-2 text-xs text-ink-3">{levels.length ? "" : t("any_level")}</p>
          </section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Tilt className="rounded-[20px]" max={5}>
            <section className="glass-dark relative overflow-hidden rounded-[20px] border p-6 text-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)]">
              <motion.div className="absolute -right-8 -top-8 h-40 w-40 rounded-full border-[10px] border-gold/30" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 30, ease: "linear" }} />
              <div className="relative">
                <div className="mb-4 flex rounded-full bg-white/10 p-0.5 text-sm">
                  {(["practice", "exam"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`h-8 flex-1 rounded-full font-semibold ${mode === m ? "bg-white text-maroon" : "text-white/80"}`}>{t(m === "exam" ? "mode_exam" : "mode_practice")}</button>)}
                </div>
                <div className="text-sm text-white/70">{t("how_many")}</div>
                <div className="mt-1 text-6xl font-bold tabular-nums">{n(size)}</div>
                <input type="range" min={5} max={30} step={5} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-4 w-full accent-[#E2B862]" aria-label={t("how_many")} />
                {mode === "exam" && (
                  <div className="mt-4"><div className="text-sm text-white/70">{t("time_limit")}: <b className="text-white">{n(limit)}</b></div>
                    <input type="range" min={5} max={60} step={5} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full accent-[#E2B862]" aria-label={t("time_limit")} /></div>
                )}
                <div className="mt-4 flex rounded-full bg-white/10 p-0.5 text-sm">
                  {(["bn", "en"] as const).map((l) => <button key={l} onClick={() => setQlang(l)} className={`h-8 flex-1 rounded-full font-semibold ${qlang === l ? "bg-white text-maroon" : "text-white/80"}`}>{l === "bn" ? t("bangla") : t("english")}</button>)}
                </div>
                <Button variant="gold" size="lg" className="mt-5 w-full" icon={mode === "exam" ? "clock" : "play"} loading={busy} onClick={start}>{mode === "exam" ? t("mock_test") : t("start_practice")}</Button>
              </div>
            </section>
          </Tilt>
          {err && <ErrorBox error={err.code === "NO_QUESTIONS" ? new ApiError(404, "", t("no_questions_filter")) : err} />}
          <section className="card">
            <h2 className="h3 mb-2">{t("recent_practice")}</h2>
            {hist.data?.items.length ? hist.data.items.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, ease }}>
                <Link to={s.status === "submitted" ? `/app/practice/${s.id}/result` : `/app/practice/${s.id}`} className="flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-0 hover:text-maroon">
                  <Icon name={s.status === "submitted" ? "check" : "clock"} className="h-4 w-4 text-ink-3" />
                  <span className="flex-1">{date(s.started_at)}</span>
                  <b>{s.status === "submitted" ? `${n(s.score ?? 0)}/${n(s.total)}` : t("continue")}</b>
                </Link>
              </motion.div>
            )) : <p className="text-sm text-ink-3">{t("no_practice")}</p>}
          </section>
        </aside>
      </div>
    </Page>
  );
}
