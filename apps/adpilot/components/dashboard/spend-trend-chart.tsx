"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@walls/utils";

import type { DashboardSpendDay } from "@/lib/analytics-server";
import {
  formatCpaFromMicros,
  formatProfitMicros,
} from "@/lib/entity-daily-progress";
import {
  formatCompactNumber,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";
import { PREVIEW_SPEND_BY_DAY } from "@/lib/dashboard-defaults";

import { panelGlassClass } from "./dashboard-metrics";

type SpendTrendChartProps = {
  days: DashboardSpendDay[];
};

function formatDollars(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatDollarAxis(value: number) {
  return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${Math.round(value)}`;
}

function formatImpressionAxis(value: number) {
  return formatCompactNumber(value);
}

type TrendTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: DashboardSpendDay }>;
};

function TrendTooltip({ active, label, payload }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  const profitMicros = point.purchaseValueMicros - point.spendMicros;

  return (
    <div className="rounded-lg border border-neutral-500/80 bg-neutral-700 px-3 py-2.5 shadow-lg">
      <p className="mb-2 text-xs font-light text-neutral-300">{label}</p>
      <div className="space-y-1">
        <TooltipRow label="Spend" value={formatDollars(point.spend)} accent="sky" />
        <TooltipRow
          label="Purchase value"
          value={formatDollars(point.purchaseValue)}
          accent="yellow"
        />
        <TooltipRow
          label="Impressions"
          value={formatCompactNumber(point.impressions)}
        />
        <TooltipRow label="CTR" value={formatPercent(point.ctr)} />
        <TooltipRow label="ROAS" value={formatRoas(point.roas)} />
        <TooltipRow
          label="CPA"
          value={formatCpaFromMicros(point.spendMicros, point.websitePurchases)}
        />
        <div className="border-t border-neutral-500/80 pt-1.5">
          <TooltipRow label="Profit" value={formatProfitMicros(profitMicros)} />
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sky" | "yellow";
}) {
  return (
    <div className="flex items-center justify-between gap-6 text-xs">
      <span className="font-light text-neutral-400">{label}</span>
      <span
        className={
          accent === "sky"
            ? "font-medium text-[var(--kenoo-sky)]"
            : accent === "yellow"
              ? "font-medium text-[var(--kenoo-yellow)]"
              : "font-medium text-neutral-100"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function SpendTrendChart({ days }: SpendTrendChartProps) {
  const hasLiveData = days.some((day) => day.spendMicros > 0);
  const chartData = hasLiveData ? days : PREVIEW_SPEND_BY_DAY;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
        panelGlassClass,
      )}
    >
      {!hasLiveData ? (
        <div className="pointer-events-none absolute right-4 top-4 z-10 md:right-6 md:top-5">
          <span className="rounded-full border border-neutral-200/80 bg-white/90 px-2.5 py-0.5 text-[10px] font-light uppercase tracking-wider text-neutral-500 shadow-sm">
            Preview
          </span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-light uppercase tracking-wider text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[var(--kenoo-sky)]" />
          Spend
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[var(--kenoo-yellow)]" />
          Purchase value
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[var(--kenoo-blue)]" />
          Impressions
        </span>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 48, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="adpilotSpendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--kenoo-sky)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--kenoo-sky)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="adpilotPurchaseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--kenoo-yellow)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--kenoo-yellow)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="adpilotImpressionsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--kenoo-blue)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--kenoo-blue)" stopOpacity={0} />
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
              yAxisId="dollars"
              orientation="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
              tickFormatter={formatDollarAxis}
              width={48}
            />

            <YAxis
              yAxisId="impressions"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgb(163 163 163)", fontSize: 11 }}
              tickFormatter={formatImpressionAxis}
              width={48}
            />

            <Tooltip content={<TrendTooltip />} />

            <Area
              yAxisId="impressions"
              type="monotone"
              dataKey="impressions"
              stroke="var(--kenoo-blue)"
              strokeWidth={2}
              fill="url(#adpilotImpressionsGrad)"
              name="Impressions"
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--kenoo-white)",
                stroke: "var(--kenoo-blue)",
                strokeWidth: 2,
              }}
            />

            <Area
              yAxisId="dollars"
              type="monotone"
              dataKey="purchaseValue"
              stroke="var(--kenoo-yellow)"
              strokeWidth={2}
              fill="url(#adpilotPurchaseGrad)"
              name="Purchase value"
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--kenoo-white)",
                stroke: "var(--kenoo-yellow)",
                strokeWidth: 2,
              }}
            />

            <Area
              yAxisId="dollars"
              type="monotone"
              dataKey="spend"
              stroke="var(--kenoo-sky)"
              strokeWidth={2.5}
              fill="url(#adpilotSpendGrad)"
              name="Spend"
              activeDot={{
                r: 5,
                fill: "var(--kenoo-white)",
                stroke: "var(--kenoo-sky)",
                strokeWidth: 2.5,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
