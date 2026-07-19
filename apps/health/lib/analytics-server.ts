import { createClient } from "@walls/supabase/server";

import { listActivitiesInRange } from "@/lib/activities-server";
import {
  listDailySummariesInRange,
  type HealthDailySummary,
} from "@/lib/daily-summaries-server";
import {
  formatCalories,
  formatDistanceMeters,
  formatDurationMinutes,
  formatGrams,
  formatHeartRate,
  formatSteps,
} from "@/lib/format-health";
import { listGoals } from "@/lib/goals-server";
import { type HealthDataScope, withHealthScope } from "@/lib/health-scope";
import { listMealsInRange } from "@/lib/meals-server";
import {
  ensureHealthProfile,
  resolveHealthTimezone,
  type HealthProfile,
} from "@/lib/profile-server";
import {
  DEFAULT_STEPS_TARGET,
  PREVIEW_ACTIVITY_BY_DAY,
  PREVIEW_CALORIES_BY_DAY,
  ZERO_DASHBOARD_STATS,
  type DashboardActivityDay,
  type DashboardCalorieDay,
} from "@/lib/dashboard-defaults";
import {
  getVisibleDashboardWidgets,
} from "@/lib/dashboard-widgets-server";
import type { DashboardWidgetId } from "@/lib/dashboard-widgets";
import {
  buildScienceInsights,
  type DashboardInsight,
} from "@/lib/science-insights";
import {
  addDaysToDateKey,
  formatDateKey,
  labelForDateKey,
  timeRangeLabel,
  todayDateKey,
  zonedStartOfDayUtc,
  type TimeRangeValue,
} from "@/lib/time-range";

export type DashboardStat = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
};

export type DashboardMealRow = {
  id: string;
  meal_type: string;
  name: string | null;
  calories: number;
  logged_at: string;
};

export type DashboardMacroRow = {
  label: string;
  value: string;
  current: number;
  target: number | null;
  color: string;
};

export type DashboardAppleHealth = {
  hasAppleHealth: boolean;
  syncedAt: string | null;
  steps: number;
  stepsTarget: number;
  stepsProgress: number;
  distanceMeters: number;
  flightsClimbed: number;
  activeEnergyKcal: number;
  basalEnergyKcal: number | null;
  exerciseMinutes: number | null;
  standHours: number | null;
  restingHeartRate: number | null;
  avgHeartRate: number | null;
  hrvSdnnMs: number | null;
  oxygenSaturation: number | null;
  sleepAsleepMinutes: number | null;
  sleepDeepMinutes: number | null;
  sleepRemMinutes: number | null;
  mindfulnessMinutes: number | null;
  unitSystem: "metric" | "imperial";
  cards: DashboardStat[];
};

export type DashboardAnalytics = {
  periodLabel: string;
  hasData: boolean;
  hasProfile: boolean;
  calorieTarget: number | null;
  stats: DashboardStat[];
  caloriesByDay: DashboardCalorieDay[];
  activityByDay: DashboardActivityDay[];
  todayMeals: DashboardMealRow[];
  macros: DashboardMacroRow[];
  insights: DashboardInsight[];
  appleHealth: DashboardAppleHealth;
  visibleWidgets: DashboardWidgetId[];
  profile: Pick<
    HealthProfile,
    | "goal_type"
    | "calorie_target_daily"
    | "current_weight_kg"
    | "unit_system"
    | "bmr_calories"
    | "tdee_calories"
  > | null;
};

type MealRow = {
  id: string;
  meal_date: string;
  meal_type: string;
  name: string | null;
  logged_at: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
};

function sumMeals(meals: MealRow[]) {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + (meal.calories ?? 0),
      protein_g: acc.protein_g + Number(meal.protein_g ?? 0),
      carbs_g: acc.carbs_g + Number(meal.carbs_g ?? 0),
      fat_g: acc.fat_g + Number(meal.fat_g ?? 0),
      sugar_g: acc.sugar_g + Number(meal.sugar_g ?? 0),
    }),
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      sugar_g: 0,
    },
  );
}

