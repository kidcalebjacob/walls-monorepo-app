export type OptimizationGoal = "roas" | "ctr" | "cpa" | "conversions";

export type AutomationStatus =
  | "inactive"
  | "active"
  | "paused"
  | "cooldown"
  | "learning"
  | "error";

export type RoasFloorInputMode = "direct" | "margin";

export type RoasFloorAction = "stop_campaign" | "email_alert";

export type SpendAutomationSettings = {
  aggressiveness: number;
  maxDailyIncreasePct: number;
  maxDailyDecreasePct: number;
  roasFloor: number | null;
  roasFloorInputMode: RoasFloorInputMode;
  contributionMarginPct: number | null;
  ctrFloorPct: number | null;
  cpaCeiling: number | null;
  /** Multi-select: stop, email alert, both, or neither when ROAS floor is breached. */
  roasFloorActions: RoasFloorAction[];
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
  roasFloor: 2.4,
  roasFloorInputMode: "direct",
  contributionMarginPct: 41.67,
  ctrFloorPct: 1.2,
  cpaCeiling: 42,
  roasFloorActions: ["stop_campaign"],
  cooldownHours: 24,
  learningPhaseProtection: true,
  pauseOnFatigue: true,
};

/** Namespaced alert key for shared `alert_subscriptions` / `alert_events`. */
export const ADPILOT_ROAS_FLOOR_ALERT_KEY = "adpilot.roas_floor_breach";

export const ROAS_FLOOR_ACTION_OPTIONS: Array<{
  value: RoasFloorAction;
  label: string;
  hint: string;
}> = [
  {
    value: "stop_campaign",
    label: "Stop campaign",
    hint: "Pause the campaign when ROAS drops below the floor",
  },
  {
    value: "email_alert",
    label: "Email alert",
    hint: "Email subscribed workspace members",
  },
];

const ROAS_FLOOR_ACTION_VALUES = new Set<RoasFloorAction>(
  ROAS_FLOOR_ACTION_OPTIONS.map((option) => option.value),
);

export function normalizeRoasFloorActions(
  raw: unknown,
): RoasFloorAction[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_SPEND_AUTOMATION_SETTINGS.roasFloorActions];
  }

  const next: RoasFloorAction[] = [];
  for (const value of raw) {
    if (
      typeof value === "string" &&
      ROAS_FLOOR_ACTION_VALUES.has(value as RoasFloorAction) &&
      !next.includes(value as RoasFloorAction)
    ) {
      next.push(value as RoasFloorAction);
    }
  }

  // Empty is allowed — monitor the floor with no stop/alert side effects.
  return next;
}

export function toggleRoasFloorAction(
  current: RoasFloorAction[],
  action: RoasFloorAction,
): RoasFloorAction[] {
  if (current.includes(action)) {
    return current.filter((value) => value !== action);
  }
  return [...current, action];
}

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

export function getEffectiveRoasFloor(
  settings: Pick<
    SpendAutomationSettings,
    "roasFloor" | "roasFloorInputMode" | "contributionMarginPct"
  >,
): number | null {
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

/** True when every spend-automation field matches (used for preset vs custom UI). */
export function spendSettingsEqual(
  a: SpendAutomationSettings,
  b: SpendAutomationSettings,
): boolean {
  const keys = Object.keys(
    DEFAULT_SPEND_AUTOMATION_SETTINGS,
  ) as Array<keyof SpendAutomationSettings>;
  return keys.every((key) => {
    const left = a[key];
    const right = b[key];
    if (Array.isArray(left) || Array.isArray(right)) {
      return JSON.stringify(left) === JSON.stringify(right);
    }
    return left === right;
  });
}

export function parseAutomationSettings(
  raw: unknown,
): SpendAutomationSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SPEND_AUTOMATION_SETTINGS };
  }

  const input = raw as Record<string, unknown>;
  const knownKeys = Object.keys(
    DEFAULT_SPEND_AUTOMATION_SETTINGS,
  ) as Array<keyof SpendAutomationSettings>;
  const filtered = Object.fromEntries(
    knownKeys
      .filter((key) => key in input)
      .map((key) => [key, input[key as string]]),
  ) as Partial<SpendAutomationSettings>;

  const parsed = mergeAutomationSettings(
    DEFAULT_SPEND_AUTOMATION_SETTINGS,
    filtered,
  );
  return syncRoasFloorSettings({
    ...parsed,
    roasFloorActions: normalizeRoasFloorActions(parsed.roasFloorActions),
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

/** Composite 0–100 risk from aggressiveness, max daily growth, ROAS floor, and floor actions. */
export function getRiskScore(
  settings: Pick<
    SpendAutomationSettings,
    | "aggressiveness"
    | "maxDailyIncreasePct"
    | "roasFloor"
    | "roasFloorInputMode"
    | "contributionMarginPct"
    | "roasFloorActions"
  >,
): number {
  const aggressiveness = Math.min(100, Math.max(0, settings.aggressiveness));
  const maxDailyIncreasePct = Math.min(
    50,
    Math.max(5, settings.maxDailyIncreasePct),
  );
  const effectiveFloor = getEffectiveRoasFloor(settings);
  const floorValue =
    effectiveFloor == null || !Number.isFinite(effectiveFloor) || effectiveFloor <= 0
      ? 0
      : effectiveFloor;

  // Caps: aggressiveness ~42, growth ~24, weak/missing floor ~22, soft actions ~12.
  const aggressivenessRisk = (aggressiveness / 100) * 42;
  const growthRisk = ((maxDailyIncreasePct - 5) / 45) * 24;
  // 0/null floor stays fully risky; stronger floors decay quickly.
  const floorRisk = 22 * Math.exp(-floorValue / 1.6);

  const actions = settings.roasFloorActions ?? [];
  const hasStop = actions.includes("stop_campaign");
  const hasAlert = actions.includes("email_alert");
  // Stop only reduces risk when the floor can actually fire (> 0).
  let actionRisk = 0;
  if (floorValue > 0) {
    if (!hasStop) {
      actionRisk = hasAlert ? 10 : 12;
    }
  } else if (!hasStop && hasAlert) {
    actionRisk = 6;
  } else if (!hasStop && !hasAlert) {
    actionRisk = 10;
  }

  const raw = aggressivenessRisk + growthRisk + floorRisk + actionRisk;
  return Math.min(99, Math.max(5, Math.round(raw)));
}

export function getProjectedWeeklyUplift(
  aggressiveness: number,
  maxDailyIncreasePct: number,
) {
  const pct = Math.round(aggressiveness * 0.12 + maxDailyIncreasePct * 0.85);
  return `+${Math.min(48, pct)}%`;
}
