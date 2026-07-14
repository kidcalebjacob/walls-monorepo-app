export type OptimizationGoal = "roas" | "ctr" | "cpa" | "conversions";

export type AutomationStatus =
  | "inactive"
  | "active"
  | "paused"
  | "cooldown"
  | "learning"
  | "error";

export type RoasFloorInputMode = "direct" | "margin";

export type SpendAutomationSettings = {
  aggressiveness: number;
  maxDailyIncreasePct: number;
  maxDailyDecreasePct: number;
  scaleUpCapPct: number;
  roasFloor: number | null;
  roasFloorInputMode: RoasFloorInputMode;
  contributionMarginPct: number | null;
  ctrFloorPct: number | null;
  cpaCeiling: number | null;
  cooldownHours: number;
  learningPhaseProtection: boolean;
  pauseOnFatigue: boolean;
};

export const CONTRIBUTION_MARGIN_PRESETS = [
  { marginPct: 100, roasFloor: 1.0 },
  { marginPct: 90, roasFloor: 1.11 },
  { marginPct: 80, roasFloor: 1.25 },
  { marginPct: 70, roasFloor: 1.43 },
  { marginPct: 60, roasFloor: 1.67 },
  { marginPct: 50, roasFloor: 2.0 },
  { marginPct: 40, roasFloor: 2.5 },
  { marginPct: 30, roasFloor: 3.33 },
  { marginPct: 20, roasFloor: 5.0 },
] as const;

export const DEFAULT_SPEND_AUTOMATION_SETTINGS: SpendAutomationSettings = {
  aggressiveness: 62,
  maxDailyIncreasePct: 18,
  maxDailyDecreasePct: 12,
  scaleUpCapPct: 35,
  roasFloor: 2.4,
  roasFloorInputMode: "direct",
  contributionMarginPct: 41.67,
  ctrFloorPct: 1.2,
  cpaCeiling: 42,
  cooldownHours: 24,
  learningPhaseProtection: true,
  pauseOnFatigue: true,
};

/** Break-even ROAS from contribution margin % (revenue after variable costs, before ad spend). */
export function roasFloorFromContributionMargin(marginPct: number): number | null {
  if (!Number.isFinite(marginPct) || marginPct <= 0 || marginPct > 100) {
    return null;
  }
  return Math.round((100 / marginPct) * 100) / 100;
}

export function contributionMarginFromRoasFloor(roasFloor: number): number | null {
  if (!Number.isFinite(roasFloor) || roasFloor <= 0) {
    return null;
  }
  return Math.round((100 / roasFloor) * 100) / 100;
}

export function getEffectiveRoasFloor(settings: SpendAutomationSettings): number | null {
  if (settings.roasFloorInputMode === "margin") {
    const fromMargin =
      settings.contributionMarginPct != null
        ? roasFloorFromContributionMargin(settings.contributionMarginPct)
        : null;
    if (fromMargin != null) return fromMargin;
  }
  return settings.roasFloor;
}

export function syncRoasFloorSettings(
  settings: SpendAutomationSettings,
): SpendAutomationSettings {
  const next = { ...settings };

  if (next.roasFloorInputMode === "margin") {
    if (next.contributionMarginPct == null && next.roasFloor != null) {
      next.contributionMarginPct = contributionMarginFromRoasFloor(next.roasFloor);
    }
    if (next.contributionMarginPct != null) {
      next.roasFloor = roasFloorFromContributionMargin(next.contributionMarginPct);
    }
  } else if (next.roasFloor != null) {
    next.contributionMarginPct = contributionMarginFromRoasFloor(next.roasFloor);
  }

  return next;
}

export function patchRoasFloorSettings(
  settings: SpendAutomationSettings,
  patch: Partial<
    Pick<
      SpendAutomationSettings,
      "roasFloor" | "roasFloorInputMode" | "contributionMarginPct"
    >
  >,
): Pick<
  SpendAutomationSettings,
  "roasFloor" | "roasFloorInputMode" | "contributionMarginPct"
> {
  const merged = syncRoasFloorSettings({ ...settings, ...patch });
  return {
    roasFloor: merged.roasFloor,
    roasFloorInputMode: merged.roasFloorInputMode,
    contributionMarginPct: merged.contributionMarginPct,
  };
}

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
  return syncRoasFloorSettings({
    ...parsed,
    cooldownHours: normalizeCooldownHours(parsed.cooldownHours),
    roasFloorInputMode: parsed.roasFloorInputMode ?? "direct",
  });
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
