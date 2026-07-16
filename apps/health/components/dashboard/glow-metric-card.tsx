"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@walls/utils";

import { AnimatedMetricValue } from "./animated-metric-value";

type GlowMetricCardProps = {
  title: string;
  value: string;
  detail?: string;
  tone: "sage" | "amber" | "spectrum" | "coral" | "mist" | "lime";
  graphic?: ReactNode;
  className?: string;
  delay?: number;
  href?: string;
};

const TONE_STYLES: Record<
  GlowMetricCardProps["tone"],
  { background: string; text: string; muted: string }
> = {
  sage: {
    background:
      "linear-gradient(145deg, #4a6b52 0%, #6f8f6a 42%, #9bb58a 100%)",
    text: "text-white",
    muted: "text-white/70",
  },
  amber: {
    background:
      "linear-gradient(145deg, #f0c35a 0%, #f59e3b 48%, #ff8a4c 100%)",
    text: "text-white",
    muted: "text-white/75",
  },
  spectrum: {
    background:
      "linear-gradient(135deg, #6eadc0 0%, #f0a060 48%, #e86b5a 100%)",
    text: "text-white",
    muted: "text-white/75",
  },
  coral: {
    background:
      "linear-gradient(145deg, #ff9a5c 0%, #ff7130 55%, #8dcf76 100%)",
    text: "text-white",
    muted: "text-white/75",
  },
  mist: {
    background:
      "linear-gradient(145deg, #d9e2e8 0%, #b7c8d2 50%, #9bb0bd 100%)",
    text: "text-neutral-900",
    muted: "text-neutral-600",
  },
  lime: {
    background:
      "linear-gradient(145deg, #c8e86a 0%, #e2f85c 45%, #ceff00 100%)",
    text: "text-neutral-900",
    muted: "text-neutral-700/80",
  },
};

export function GlowMetricCard({
  title,
  value,
  detail,
  tone,
  graphic,
  className,
  delay = 0,
  href,
}: GlowMetricCardProps) {
  const styles = TONE_STYLES[tone];

  const inner = (
    <>
      <div className="relative z-10 flex h-full flex-col justify-between p-5 md:p-6">
        <p
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.18em]",
            styles.muted,
          )}
        >
          {title}
        </p>
        <div className="mt-auto pt-10">
          <p
            className={cn(
              "text-3xl font-semibold tracking-[-0.04em] tabular-nums md:text-4xl",
              styles.text,
            )}
          >
            <AnimatedMetricValue value={value} />
          </p>
          {detail ? (
            <p className={cn("mt-1.5 text-sm font-light", styles.muted)}>
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      {graphic ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {graphic}
        </div>
      ) : null}
    </>
  );

  const shellClass = cn(
    "relative isolate block min-h-[160px] overflow-hidden rounded-[28px] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] transition-transform duration-300",
    href ? "hover:-translate-y-0.5" : null,
    className,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={shellClass}
      style={{ background: styles.background }}
    >
      {href ? (
        <Link href={href} className="absolute inset-0 z-20">
          <span className="sr-only">Open {title}</span>
        </Link>
      ) : null}
      {inner}
    </motion.div>
  );
}

export function RingsGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("absolute -right-6 -bottom-8 h-44 w-44 opacity-40", className)}
      aria-hidden
    >
      {[40, 58, 76, 94].map((r) => (
        <circle
          key={r}
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="0.8"
          opacity={0.55}
        />
      ))}
      <circle cx="100" cy="100" r="6" fill="white" opacity="0.7" />
    </svg>
  );
}

export function WaveGraphic({
  className,
  stroke = "white",
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 120"
      className={cn("absolute right-0 bottom-4 h-28 w-full opacity-45", className)}
      aria-hidden
    >
      <path
        d="M10 70 C40 30, 70 110, 100 60 S160 20, 210 55"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10 85 C45 50, 75 120, 110 75 S165 40, 210 70"
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        opacity="0.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ArcScaleGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 140"
      className={cn("absolute right-2 bottom-2 h-32 w-40 opacity-50", className)}
      aria-hidden
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M ${30 + i * 8} 110 A ${70 - i * 10} ${70 - i * 10} 0 0 1 ${170 - i * 8} 110`}
          fill="none"
          stroke="white"
          strokeWidth="1"
          opacity={0.35 + i * 0.1}
        />
      ))}
      <circle cx="100" cy="70" r="4" fill="white" />
      <circle cx="145" cy="55" r="3" fill="white" opacity="0.8" />
    </svg>
  );
}

export function DiamondGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={cn("absolute -right-4 -bottom-4 h-40 w-40 opacity-40", className)}
      aria-hidden
    >
      <path
        d="M80 20 L130 80 L80 140 L30 80 Z"
        fill="none"
        stroke="white"
        strokeWidth="1"
      />
      <path
        d="M80 45 L110 80 L80 115 L50 80 Z"
        fill="none"
        stroke="white"
        strokeWidth="1"
        opacity="0.7"
      />
      <path d="M80 20 V140 M30 80 H130" stroke="white" strokeWidth="0.6" opacity="0.45" />
    </svg>
  );
}

export function FunnelGraphic({
  className,
  stroke = "white",
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={cn("absolute right-0 bottom-0 h-36 w-36 opacity-40", className)}
      aria-hidden
    >
      {[20, 35, 50, 65].map((r, i) => (
        <ellipse
          key={r}
          cx="80"
          cy={40 + i * 22}
          rx={r}
          ry={10 + i * 2}
          fill="none"
          stroke={stroke}
          strokeWidth="1"
          opacity={0.35 + i * 0.12}
        />
      ))}
    </svg>
  );
}
