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
  priority: number;
  status: BudgetObjectiveStatus;
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
  /** Account-level ad metric actuals for the period window (null = not measurable). */
  metricActuals: PeriodMetricActuals;
  objectives: BudgetObjective[];
};

/** Trackable performance numbers for a budget period (account rollup). */
export type PeriodMetricActuals = {
  roas: number | null;
  ctr: number | null;
  cpa: number | null;
  cpc: number | null;
  conversions: number | null;
  conversion_rate: number | null;
  reach: number | null;
  impressions: number | null;
  frequency: number | null;
  cpm: number | null;
};

export const EMPTY_PERIOD_METRIC_ACTUALS: PeriodMetricActuals = {
  roas: null,
  ctr: null,
  cpa: null,
  cpc: null,
  conversions: null,
  conversion_rate: null,
  reach: null,
  impressions: null,
  frequency: null,
  cpm: null,
};

export function objectiveActualValue(
  metricKey: BudgetObjectiveMetric,
  actuals: PeriodMetricActuals,
): number | null {
  switch (metricKey) {
    case "roas":
      return actuals.roas;
    case "ctr":
      return actuals.ctr;
    case "cpa":
      return actuals.cpa;
    case "cpc":
      return actuals.cpc;
    case "conversions":
      return actuals.conversions;
    case "conversion_rate":
      return actuals.conversion_rate;
    case "reach":
      return actuals.reach;
    case "impressions":
      return actuals.impressions;
    case "frequency":
      return actuals.frequency;
    case "cpm":
      return actuals.cpm;
    default:
      return null;
  }
}

/** Whether the actual meets the objective target. */
export function isObjectiveOnTrack(
  operator: BudgetTargetOperator,
  target: number,
  actual: number | null,
): boolean | null {
  if (actual == null || !Number.isFinite(actual) || !Number.isFinite(target)) {
    return null;
  }
  if (operator === "gte") return actual >= target;
  if (operator === "lte") return actual <= target;
  return Math.abs(actual - target) / Math.max(Math.abs(target), 1e-9) <= 0.05;
}

/** How far the actual sits above/below the numeric target (unit-aware). */
export function formatObjectiveVsTarget(
  target: number,
  actual: number,
  unit: string | null,
): string {
  if (!Number.isFinite(actual) || !Number.isFinite(target)) return "";
  const delta = actual - target;
  if (Math.abs(delta) < 1e-9) return "At target";

  const sign = delta > 0 ? "+" : "−";
  const magnitude = formatMetricTargetAmount(Math.abs(delta), unit);
  const direction = delta > 0 ? "above" : "below";
  return `${sign}${magnitude} ${direction}`;
}

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

export const OBJECTIVE_TARGET_TIERS = ["good", "great", "excellent"] as const;

export type ObjectiveTargetTier = (typeof OBJECTIVE_TARGET_TIERS)[number];

export type ObjectiveTargetTiers = Record<ObjectiveTargetTier, number>;

export const OBJECTIVE_TARGET_TIER_LABELS: Record<ObjectiveTargetTier, string> =
  {
    good: "Good",
    great: "Great",
    excellent: "Excellent",
  };

/**
 * Good / Great / Excellent baselines for Meta/digital ads.
 * For ≤ metrics (CPA, CPC, CPM, frequency), Excellent is the strictest (lowest) number.
 */
