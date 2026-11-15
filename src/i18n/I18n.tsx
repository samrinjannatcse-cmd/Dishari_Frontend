import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { STR, type StrKey } from "./strings";

export type Lang = "bn" | "en";
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: StrKey, vars?: Record<string, string | number>) => string;
  /** number in the UI language's digits */
  n: (v: number | string | null | undefined, opts?: Intl.NumberFormatOptions) => string;
  /** pick name_en / name_bn from an API object */
  pick: (o?: { name_en?: string | null; name_bn?: string | null } | null) => string;
  date: (d?: string | null) => string;
  /** display settings (per device): digits "auto" follows the language */
  digits: Digits;
  setDigits: (d: Digits) => void;
  textSize: TextSize;
  setTextSize: (s: TextSize) => void;
};
export type Digits = "auto" | "en" | "bn";
export type TextSize = "normal" | "large" | "xlarge";
const ls = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const I18nCtx = createContext<Ctx>(null as unknown as Ctx);

export const toBnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[+d]);

function initialLang(): Lang {
  try {
    const s = localStorage.getItem("dishari.lang");
    if (s === "bn" || s === "en") return s;
  } catch { /* ignore */ }
  return "bn";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const [digits, setDigitsState] = useState<Digits>(() => (["en", "bn"].includes(ls("dishari.digits") || "") ? ls("dishari.digits") : "auto") as Digits);
  const [textSize, setTextSizeState] = useState<TextSize>(() => (["large", "xlarge"].includes(ls("dishari.textsize") || "") ? ls("dishari.textsize") : "normal") as TextSize);
  useEffect(() => { document.documentElement.dataset.textsize = textSize; }, [textSize]);
  const setDigits = useCallback((d: Digits) => { setDigitsState(d); lsSet("dishari.digits", d); }, []);
  const setTextSize = useCallback((s: TextSize) => { setTextSizeState(s); lsSet("dishari.textsize", s); }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("dishari.lang", l); } catch { /* ignore */ }
  }, []);

  const value = useMemo<Ctx>(() => {
    const n: Ctx["n"] = (v, opts) => {
      if (v === null || v === undefined || v === "") return "–";
      const s = typeof v === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, ...opts }).format(v) : String(v);
      return (digits === "bn" || (digits === "auto" && lang === "bn")) ? toBnDigits(s) : s;
    };
    return {
      lang, setLang, n, digits, setDigits, textSize, setTextSize,
      t: (k, vars) => {
        const pair = STR[k] as readonly [string, string] | undefined;
        let s = pair ? pair[lang === "bn" ? 1 : 0] : String(k);
        if (vars) for (const [key, val] of Object.entries(vars)) s = s.replace(`{${key}}`, typeof val === "number" ? n(val) : val);
        return s;
      },
      pick: (o) => (o ? (lang === "bn" ? o.name_bn || o.name_en : o.name_en || o.name_bn) || "" : ""),
      date: (d) => {
        if (!d) return "–";
        const s = new Date(d).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
        return s;
      },
    };
  }, [lang, setLang, digits, setDigits, textSize, setTextSize]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
