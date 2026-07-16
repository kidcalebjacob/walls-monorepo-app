"use client";

import { motion } from "framer-motion";

import { cn } from "@walls/utils";

import { AnimatedMetricValue } from "./animated-metric-value";

type DayPulseProps = {
  title: string;
  progress: number;
  centerValue: string;
  centerLabel: string;
  statusItems: Array<{ label: string; value: string }>;
  className?: string;
};

export function DayPulse({
  title,
  progress,
  centerValue,
  centerLabel,
  statusItems,
  className,
}: DayPulseProps) {
  const clamped = Math.max(0, Math.min(progress, 100));
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      <div className="relative z-10">
        <h1 className="max-w-sm text-3xl font-semibold tracking-[-0.04em] text-neutral-900 md:text-4xl">
          {title}
        </h1>
      </div>

      <div className="relative mt-8 flex flex-1 flex-col items-center justify-center gap-10">
        <div className="relative flex h-[260px] w-[260px] items-center justify-center md:h-[300px] md:w-[300px]">
          <div
            aria-hidden
            className="absolute inset-6 rounded-full opacity-80"
            style={{
              background:
                "radial-gradient(circle, rgba(206,255,0,0.18) 0%, rgba(255,113,48,0.08) 45%, transparent 70%)",
            }}
          />

          <svg
            viewBox="0 0 200 200"
            className="h-full w-full -rotate-90"
            aria-hidden
          >
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#e6e6e4"
              strokeWidth="10"
            />
            <circle
              cx="100"
              cy="100"
              r={72}
              fill="none"
              stroke="#ececea"
              strokeWidth="1"
            />
            <circle
              cx="100"
              cy="100"
              r={58}
              fill="none"
              stroke="#efefed"
              strokeWidth="1"
            />
            <motion.circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="url(#dayPulseStroke)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            <defs>
              <linearGradient id="dayPulseStroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ceff00" />
                <stop offset="55%" stopColor="#e2f85c" />
                <stop offset="100%" stopColor="#ff7130" />
              </linearGradient>
            </defs>
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
              {centerLabel}
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-[-0.05em] tabular-nums text-neutral-900 md:text-5xl">
              <AnimatedMetricValue value={centerValue} />
            </p>
            <p className="mt-1 text-xs font-light text-neutral-500">
              {clamped}% of target
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-sm justify-between gap-6 px-2">
          {statusItems.map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-medium text-neutral-800">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