function buildDaySeries(
  startKey: string,
  days: number,
  meals: MealRow[],
  burnedByDate: Map<string, number>,
  calorieTarget: number | null,
): DashboardCalorieDay[] {
  const mealsByDate = new Map<string, MealRow[]>();
  for (const meal of meals) {
    const list = mealsByDate.get(meal.meal_date) ?? [];
    list.push(meal);
    mealsByDate.set(meal.meal_date, list);
  }

  const points: DashboardCalorieDay[] = [];
  for (let index = 0; index < days; index += 1) {
    const key = addDaysToDateKey(startKey, index);
    const dayMeals = mealsByDate.get(key) ?? [];
    const totals = sumMeals(dayMeals);
    const burned = burnedByDate.get(key) ?? 0;
    const target = calorieTarget ?? 0;
    const remaining = target > 0 ? target - totals.calories + burned : 0;

    points.push({
      date: key,
      label: labelForDateKey(key),
      consumed: totals.calories,
      burned,
      target,
      remaining,
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
      sugar_g: totals.sugar_g,
    });
  }

  return points;
}

function buildActivitySeries(
  startKey: string,
  days: number,
  summariesByDate: Map<string, HealthDailySummary>,
): DashboardActivityDay[] {
  const points: DashboardActivityDay[] = [];
  for (let index = 0; index < days; index += 1) {
    const key = addDaysToDateKey(startKey, index);
    const summary = summariesByDate.get(key);
    points.push({
      date: key,
      label: labelForDateKey(key),
      steps: summary?.steps ?? 0,
      distance_meters: summary?.distance_walking_meters ?? 0,
      active_energy_kcal: summary?.active_energy_kcal ?? 0,
      flights_climbed: summary?.flights_climbed ?? 0,
    });
  }
  return points;
}

function resolveBurnedForDay(
  activityBurned: number,
  summary: HealthDailySummary | undefined,
): number {
  const appleActive = summary?.active_energy_kcal ?? 0;
  return Math.max(activityBurned, appleActive);
}

