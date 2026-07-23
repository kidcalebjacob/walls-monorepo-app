/** Shared budget period / objective types & constants (safe for client). */

export const BUDGET_PERIOD_TYPES = [
  "quarter",
  "month",
  "year",
  "custom",
  "ongoing",
] as const;

export type BudgetPeriodType = (typeof BUDGET_PERIOD_TYPES)[number];

export const BUDGET_OBJECTIVE_METRICS = [
  "roas",
  "ctr",
  "cpa",
  "cpc",
  "conversions",
  "conversion_rate",
  "reach",
  "impressions",
  "frequency",
  "cpm",
  "brand_recognition",
  "awareness",
  "engagement",
  "custom",
] as const;

export type BudgetObjectiveMetric = (typeof BUDGET_OBJECTIVE_METRICS)[number];

export const BUDGET_TARGET_OPERATORS = ["gte", "lte", "eq"] as const;

export type BudgetTargetOperator = (typeof BUDGET_TARGET_OPERATORS)[number];

export const BUDGET_OBJECTIVE_STATUSES = [
  "active",
  "achieved",
  "missed",
  "cancelled",
] as const;

export type BudgetObjectiveStatus = (typeof BUDGET_OBJECTIVE_STATUSES)[number];

export type BudgetObjective = {
  id: string;
  periodId: string;
  name: string;
  metricKey: BudgetObjectiveMetric;
  customMetricLabel: string | null;
  targetValue: number;
  targetOperator: BudgetTargetOperator;
  targetUnit: string | null;
  isPrimary: boolean;
  priority: number;
  status: BudgetObjectiveStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type BudgetPeriod = {
  id: string;
  name: string;
  description: string | null;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string | null;
  currency: string;
  /** Period-level planned budget in micros (1 unit = 1,000,000). */
  budgetAmountMicros: number;
  /** Actual ad spend in the period window from ad_metrics_daily (account entities). */
  spentMicros: number;
  primaryFocus: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** True when today falls within the period date window. */
  isCurrentlyEffective: boolean;
  objectives: BudgetObjective[];
};

export const PERIOD_TYPE_OPTIONS: Array<{
  value: BudgetPeriodType;
  label: string;
  hint: string;
}> = [
  { value: "quarter", label: "Quarter", hint: "Fiscal or calendar quarter" },
  { value: "month", label: "Month", hint: "Single calendar month" },
  { value: "year", label: "Year", hint: "Fiscal or calendar year" },
  {
    value: "ongoing",
    label: "Ongoing",
    hint: "No end date — stays in effect until deleted",
  },
];

/** End date for a period type, derived from the start date. */
export function computePeriodEndDate(
  startDate: Date | null,
  periodType: BudgetPeriodType,
): Date | null {
  if (!startDate || Number.isNaN(startDate.getTime())) return null;
  if (periodType === "ongoing") return null;

  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  if (periodType === "month") {
    return new Date(year, month + 1, 0);
  }
  if (periodType === "quarter") {
    const quarterEndMonth = Math.floor(month / 3) * 3 + 3;
    return new Date(year, quarterEndMonth, 0);
  }
  if (periodType === "year") {
    return new Date(year, 12, 0);
  }

  // Legacy "custom" (and any unknown type): leave end unset for the caller.
  return null;
}

export function periodTypeLabel(periodType: BudgetPeriodType): string {
  return (
    PERIOD_TYPE_OPTIONS.find((t) => t.value === periodType)?.label ??
    (periodType === "custom" ? "Custom" : periodType)
  );
}

export const OBJECTIVE_METRIC_OPTIONS: Array<{
  value: BudgetObjectiveMetric;
  label: string;
  defaultUnit: string | null;
  defaultOperator: BudgetTargetOperator;
}> = [
  { value: "roas", label: "ROAS", defaultUnit: "x", defaultOperator: "gte" },
  { value: "ctr", label: "CTR", defaultUnit: "%", defaultOperator: "gte" },
  { value: "cpa", label: "CPA", defaultUnit: "$", defaultOperator: "lte" },
  { value: "cpc", label: "CPC", defaultUnit: "$", defaultOperator: "lte" },
  {
    value: "conversions",
    label: "Conversions",
    defaultUnit: null,
    defaultOperator: "gte",
  },
  {
    value: "conversion_rate",
    label: "Conversion rate",
    defaultUnit: "%",
    defaultOperator: "gte",
  },
  { value: "reach", label: "Reach", defaultUnit: null, defaultOperator: "gte" },
  {
    value: "impressions",
    label: "Impressions",
    defaultUnit: null,
    defaultOperator: "gte",
  },
  {
    value: "frequency",
    label: "Frequency",
    defaultUnit: null,
    defaultOperator: "lte",
  },
  { value: "cpm", label: "CPM", defaultUnit: "$", defaultOperator: "lte" },
  {
    value: "brand_recognition",
    label: "Brand recognition",
    defaultUnit: "%",
    defaultOperator: "gte",
  },
  {
    value: "awareness",
    label: "Awareness",
    defaultUnit: "%",
    defaultOperator: "gte",
  },
  {
    value: "engagement",
    label: "Engagement",
    defaultUnit: "%",
    defaultOperator: "gte",
  },
  {
    value: "custom",
    label: "Custom metric",
    defaultUnit: null,
    defaultOperator: "gte",
  },
];

/** Period primary focus choices (stored in ad_budget_periods.primary_focus). */
export const PRIMARY_FOCUS_OPTIONS: Array<{ value: string; label: string }> =
  OBJECTIVE_METRIC_OPTIONS.filter((m) => m.value !== "custom").map((m) => ({
    value: m.label,
    label: m.label,
  }));

export const TARGET_OPERATOR_OPTIONS: Array<{
  value: BudgetTargetOperator;
  label: string;
  symbol: string;
}> = [
  { value: "gte", label: "At least", symbol: "≥" },
  { value: "lte", label: "At most", symbol: "≤" },
  { value: "eq", label: "Exactly", symbol: "=" },
];

export const MICROS_PER_UNIT = 1_000_000;

export function dollarsToMicros(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars < 0) return 0;
  return Math.round(dollars * MICROS_PER_UNIT);
}

