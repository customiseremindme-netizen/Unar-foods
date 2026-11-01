"use client";

import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Motion is loaded lazily (smaller JavaScript) and automatically respects the
 * visitor's "reduce motion" system setting.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

const EASE = [0.22, 0.61, 0.36, 1] as const;

/** Soft fade-and-rise when the element scrolls into view (once). */
export function Reveal({
  children,
  delay = 0,
  y = 22,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const Comp = m[as];
  return (
    <Comp
      data-reveal
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

/** Children appear one after another. Use with <StaggerItem>. */
export function Stagger({ children, className, gap = 0.09 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <m.div
      data-reveal
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div
      data-reveal
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
      }}
    >
      {children}
    </m.div>
  );
}

function useLargeScreen() {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setLarge(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return large;
}

/**
 * Gentle scroll parallax for decorative layers. Disabled on small screens and
 * for visitors who prefer reduced motion.
 */
export function Parallax({ children, distance = 60, className }: { children: ReactNode; distance?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const large = useLargeScreen();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const active = large && !reduce;
  return (
    <m.div ref={ref} className={className} style={active ? { y } : undefined}>
      {children}
    </m.div>
  );
}

/**
 * Reveals an image through a soft mask that opens from the bottom, once, when
 * it scrolls into view. Without JavaScript or with reduced motion it is simply shown.
 */
export function MaskReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      data-reveal
      className={className}
      initial={{ clipPath: "inset(18% 6% 18% 6% round 2.5rem)", opacity: 0.4 }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0% round 2.5rem)", opacity: 1 }}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      transition={{ duration: 1.1, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}

/** A small "pop" for icons inside a <Stagger> list. */
export function IconPop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.span
      className={className}
      variants={{
        hidden: { scale: 0.6, rotate: -12, opacity: 0 },
        show: { scale: 1, rotate: 0, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 16, delay: 0.15 } },
      }}
    >
      {children}
    </m.span>
  );
}

/** Draws an SVG line-art illustration stroke by stroke when it enters view. */
export function DrawOnView({
  children,
  className,
  viewBox,
  duration = 2.2,
  label,
}: {
  children: (props: { pathProps: Record<string, unknown> }) => ReactNode;
  className?: string;
  viewBox: string;
  duration?: number;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const pathProps = reduce
    ? { variants: { hidden: { pathLength: 1, opacity: 1 }, show: { pathLength: 1, opacity: 1 } } }
    : {
    variants: {
      hidden: { pathLength: 0, opacity: 0 },
      show: (i: number = 0) => ({
        pathLength: 1,
        opacity: 1,
        transition: { pathLength: { duration, ease: EASE, delay: i * 0.12 }, opacity: { duration: 0.3, delay: i * 0.12 } },
      }),
    },
  };
  return (
    <m.svg
      viewBox={viewBox}
      className={className}
      fill="none"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {children({ pathProps })}
    </m.svg>
  );
}
