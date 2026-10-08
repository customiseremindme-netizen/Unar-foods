"use client";

import { m } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Original botanical line art used as quiet decoration (never as a logo).
 * Paths draw themselves when they scroll into view; the reduced-motion
 * setting shows them instantly.
 */

const EASE = [0.22, 0.61, 0.36, 1] as const;

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i: number = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 1.8, ease: EASE, delay: 0.15 + i * 0.1 }, opacity: { duration: 0.2, delay: 0.15 + i * 0.1 } },
  }),
};

const LEAF = "M0 0 C10 -11 28 -13 42 0 C28 13 10 11 0 0 Z";
const RIB = "M3 0 C14 -1 26 -1 37 0";

const SPRIG_LEAVES: [number, number, number, number][] = [
  [58, 172, -150, 0.85],
  [59, 150, -32, 0.95],
  [61, 124, -152, 1],
  [61, 100, -28, 1],
  [60, 76, -148, 0.9],
  [61, 54, -35, 0.85],
  [63, 32, -145, 0.7],
  [64, 13, -70, 0.62],
];

export function LeafSprig({ className, strokeWidth = 1.1 }: { className?: string; strokeWidth?: number }) {
  return (
    <m.svg
      viewBox="0 0 120 200"
      fill="none"
      className={cn("pointer-events-none", className)}
      aria-hidden="true"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
    >
      <m.path
        d="M58 196 C56 160 64 128 60 96 C57 70 63 40 64 8"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        variants={draw}
        custom={0}
      />
      {SPRIG_LEAVES.map(([x, y, angle, scale], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
          <m.path d={LEAF} stroke="currentColor" strokeWidth={strokeWidth / scale} strokeLinejoin="round" variants={draw} custom={i + 1} />
          <m.path d={RIB} stroke="currentColor" strokeWidth={(strokeWidth * 0.7) / scale} strokeLinecap="round" variants={draw} custom={i + 1.5} />
        </g>
      ))}
    </m.svg>
  );
}

function bananaLeafPaths() {
  // Midrib is a quadratic curve from the stem (bottom) to the tip (top).
  const p0 = [118, 412];
  const p1 = [96, 210];
  const p2 = [150, 12];
  const at = (t: number) => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1],
  ];
  const width = (t: number) => (t < 0.08 ? 0 : 92 * Math.sin(Math.PI * Math.min(1, (t - 0.04) / 0.98)) ** 0.8);
  const steps = 28;
  const left: number[][] = [];
  const right: number[][] = [];
  for (let s = 0; s <= steps; s++) {
    const t = 0.06 + (s / steps) * 0.94;
    const [x, y] = at(t);
    const w = width(t);
    left.push([x - w, y - w * 0.18]);
    right.push([x + w * 0.9, y - w * 0.22]);
  }
  const toPath = (pts: number[][]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const [sx, sy] = at(0.06);
  const outline = `M${sx.toFixed(1)} ${sy.toFixed(1)} ${toPath(left).replace(/^M/, "L")} ${toPath([...right].reverse()).replace(/^M/, "L")} Z`;
  const midrib = toPath(Array.from({ length: 30 }, (_, i) => at(i / 29)));
  const veins: string[] = [];
  for (let s = 2; s < steps - 1; s += 2) {
    const t = 0.06 + (s / steps) * 0.94;
    const [x, y] = at(t);
    veins.push(`M${x.toFixed(1)} ${y.toFixed(1)} L${left[s][0].toFixed(1)} ${(left[s][1] - 10).toFixed(1)}`);
    veins.push(`M${x.toFixed(1)} ${y.toFixed(1)} L${right[s][0].toFixed(1)} ${(right[s][1] - 12).toFixed(1)}`);
  }
  return { outline, midrib, veins };
}

const BANANA = bananaLeafPaths();

export function BananaLeaf({ className, strokeWidth = 1 }: { className?: string; strokeWidth?: number }) {
  return (
    <m.svg
      viewBox="0 0 260 420"
      fill="none"
      className={cn("pointer-events-none", className)}
      aria-hidden="true"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
    >
      <m.path d={BANANA.outline} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" variants={draw} custom={0} />
      <m.path d={BANANA.midrib} stroke="currentColor" strokeWidth={strokeWidth * 1.2} strokeLinecap="round" variants={draw} custom={0.5} />
      {BANANA.veins.map((d, i) => (
        <m.path key={i} d={d} stroke="currentColor" strokeWidth={strokeWidth * 0.6} strokeLinecap="round" variants={draw} custom={1 + i * 0.05} />
      ))}
    </m.svg>
  );
}

export function LeafDivider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 24" fill="none" className={cn("pointer-events-none", className)} aria-hidden="true">
      <path d="M0 12 H96" stroke="currentColor" strokeWidth="1" />
      <path d="M144 12 H240" stroke="currentColor" strokeWidth="1" />
      <g transform="translate(104 12) rotate(-18)">
        <path d={LEAF} stroke="currentColor" strokeWidth="1.1" />
        <path d={RIB} stroke="currentColor" strokeWidth="0.8" />
      </g>
    </svg>
  );
}