export function microsToDollars(micros: number): number {
  if (!Number.isFinite(micros)) return 0;
  return micros / MICROS_PER_UNIT;
}

export function formatBudgetCurrency(
  micros: number,
  currency = "USD",
  options?: { compact?: boolean },
): string {
  const amount = microsToDollars(micros);
  if (options?.compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatPeriodRange(
  startDate: string,
  endDate: string | null,
): string {
  const start = formatIsoDate(startDate);
  if (!endDate) return `${start} → ongoing`;
  return `${start} → ${formatIsoDate(endDate)}`;
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatObjectiveTarget(objective: {
  targetOperator: BudgetTargetOperator;
  targetValue: number;
  targetUnit: string | null;
  metricKey: BudgetObjectiveMetric;
  customMetricLabel: string | null;
}): string {
  const op =
    TARGET_OPERATOR_OPTIONS.find((o) => o.value === objective.targetOperator)
      ?.symbol ?? "≥";
  const unit = objective.targetUnit ?? "";
  const value =
    unit === "%" || unit === "x"
      ? `${formatNumber(objective.targetValue)}${unit}`
      : unit === "$"
        ? `$${formatNumber(objective.targetValue)}`
        : `${formatNumber(objective.targetValue)}${unit ? ` ${unit}` : ""}`;
  return `${op} ${value}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function metricLabel(
  metricKey: BudgetObjectiveMetric,
  customMetricLabel: string | null,
): string {
  if (metricKey === "custom") {
    return customMetricLabel?.trim() || "Custom metric";
  }
  return (
    OBJECTIVE_METRIC_OPTIONS.find((m) => m.value === metricKey)?.label ??
    metricKey
  );
}

export function isPeriodCurrentlyEffective(input: {
  startDate: string;
  endDate: string | null;
  today?: string;
}): boolean {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (input.startDate > today) return false;
  if (input.endDate && input.endDate < today) return false;
  return true;
}

/** Fraction of planned budget already spent (0–1+, can exceed 1 when over budget). */
export function budgetUsedRatio(budgetAmountMicros: number, spentMicros: number): number {
  if (!Number.isFinite(budgetAmountMicros) || budgetAmountMicros <= 0) return 0;
  if (!Number.isFinite(spentMicros) || spentMicros <= 0) return 0;
  return spentMicros / budgetAmountMicros;
}

export function formatBudgetUsedPercent(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0%";
  const pct = ratio * 100;
  return `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}
