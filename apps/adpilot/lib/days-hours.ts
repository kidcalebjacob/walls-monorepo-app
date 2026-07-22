import {
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";

export const DAYS_HOURS_METRICS = ["roas", "ctr", "spend", "cpc"] as const;
export type DaysHoursMetric = (typeof DAYS_HOURS_METRICS)[number];

export const DAYS_HOURS_METRIC_OPTIONS: Array<{
  value: DaysHoursMetric;
  label: string;
}> = [
  { value: "roas", label: "ROAS" },
  { value: "ctr", label: "CTR" },
  { value: "spend", label: "Spend" },
  { value: "cpc", label: "CPC" },
];

/** Postgres EXTRACT(DOW): 0=Sunday … 6=Saturday. Display order Mon→Sun. */
export const DOW_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const DOW_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export type DaysHoursCellTotals = {
  dayOfWeek: number;
  hour: number;
  impressions: number;
  clicks: number;
  spendMicros: number;
  conversionValueMicros: number;
};

export type DaysHoursAnalytics = {
  hasData: boolean;
  cells: DaysHoursCellTotals[];
};

export type MetricTotals = {
  impressions: number;
  clicks: number;
  spendMicros: number;
  conversionValueMicros: number;
};

export function emptyMetricTotals(): MetricTotals {
  return {
    impressions: 0,
    clicks: 0,
    spendMicros: 0,
    conversionValueMicros: 0,
  };
}

export function addMetricTotals(a: MetricTotals, b: MetricTotals): MetricTotals {
  return {
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    spendMicros: a.spendMicros + b.spendMicros,
    conversionValueMicros: a.conversionValueMicros + b.conversionValueMicros,
  };
}

export function metricValueFromTotals(
  totals: MetricTotals,
  metric: DaysHoursMetric,
): number | null {
  const spend = totals.spendMicros / 1_000_000;
  switch (metric) {
    case "roas":
      return spend > 0 ? totals.conversionValueMicros / 1_000_000 / spend : null;
    case "ctr":
      return totals.impressions > 0
        ? (totals.clicks / totals.impressions) * 100
        : null;
    case "spend":
      return spend > 0 ? spend : null;
    case "cpc":
      return totals.clicks > 0 ? spend / totals.clicks : null;
    default:
      return null;
  }
}

export function formatDaysHoursMetricValue(
  value: number | null,
  metric: DaysHoursMetric,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (metric) {
    case "roas":
      return formatRoas(value);
    case "ctr":
      return formatPercent(value);
    case "spend":
    case "cpc":
      return formatCurrencyFromMicros(Math.round(value * 1_000_000));
    default:
      return "—";
  }
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
