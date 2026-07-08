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

import type { EntityDailyProgress } from "@/lib/entity-daily-progress";
import {
  formatProfitMicros,
  formatProgressAxisValue,
  formatProgressTooltipValue,
} from "@/lib/entity-daily-progress";

import { DetailSection } from "@/components/campaigns/entity-detail-shared";

type ChartPoint = EntityDailyProgress["days"][number] & {
  primary: number;
  secondary: number | null;
};

type ProgressTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: ChartPoint }>;
  progress: EntityDailyProgress;
};

function ProgressTooltip({
  active,
  label,
  payload,
  progress,
}: ProgressTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  const showProfit = progress.primaryMetric.key === "roas";
  const profitMicros = point.conversionValueMicros - point.spendMicros;

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 shadow-lg">
      <p className="mb-2 text-xs font-light text-neutral-300">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="font-light text-neutral-400">{progress.primaryMetric.label}</span>
          <span className="font-medium text-neutral-100">
            {formatProgressTooltipValue(progress.primaryMetric.key, point.primary)}
          </span>
        </div>
        {progress.secondaryMetric && point.secondary != null ? (
          <div className="flex items-center justify-between gap-6 text-xs">
            <span className="font-light text-neutral-400">
              {progress.secondaryMetric.label}
            </span>
            <span className="font-medium text-[var(--walls-yellow)]">
              {formatProgressTooltipValue(
                progress.secondaryMetric.key,
                point.secondary,
              )}
            </span>
          </div>
        ) : null}
        {showProfit ? (
          <div className="flex items-center justify-between gap-6 border-t border-neutral-700 pt-1.5 text-xs">
            <span className="font-light text-neutral-400">Profit</span>
            <span className="font-medium text-neutral-100">
              {formatProfitMicros(profitMicros)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type EntityDailyProgressSectionProps = {
  progress: EntityDailyProgress;
};

export function EntityDailyProgressSection({
  progress,
}: EntityDailyProgressSectionProps) {
  const hasLiveData = progress.days.some((day) => day.spendMicros > 0);
  const chartData = progress.days.map((day) => ({
    ...day,
    primary: day.primaryValue,
    secondary: day.secondaryValue,
  }));

  return (
    <DetailSection
      title="Daily progress"
      description={`${progress.periodLabel} · ${progress.objectiveLabel} outcome`}
      defaultOpen
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-[11px] font-light uppercase tracking-wider text-neutral-400">
              {progress.summary.primaryLabel}
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight text-neutral-900">
              {progress.summary.primaryValue}
            </p>
          </div>
          {progress.summary.secondaryLabel && progress.summary.secondaryValue ? (
            <div>
              <p className="text-[11px] font-light uppercase tracking-wider text-neutral-400">
                {progress.summary.secondaryLabel}
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-neutral-900">
                {progress.summary.secondaryValue}
              </p>
            </div>
          ) : null}
          {progress.summary.profitLabel && progress.summary.profitValue ? (
            <div>
              <p className="text-[11px] font-light uppercase tracking-wider text-neutral-400">
                {progress.summary.profitLabel}
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-neutral-900">
                {progress.summary.profitValue}
              </p>
            </div>
          ) : null}
        </div>

        {!hasLiveData ? (
          <p className="text-sm font-light text-neutral-400">
            Daily metrics will appear here once this ad set has synced performance
            data from Meta.
          </p>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: progress.secondaryMetric ? 48 : 24, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="adpilotProgressGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--walls-sky)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--walls-sky)" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgb(212 212 212)"
                  vertical
                  horizontal
                />

                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: "rgb(212 212 212)" }}
                  tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />

                <YAxis
                  yAxisId="primary"
                  orientation="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                  tickFormatter={(value: number) =>
                    formatProgressAxisValue(progress.primaryMetric.key, value)
                  }
                  width={48}
                />

                {progress.secondaryMetric ? (
                  <YAxis
                    yAxisId="secondary"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgb(163 163 163)", fontSize: 11 }}
                    tickFormatter={(value: number) =>
                      formatProgressAxisValue(progress.secondaryMetric!.key, value)
                    }
                    width={48}
                  />
                ) : null}

                <Tooltip
                  content={<ProgressTooltip progress={progress} />}
                />

                <Area
                  yAxisId="primary"
                  type="monotone"
                  dataKey="primary"
                  stroke="var(--walls-sky)"
                  strokeWidth={2.5}
                  fill="url(#adpilotProgressGrad)"
                  name="primary"
                  activeDot={{
                    r: 5,
                    fill: "var(--walls-white)",
                    stroke: "var(--walls-sky)",
                    strokeWidth: 2.5,
                  }}
                />

                {progress.secondaryMetric ? (
                  <Line
                    yAxisId="secondary"
                    type="monotone"
                    dataKey="secondary"
                    stroke="var(--walls-yellow)"
                    strokeWidth={2}
                    dot={false}
                    name="secondary"
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </DetailSection>
  );
}
