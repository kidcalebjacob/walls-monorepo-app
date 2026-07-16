import type { DashboardCalorieDay } from "@/lib/dashboard-defaults";
import type { HealthProfile } from "@/lib/profile-server";

/** Rough physiological constant used in energy-balance projections. */
const KCAL_PER_KG_BODY_FAT = 7700;

export type DashboardInsightTone =
  | "sage"
  | "amber"
  | "spectrum"
  | "coral"
  | "mist"
  | "lime";

export type DashboardInsight = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: DashboardInsightTone;
  /** Optional link for deeper context */
  href?: string;
};

type InsightActivity = {
  distance_meters: number | null;
  calories_burned: number | null;
  duration_seconds: number | null;
};

type BuildInsightsInput = {
  profile: HealthProfile;
  todayCalories: number;
  todayProteinG: number;
  todayCarbsG: number;
  todayFatG: number;
  todayBurned: number;
  caloriesByDay: DashboardCalorieDay[];
  activities: InsightActivity[];
  periodLabel: string;
};

function round1(n: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
  }).format(n);
}

function computeBmi(weightKg: number, heightCm: number): number {
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight range";
  if (bmi < 25) return "Healthy range";
  if (bmi < 30) return "Overweight range";
  return "Higher range";
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Build “ready now” scientific insights from logged meals, activities, and profile.
 * Only returns insights that have enough data to be meaningful.
 */
export function buildScienceInsights(
  input: BuildInsightsInput,
): DashboardInsight[] {
  const insights: DashboardInsight[] = [];
  const {
    profile,
    todayCalories,
    todayProteinG,
    todayCarbsG,
    todayFatG,
    todayBurned,
    caloriesByDay,
    activities,
    periodLabel,
  } = input;

  const weightKg = profile.current_weight_kg
    ? Number(profile.current_weight_kg)
    : null;
  const heightCm = profile.height_cm ? Number(profile.height_cm) : null;
  const tdee = profile.tdee_calories ?? null;
  const calorieTarget =
    profile.calorie_target_daily ?? profile.tdee_calories ?? null;

  // Days with meaningful food logging in the selected range.
  const loggedDays = caloriesByDay.filter((day) => day.consumed > 0);
  const avgConsumed =
    loggedDays.length > 0 ? mean(loggedDays.map((d) => d.consumed)) : null;
  const avgBurned =
    loggedDays.length > 0 ? mean(loggedDays.map((d) => d.burned)) : 0;

  // 1) Energy deficit / surplus + weekly projection
  if (tdee != null && avgConsumed != null && loggedDays.length >= 1) {
    const avgNet = avgConsumed - tdee + avgBurned;
    // Negative net = deficit (losing). Use target if set for "planned" framing.
    const weeklyKg = (avgNet * 7) / KCAL_PER_KG_BODY_FAT;
    const signed =
      weeklyKg > 0 ? `+${round1(weeklyKg)}` : round1(weeklyKg);
    const dailySigned =
      avgNet > 0 ? `+${Math.round(avgNet)}` : `${Math.round(avgNet)}`;

    insights.push({
      id: "energy-pace",
      title: "Projected pace",
      value: `${signed} kg/wk`,
      detail:
        loggedDays.length === 1
          ? `${dailySigned} kcal vs TDEE today`
          : `${dailySigned} kcal/day avg · ${periodLabel.toLowerCase()}`,
      tone: avgNet <= 0 ? "sage" : "coral",
    });
  }

  // 2) Protein per kg bodyweight
  if (weightKg != null && weightKg > 0 && todayProteinG > 0) {
    const perKg = todayProteinG / weightKg;
    let status = "Building toward training range";
    if (perKg >= 1.6 && perKg <= 2.2) status = "In fat-loss training range";
    else if (perKg > 2.2) status = "High protein day";
    else if (perKg >= 1.2) status = "Moderate — push toward 1.6+";

    insights.push({
      id: "protein-density",
      title: "Protein density",
      value: `${round1(perKg)} g/kg`,
      detail: `${Math.round(todayProteinG)}g today · ${status}`,
      tone: perKg >= 1.6 ? "lime" : "amber",
    });
  }

  // 3) Macro balance (% of kcal)
  const proteinKcal = todayProteinG * 4;
  const carbsKcal = todayCarbsG * 4;
  const fatKcal = todayFatG * 9;
  const macroKcal = proteinKcal + carbsKcal + fatKcal;
  if (macroKcal >= 200) {
    const pPct = Math.round((proteinKcal / macroKcal) * 100);
    const cPct = Math.round((carbsKcal / macroKcal) * 100);
    const fPct = Math.round((fatKcal / macroKcal) * 100);
    // Soft AMPM-ish: protein 15–35%, carbs 40–65%, fat 20–35% — score by protein floor for loss goals.
    const balanced =
      pPct >= 20 && pPct <= 40 && fPct >= 15 && fPct <= 40 && cPct <= 65;

    insights.push({
      id: "macro-split",
      title: "Macro split",
      value: `${pPct}/${cPct}/${fPct}`,
      detail: balanced
        ? "P / C / F % · solid balance today"
        : "P / C / F % · tweak protein or fat share",
      tone: balanced ? "spectrum" : "mist",
    });
  }

  // 4) BMI
  if (weightKg != null && heightCm != null && heightCm > 0) {
    const bmi = computeBmi(weightKg, heightCm);
    insights.push({
      id: "bmi",
      title: "BMI",
      value: round1(bmi),
      detail: `${bmiCategory(bmi)} · ${Math.round(heightCm)} cm / ${round1(weightKg)} kg`,
      tone: "mist",
      href: "/settings",
    });
  }

  // 5) Goal pace (required daily deficit vs actual)
  if (
    weightKg != null &&
    profile.target_weight_kg != null &&
    profile.target_date &&
    tdee != null &&
    avgConsumed != null
  ) {
    const targetKg = Number(profile.target_weight_kg);
    const daysLeft = Math.max(
      1,
      Math.ceil(
        (new Date(profile.target_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const kgDelta = targetKg - weightKg;
    const requiredDailyKcal = (kgDelta * KCAL_PER_KG_BODY_FAT) / daysLeft;
    const actualDailyNet = avgConsumed - tdee + avgBurned;
    // For loss, requiredDailyKcal is negative.
    const onTrack =
      kgDelta < 0
        ? actualDailyNet <= requiredDailyKcal * 0.85
        : actualDailyNet >= requiredDailyKcal * 0.85;

    insights.push({
      id: "goal-pace",
      title: "Goal pace",
      value: onTrack ? "On pace" : "Off pace",
      detail: `Need ${Math.round(requiredDailyKcal)} kcal/day net · averaging ${Math.round(actualDailyNet)}`,
      tone: onTrack ? "sage" : "coral",
      href: "/goals",
    });
  }

  // 6) Diet consistency (adherence to calorie target)
  if (calorieTarget != null && calorieTarget > 0 && loggedDays.length >= 2) {
    const ratios = loggedDays.map((d) => d.consumed / calorieTarget);
    // % of days within ±15% of target
    const adherentDays = ratios.filter((r) => r >= 0.85 && r <= 1.15).length;
    const adherence = Math.round((adherentDays / loggedDays.length) * 100);
    const intakes = loggedDays.map((d) => d.consumed);
    const cv = stdDev(intakes) / mean(intakes);

    insights.push({
      id: "consistency",
      title: "Consistency",
      value: `${adherence}%`,
      detail:
        cv < 0.2
          ? `Days near target · steady intake (${periodLabel.toLowerCase()})`
          : `Days near target · intake still swinging (${periodLabel.toLowerCase()})`,
      tone: adherence >= 70 ? "lime" : "amber",
    });
  } else if (calorieTarget != null && todayCalories > 0) {
    const ratio = todayCalories / calorieTarget;
    const pct = Math.round(ratio * 100);
    insights.push({
      id: "consistency",
      title: "Target hit",
      value: `${pct}%`,
      detail:
        ratio >= 0.85 && ratio <= 1.15
          ? "Today is within your calorie band"
          : "Today is outside your ±15% band",
      tone: ratio >= 0.85 && ratio <= 1.15 ? "lime" : "amber",
    });
  }

  // 7) Activity efficiency (kcal per km)
  const withDistance = activities.filter(
    (a) =>
      a.distance_meters != null &&
      Number(a.distance_meters) > 100 &&
      a.calories_burned != null &&
      Number(a.calories_burned) > 0,
  );
  if (withDistance.length > 0) {
    const totalKm = withDistance.reduce(
      (sum, a) => sum + Number(a.distance_meters) / 1000,
      0,
    );
    const totalKcal = withDistance.reduce(
      (sum, a) => sum + Number(a.calories_burned),
      0,
    );
    if (totalKm > 0) {
      const kcalPerKm = totalKcal / totalKm;
      insights.push({
        id: "activity-efficiency",
        title: "Move efficiency",
        value: `${Math.round(kcalPerKm)} kcal/km`,
        detail: `${round1(totalKm)} km · ${totalKcal} kcal across ${withDistance.length} activit${withDistance.length === 1 ? "y" : "ies"}`,
        tone: "spectrum",
        href: "/activities",
      });
    }
  }

  // Bonus if we have today burn vs BMR context
  if (
    profile.bmr_calories != null &&
    todayBurned > 0 &&
    !insights.some((i) => i.id === "activity-efficiency")
  ) {
    const pctOfBmr = Math.round((todayBurned / profile.bmr_calories) * 100);
    insights.push({
      id: "active-boost",
      title: "Active boost",
      value: `+${pctOfBmr}%`,
      detail: `${todayBurned} kcal burned on top of BMR today`,
      tone: "lime",
      href: "/activities",
    });
  }

  return insights;
}
