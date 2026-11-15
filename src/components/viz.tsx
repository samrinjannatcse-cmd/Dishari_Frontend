import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { ease } from "@/motion";

export const LEVEL_FILL: Record<string, string> = { K1: "#D9B45A", K2: "#D9893A", K3: "#C63A50", K4: "#7A0F1E", untagged: "#D6D0C7" };

/** Horizontal stacked bar of K1..K4 with legend, animated in. */
export function LevelMix({ data }: { data: Record<string, number> }) {
  const { t, n } = useI18n();
  const keys = ["K1", "K2", "K3", "K4", "untagged"].filter((k) => data[k]);
  const total = keys.reduce((s, k) => s + (data[k] || 0), 0) || 1;
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-head">
        {keys.map((k, i) => (
          <motion.div key={k} title={k} style={{ background: LEVEL_FILL[k] }} initial={{ width: 0 }} animate={{ width: `${(100 * data[k]) / total}%` }} transition={{ duration: 1, ease, delay: i * 0.08 }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_FILL[k] }} />
            <span className="font-semibold">{k === "untagged" ? "–" : k}</span>
            <span className="truncate text-ink-2">{k === "untagged" ? t("st_pending") : t(k as StrKey)}</span>
            <span className="ml-auto tabular-nums text-ink-2">{n(Math.round((100 * data[k]) / total))}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Concentric tilted orbits (logo motif): each ring = a level, dots = share. Decorative + informative. */
export function OrbitRings({ data, size = 220 }: { data: Record<string, number>; size?: number }) {
  const total = ["K1", "K2", "K3", "K4"].reduce((s, k) => s + (data[k] || 0), 0) || 1;
  const rings = ["K1", "K2", "K3", "K4"].map((k, i) => ({ k, rx: 34 + i * 20, ry: 13 + i * 7.5, rot: -18 + i * 9, share: (data[k] || 0) / total }));
  return (
    <svg viewBox="-110 -110 220 220" width={size} height={size} aria-hidden className="overflow-visible">
      <defs>
        <radialGradient id="core"><stop offset="0" stopColor="#FFF4D6" /><stop offset=".4" stopColor="#E9A84F" /><stop offset="1" stopColor="#E9A84F" stopOpacity="0" /></radialGradient>
      </defs>
      <circle r="22" fill="url(#core)" />
      <path d="M0 -14 L3 -3 L14 0 L3 3 L0 14 L-3 3 L-14 0 L-3 -3Z" fill="#FFF4D6" />
      {rings.map((r, i) => (
        <g key={r.k} transform={`rotate(${r.rot})`}>
          <ellipse rx={r.rx} ry={r.ry} fill="none" stroke={LEVEL_FILL[r.k]} strokeOpacity=".35" strokeWidth="1.2" />
          <motion.ellipse rx={r.rx} ry={r.ry} fill="none" stroke={LEVEL_FILL[r.k]} strokeWidth="3.2" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(0.03, r.share) }} transition={{ duration: 1.4, ease, delay: 0.2 + i * 0.12 }} />
          <motion.circle r="3.4" cx={r.rx} cy={0} initial={{ cx: r.rx, cy: 0 }} fill={LEVEL_FILL[r.k]} animate={{ cx: [r.rx, 0, -r.rx, 0, r.rx], cy: [0, r.ry, 0, -r.ry, 0] }} transition={{ repeat: Infinity, duration: 6 + i * 2.5, ease: "linear" }} />
        </g>
      ))}
    </svg>
  );
}

/** Labelled gold progress bar (design file style), animates in when shown. */
export function Bar({ label, value, right, delay = 0, tone = "gold" }: { label: ReactNode; value: number | null | undefined; right?: ReactNode; delay?: number; tone?: "gold" | "maroon" | "err" }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const fill = tone === "gold" ? "from-[#C9962E] to-[#E2B862]" : tone === "err" ? "from-[#9B1C1C] to-[#D9534F]" : "from-maroon to-[#C63A50]";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-ink-2">{label}</span>{right != null && <b className="tabular-nums text-ink">{right}</b>}</div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#ECE3D6]">
        <motion.div className={`h-full rounded-full bg-gradient-to-r ${fill}`} initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </div>
  );
}

/** Simple column chart of percentages (progress / weekly trend). */
export function Columns({ items, height = 90 }: { items: { label?: string; value: number }[]; height?: number }) {
  if (!items.length) return null;
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {items.map((it, i) => (
        <div key={i} className="group flex h-full flex-1 flex-col justify-end">
          <motion.div className="relative rounded-t-md bg-gradient-to-t from-maroon to-[#B5263C] shadow-[0_6px_14px_-8px_rgba(122,15,30,.8)]"
            initial={{ height: 0 }} animate={{ height: `${Math.max(6, it.value * 100)}%` }} transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}>
            <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">{Math.round(it.value * 100)}%</span>
          </motion.div>
        </div>
      ))}
    </div>
  );
}