function buildAppleHealthCards(
  today: HealthDailySummary | undefined,
  stepsTarget: number,
  unitSystem: "metric" | "imperial",
): DashboardStat[] {
  if (!today) return [];

  const cards: DashboardStat[] = [];
  const steps = today.steps ?? 0;

  cards.push({
    label: "Steps",
    value: formatSteps(steps),
    change:
      stepsTarget > 0
        ? `${Math.min(100, Math.round((steps / stepsTarget) * 100))}% of ${formatSteps(stepsTarget)}`
        : "Today",
    positive: stepsTarget <= 0 || steps >= stepsTarget * 0.85,
  });

  if (today.distance_walking_meters != null && today.distance_walking_meters > 0) {
    cards.push({
      label: "Distance",
      value: formatDistanceMeters(today.distance_walking_meters, unitSystem),
      change: "Walking + running",
      positive: true,
    });
  }

  if (today.flights_climbed != null && today.flights_climbed > 0) {
    cards.push({
      label: "Flights",
      value: new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }).format(Math.round(today.flights_climbed)),
      change: "Climbed today",
      positive: true,
    });
  }

  if (today.exercise_minutes != null && today.exercise_minutes > 0) {
    cards.push({
      label: "Exercise",
      value: formatDurationMinutes(today.exercise_minutes),
      change: "Move minutes",
      positive: true,
    });
  }

  if (today.stand_hours != null && today.stand_hours > 0) {
    cards.push({
      label: "Stand hours",
      value: `${today.stand_hours}`,
      change: today.stand_minutes
        ? `${formatDurationMinutes(today.stand_minutes)} standing`
        : "Today",
      positive: true,
    });
  }

  if (today.resting_heart_rate != null) {
    cards.push({
      label: "Resting HR",
      value: formatHeartRate(today.resting_heart_rate),
      change:
        today.avg_heart_rate != null
          ? `Avg ${formatHeartRate(today.avg_heart_rate)}`
          : "Today",
      positive: true,
    });
  } else if (today.avg_heart_rate != null) {
    cards.push({
      label: "Avg HR",
      value: formatHeartRate(today.avg_heart_rate),
      change: "Today",
      positive: true,
    });
  }

  if (today.hrv_sdnn_ms != null && today.hrv_sdnn_ms > 0) {
    cards.push({
      label: "HRV",
      value: `${Math.round(today.hrv_sdnn_ms)} ms`,
      change: "SDNN",
      positive: true,
    });
  }

  if (today.oxygen_saturation != null && today.oxygen_saturation > 0) {
    const pct =
      today.oxygen_saturation <= 1
        ? today.oxygen_saturation * 100
        : today.oxygen_saturation;
    cards.push({
      label: "Blood oxygen",
      value: `${new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }).format(pct)}%`,
      change: "SpO₂",
      positive: true,
    });
  }

  if (today.sleep_asleep_minutes != null && today.sleep_asleep_minutes > 0) {
    const stages = [
      today.sleep_deep_minutes != null && today.sleep_deep_minutes > 0
        ? `${formatDurationMinutes(today.sleep_deep_minutes)} deep`
        : null,
      today.sleep_rem_minutes != null && today.sleep_rem_minutes > 0
        ? `${formatDurationMinutes(today.sleep_rem_minutes)} REM`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    cards.push({
      label: "Sleep",
      value: formatDurationMinutes(today.sleep_asleep_minutes),
      change: stages || "Last night",
      positive: today.sleep_asleep_minutes >= 420,
    });
  }

  if (today.mindfulness_minutes != null && today.mindfulness_minutes > 0) {
    cards.push({
      label: "Mindfulness",
      value: formatDurationMinutes(today.mindfulness_minutes),
      change: "Today",
      positive: true,
    });
  }

  return cards;
}

