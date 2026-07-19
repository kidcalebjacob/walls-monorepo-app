import { createClient } from "@walls/supabase/server";

import { type HealthDataScope, withHealthScope } from "@/lib/health-scope";

export type HealthDailySummary = {
  summary_date: string;
  steps: number | null;
  distance_walking_meters: number | null;
  flights_climbed: number | null;
  active_energy_kcal: number | null;
  basal_energy_kcal: number | null;
  exercise_minutes: number | null;
  stand_minutes: number | null;
  stand_hours: number | null;
  resting_heart_rate: number | null;
  avg_heart_rate: number | null;
  walking_heart_rate_avg: number | null;
  hrv_sdnn_ms: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  body_temperature_c: number | null;
  blood_glucose_mg_dl: number | null;
  vo2_max: number | null;
  mindfulness_minutes: number | null;
  sleep_asleep_minutes: number | null;
  sleep_in_bed_minutes: number | null;
  sleep_deep_minutes: number | null;
  sleep_rem_minutes: number | null;
  sleep_core_minutes: number | null;
  sleep_awake_minutes: number | null;
  apple_health_synced_at: string | null;
};

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asInteger(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed == null ? null : Math.round(parsed);
}

export async function listDailySummariesInRange(
  scope: HealthDataScope,
  startDate: string,
  endDate: string,
): Promise<HealthDailySummary[]> {
  const supabase = await createClient();
  const { data, error } = await withHealthScope(
    supabase
      .from("health_daily_summaries")
      .select(
        "summary_date, steps, distance_walking_meters, flights_climbed, active_energy_kcal, basal_energy_kcal, exercise_minutes, stand_minutes, stand_hours, resting_heart_rate, avg_heart_rate, walking_heart_rate_avg, hrv_sdnn_ms, respiratory_rate, oxygen_saturation, body_temperature_c, blood_glucose_mg_dl, vo2_max, mindfulness_minutes, sleep_asleep_minutes, sleep_in_bed_minutes, sleep_deep_minutes, sleep_rem_minutes, sleep_core_minutes, sleep_awake_minutes, apple_health_synced_at",
      )
      .gte("summary_date", startDate)
      .lte("summary_date", endDate)
      .order("summary_date", { ascending: true }),
    scope,
  );

  if (error) {
    console.error("[health] list daily summaries:", error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    summary_date: String(row.summary_date),
    steps: asInteger(row.steps),
    distance_walking_meters: asNumber(row.distance_walking_meters),
    flights_climbed: asNumber(row.flights_climbed),
    active_energy_kcal: asInteger(row.active_energy_kcal),
    basal_energy_kcal: asInteger(row.basal_energy_kcal),
    exercise_minutes: asInteger(row.exercise_minutes),
    stand_minutes: asInteger(row.stand_minutes),
    stand_hours: asInteger(row.stand_hours),
    resting_heart_rate: asInteger(row.resting_heart_rate),
    avg_heart_rate: asInteger(row.avg_heart_rate),
    walking_heart_rate_avg: asInteger(row.walking_heart_rate_avg),
    hrv_sdnn_ms: asNumber(row.hrv_sdnn_ms),
    respiratory_rate: asNumber(row.respiratory_rate),
    oxygen_saturation: asNumber(row.oxygen_saturation),
    body_temperature_c: asNumber(row.body_temperature_c),
    blood_glucose_mg_dl: asNumber(row.blood_glucose_mg_dl),
    vo2_max: asNumber(row.vo2_max),
    mindfulness_minutes: asInteger(row.mindfulness_minutes),
    sleep_asleep_minutes: asInteger(row.sleep_asleep_minutes),
    sleep_in_bed_minutes: asInteger(row.sleep_in_bed_minutes),
    sleep_deep_minutes: asInteger(row.sleep_deep_minutes),
    sleep_rem_minutes: asInteger(row.sleep_rem_minutes),
    sleep_core_minutes: asInteger(row.sleep_core_minutes),
    sleep_awake_minutes: asInteger(row.sleep_awake_minutes),
    apple_health_synced_at:
      row.apple_health_synced_at != null
        ? String(row.apple_health_synced_at)
        : null,
  }));
}
