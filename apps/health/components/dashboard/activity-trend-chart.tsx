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

import type { DashboardActivityDay } from "@/lib/dashboard-defaults";
import {
  DEFAULT_STEPS_TARGET,
  PREVIEW_ACTIVITY_BY_DAY,
} from "@/lib/dashboard-defaults";
import { formatSteps } from "@/lib/format-health";

type ActivityTrendChartProps = {
  days: DashboardActivityDay[];
  stepsTarget?: number;
  variant?: "default" | "onGlow" | "onDark";
};

function TrendTooltip({
  active,
  label,
  payload,
  stepsTarget,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: DashboardActivityDay }>;
  stepsTarget: number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-white/20 bg-neutral-900/90 px-3 py-2.5 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-xs font-light text-neutral-300">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-6">
          <span className="text-neutral-400">Steps</span>
          <span className="font-medium text-[var(--kenoo-sky)]">
            {formatSteps(point.steps)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-neutral-400">Target</span>
          <span className="font-medium text-neutral-100">
            {formatSteps(stepsTarget)}
          </span>
        </div>
        {point.active_energy_kcal > 0 ? (
          <div className="flex justify-between gap-6">
            <span className="text-neutral-400">Active energy</span>
            <span className="font-medium text-[var(--kenoo-yellow)]">
              {Math.round(point.active_energy_kcal)} kcal
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityTrendChart({
  days,
  stepsTarget = DEFAULT_STEPS_TARGET,
  variant = "default",
}: ActivityTrendChartProps) {
  const hasLiveData = days.some((day) => day.steps > 0);
  const chartData = (hasLiveData ? days : PREVIEW_ACTIVITY_BY_DAY).map(
    (day) => ({
      ...day,
      target: stepsTarget,
    }),
  );
  const onGlow = variant === "onGlow";
  const onDark = variant === "onDark";
  const gridStroke = onDark
    ? "rgba(255,255,255,0.2)"
    : onGlow
      ? "rgba(255,255,255,0.35)"
      : "rgb(212 212 212)";
  const axisStroke = onDark
    ? "rgba(255,255,255,0.35)"
    : onGlow
      ? "rgba(255,255,255,0.4)"
      : "rgb(212 212 212)";
  const tickFill = onDark
    ? "rgb(229 229 229)"
    : onGlow
      ? "rgb(64 64 64)"
      : "rgb(115 115 115)";
  const targetStroke = onDark
    ? "rgba(255,255,255,0.55)"
    : onGlow
      ? "rgb(82 82 82)"
      : "rgb(163 163 163)";
  const areaStroke = onDark ? "#ffffff" : "var(--kenoo-sky)";

  return (
    <div className="relative w-full">
      {!hasLiveData ? (
        <div className="pointer-events-none absolute right-0 top-0 z-10">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-light uppercase tracking-wider shadow-sm",
              onDark
                ? "bg-white/20 text-white ring-1 ring-white/30"
                : onGlow
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
          onDark
            ? "text-white/70"
            : onGlow
              ? "text-neutral-600"
              : "text-neutral-400",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-0.5 w-4 rounded-full",
              onDark ? "bg-white" : "bg-[var(--kenoo-sky)]",
            )}
          />
          Steps
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-0.5 w-4 border-t border-dashed",
              onDark
                ? "border-white/60"
                : onGlow
                  ? "border-neutral-600"
                  : "border-neutral-400",
            )}
          />
          Target
        </span>
      </div>

      <div className="h-[220px] w-full md:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="healthStepsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={onDark ? "#ffffff" : "var(--kenoo-sky)"}
                  stopOpacity={onDark ? 0.28 : 0.35}
                />
                <stop
                  offset="100%"
                  stopColor={onDark ? "#ffffff" : "var(--kenoo-sky)"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridStroke}
              vertical
              horizontal
            />
            <XAxis
              dataKey="label"
              axisLine={{ stroke: axisStroke }}
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: tickFill, fontSize: 11 }}
              width={48}
            />
            <Tooltip
              content={(props) => (
                <TrendTooltip
                  active={props.active}
                  label={
                    typeof props.label === "string" ||
                    typeof props.label === "number"
                      ? String(props.label)
                      : undefined
                  }
                  payload={
                    props.payload as Array<{
                      payload?: DashboardActivityDay;
                    }>
                  }
                  stepsTarget={stepsTarget}
                />
              )}
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke={targetStroke}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="steps"
              stroke={areaStroke}
              strokeWidth={2.5}
              fill="url(#healthStepsGrad)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