export async function getDashboardAnalytics(
  scope: HealthDataScope,
  options: { rangeDays: number; timeRange: TimeRangeValue },
): Promise<DashboardAnalytics> {
  const [profile, timeZone, goals, visibleWidgets] = await Promise.all([
    ensureHealthProfile(scope),
    resolveHealthTimezone(scope),
    listGoals(scope),
    getVisibleDashboardWidgets(scope),
  ]);

  const todayKey = todayDateKey(timeZone);
  const startKey = addDaysToDateKey(todayKey, -(options.rangeDays - 1));
  const endKey = todayKey;

  const rangeStartUtc = zonedStartOfDayUtc(startKey, timeZone);
  const rangeEndExclusiveUtc = zonedStartOfDayUtc(
    addDaysToDateKey(todayKey, 1),
    timeZone,
  );
  const rangeEndInclusiveUtc = new Date(rangeEndExclusiveUtc.getTime() - 1);

  const [meals, activities, summaries] = await Promise.all([
    listMealsInRange(scope, startKey, endKey),
    listActivitiesInRange(
      scope,
      rangeStartUtc.toISOString(),
      rangeEndInclusiveUtc.toISOString(),
    ),
    listDailySummariesInRange(scope, startKey, endKey),
  ]);

  const summariesByDate = new Map<string, HealthDailySummary>();
  for (const summary of summaries) {
    summariesByDate.set(summary.summary_date, summary);
  }

  const activityBurnedByDate = new Map<string, number>();
  for (const activity of activities) {
    const key = formatDateKey(new Date(activity.started_at), timeZone);
    const burned = activity.calories_burned ?? 0;
    activityBurnedByDate.set(
      key,
      (activityBurnedByDate.get(key) ?? 0) + burned,
    );
  }

  const burnedByDate = new Map<string, number>();
  for (let index = 0; index < options.rangeDays; index += 1) {
    const key = addDaysToDateKey(startKey, index);
    burnedByDate.set(
      key,
      resolveBurnedForDay(
        activityBurnedByDate.get(key) ?? 0,
        summariesByDate.get(key),
      ),
    );
  }

  const calorieTarget = profile.calorie_target_daily ?? profile.tdee_calories;
  const caloriesByDay = buildDaySeries(
    startKey,
    options.rangeDays,
    meals as MealRow[],
    burnedByDate,
    calorieTarget,
  );
  const activityByDay = buildActivitySeries(
    startKey,
    options.rangeDays,
    summariesByDate,
  );

  const todayMeals = (meals as MealRow[])
    .filter((meal) => meal.meal_date === todayKey)
    .sort(
      (a, b) =>
        new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
    )
    .map((meal) => ({
      id: meal.id,
      meal_type: meal.meal_type,
      name: meal.name,
      calories: meal.calories,
      logged_at: meal.logged_at,
    }));

  const todayTotals = sumMeals(
    (meals as MealRow[]).filter((meal) => meal.meal_date === todayKey),
  );
  const todaySummary = summariesByDate.get(todayKey);
  const todayBurned = burnedByDate.get(todayKey) ?? 0;
  const remaining =
    calorieTarget != null
      ? calorieTarget - todayTotals.calories + todayBurned
      : 0;

  const stepsGoal = goals.find(
    (goal) => goal.is_active && goal.goal_type === "daily_steps",
  );
  const stepsTarget = stepsGoal?.target_value
    ? Number(stepsGoal.target_value)
    : DEFAULT_STEPS_TARGET;
  const todaySteps = todaySummary?.steps ?? 0;
  const unitSystem = profile.unit_system === "metric" ? "metric" : "imperial";

  const hasAppleHealth = summaries.some(
    (summary) =>
      summary.apple_health_synced_at != null ||
      (summary.steps != null && summary.steps > 0) ||
      (summary.active_energy_kcal != null && summary.active_energy_kcal > 0),
  );

  const hasData =
    meals.length > 0 ||
    activities.length > 0 ||
    hasAppleHealth ||
    profile.calorie_target_daily != null;

  const appleHealth: DashboardAppleHealth = {
    hasAppleHealth,
    syncedAt: todaySummary?.apple_health_synced_at ?? null,
    steps: todaySteps,
    stepsTarget,
    stepsProgress:
      stepsTarget > 0
        ? Math.min(100, Math.round((todaySteps / stepsTarget) * 100))
        : 0,
    distanceMeters: todaySummary?.distance_walking_meters ?? 0,
    flightsClimbed: todaySummary?.flights_climbed ?? 0,
    activeEnergyKcal: todaySummary?.active_energy_kcal ?? 0,
    basalEnergyKcal: todaySummary?.basal_energy_kcal ?? null,
    exerciseMinutes: todaySummary?.exercise_minutes ?? null,
    standHours: todaySummary?.stand_hours ?? null,
    restingHeartRate: todaySummary?.resting_heart_rate ?? null,
    avgHeartRate: todaySummary?.avg_heart_rate ?? null,
    hrvSdnnMs: todaySummary?.hrv_sdnn_ms ?? null,
    oxygenSaturation: todaySummary?.oxygen_saturation ?? null,
    sleepAsleepMinutes: todaySummary?.sleep_asleep_minutes ?? null,
    sleepDeepMinutes: todaySummary?.sleep_deep_minutes ?? null,
    sleepRemMinutes: todaySummary?.sleep_rem_minutes ?? null,
    mindfulnessMinutes: todaySummary?.mindfulness_minutes ?? null,
    unitSystem,
    cards: buildAppleHealthCards(todaySummary, stepsTarget, unitSystem),
  };

  const stats: DashboardStat[] = [
    {
      label: "Consumed",
      value: formatCalories(todayTotals.calories),
      change: "Today",
      positive: true,
    },
    {
      label: "Remaining",
      value: calorieTarget != null ? formatCalories(remaining) : "—",
      change:
        calorieTarget != null
          ? `of ${formatCalories(calorieTarget)}`
          : "Set target",
      positive: remaining >= 0,
    },
    {
      label: "Burned",
      value: formatCalories(todayBurned),
      change: todaySummary?.active_energy_kcal
        ? "Apple Health"
        : "Today",
      positive: true,
    },
    {
      label: "Steps",
      value: formatSteps(todaySteps),
      change:
        stepsTarget > 0
          ? `${appleHealth.stepsProgress}% of ${formatSteps(stepsTarget)}`
          : "Today",
      positive: todaySteps >= stepsTarget * 0.85,
    },
    {
      label: "Protein",
      value: formatGrams(todayTotals.protein_g),
      change: profile.protein_target_g
        ? `/${formatGrams(Number(profile.protein_target_g))}`
        : "Today",
      positive: true,
    },
    {
      label: "Carbs",
      value: formatGrams(todayTotals.carbs_g),
      change: profile.carbs_target_g
        ? `/${formatGrams(Number(profile.carbs_target_g))}`
        : "Today",
      positive: true,
    },
    {
      label: "Fat",
      value: formatGrams(todayTotals.fat_g),
      change: profile.fat_target_g
        ? `/${formatGrams(Number(profile.fat_target_g))}`
        : "Today",
      positive: true,
    },
  ];

  const macros: DashboardMacroRow[] = [
    {
      label: "Protein",
      value: formatGrams(todayTotals.protein_g),
      current: todayTotals.protein_g,
      target: profile.protein_target_g ? Number(profile.protein_target_g) : null,
      color: "var(--kenoo-sky)",
    },
    {
      label: "Carbs",
      value: formatGrams(todayTotals.carbs_g),
      current: todayTotals.carbs_g,
      target: profile.carbs_target_g ? Number(profile.carbs_target_g) : null,
      color: "var(--kenoo-yellow)",
    },
    {
      label: "Fat",
      value: formatGrams(todayTotals.fat_g),
      current: todayTotals.fat_g,
      target: profile.fat_target_g ? Number(profile.fat_target_g) : null,
      color: "var(--kenoo-blue)",
    },
  ];

  const insights = hasData
    ? buildScienceInsights({
        profile,
        todayCalories: todayTotals.calories,
        todayProteinG: todayTotals.protein_g,
        todayCarbsG: todayTotals.carbs_g,
        todayFatG: todayTotals.fat_g,
        todayBurned,
        caloriesByDay,
        activities: activities.map((activity) => ({
          distance_meters: activity.distance_meters,
          calories_burned: activity.calories_burned,
          duration_seconds: activity.duration_seconds,
        })),
        periodLabel: timeRangeLabel(options.timeRange),
      })
    : [];

  return {
    periodLabel: timeRangeLabel(options.timeRange),
    hasData,
    hasProfile: profile.calorie_target_daily != null,
    calorieTarget,
    stats: hasData ? stats : [...ZERO_DASHBOARD_STATS],
    caloriesByDay: hasData ? caloriesByDay : PREVIEW_CALORIES_BY_DAY,
    activityByDay: hasAppleHealth ? activityByDay : PREVIEW_ACTIVITY_BY_DAY,
    todayMeals,
    macros,
    insights,
    appleHealth,
    visibleWidgets,
    profile: {
      goal_type: profile.goal_type,
      calorie_target_daily: profile.calorie_target_daily,
      current_weight_kg: profile.current_weight_kg,
      unit_system: profile.unit_system,
      bmr_calories: profile.bmr_calories,
      tdee_calories: profile.tdee_calories,
    },
  };
}

export async function isStravaSyncing(scope: HealthDataScope): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await withHealthScope(
    supabase
      .from("health_sync_state")
      .select("sync_status")
      .eq("sync_status", "syncing")
      .limit(1),
    scope,
  );

  return (data ?? []).length > 0;
}
