import { motion } from "framer-motion";
import { mediaUrl, type Question } from "@/api/client";
import { useI18n } from "@/i18n/I18n";
import { ease, stagger } from "@/motion";
import { Icon } from "./Icon";
import { ConfBar, DiffBadge, LevelBadge, StatusBadge, TagRow } from "./ui";

export const OPT_BN: Record<string, string> = { A: "ক", B: "খ", C: "গ", D: "ঘ" };
export const optLabel = (k: string, lang: string) => (lang === "bn" ? OPT_BN[k] || k : k);

export function Stem({ q, showAnswer = true, compact }: { q: Pick<Question, "stem" | "options" | "answer" | "language" | "image_url">; showAnswer?: boolean; compact?: boolean }) {
  return (
    <div>
      <p className={`${compact ? "text-[15px]" : "text-lg"} font-medium leading-relaxed`}>{q.stem}</p>
      {q.image_url && <img src={mediaUrl(q.image_url)!} alt="" className="mt-3 max-h-56 rounded-lg border border-line bg-white object-contain" />}
      <div className={`mt-3 grid gap-2 ${compact ? "text-sm" : ""} sm:grid-cols-2`}>
        {(["A", "B", "C", "D"] as const).map((k) => {
          const right = showAnswer && q.answer === k;
          return (
            <div key={k} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${right ? "border-ok/50 bg-[#E3F1E3]" : "border-line bg-white"}`}>
              <b className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${right ? "bg-ok text-white" : "bg-head text-ink-2"}`}>{optLabel(k, q.language)}</b>
              <span className="pt-0.5">{(q.options as Record<string, string>)[k]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The full tag result card: chapter → topic with confidence, level, difficulty, board match. */
export function TagPanel({ q }: { q: Question }) {
  const { t } = useI18n();
  const mock = q.model_version?.startsWith("mock");
  return (
    <motion.div variants={stagger.parent} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={stagger.child} className="flex flex-wrap items-center gap-2">
        <StatusBadge status={q.status} />
        {q.model_version && <span className="chip border-line bg-head text-ink-2"><Icon name="cpu" className="h-3 w-3" />{q.model_version}</span>}
        {q.tag_source && q.tag_source !== "model" && <span className="chip border-gold/40 bg-[#FBF3DF] text-[#7A5600]">{q.tag_source}</span>}
      </motion.div>
      <motion.div variants={stagger.child}>
        <TagRow label={t("chapter")} tag={q.chapter} />
        <TagRow label={t("concept")} tag={q.concept} />
        <TagRow label={t("topic")} tag={q.topic} />
        <TagRow label={t("level")} tag={q.cognitive_level}>
          <div className="w-full">
            <LevelBadge code={q.cognitive_level?.id} />
            {q.cognitive_level?.confidence != null && <ConfBar value={q.cognitive_level.confidence} className="mt-1.5 max-w-[260px]" />}
          </div>
        </TagRow>
        <TagRow label={t("difficulty")} tag={q.difficulty}>
          <div className="w-full"><DiffBadge value={q.difficulty?.id} />{q.difficulty?.confidence != null && <ConfBar value={q.difficulty.confidence} className="mt-1.5 max-w-[260px]" />}</div>
        </TagRow>
      </motion.div>
      {q.low_confidence_fields.length > 0 && q.status === "needs_review" && (
        <motion.p variants={stagger.child} className="flex items-start gap-2 rounded-lg bg-[#FBF1DE] px-3 py-2 text-sm text-warn"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />{t("low_conf")}</motion.p>
      )}
      {Boolean(q.board_match?.matched) && (
        <motion.div variants={stagger.child} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.5 }}
          className="flex items-center gap-3 rounded-lg border border-gold/50 bg-gradient-to-r from-[#FBF3DF] to-white px-3 py-2.5">
          <Icon name="sparkle" className="h-5 w-5 text-gold" />
          <div className="text-sm"><b>{t("board_match")}</b> · {t("matched_board", { b: String(q.board_match!.board), y: String(q.board_match!.year) })} <span className="text-ink-3">({Math.round(Number(q.board_match!.score) * 100)}%)</span></div>
        </motion.div>
      )}
      {mock && <motion.p variants={stagger.child} className="text-xs text-ink-3">{t("mock_model")}</motion.p>}
    </motion.div>
  );
}

/** "Scanning" placeholder while the model reads. */
export function Scanning() {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-white p-6">
      <motion.div className="absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-gold/25 to-transparent" animate={{ y: ["-80px", "340px"] }} transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }} />
      <div className="relative flex items-center gap-3 text-maroon"><Icon name="spinner" className="h-5 w-5 animate-spin" /><b>{t("tagging")}</b></div>
      <div className="relative mt-5 space-y-3">{[80, 65, 90, 45, 55].map((w, i) => <motion.div key={i} className="skeleton h-4" style={{ width: `${w}%` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1, ease }} />)}</div>
    </div>
  );
}
