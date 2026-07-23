"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { cn } from "@walls/utils";

import { AnimatedMetricValue } from "./animated-metric-value";

/** Matches Projects hub frosted glass panels. */
export const panelGlassClass =
  "bg-white/80 backdrop-blur-xl shadow-[0_8px_28px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.95)]";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
      {children}
    </p>
  );
}

function HeroStatSkeleton() {
  return (
    <div className="flex items-center gap-3.5">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-neutral-200/80" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-neutral-200/80" />
        <div className="h-6 w-28 animate-pulse rounded bg-neutral-200/80" />
      </div>
    </div>
  );
}

type HeroStatsBarProps = {
  children: React.ReactNode;
  className?: string;
};

/** One connected glass pill; children form a 3×2 grid (stacked on mobile). */
function HeroStatsBar({ children, className }: HeroStatsBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "grid grid-cols-1 overflow-hidden rounded-[28px]",
        "sm:grid-cols-3",
        // Mobile: horizontal rules between stacked stats
        "[&>*]:border-b [&>*]:border-neutral-200/80 [&>*:last-child]:border-b-0",
        // sm+: 3×2 with vertical + horizontal hairlines
        "sm:[&>*]:border-r sm:[&>*:nth-child(3n)]:border-r-0",
        "sm:[&>*:nth-last-child(-n+3)]:border-b-0",
        panelGlassClass,
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

type HeroStatProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  accentColor: string;
  change?: string;
  positive?: boolean;
  loading?: boolean;
  className?: string;
};

function HeroStat({
  label,
  value,
  icon: Icon,
  accentColor,
  change,
  positive = true,
  loading,
  className,
}: HeroStatProps) {
  const showChange = Boolean(change && change !== "-");
  const GrowthIcon = positive ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center px-4 py-3.5 md:px-5 md:py-4",
        className,
      )}
    >
      {loading ? (
        <HeroStatSkeleton />
      ) : (
        <div className="flex w-full min-w-0 items-center gap-3.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: accentColor }}
          >
            <Icon className="h-4 w-4 text-white" strokeWidth={1.8} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-light text-neutral-500">
              {label}
            </p>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
              <p className="truncate text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
                <AnimatedMetricValue value={value} />
              </p>
              {showChange ? (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums",
                    positive ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  <GrowthIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                  {change}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { HeroStat, HeroStatsBar, SectionLabel };
