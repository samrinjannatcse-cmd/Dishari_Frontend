import { AnimatePresence, motion } from "framer-motion";
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { ApiError, type TagView } from "@/api/client";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { ease } from "@/motion";
import { Icon } from "./Icon";

/* ------------------------------------------------------------------ Button */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "gold"; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: Parameters<typeof Icon>[0]["name"] };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "primary", size = "md", loading, icon, className = "", children, disabled, ...rest }, ref) {
  const v = {
    primary: "bg-maroon text-white hover:bg-maroon-hover shadow-[0_8px_20px_-8px_rgba(122,15,30,.6)]",
    secondary: "bg-white text-maroon border border-maroon/60 hover:bg-maroon-tint",
    ghost: "text-current opacity-85 hover:opacity-100 hover:bg-black/10",
    danger: "bg-white text-err border border-err/60 hover:bg-err/5",
    gold: "bg-gradient-to-b from-[#D7AE55] to-gold text-[#2A1A00] hover:brightness-105 shadow-[0_10px_24px_-10px_rgba(184,137,43,.9)]",
  }[variant];
  const s = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-12 px-6 text-base" }[size];
  return (
    <button ref={ref} disabled={disabled || loading} className={`relative inline-flex items-center justify-center gap-2 rounded-field font-semibold transition active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none ${v} ${s} ${className}`} {...rest}>
      {loading ? <Icon name="spinner" className="h-4 w-4 animate-spin" /> : icon ? <Icon name={icon} className="h-[18px] w-[18px]" /> : null}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ Fields */
export function Field({ label, error, hint, children, className = "" }: { label?: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="flex items-center gap-1 text-[13px] text-err"><Icon name="alert" className="h-4 w-4" />{error}</span>
        : hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className = "", invalid, ...p }, ref) {
  return <input ref={ref} className={`input ${invalid ? "border-err focus:border-err focus:ring-err/10" : ""} ${className}`} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className = "", invalid, ...p }, ref) {
  return <textarea ref={ref} className={`textarea ${invalid ? "border-err" : ""} ${className}`} {...p} />;
});
export function Select({ className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`input pr-8 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A4A4A' stroke-width='2.5'><path d='M6 9l6 6 6-6'/></svg>")] bg-[length:12px] bg-[right_12px_center] bg-no-repeat ${className}`} {...p}>{children}</select>;
}

/* ------------------------------------------------------------------ Badges */
const LEVEL_STYLE: Record<string, string> = {
  K1: "bg-[#FBF3DF] text-[#7A5600] border-[#E8D3A0]",
  K2: "bg-[#FDEBDD] text-[#8A4200] border-[#F0C9A6]",
  K3: "bg-[#FBE4E8] text-[#9B1C31] border-[#EFB6C0]",
  K4: "bg-maroon text-white border-maroon",
};
export function LevelBadge({ code, short }: { code?: string | null; short?: boolean }) {
  const { t } = useI18n();
  if (!code) return <span className="chip border-dashed border-line text-ink-3">–</span>;
  return <span className={`chip ${LEVEL_STYLE[code] || ""}`}>{code}{!short && <span className="font-medium">· {t(code as StrKey)}</span>}</span>;
}
export function DiffBadge({ value }: { value?: string | null }) {
  const { t } = useI18n();
  if (!value) return <span className="text-ink-3">–</span>;
  const dots = { Easy: 1, Medium: 2, Hard: 3 }[value] || 0;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-2 whitespace-nowrap">
      <span className="flex gap-0.5">{[1, 2, 3].map((i) => <i key={i} className={`h-1.5 w-1.5 rounded-full ${i <= dots ? "bg-maroon" : "bg-line"}`} />)}</span>
      {t(value as StrKey)}
    </span>
  );
}
const STATUS: Record<string, [string, string]> = {
  pending: ["border-line bg-head text-ink-2", "○"],
  tagged: ["border-info/30 bg-[#E8EFF8] text-info", "●"],
  needs_review: ["border-warn/40 bg-[#FBF1DE] text-warn", "!"],
  verified: ["border-ok/30 bg-[#E3F1E3] text-ok", "✓"],
  rejected: ["border-err/30 bg-[#FBE7E5] text-err", "✕"],
};
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const [cls, ic] = STATUS[status] || STATUS.pending;
  return <span className={`chip ${cls}`}><b className="text-[11px]">{ic}</b>{t(`st_${status}` as StrKey)}</span>;
}

