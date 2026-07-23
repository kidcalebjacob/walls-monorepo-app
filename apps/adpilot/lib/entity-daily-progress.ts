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
  reach: number | null;
  frequency: number | null;
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
  reach: number;
  frequency: number | null;
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
  reach: number;
  frequencySum: number;
  frequencyCount: number;
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
      reach: 0,
      frequencySum: 0,
      frequencyCount: 0,
    };

    const rowFrequency = row.frequency != null ? Number(row.frequency) : null;

    byDate.set(row.metric_date, {
      spendMicros: existing.spendMicros + (row.spend_micros ?? 0),
      impressions: existing.impressions + (row.impressions ?? 0),
      clicks: existing.clicks + (row.clicks ?? 0),
      conversionValueMicros:
        existing.conversionValueMicros + (row.conversion_value_micros ?? 0),
      websitePurchases:
        existing.websitePurchases + Number(row.website_purchases ?? 0),
      reach: existing.reach + (row.reach ?? 0),
      frequencySum:
        existing.frequencySum +
        (rowFrequency != null && Number.isFinite(rowFrequency)
          ? rowFrequency
          : 0),
      frequencyCount:
        existing.frequencyCount +
        (rowFrequency != null && Number.isFinite(rowFrequency) ? 1 : 0),
    });
  }

  return byDate;
}

/**
 * Frequency is impressions per person reached. When aggregating multiple rows
 * for a day we recompute it from total impressions / total reach; if reach is
 * missing we fall back to averaging the stored frequency values.
 */
function getFrequencyValue(totals: DayTotals): number | null {
  if (totals.reach > 0) {
    return totals.impressions / totals.reach;
  }
  if (totals.frequencyCount > 0) {
    return totals.frequencySum / totals.frequencyCount;
  }
  return null;
}

function getMetricValue(totals: DayTotals, key: ObjectiveProgressMetricKey): number {
  const spend = totals.spendMicros / 1_000_000;

  switch (key) {
    case "spend":
      return spend;
    case "earnings":
      return totals.conversionValueMicros / 1_000_000;
    case "impressions":
      return totals.impressions;
    case "reach":
      return totals.reach;
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
    case "earnings":
      return formatCurrencyFromMicros(Math.round(value * 1_000_000));
    case "impressions":
    case "reach":
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

/** Cost per acquisition for a day: spend divided by website purchases. */
export function formatCpaFromMicros(
  spendMicros: number,
  purchases: number,
): string {
  if (!Number.isFinite(purchases) || purchases <= 0) return "-";
  return formatCurrencyFromMicros(Math.round(spendMicros / purchases));
}

function summarizePeriod(
  days: EntityDailyProgressPoint[],
  primary: ObjectiveProgressMetric,
  secondary: ObjectiveProgressMetric | null,
): EntityDailyProgressSummary {
  const totals: DayTotals = days.reduce<DayTotals>(
    (acc, day) => ({
      spendMicros: acc.spendMicros + day.spendMicros,
      impressions: acc.impressions + day.impressions,
      clicks: acc.clicks + day.clicks,
      conversionValueMicros: acc.conversionValueMicros + day.conversionValueMicros,
      websitePurchases: acc.websitePurchases + day.websitePurchases,
      reach: acc.reach + day.reach,
      frequencySum: acc.frequencySum,
      frequencyCount: acc.frequencyCount,
    }),
    {
      spendMicros: 0,
      impressions: 0,
      clicks: 0,
      conversionValueMicros: 0,
      websitePurchases: 0,
      reach: 0,
      frequencySum: 0,
      frequencyCount: 0,
    },
  );

  const primaryValue = getMetricValue(totals, primary.key);
  const secondaryValue = secondary ? getMetricValue(totals, secondary.key) : null;
  const tracksEarnings =
    primary.key === "earnings" ||
    secondary?.key === "earnings" ||
    primary.key === "roas";
  const profitMicros = tracksEarnings
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
      reach: 0,
      frequencySum: 0,
      frequencyCount: 0,
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
      reach: totals.reach,
      frequency: getFrequencyValue(totals),
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
    case "earnings":
      return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${Math.round(value)}`;
    case "impressions":
    case "reach":
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