export const OBJECTIVE_METRIC_OPTIONS: Array<{
  value: BudgetObjectiveMetric;
  label: string;
  defaultUnit: string | null;
  defaultOperator: BudgetTargetOperator;
  /** Tiered starter targets; null for custom metrics. */
  targetTiers: ObjectiveTargetTiers | null;
}> = [
  {
    value: "roas",
    label: "ROAS",
    defaultUnit: "x",
    defaultOperator: "gte",
    targetTiers: { good: 2.5, great: 3.5, excellent: 5 },
  },
  {
    value: "ctr",
    label: "CTR",
    defaultUnit: "%",
    defaultOperator: "gte",
    targetTiers: { good: 1, great: 1.5, excellent: 2.5 },
  },
  {
    value: "cpa",
    label: "CPA",
    defaultUnit: "$",
    defaultOperator: "lte",
    targetTiers: { good: 50, great: 35, excellent: 20 },
  },
  {
    value: "cpc",
    label: "CPC",
    defaultUnit: "$",
    defaultOperator: "lte",
    targetTiers: { good: 2, great: 1.5, excellent: 0.8 },
  },
  {
    value: "conversions",
    label: "Conversions",
    defaultUnit: null,
    defaultOperator: "gte",
    targetTiers: { good: 25, great: 50, excellent: 100 },
  },
  {
    value: "conversion_rate",
    label: "Conversion rate",
    defaultUnit: "%",
    defaultOperator: "gte",
    targetTiers: { good: 1.5, great: 2.5, excellent: 4 },
  },
  {
    value: "reach",
    label: "Reach",
    defaultUnit: "people",
    defaultOperator: "gte",
    targetTiers: { good: 5000, great: 10000, excellent: 25000 },
  },
  {
    value: "impressions",
    label: "Impressions",
    defaultUnit: null,
    defaultOperator: "gte",
    targetTiers: { good: 25000, great: 50000, excellent: 100000 },
  },
  {
    value: "frequency",
    label: "Frequency",
    defaultUnit: null,
    defaultOperator: "lte",
    targetTiers: { good: 3, great: 2.5, excellent: 2 },
  },
  {
    value: "cpm",
    label: "CPM",
    defaultUnit: "$",
    defaultOperator: "lte",
    targetTiers: { good: 18, great: 12, excellent: 8 },
  },
  {
    value: "brand_recognition",
    label: "Brand recognition",
    defaultUnit: "%",
    defaultOperator: "gte",
    targetTiers: { good: 10, great: 15, excellent: 25 },
  },
  {
    value: "awareness",
    label: "Awareness",
    defaultUnit: "%",
    defaultOperator: "gte",
    targetTiers: { good: 15, great: 20, excellent: 30 },
  },
  {
    value: "engagement",
    label: "Engagement",
    defaultUnit: "%",
    defaultOperator: "gte",
    targetTiers: { good: 1, great: 2, excellent: 3.5 },
  },
  {
    value: "custom",
    label: "Custom metric",
    defaultUnit: null,
    defaultOperator: "gte",
    targetTiers: null,
  },
];

export function metricObjectiveDefaults(metricKey: BudgetObjectiveMetric) {
  return (
    OBJECTIVE_METRIC_OPTIONS.find((m) => m.value === metricKey) ??
    OBJECTIVE_METRIC_OPTIONS[0]!
  );
}

export function formatMetricTargetAmount(
  value: number,
  unit: string | null,
): string {
  const formatted = formatNumber(value);
  if (unit === "%" || unit === "x") return `${formatted}${unit}`;
  if (unit === "$") return `$${formatted}`;
  return unit ? `${formatted} ${unit}` : formatted;
}

/** Dropdown options for Good / Great / Excellent (+ Custom). */
export function metricTargetTierSelectOptions(
  metricKey: BudgetObjectiveMetric,
): Array<{ value: ObjectiveTargetTier | "custom"; label: string }> {
  const defaults = metricObjectiveDefaults(metricKey);
  const tiers = defaults.targetTiers;
  if (!tiers) {
    return [{ value: "custom", label: "Custom" }];
  }

  const op =
    TARGET_OPERATOR_OPTIONS.find((o) => o.value === defaults.defaultOperator)
      ?.symbol ?? "≥";

  return [
    ...OBJECTIVE_TARGET_TIERS.map((tier) => ({
      value: tier as ObjectiveTargetTier | "custom",
      label: `${OBJECTIVE_TARGET_TIER_LABELS[tier]} · ${op} ${formatMetricTargetAmount(
        tiers[tier],
        defaults.defaultUnit,
      )}`,
    })),
    { value: "custom" as const, label: "Custom…" },
  ];
}

export function matchObjectiveTargetTier(
  metricKey: BudgetObjectiveMetric,
  targetValue: number,
): ObjectiveTargetTier | "custom" {
  const tiers = metricObjectiveDefaults(metricKey).targetTiers;
  if (!tiers || !Number.isFinite(targetValue)) return "custom";
  for (const tier of OBJECTIVE_TARGET_TIERS) {
    if (Math.abs(tiers[tier] - targetValue) < 1e-9) return tier;
  }
  return "custom";
}

export function targetValueForTier(
  metricKey: BudgetObjectiveMetric,
  tier: ObjectiveTargetTier,
): number | null {
  return metricObjectiveDefaults(metricKey).targetTiers?.[tier] ?? null;
}

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
  return `${op} ${formatMetricTargetAmount(objective.targetValue, objective.targetUnit)}`;
}

export function formatObjectiveActual(
  value: number | null,
  unit: string | null,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatMetricTargetAmount(value, unit);
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
