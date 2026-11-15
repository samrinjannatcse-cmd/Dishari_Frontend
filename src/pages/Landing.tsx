import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/Auth";
import { Icon, type IconName } from "@/components/Icon";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { LangToggle } from "@/layout/AppShell";
import { CountUp, ease, FadeIn, Magnetic, Reveal, Ribbons, Tilt, useLenis } from "@/motion";
import type { SceneProgress } from "@/three/OrbitScene";

const OrbitScene = lazy(() => import("@/three/OrbitScene"));
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const LEVELS = [
  { k: "K1", c: "#F4D58A" }, { k: "K2", c: "#E9A84F" }, { k: "K3", c: "#E2566C" }, { k: "K4", c: "#C22B45" },
] as const;

function Panel({ p, range, children, align = "left" }: { p: MotionValue<number>; range: [number, number, number, number]; children: React.ReactNode; align?: "left" | "right" | "center" }) {
  const opacity = useTransform(p, range, [0, 1, 1, 0]);
  const y = useTransform(p, range, [60, 0, 0, -60]);
  const pe = useTransform(opacity, (o) => (o > 0.5 ? "auto" : "none"));
  const pos = align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right md:pr-[6vw]" : "items-start md:pl-[6vw]";
  return (
    <motion.div style={{ opacity, y, pointerEvents: pe }} className={`absolute inset-0 flex flex-col justify-center px-6 ${pos}`}>
      {children}
    </motion.div>
  );
}

export default function Landing() {
  useLenis();
  const { t } = useI18n();
  const { user } = useAuth();
  const story = useRef<HTMLDivElement>(null);
  const progress = useRef<SceneProgress>({ p1: 0, p2: 0 });
  const { scrollYProgress } = useScroll({ target: story, offset: ["start start", "end end"] });
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    progress.current.p1 = clamp((v - 0.28) / 0.3);
    progress.current.p2 = clamp((v - 0.7) / 0.24);
  });
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  const hint = useTransform(scrollYProgress, [0, 0.06], [1, 0]);
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const startHref = user ? "/app" : "/login";

  return (
    <div className="bg-[#0E0306] text-white">
      {/* nav */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "bg-[#12040A]/85 backdrop-blur-xl" : ""}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.webp" alt="" className="h-9 drop-shadow-[0_0_12px_rgba(233,168,79,.5)]" />
            <span className="text-xl font-bold tracking-tight">{t("brand")}</span>
          </Link>
          <span className="flex-1" />
          <LangToggle dark />
          <Magnetic><Link to={startHref} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-maroon transition hover:bg-gold-soft">{user ? t("nav_dashboard") : t("login")}<Icon name="arrow" className="h-4 w-4" /></Link></Magnetic>
        </div>
        <motion.div className="h-px bg-gradient-to-r from-gold via-[#E2566C] to-gold" style={{ width: bar }} />
      </header>

      {/* scroll story over the 3D scene */}
      <section ref={story} className="relative h-[460vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#4A0A17_0%,#1A050B_45%,#0E0306_75%)]" />
          <Suspense fallback={null}><OrbitScene progress={progress} className="absolute inset-0" /></Suspense>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(14,3,6,.85)_100%)]" />

          <Panel p={scrollYProgress} range={[-0.1, 0, 0.13, 0.2]} align="center">
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm text-gold-soft backdrop-blur">
              <Icon name="sparkle" className="h-3.5 w-3.5 text-gold" />{t("hero_kicker")}
            </motion.span>
            <Reveal as="h1" text={t("hero_title")} delay={0.35} className="max-w-4xl text-[40px] font-bold leading-[1.1] tracking-tight sm:text-6xl md:text-7xl [text-shadow:0_4px_40px_rgba(194,43,69,.45)]" />
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1 }} className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">{t("hero_sub")}</motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35, duration: 0.8, ease }} className="mt-9 flex flex-wrap justify-center gap-3">
              <Magnetic><Link to={startHref} className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[#E2B862] to-gold px-7 font-semibold text-[#2A1A00] shadow-[0_10px_40px_-8px_rgba(233,168,79,.8)] transition hover:brightness-110">{t("cta_start")}<Icon name="arrow" className="h-4 w-4" /></Link></Magnetic>
              <a href="#how" className="inline-flex h-12 items-center rounded-full border border-white/25 px-7 font-semibold text-white/90 backdrop-blur transition hover:bg-white/10">{t("cta_how")}</a>
            </motion.div>
          </Panel>

          <Panel p={scrollYProgress} range={[0.17, 0.24, 0.36, 0.42]}>
            <span className="mb-3 text-sm font-semibold uppercase tracking-[.2em] text-gold">{t("s1_kicker")}</span>
            <h2 className="max-w-xl text-4xl font-bold leading-tight md:text-5xl">{t("s1_title")}</h2>
            <p className="mt-4 max-w-md text-white/70 md:text-lg">{t("s1_body")}</p>
          </Panel>

          <Panel p={scrollYProgress} range={[0.42, 0.5, 0.64, 0.7]} align="right">
            <span className="mb-3 text-sm font-semibold uppercase tracking-[.2em] text-gold">{t("s2_kicker")}</span>
            <h2 className="max-w-xl text-4xl font-bold leading-tight md:text-5xl">{t("s2_title")}</h2>
            <p className="mt-4 max-w-md text-white/70 md:text-lg">{t("s2_body")}</p>
            <div className="mt-6 grid max-w-md grid-cols-2 gap-2.5">
              {LEVELS.map((l, i) => (
                <motion.div key={l.k} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left backdrop-blur">
                  <span className="h-3 w-3 rounded-full shadow-[0_0_12px_currentColor]" style={{ background: l.c, color: l.c }} />
                  <b>{l.k}</b><span className="text-sm text-white/75">{t(l.k as StrKey)}</span>
                </motion.div>
              ))}
            </div>
          </Panel>

          <Panel p={scrollYProgress} range={[0.72, 0.8, 0.97, 1.05]}>
            <span className="mb-3 text-sm font-semibold uppercase tracking-[.2em] text-gold">{t("s3_kicker")}</span>
            <h2 className="max-w-xl text-4xl font-bold leading-tight md:text-5xl">{t("s3_title")}</h2>
            <p className="mt-4 max-w-md text-white/70 md:text-lg">{t("s3_body")}</p>
          </Panel>

          <motion.div style={{ opacity: hint }} className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-xs uppercase tracking-[.25em] text-white/60">
            {t("scroll_hint")}
            <span className="relative h-10 w-6 rounded-full border border-white/40"><motion.i className="absolute left-1/2 top-2 h-2 w-1 -translate-x-1/2 rounded-full bg-gold" animate={{ y: [0, 14, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} /></span>
          </motion.div>
        </div>
      </section>

      {/* light half */}
      <div className="relative text-white" style={{ background: "radial-gradient(1100px 600px at 10% 0%, rgba(214,58,82,.45), transparent 60%), radial-gradient(900px 600px at 100% 40%, rgba(233,168,79,.18), transparent 55%), linear-gradient(180deg, #0E0306 0%, #5C0B17 12%, #7A0F1E 45%, #4A0A17 100%)" }}>
        <Stats />
        <HowItWorks />
        <Roles />
        <FinalCta href={startHref} />
      </div>
    </div>
  );
}

function Stats() {
  const { t } = useI18n();
  const items: [number, StrKey][] = [[13, "stat_chapters"], [91, "stat_concepts"], [193, "stat_topics"], [4, "stat_levels"]];
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-5 pt-24 md:grid-cols-4">
      {items.map(([v, k], i) => (
        <FadeIn key={k} delay={i * 0.08} className="border-l border-white/20 px-6 py-4 first:border-l-0">
          <div className="text-6xl font-bold tracking-tighter text-sheen-gold md:text-7xl"><CountUp to={v} /></div>
          <div className="mt-1 text-white/75">{t(k)}</div>
        </FadeIn>
      ))}
    </section>
  );
}

