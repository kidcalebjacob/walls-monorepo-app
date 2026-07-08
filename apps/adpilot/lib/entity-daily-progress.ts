import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";
import {
  getObjectiveBucketLabel,
  getObjectiveProgressConfig,
  type DashboardObjectiveBucket,
  type ObjectiveProgressMetric,
  type ObjectiveProgressMetricKey,
} from "@/lib/meta-objectives";

export type DailyMetricRow = {
  metric_date: string;
  spend_micros: number | null;
  impressions: number | null;
  clicks: number | null;
  conversion_value_micros: number | null;
  website_purchases: number | null;
};

export type EntityDailyProgressPoint = {
  date: string;
  label: string;
  primaryValue: number;
  secondaryValue: number | null;
  spendMicros: number;
  impressions: number;
  clicks: number;
  conversionValueMicros: number;
  websitePurchases: number;
};

export type EntityDailyProgressSummary = {
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string | null;
  secondaryValue: string | null;
  profitLabel: string | null;
  profitValue: string | null;
  profitMicros: number | null;
};

export type EntityDailyProgress = {
  periodLabel: string;
  objectiveBucket: DashboardObjectiveBucket | null;
  objectiveLabel: string;
  primaryMetric: ObjectiveProgressMetric;
  secondaryMetric: ObjectiveProgressMetric | null;
  days: EntityDailyProgressPoint[];
  summary: EntityDailyProgressSummary;
};

type DayTotals = {
  spendMicros: number;
  impressions: number;
  clicks: number;
  conversionValueMicros: number;
  websitePurchases: number;
};

function buildDateRange(rangeDays: number): string[] {
  const dates: string[] = [];
  const end = new Date();

  for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function aggregateRowsByDate(rows: DailyMetricRow[]): Map<string, DayTotals> {
  const byDate = new Map<string, DayTotals>();

  for (const row of rows) {
    const existing = byDate.get(row.metric_date) ?? {
      spendMicros: 0,
      impressions: 0,
      clicks: 0,
      conversionValueMicros: 0,
      websitePurchases: 0,
    };

    byDate.set(row.metric_date, {
      spendMicros: existing.spendMicros + (row.spend_micros ?? 0),
      impressions: existing.impressions + (row.impressions ?? 0),
      clicks: existing.clicks + (row.clicks ?? 0),
      conversionValueMicros:
        existing.conversionValueMicros + (row.conversion_value_micros ?? 0),
      websitePurchases:
        existing.websitePurchases + Number(row.website_purchases ?? 0),
    });
  }

  return byDate;
}

function getMetricValue(totals: DayTotals, key: ObjectiveProgressMetricKey): number {
  const spend = totals.spendMicros / 1_000_000;

  switch (key) {
    case "spend":
      return spend;
    case "impressions":
      return totals.impressions;
    case "clicks":
      return totals.clicks;
    case "ctr":
      return totals.impressions > 0
        ? (totals.clicks / totals.impressions) * 100
        : 0;
    case "roas":
      return spend > 0 ? totals.conversionValueMicros / 1_000_000 / spend : 0;
  }
}

function formatMetricValue(
  key: ObjectiveProgressMetricKey,
  value: number,
): string {
  switch (key) {
    case "spend":
      return formatCurrencyFromMicros(Math.round(value * 1_000_000));
    case "impressions":
    case "clicks":
      return formatCompactNumber(value);
    case "ctr":
      return formatPercent(value);
    case "roas":
      return formatRoas(value > 0 ? value : null);
  }
}

/**
 * Conversion value minus ad spend, in accounting style: positive shows the
 * plain amount, negative is wrapped in brackets e.g. ($12,934).
 */
export function formatProfitMicros(profitMicros: number): string {
  const amount = formatCurrencyFromMicros(Math.abs(profitMicros));
  return profitMicros < 0 ? `(${amount})` : amount;
}

function summarizePeriod(
  days: EntityDailyProgressPoint[],
  primary: ObjectiveProgressMetric,
  secondary: ObjectiveProgressMetric | null,
): EntityDailyProgressSummary {
  const totals = days.reduce(
    (acc, day) => ({
      spendMicros: acc.spendMicros + day.spendMicros,
      impressions: acc.impressions + day.impressions,
      clicks: acc.clicks + day.clicks,
      conversionValueMicros: acc.conversionValueMicros + day.conversionValueMicros,
    }),
    {
      spendMicros: 0,
      impressions: 0,
      clicks: 0,
      conversionValueMicros: 0,
    },
  );

  const primaryValue = getMetricValue(totals, primary.key);
  const secondaryValue = secondary ? getMetricValue(totals, secondary.key) : null;
  const profitMicros =
    primary.key === "roas"
      ? totals.conversionValueMicros - totals.spendMicros
      : null;

  return {
    primaryLabel: `Period ${primary.key === "roas" || primary.key === "ctr" ? "avg" : "total"} ${primary.label}`,
    primaryValue: formatMetricValue(primary.key, primaryValue),
    secondaryLabel: secondary
      ? `Period ${secondary.key === "roas" || secondary.key === "ctr" ? "avg" : "total"} ${secondary.label}`
      : null,
    secondaryValue:
      secondary != null && secondaryValue != null
        ? formatMetricValue(secondary.key, secondaryValue)
        : null,
    profitLabel: profitMicros != null ? "Period total Profit" : null,
    profitValue:
      profitMicros != null ? formatProfitMicros(profitMicros) : null,
    profitMicros,
  };
}

export function buildEntityDailyProgress(
  rows: DailyMetricRow[],
  objectiveBucket: DashboardObjectiveBucket | null,
  rangeDays = 30,
): EntityDailyProgress {
  const { primary, secondary } = getObjectiveProgressConfig(objectiveBucket);
  const byDate = aggregateRowsByDate(rows);
  const dates = buildDateRange(rangeDays);

  const days: EntityDailyProgressPoint[] = dates.map((date) => {
    const totals = byDate.get(date) ?? {
      spendMicros: 0,
      impressions: 0,
      clicks: 0,
      conversionValueMicros: 0,
      websitePurchases: 0,
    };

    return {
      date,
      label: formatDateLabel(date),
      primaryValue: getMetricValue(totals, primary.key),
      secondaryValue: secondary ? getMetricValue(totals, secondary.key) : null,
      spendMicros: totals.spendMicros,
      impressions: totals.impressions,
      clicks: totals.clicks,
      conversionValueMicros: totals.conversionValueMicros,
      websitePurchases: totals.websitePurchases,
    };
  });

  return {
    periodLabel: `Last ${rangeDays} days`,
    objectiveBucket,
    objectiveLabel: objectiveBucket
      ? getObjectiveBucketLabel(objectiveBucket)
      : "Performance",
    primaryMetric: primary,
    secondaryMetric: secondary,
    days,
    summary: summarizePeriod(days, primary, secondary),
  };
}

export function formatProgressAxisValue(
  key: ObjectiveProgressMetricKey,
  value: number,
): string {
  switch (key) {
    case "spend":
      return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${Math.round(value)}`;
    case "impressions":
    case "clicks":
      return formatCompactNumber(value);
    case "ctr":
      return `${value.toFixed(1)}%`;
    case "roas":
      return `${value.toFixed(1)}x`;
  }
}

export function formatProgressTooltipValue(
  key: ObjectiveProgressMetricKey,
  value: number,
): string {
  return formatMetricValue(key, value);
}
