import { createElement, useEffect, useRef, useState, type ElementType, type ReactNode, type RefObject } from "react";
import { prefersReducedMotion } from "./motion";

/**
 * A small, dependency-free motion kit shared by every world:
 * - <Reveal> fades/rises/unmasks content once as it enters the viewport
 * - useScrollProgress gives 0→1 progress through an element (for pinned stories)
 * - useParallax writes a CSS variable you can use in transforms
 * All of it switches off under prefers-reduced-motion.
 */

let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, () => void>();

function sharedObserver() {
  if (observer || typeof IntersectionObserver === "undefined") return observer;
  observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          callbacks.get(e.target)?.();
          observer!.unobserve(e.target);
          callbacks.delete(e.target);
        }
      }),
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
  );
  return observer;
}

export function useInView<T extends Element>(ref: RefObject<T | null>) {
  const [inView, setInView] = useState(() => prefersReducedMotion());
  useEffect(() => {
    const el = ref.current;
    const io = sharedObserver();
    if (!el || !io || inView) {
      if (!io) setInView(true);
      return;
    }
    callbacks.set(el, () => setInView(true));
    io.observe(el);
    return () => {
      io.unobserve(el);
      callbacks.delete(el);
    };
  }, [ref, inView]);
  return inView;
}

type RevealKind = "rise" | "fade" | "mask" | "scale" | "slide-left" | "slide-right" | "clip";

export function Reveal({
  as = "div",
  kind = "rise",
  delay = 0,
  className = "",
  children,
  ...rest
}: {
  as?: ElementType;
  kind?: RevealKind;
  delay?: number;
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);
  return createElement(
    as,
    {
      ref,
      className: `rv rv--${kind} ${inView ? "is-in" : ""} ${className}`.trim(),
      style: { ...((rest.style as object) ?? {}), "--rv-delay": `${delay}ms` },
      ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== "style")),
    },
    children,
  );
}

/** Splits a line of text into words that rise in sequence. */
export function SplitWords({ text, className = "", stagger = 60, delay = 0 }: { text: string; className?: string; stagger?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const words = text.split(" ");
  return (
    <span ref={ref} className={`split ${inView ? "is-in" : ""} ${className}`} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="split__mask" aria-hidden="true">
          <span className="split__word" style={{ transitionDelay: `${delay + i * stagger}ms` }}>
            {w}
          </span>{" "}
        </span>
      ))}
    </span>
  );
}

/** Progress 0→1 as an element scrolls from entering the bottom to leaving the top (or through a sticky track). */
export function useScrollProgress<T extends HTMLElement>(ref: RefObject<T | null>, mode: "through" | "track" = "track") {
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const value = mode === "track" ? -r.top / Math.max(1, r.height - vh) : (vh - r.top) / (vh + r.height);
      setP(Math.max(0, Math.min(1, value)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, mode]);
  return p;
}

/**
 * Writes --py (−1…1, how far the element is from the viewport centre) onto the
 * element on scroll. CSS turns it into parallax with calc().
 */
export function useParallax<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const centre = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.setProperty("--py", Math.max(-1.5, Math.min(1.5, centre / window.innerHeight)).toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [ref]);
}

/** Global scroll position as 0…1 of the page, plus whether the user has scrolled past a threshold. */
export function useScrolled(threshold = 40) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const on = () => setPast(window.scrollY > threshold);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [threshold]);
  return past;
}
