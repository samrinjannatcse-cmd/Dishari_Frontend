import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import Lenis from "lenis";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18n";

export const ease = [0.22, 1, 0.36, 1] as const;

/** Word-by-word rise. Splits on spaces only, so Bangla conjuncts are never broken. */
export function Reveal({ text, className, delay = 0, as = "span" }: { text: string; className?: string; delay?: number; as?: "span" | "h1" | "h2" | "p" }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const Tag = motion[as] as typeof motion.span;
  const words = text.split(" ");
  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]" aria-hidden>
          <motion.span className="inline-block" initial={reduce ? false : { y: "110%", opacity: 0 }}
            animate={inView ? { y: 0, opacity: 1 } : undefined} transition={{ duration: 0.8, ease, delay: delay + i * 0.045 }}>
            {w}{i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Fade + rise when scrolled into view. */
export function FadeIn({ children, delay = 0, y = 24, className, ...rest }: { children: ReactNode; delay?: number; y?: number; className?: string } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }} transition={{ duration: 0.7, ease, delay }} {...rest}>
      {children}
    </motion.div>
  );
}

/** Animated number in the UI language's digits. */
export function CountUp({ to, decimals = 0, duration = 1.4, suffix = "" }: { to: number; decimals?: number; duration?: number; suffix?: string }) {
  const { n } = useI18n();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setV(to); return; }
    const c = animate(0, to, { duration, ease, onUpdate: setV });
    return () => c.stop();
  }, [inView, to, duration, reduce]);
  return <span ref={ref} className="tabular-nums">{n(Number(v.toFixed(decimals)), { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/** 3D tilt toward the pointer, with a moving glare. */
export function Tilt({ children, className, max = 8, glare = true }: { children: ReactNode; className?: string; max?: number; glare?: boolean }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0.5), y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [0, 1], [-max, max]), { stiffness: 200, damping: 20 });
  const gx = useTransform(x, (v) => `${v * 100}%`), gy = useTransform(y, (v) => `${v * 100}%`);
  const bg = useTransform([gx, gy] as never, ([a, b]: string[]) => `radial-gradient(420px circle at ${a} ${b}, rgba(255,255,255,.55), transparent 45%)`);
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={`relative [transform-style:preserve-3d] ${className || ""}`} style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left) / r.width); y.set((e.clientY - r.top) / r.height); }}
      onPointerLeave={() => { x.set(0.5); y.set(0.5); }}>
      {children}
      {glare && <motion.div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 [div:hover>&]:opacity-100 mix-blend-soft-light" style={{ background: bg }} />}
    </motion.div>
  );
}

/** Element drifts toward the cursor while hovered. */
export function Magnetic({ children, strength = 0.25, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 250, damping: 15 }), y = useSpring(0, { stiffness: 250, damping: 15 });
  if (reduce) return <span className={className}>{children}</span>;
  return (
    <motion.span className={`inline-block ${className || ""}`} style={{ x, y }}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * strength); y.set((e.clientY - r.top - r.height / 2) * strength); }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.span>
  );
}

/** Page transition wrapper. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease }}>
      {children}
    </motion.div>
  );
}

/** Stagger children list. */
export const stagger = {
  parent: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  child: { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } },
};

/** Slow maroon/gold silk ribbons (2D canvas, cheap), used behind the app and auth pages. */
export function Ribbons({ className, dark = false }: { className?: string; dark?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let raf = 0, t = Math.random() * 100;
    const resize = () => { const d = Math.min(window.devicePixelRatio, 1.5); c.width = c.offsetWidth * d; c.height = c.offsetHeight * d; };
    resize(); window.addEventListener("resize", resize);
    const bands = dark
      ? [["rgba(184,137,43,.30)", 0.0], ["rgba(194,43,69,.28)", 1.7], ["rgba(244,213,138,.14)", 3.1]]
      : [["rgba(122,15,30,.10)", 0.0], ["rgba(184,137,43,.14)", 1.7], ["rgba(122,15,30,.06)", 3.1]];
    const draw = () => {
      const w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);
      bands.forEach(([col, off], bi) => {
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const px = (i / 60) * w;
          const py = h * (0.35 + bi * 0.12) + Math.sin(i * 0.12 + t * (0.35 + bi * 0.1) + (off as number)) * h * 0.08 + Math.cos(i * 0.05 - t * 0.2) * h * 0.05;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        for (let i = 60; i >= 0; i--) {
          const px = (i / 60) * w;
          const py = h * (0.47 + bi * 0.12) + Math.sin(i * 0.1 + t * (0.3 + bi * 0.1) + (off as number) + 1) * h * 0.07;
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = col as string; ctx.filter = `blur(${28 * (window.devicePixelRatio || 1)}px)`; ctx.fill();
      });
      ctx.filter = "none";
      if (!reduce) { t += 0.006; raf = requestAnimationFrame(draw); }
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [dark, reduce]);
  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className || ""}`} aria-hidden />;
}

/** Smooth wheel scrolling (landing page only). */
export function useLenis() {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const l = new Lenis({ lerp: 0.09, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => { l.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); l.destroy(); };
  }, [reduce]);
}