/** Animated mock of the real tagging result: chips pop in, confidence bars fill. */
function HowItWorks() {
  const { t, lang, n } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const line = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const steps: [IconName, string, string][] = lang === "bn"
    ? [["file", "প্রশ্ন দিন", "একটি বা Excel-এ হাজারটি"], ["cpu", "মডেল পড়ে", "বাংলা ও ইংরেজি দুটোই"], ["tag", "ট্যাগ + নিশ্চয়তা", "অধ্যায় থেকে K1–K4"], ["shield", "যাচাই ও বোর্ড মিল", "কম নিশ্চয়তা হলে মডারেটর"]]
    : [["file", "Add questions", "One at a time or thousands by Excel"], ["cpu", "The model reads", "Bangla and English"], ["tag", "Tags + confidence", "Chapter down to K1–K4"], ["shield", "Check & board match", "Low confidence goes to a moderator"]];
  const demo = lang === "bn"
    ? { q: "৫ কেজি ভরের বস্তুর উপর ১০ নিউটন বল প্রয়োগ করলে ত্বরণ কত হবে?", tags: [["অধ্যায়", "বল"], ["ধারণা", "নিউটনের গতির সূত্র"], ["টপিক", "দ্বিতীয় সূত্র"]] }
    : { q: "A force of 10 N acts on a 5 kg body. What is its acceleration?", tags: [["Chapter", "Force"], ["Concept", "Newton's laws of motion"], ["Topic", "Second law"]] };
  return (
    <section id="how" ref={ref} className="mx-auto max-w-6xl px-5 py-28">
      <FadeIn><h2 className="max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">{t("cta_how")}</h2></FadeIn>
      <div className="relative mt-14 grid gap-6 md:grid-cols-4">
        <svg className="pointer-events-none absolute left-0 top-7 hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 2">
          <line x1="4" y1="1" x2="96" y2="1" stroke="rgba(255,255,255,.25)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <motion.line x1="4" y1="1" x2="96" y2="1" stroke="url(#g)" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ pathLength: line }} />
          <defs><linearGradient id="g"><stop offset="0" stopColor="#E9A84F" /><stop offset="1" stopColor="#FFF4D6" /></linearGradient></defs>
        </svg>
        {steps.map(([ic, h, s], i) => (
          <FadeIn key={h} delay={i * 0.12} className="relative">
            <div className="glass relative z-10 grid h-14 w-14 place-items-center rounded-2xl text-maroon"><Icon name={ic} className="h-6 w-6" /></div>
            <div className="mt-4 text-sm font-semibold text-gold-soft">{n(i + 1).padStart(2, lang === "bn" ? "০" : "0")}</div>
            <h3 className="mt-1 text-lg font-semibold">{h}</h3>
            <p className="mt-1 text-sm text-white/70">{s}</p>
          </FadeIn>
        ))}
      </div>

      <FadeIn className="mt-16">
        <Tilt className="mx-auto max-w-3xl rounded-[20px]" max={5}>
          <div className="glass overflow-hidden rounded-[20px] text-ink">
            <div className="flex items-center gap-1.5 border-b border-line bg-head px-4 py-2.5">{["#E2566C", "#E9A84F", "#7FB77E"].map((c) => <i key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}<span className="ml-3 text-xs text-ink-3">dishari · {t("nav_tag")}</span></div>
            <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_1fr]">
              <div>
                <div className="label">{t("stem")}</div>
                <p className="mt-2 text-lg font-medium leading-relaxed">{demo.q}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">{(lang === "bn" ? ["০.৫ মি/সে²", "২ মি/সে²", "৫ মি/সে²", "৫০ মি/সে²"] : ["0.5 m/s²", "2 m/s²", "5 m/s²", "50 m/s²"]).map((o, i) => <div key={o} className={`rounded-lg border px-3 py-2 ${i === 1 ? "border-maroon bg-maroon-tint" : "border-line"}`}>{o}</div>)}</div>
              </div>
              <div className="space-y-2.5">
                {demo.tags.map(([k, v], i) => (
                  <motion.div key={k} initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.25, ease }}
                    className="rounded-lg border border-line px-3 py-2">
                    <div className="text-xs text-ink-3">{k}</div><div className="font-semibold">{v}</div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#EDE7DF]"><motion.i className="block h-full bg-gradient-to-r from-gold to-maroon" initial={{ width: 0 }} whileInView={{ width: `${[94, 86, 71][i]}%` }} viewport={{ once: true }} transition={{ delay: 0.5 + i * 0.25, duration: 0.9, ease }} /></div>
                  </motion.div>
                ))}
                <motion.div initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.2, type: "spring", stiffness: 260, damping: 14 }}
                  className="flex items-center gap-2 pt-1"><span className="chip border-[#EFB6C0] bg-[#FBE4E8] text-[#9B1C31]">K3 · {t("K3")}</span><span className="chip border-ok/30 bg-[#E3F1E3] text-ok">✓ {t("st_tagged")}</span></motion.div>
              </div>
            </div>
          </div>
        </Tilt>
      </FadeIn>
    </section>
  );
}