/* ------------------------------------------------------------------ Confidence bar */
export function ConfBar({ value, threshold = 0.6, className = "" }: { value?: number | null; threshold?: number; className?: string }) {
  const { n } = useI18n();
  if (value === null || value === undefined) return null;
  const low = value < threshold;
  return (
    <div className={`flex items-center gap-2 ${className}`} title={`${Math.round(value * 100)}%`}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#EDE7DF]">
        <motion.div className={`absolute inset-y-0 left-0 rounded-full ${low ? "bg-warn" : "bg-gradient-to-r from-gold to-maroon"}`}
          initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ duration: 0.9, ease }} />
        <i className="absolute inset-y-0 w-px bg-ink/30" style={{ left: `${threshold * 100}%` }} />
      </div>
      <span className={`w-9 text-right text-xs font-semibold tabular-nums ${low ? "text-warn" : "text-ink-2"}`}>{n(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  );
}

/** A tag row: label · name · confidence */
export function TagRow({ label, tag, children }: { label: string; tag?: TagView | null; children?: ReactNode }) {
  const { pick } = useI18n();
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5 border-b border-[#EFEAE3] last:border-0">
      <span className="label pt-0.5">{label}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {children ?? <span className="font-medium">{tag?.id ? pick(tag) : "–"}</span>}
          {tag?.id && !children && <code className="rounded bg-head px-1.5 text-[11px] text-ink-2">{tag.id}</code>}
        </div>
        {!children && tag?.confidence != null && <ConfBar value={tag.confidence} className="mt-1.5 max-w-[260px]" />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Misc */
export function Skeleton({ className = "" }: { className?: string }) { return <div className={`skeleton ${className}`} />; }
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}

export function Empty({ title, sub, icon = "inbox", action }: { title: string; sub?: string; icon?: Parameters<typeof Icon>[0]["name"]; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="grid h-16 w-16 place-items-center rounded-2xl bg-maroon-tint text-maroon"><Icon name={icon} className="h-8 w-8" /></motion.div>
      <div className="h3">{title}</div>
      {sub && <p className="max-w-sm text-sm text-ink-2">{sub}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const msg = error instanceof ApiError ? error.message : t("error_generic");
  return (
    <div className="flex items-center gap-3 rounded-card border border-err/30 bg-[#FBE7E5] p-4 text-sm text-err">
      <Icon name="alert" className="h-5 w-5 shrink-0" /><span className="flex-1">{msg}</span>
      {onRetry && <Button size="sm" variant="danger" onClick={onRetry}>{t("retry")}</Button>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        <motion.h1 className="h1 text-white [text-shadow:0_2px_24px_rgba(0,0,0,.25)]" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease }}>{title}</motion.h1>
        {sub && <motion.p className="mt-1 text-white/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>{sub}</motion.p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-white/85">
      <span>{t("page_of", { p: page, n: pages })}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("prev")}</Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t("next")}</Button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  const id = useId();
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/20" role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} onClick={() => onChange(it.id)}
          className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition ${value === it.id ? "text-white" : "text-white/65 hover:text-white"}`}>
          {it.label}{it.count != null && <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[11px]">{it.count}</span>}
          {value === it.id && <motion.i layoutId={`tab-${id}`} className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-gold shadow-[0_0_12px_rgba(233,168,79,.8)]" />}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`h-9 rounded-full border px-3.5 text-sm font-medium transition ${active ? "border-white/80 bg-maroon !text-white ring-2 ring-gold/70 shadow-[0_6px_14px_-6px_rgba(122,15,30,.7)]" : "border-line/70 bg-white/80 text-ink-2 backdrop-blur hover:border-maroon/50"}`}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Modal / Drawer */
export function Modal({ open, onClose, title, children, wide, side }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; side?: boolean }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className={`fixed inset-0 z-50 flex ${side ? "justify-end" : "items-center justify-center p-4"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#1a0508]/55 backdrop-blur-[4px]" onClick={onClose} />
          <motion.div role="dialog" aria-modal aria-label={title}
            className={`relative flex max-h-full flex-col bg-white text-ink shadow-2xl ${side ? "h-full w-full max-w-md" : `w-full rounded-card ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh]`}`}
            initial={side ? { x: "100%" } : { opacity: 0, y: 24, scale: 0.97 }} animate={side ? { x: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={side ? { x: "100%" } : { opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.35, ease }}>
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <h2 className="h2 flex-1">{title}</h2>
              <button onClick={onClose} aria-label={t("close")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"><Icon name="x" className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>, document.body);
}

/* ------------------------------------------------------------------ Toasts */
type Toast = { id: number; text: string; kind: "ok" | "err" | "info" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = ++idRef.current;
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex flex-col gap-2 md:bottom-6" aria-live="polite">
        <AnimatePresence>
          {items.map((i) => (
            <motion.div key={i.id} layout initial={{ opacity: 0, x: 40, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-card px-4 py-3 text-sm font-medium text-white shadow-lift ${i.kind === "err" ? "bg-err" : i.kind === "info" ? "bg-info" : "bg-ink"}`}>
              <Icon name={i.kind === "err" ? "alert" : "check"} className="h-4 w-4" />{i.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ------------------------------------------------------------------ File drop */
export function FileDrop({ accept, onFile, onFiles, label, sub, busy }: { accept: string; onFile?: (f: File) => void; onFiles?: (f: File[]) => void; label: string; sub?: string; busy?: boolean }) {
  const take = (fl: FileList | null) => { const a = Array.from(fl || []); if (!a.length) return; if (onFiles) onFiles(a); else onFile?.(a[0]); };
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <motion.button type="button" onClick={() => input.current?.click()} whileHover={{ scale: 1.005 }} disabled={busy}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      className={`group relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-card border-2 border-dashed px-6 py-10 text-center transition ${over ? "border-maroon bg-maroon-tint" : "border-line bg-white hover:border-maroon/50"}`}>
      <motion.div animate={over ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }} className="grid h-14 w-14 place-items-center rounded-2xl bg-maroon-tint text-maroon">
        <Icon name={busy ? "spinner" : "upload"} className={`h-7 w-7 ${busy ? "animate-spin" : ""}`} />
      </motion.div>
      <span className="font-semibold">{label}</span>
      {sub && <span className="text-sm text-ink-3">{sub}</span>}
      <input ref={input} type="file" accept={accept} multiple={!!onFiles} hidden onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
    </motion.button>
  );
}

/** Stat card with count-up number. */
export function Stat({ label, value, icon, tone = "maroon", delay = 0 }: { label: string; value: ReactNode; icon: Parameters<typeof Icon>[0]["name"]; tone?: "maroon" | "gold" | "ok" | "warn" | "info"; delay?: number }) {
  const tones = { maroon: "bg-maroon-tint text-maroon", gold: "bg-[#FBF3DF] text-[#8A6200]", ok: "bg-[#E3F1E3] text-ok", warn: "bg-[#FBF1DE] text-warn", info: "bg-[#E8EFF8] text-info" };
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay }}
      className="card group relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-gold/10 to-maroon/10 transition-transform duration-500 group-hover:scale-150" />
      <div className={`relative mb-3 grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon name={icon} className="h-5 w-5" /></div>
      <div className="relative text-3xl font-bold tracking-tight">{value}</div>
      <div className="relative mt-0.5 text-sm text-ink-2">{label}</div>
    </motion.div>
  );
}
