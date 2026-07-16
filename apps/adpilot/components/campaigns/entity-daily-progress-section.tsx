"use client";

import type { ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { EntityDailyProgress } from "@/lib/entity-daily-progress";
import {
  formatCpaFromMicros,
  formatProfitMicros,
  formatProgressAxisValue,
  formatProgressTooltipValue,
} from "@/lib/entity-daily-progress";
import { formatFrequency, formatRoas } from "@/lib/format-analytics";
import {
  getProgressMetricColor,
  isCurrencyProgressMetric,
  type ObjectiveProgressMetricKey,
} from "@/lib/meta-objectives";

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

function MetricTooltipValue({
  metricKey,
  children,
}: {
  metricKey: ObjectiveProgressMetricKey;
  children: ReactNode;
}) {
  return (
    <span className="font-medium" style={{ color: getProgressMetricColor(metricKey) }}>
      {children}
    </span>
  );
}

function ProgressTooltip({
  active,
  label,
  payload,
  progress,
}: ProgressTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  const showSalesExtras =
    progress.objectiveBucket === "OUTCOME_SALES" ||
    progress.primaryMetric.key === "earnings" ||
    progress.secondaryMetric?.key === "earnings";
  const profitMicros = point.conversionValueMicros - point.spendMicros;
  const spend = point.spendMicros / 1_000_000;
  const roas =
    spend > 0 ? point.conversionValueMicros / 1_000_000 / spend : null;

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 shadow-lg">
      <p className="mb-2 text-xs font-light text-neutral-300">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="font-light text-neutral-400">
            {progress.primaryMetric.label}
          </span>
          <MetricTooltipValue metricKey={progress.primaryMetric.key}>
            {formatProgressTooltipValue(progress.primaryMetric.key, point.primary)}
          </MetricTooltipValue>
        </div>
        {progress.secondaryMetric && point.secondary != null ? (
          <div className="flex items-center justify-between gap-6 text-xs">
            <span className="font-light text-neutral-400">
              {progress.secondaryMetric.label}
            </span>
            <MetricTooltipValue metricKey={progress.secondaryMetric.key}>
              {formatProgressTooltipValue(
                progress.secondaryMetric.key,
                point.secondary,
              )}
            </MetricTooltipValue>
          </div>
        ) : null}
        {point.frequency != null ? (
          <div className="flex items-center justify-between gap-6 text-xs">
            <span className="font-light text-neutral-400">Frequency</span>
            <span className="font-medium text-neutral-100">
              {formatFrequency(point.frequency)}
            </span>
          </div>
        ) : null}
        {showSalesExtras ? (
          <>
            <div className="flex items-center justify-between gap-6 text-xs">
              <span className="font-light text-neutral-400">ROAS</span>
              <span className="font-medium text-neutral-100">
                {formatRoas(roas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6 text-xs">
              <span className="font-light text-neutral-400">CPA</span>
              <span className="font-medium text-neutral-100">
                {formatCpaFromMicros(point.spendMicros, point.websitePurchases)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6 border-t border-neutral-700 pt-1.5 text-xs">
              <span className="font-light text-neutral-400">Profit</span>
              <span className="font-medium text-neutral-100">
                {formatProfitMicros(profitMicros)}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ChartLegend({ progress }: { progress: EntityDailyProgress }) {
  const items = [
    progress.primaryMetric,
    ...(progress.secondaryMetric ? [progress.secondaryMetric] : []),
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-light uppercase tracking-wider text-neutral-400">
      {items.map((metric) => (
        <span key={metric.key} className="inline-flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: getProgressMetricColor(metric.key) }}
          />
          {metric.label}
        </span>
      ))}
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

  const primaryColor = getProgressMetricColor(progress.primaryMetric.key);
  const secondaryColor = progress.secondaryMetric
    ? getProgressMetricColor(progress.secondaryMetric.key)
    : null;
  const shareDollarAxis =
    progress.secondaryMetric != null &&
    isCurrencyProgressMetric(progress.primaryMetric.key) &&
    isCurrencyProgressMetric(progress.secondaryMetric.key);
  const hasSecondaryAxis =
    progress.secondaryMetric != null && !shareDollarAxis;

  return (
    <DetailSection title="Daily progress">
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
          <div>
            <ChartLegend progress={progress} />
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{
                    top: 8,
                    right: hasSecondaryAxis ? 48 : 24,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="adpilotProgressPrimaryGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={primaryColor} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
                    </linearGradient>
                    {secondaryColor ? (
                      <linearGradient
                        id="adpilotProgressSecondaryGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={secondaryColor}
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor={secondaryColor}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    ) : null}
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

                  {hasSecondaryAxis && progress.secondaryMetric ? (
                    <YAxis
                      yAxisId="secondary"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgb(163 163 163)", fontSize: 11 }}
                      tickFormatter={(value: number) =>
                        formatProgressAxisValue(
                          progress.secondaryMetric!.key,
                          value,
                        )
                      }
                      width={48}
                    />
                  ) : null}

                  <Tooltip content={<ProgressTooltip progress={progress} />} />

                  {progress.secondaryMetric && secondaryColor ? (
                    <Area
                      yAxisId={shareDollarAxis ? "primary" : "secondary"}
                      type="monotone"
                      dataKey="secondary"
                      stroke={secondaryColor}
                      strokeWidth={2}
                      fill="url(#adpilotProgressSecondaryGrad)"
                      name={progress.secondaryMetric.label}
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: "var(--kenoo-white)",
                        stroke: secondaryColor,
                        strokeWidth: 2,
                      }}
                    />
                  ) : null}

                  <Area
                    yAxisId="primary"
                    type="monotone"
                    dataKey="primary"
                    stroke={primaryColor}
                    strokeWidth={2.5}
                    fill="url(#adpilotProgressPrimaryGrad)"
                    name={progress.primaryMetric.label}
                    activeDot={{
                      r: 5,
                      fill: "var(--kenoo-white)",
                      stroke: primaryColor,
                      strokeWidth: 2.5,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </DetailSection>
  );
}