function Roles() {
  const { t } = useI18n();
  const roles: [StrKey, StrKey, IconName][] = [["r_teacher", "who_teacher", "file"], ["r_moderator", "who_moderator", "shield"], ["r_student", "who_student", "play"], ["r_parent", "who_parent", "heart"]];
  return (
    <section className="mx-auto max-w-6xl px-5 pb-28">
      <FadeIn><h2 className="text-4xl font-bold tracking-tight md:text-5xl">{t("who_title")}</h2></FadeIn>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map(([r, d, ic], i) => (
          <FadeIn key={r} delay={i * 0.08}>
            <Tilt className="h-full rounded-card">
              <div className="glass group relative h-full overflow-hidden rounded-card p-6 text-ink">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-gold/20 to-maroon/20 blur-xl transition-transform duration-700 group-hover:scale-[2.2]" />
                <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-maroon text-white shadow-[0_10px_20px_-10px_rgba(122,15,30,.9)]"><Icon name={ic} className="h-6 w-6" /></div>
                <h3 className="relative mt-5 text-xl font-semibold">{t(r)}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-2">{t(d)}</p>
              </div>
            </Tilt>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ href }: { href: string }) {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-gradient-to-br from-[#2A050C]/60 via-transparent to-[#2A050C]/70 text-white">
      <Ribbons dark className="opacity-90" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center">
        <motion.img src="/logo-mark.webp" alt="" className="h-20 drop-shadow-[0_0_30px_rgba(233,168,79,.6)]" animate={{ y: [0, -10, 0], rotate: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} />
        <Reveal as="h2" text={t("final_title")} className="mt-6 text-4xl font-bold tracking-tight md:text-6xl" />
        <Magnetic className="mt-9"><Link to={href} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 font-semibold text-maroon shadow-[0_10px_40px_-8px_rgba(0,0,0,.5)] transition hover:bg-gold-soft">{t("cta_start")}<Icon name="arrow" className="h-4 w-4" /></Link></Magnetic>
      </div>
      <footer className="relative border-t border-white/10 py-6 text-center text-sm text-white/60">{t("brand")} · {t("tagline")} · {t("footer")}</footer>
    </section>
  );
}
