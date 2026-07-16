"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@walls/utils";

import type { DashboardCalorieDay } from "@/lib/dashboard-defaults";
import { PREVIEW_CALORIES_BY_DAY } from "@/lib/dashboard-defaults";
import { formatCalories } from "@/lib/format-health";

type CalorieTrendChartProps = {
  days: DashboardCalorieDay[];
  /** Softer ticks/legend for mist glow card background */
  variant?: "default" | "onGlow";
};

function TrendTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: DashboardCalorieDay }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-white/20 bg-neutral-900/90 px-3 py-2.5 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-xs font-light text-neutral-300">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-6">
          <span className="text-neutral-400">Consumed</span>
          <span className="font-medium text-[var(--kenoo-sky)]">
            {formatCalories(point.consumed)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-neutral-400">Burned</span>
          <span className="font-medium text-[var(--kenoo-yellow)]">
            {formatCalories(point.burned)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-neutral-400">Remaining</span>
          <span className="font-medium text-neutral-100">
            {formatCalories(point.remaining)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CalorieTrendChart({
  days,
  variant = "default",
}: CalorieTrendChartProps) {
  const hasLiveData = days.some((day) => day.consumed > 0 || day.burned > 0);
  const chartData = hasLiveData ? days : PREVIEW_CALORIES_BY_DAY;
  const onGlow = variant === "onGlow";

  return (
    <div className="relative w-full">
      {!hasLiveData ? (
        <div className="pointer-events-none absolute right-0 top-0 z-10">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-light uppercase tracking-wider shadow-sm",
              onGlow
                ? "bg-white/50 text-neutral-700 ring-1 ring-white/60"
                : "border border-neutral-200/80 bg-kenoo-white/90 text-neutral-500",
            )}
          >
            Preview
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          "mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-light uppercase tracking-wider",
          onGlow ? "text-neutral-600" : "text-neutral-400",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[var(--kenoo-sky)]" />
          Consumed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[var(--kenoo-yellow)]" />
          Burned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-0.5 w-4 border-t border-dashed",
              onGlow ? "border-neutral-600" : "border-neutral-400",
            )}
          />
          Target
        </span>
      </div>

      <div className="h-[260px] w-full md:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="healthConsumedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--kenoo-sky)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--kenoo-sky)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="healthBurnedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--kenoo-yellow)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--kenoo-yellow)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={onGlow ? "rgba(255,255,255,0.35)" : "rgb(212 212 212)"}
              vertical
              horizontal
            />
            <XAxis
              dataKey="label"
              axisLine={{
                stroke: onGlow ? "rgba(255,255,255,0.4)" : "rgb(212 212 212)",
              }}
              tick={{
                fill: onGlow ? "rgb(64 64 64)" : "rgb(115 115 115)",
                fontSize: 11,
              }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fill: onGlow ? "rgb(64 64 64)" : "rgb(115 115 115)",
                fontSize: 11,
              }}
              width={48}
            />
            <Tooltip content={<TrendTooltip />} />
            <Line
              type="monotone"
              dataKey="target"
              stroke={onGlow ? "rgb(82 82 82)" : "rgb(163 163 163)"}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="burned"
              stroke="var(--kenoo-yellow)"
              strokeWidth={2}
              fill="url(#healthBurnedGrad)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="consumed"
              stroke="var(--kenoo-sky)"
              strokeWidth={2.5}
              fill="url(#healthConsumedGrad)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
