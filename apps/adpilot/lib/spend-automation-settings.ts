export type OptimizationGoal = "roas" | "ctr" | "cpa" | "conversions";

export type AutomationStatus =
  | "inactive"
  | "active"
  | "paused"
  | "cooldown"
  | "learning"
  | "error";

export type SpendAutomationSettings = {
  aggressiveness: number;
  maxDailyIncreasePct: number;
  maxDailyDecreasePct: number;
  scaleUpCapPct: number;
  roasFloor: number | null;
  ctrFloorPct: number | null;
  cpaCeiling: number | null;
  cooldownHours: number;
  learningPhaseProtection: boolean;
  pauseOnFatigue: boolean;
};

export const DEFAULT_SPEND_AUTOMATION_SETTINGS: SpendAutomationSettings = {
  aggressiveness: 62,
  maxDailyIncreasePct: 18,
  maxDailyDecreasePct: 12,
  scaleUpCapPct: 35,
  roasFloor: 2.4,
  ctrFloorPct: 1.2,
  cpaCeiling: 42,
  cooldownHours: 24,
  learningPhaseProtection: true,
  pauseOnFatigue: true,
};

export const OPTIMIZATION_GOAL_OPTIONS: Array<{
  value: OptimizationGoal;
  label: string;
  hint: string;
}> = [
  {
    value: "roas",
    label: "ROAS",
    hint: "Maximize return on ad spend",
  },
  {
    value: "ctr",
    label: "CTR",
    hint: "Improve click-through rate",
  },
  {
    value: "cpa",
    label: "CPA",
    hint: "Keep cost per acquisition under ceiling",
  },
  {
    value: "conversions",
    label: "Conversions",
    hint: "Drive more conversion volume",
  },
];

export function mergeAutomationSettings(
  base: SpendAutomationSettings,
  override: Partial<SpendAutomationSettings>,
): SpendAutomationSettings {
  return { ...base, ...override };
}

export function parseAutomationSettings(
  raw: unknown,
): SpendAutomationSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SPEND_AUTOMATION_SETTINGS };
  }

  const input = raw as Partial<SpendAutomationSettings>;
  const parsed = mergeAutomationSettings(DEFAULT_SPEND_AUTOMATION_SETTINGS, input);
  return {
    ...parsed,
    cooldownHours: normalizeCooldownHours(parsed.cooldownHours),
  };
}

export function optimizationGoalLabel(goal: OptimizationGoal): string {
  return OPTIMIZATION_GOAL_OPTIONS.find((option) => option.value === goal)?.label ?? goal;
}

export const MIN_COOLDOWN_HOURS = 24;

export const COOLDOWN_OPTIONS = [
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
  { value: 72, label: "72 hours" },
] as const;

export function normalizeCooldownHours(hours: number | null | undefined): number {
  const allowed = COOLDOWN_OPTIONS.map((option) => option.value);
  const fallback = DEFAULT_SPEND_AUTOMATION_SETTINGS.cooldownHours;

  if (hours == null || !Number.isFinite(hours)) {
    return fallback;
  }

  const clamped = Math.max(MIN_COOLDOWN_HOURS, hours);
  if ((allowed as readonly number[]).includes(clamped)) {
    return clamped;
  }

  return allowed.reduce((best, option) =>
    Math.abs(option - clamped) < Math.abs(best - clamped) ? option : best,
  );
}

export function getAggressivenessLabel(value: number) {
  if (value < 34) return "Conservative";
  if (value < 67) return "Balanced";
  return "Aggressive";
}

export function getRiskScore(aggressiveness: number, maxDailyIncreasePct: number) {
  const raw = aggressiveness * 0.55 + maxDailyIncreasePct * 1.8;
  return Math.min(99, Math.max(8, Math.round(raw)));
}

export function getProjectedWeeklyUplift(
  aggressiveness: number,
  maxDailyIncreasePct: number,
) {
  const pct = Math.round(aggressiveness * 0.12 + maxDailyIncreasePct * 0.85);
  return `+${Math.min(48, pct)}%`;
}
