import { createClient } from "@walls/supabase/server";

import { listActivitiesInRange } from "@/lib/activities-server";
import {
  formatCalories,
  formatGrams,
} from "@/lib/format-health";
import { type HealthDataScope, withHealthScope } from "@/lib/health-scope";
import { listMealsInRange } from "@/lib/meals-server";
import {
  ensureHealthProfile,
  resolveHealthTimezone,
  type HealthProfile,
} from "@/lib/profile-server";
import {
  PREVIEW_CALORIES_BY_DAY,
  ZERO_DASHBOARD_STATS,
  type DashboardCalorieDay,
} from "@/lib/dashboard-defaults";
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

export type DashboardAnalytics = {
  periodLabel: string;
  hasData: boolean;
  hasProfile: boolean;
  calorieTarget: number | null;
  stats: DashboardStat[];
  caloriesByDay: DashboardCalorieDay[];
  todayMeals: DashboardMealRow[];
  macros: DashboardMacroRow[];
  insights: DashboardInsight[];
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

export async function getDashboardAnalytics(
  scope: HealthDataScope,
  options: { rangeDays: number; timeRange: TimeRangeValue },
): Promise<DashboardAnalytics> {
  const [profile, timeZone] = await Promise.all([
    ensureHealthProfile(scope),
    resolveHealthTimezone(scope),
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

  const [meals, activities] = await Promise.all([
    listMealsInRange(scope, startKey, endKey),
    listActivitiesInRange(
      scope,
      rangeStartUtc.toISOString(),
      rangeEndInclusiveUtc.toISOString(),
    ),
  ]);

  const burnedByDate = new Map<string, number>();
  for (const activity of activities) {
    const key = formatDateKey(new Date(activity.started_at), timeZone);
    const burned = activity.calories_burned ?? 0;
    burnedByDate.set(key, (burnedByDate.get(key) ?? 0) + burned);
  }

  const calorieTarget = profile.calorie_target_daily ?? profile.tdee_calories;
  const caloriesByDay = buildDaySeries(
    startKey,
    options.rangeDays,
    meals as MealRow[],
    burnedByDate,
    calorieTarget,
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
  const todayBurned = burnedByDate.get(todayKey) ?? 0;
  const remaining =
    calorieTarget != null
      ? calorieTarget - todayTotals.calories + todayBurned
      : 0;

  const hasData =
    meals.length > 0 ||
    activities.length > 0 ||
    profile.calorie_target_daily != null;

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
      change: calorieTarget != null ? `of ${formatCalories(calorieTarget)}` : "Set target",
      positive: remaining >= 0,
    },
    {
      label: "Burned",
      value: formatCalories(todayBurned),
      change: "Today",
      positive: true,
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
    todayMeals,
    macros,
    insights,
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
