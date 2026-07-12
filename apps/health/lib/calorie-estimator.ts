/**
 * Calorie-burn estimator for synced activities.
 *
 * Strava's summary activity feed only reports `kilojoules` (mechanical work,
 * effectively kcal for rides). Most activity types — runs, walks, swims,
 * strength, etc. — come back with no calorie figure at all. This module fills
 * that gap so every activity gets a reasonable `calories_burned` value.
 *
 * Estimation strategy, in order of accuracy:
 *   1. Heart-rate based (Keytel et al. 2005) when we have avg HR + the athlete's
 *      age, sex and weight. This is the most personalized.
 *   2. MET based (Compendium of Physical Activities) using activity type,
 *      body weight and duration. Speed/grade refine running & walking METs via
 *      ACSM metabolic equations.
 *
 * Everything is a best-effort estimate: if we lack the minimum inputs (a body
 * weight and a duration) we return null and leave `calories_burned` empty.
 */

export type HealthActivityType =
  | "run"
  | "ride"
  | "swim"
  | "walk"
  | "hike"
  | "workout"
  | "yoga"
  | "strength"
  | "crossfit"
  | "sport"
  | "other";

export type CalorieEstimateInput = {
  activityType: HealthActivityType;
  /** Duration of the effort in seconds (prefer moving time). */
  durationSeconds: number | null | undefined;
  /** Total distance in meters (optional, refines run/walk/ride METs). */
  distanceMeters?: number | null;
  /** Total elevation gain in meters (optional, adds grade to run/walk). */
  elevationGainMeters?: number | null;
  /** Average speed in meters/second (optional, preferred over distance/time). */
  avgSpeedMps?: number | null;
  /** Average heart rate in bpm (optional, enables HR-based estimate). */
  avgHeartRate?: number | null;
  /** Athlete body weight in kilograms. Required for any estimate. */
  weightKg?: number | null;
  /** Athlete biological sex, used by the HR formula. */
  sex?: "male" | "female" | "other" | string | null;
  /** Athlete age in years, used by the HR formula. */
  ageYears?: number | null;
};

export type CalorieEstimateMethod = "heart_rate" | "met" | null;

export type CalorieEstimate = {
  /** Estimated calories burned (kcal), or null when we lack the inputs. */
  calories: number | null;
  /** Which model produced the estimate. */
  method: CalorieEstimateMethod;
  /** MET value used (only when method === "met"). */
  met?: number;
};

/**
 * Baseline MET values (Compendium of Physical Activities, 2011). Used when we
 * can't refine intensity from speed. Chosen toward the "general" effort for
 * each bucket rather than the extremes.
 */
const BASE_MET: Record<HealthActivityType, number> = {
  run: 9.8,
  ride: 7.5,
  swim: 7.0,
  walk: 3.5,
  hike: 6.0,
  workout: 5.0,
  yoga: 3.0,
  strength: 5.0,
  crossfit: 8.0,
  sport: 7.0,
  other: 4.5,
};

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
/** Resting VO2 in ml/kg/min; 1 MET. */
const REST_VO2 = 3.5;

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Speed in meters/second, preferring the reported average speed and falling
 * back to distance / duration.
 */
function resolveSpeedMps(input: CalorieEstimateInput): number | null {
  const avg = toFiniteNumber(input.avgSpeedMps);
  if (avg != null && avg > 0) return avg;

  const distance = toFiniteNumber(input.distanceMeters);
  const duration = toFiniteNumber(input.durationSeconds);
  if (distance != null && distance > 0 && duration != null && duration > 0) {
    return distance / duration;
  }
  return null;
}

/** Fractional grade (rise/run) from elevation gain over distance. */
function resolveGrade(input: CalorieEstimateInput): number {
  const elevation = toFiniteNumber(input.elevationGainMeters);
  const distance = toFiniteNumber(input.distanceMeters);
  if (elevation == null || distance == null || distance <= 0) return 0;
  // Elevation gain is one-directional; halve it to approximate average grade
  // across the whole route and clamp to a sane treadmill-style range.
  const grade = elevation / distance / 2;
  return Math.min(Math.max(grade, 0), 0.3);
}

/**
 * Running MET via the ACSM running equation:
 *   VO2 = 0.2 * speed(m/min) + 0.9 * speed(m/min) * grade + 3.5
 */
function runningMet(speedMps: number, grade: number): number {
  const speedMPerMin = speedMps * SECONDS_PER_MINUTE;
  const vo2 = 0.2 * speedMPerMin + 0.9 * speedMPerMin * grade + REST_VO2;
  return vo2 / REST_VO2;
}

/**
 * Walking MET via the ACSM walking equation:
 *   VO2 = 0.1 * speed(m/min) + 1.8 * speed(m/min) * grade + 3.5
 */
function walkingMet(speedMps: number, grade: number): number {
  const speedMPerMin = speedMps * SECONDS_PER_MINUTE;
  const vo2 = 0.1 * speedMPerMin + 1.8 * speedMPerMin * grade + REST_VO2;
  return vo2 / REST_VO2;
}

/** Cycling MET from speed (Compendium buckets, km/h). */
function cyclingMet(speedMps: number): number {
  const kmh = speedMps * 3.6;
  if (kmh < 16) return 4.0;
  if (kmh < 19) return 6.8;
  if (kmh < 22) return 8.0;
  if (kmh < 25) return 10.0;
  if (kmh < 30) return 12.0;
  return 15.8;
}

/**
 * Resolves the MET value for an activity, refining by speed/grade where the
 * activity type has a well-established metabolic equation.
 */
function resolveMet(input: CalorieEstimateInput): number {
  const speedMps = resolveSpeedMps(input);
  const grade = resolveGrade(input);

  switch (input.activityType) {
    case "run":
      return speedMps != null && speedMps > 0
        ? runningMet(speedMps, grade)
        : BASE_MET.run;
    case "walk":
    case "hike": {
      if (speedMps == null || speedMps <= 0) return BASE_MET[input.activityType];
      const met = walkingMet(speedMps, grade);
      // Hiking on rough terrain runs higher than flat walking; keep a floor.
      return input.activityType === "hike" ? Math.max(met, BASE_MET.hike) : met;
    }
    case "ride":
      return speedMps != null && speedMps > 0
        ? cyclingMet(speedMps)
        : BASE_MET.ride;
    default:
      return BASE_MET[input.activityType] ?? BASE_MET.other;
  }
}

/**
 * MET-based burn: calories = MET * 3.5 * weightKg / 200 * minutes,
 * equivalent to MET * weightKg * hours (the classic Compendium formula).
 */
function metCalories(met: number, weightKg: number, durationSeconds: number): number {
  const hours = durationSeconds / SECONDS_PER_HOUR;
  return met * weightKg * hours;
}

/**
 * Heart-rate based burn using the Keytel et al. (2005) regression. Returns
 * kcal/min * minutes. HR must be in a plausible exercise range for the model
 * to be meaningful.
 */
function heartRateCalories(params: {
  avgHeartRate: number;
  weightKg: number;
  ageYears: number;
  sex: "male" | "female" | "other" | string;
  durationSeconds: number;
}): number {
  const { avgHeartRate, weightKg, ageYears, sex, durationSeconds } = params;
  const minutes = durationSeconds / SECONDS_PER_MINUTE;

  // Keytel formula, kcal/min. Female coefficients used for female; male
  // coefficients cover male and unspecified/other.
  const perMinute =
    sex === "female"
      ? (-20.4022 +
          0.4472 * avgHeartRate -
          0.1263 * weightKg +
          0.074 * ageYears) /
        4.184
      : (-55.0969 +
          0.6309 * avgHeartRate +
          0.1988 * weightKg +
          0.2017 * ageYears) /
        4.184;

  return perMinute * minutes;
}

/**
 * Estimates calories burned for a single activity. Prefers a heart-rate model
 * when the necessary athlete data + avg HR are present, otherwise falls back to
 * a MET-based estimate. Returns `{ calories: null }` when there isn't enough
 * data (no weight or no duration).
 */
export function estimateCaloriesBurned(
  input: CalorieEstimateInput,
): CalorieEstimate {
  const weightKg = toFiniteNumber(input.weightKg);
  const durationSeconds = toFiniteNumber(input.durationSeconds);

  if (weightKg == null || weightKg <= 0) return { calories: null, method: null };
  if (durationSeconds == null || durationSeconds <= 0) {
    return { calories: null, method: null };
  }

  const avgHeartRate = toFiniteNumber(input.avgHeartRate);
  const ageYears = toFiniteNumber(input.ageYears);

  // Heart-rate model: most personalized, but only trustworthy with a real
  // exercise HR and the athlete's age.
  if (
    avgHeartRate != null &&
    avgHeartRate >= 60 &&
    avgHeartRate <= 220 &&
    ageYears != null &&
    ageYears > 0
  ) {
    const calories = heartRateCalories({
      avgHeartRate,
      weightKg,
      ageYears,
      sex: input.sex ?? "male",
      durationSeconds,
    });
    // The regression can go slightly negative at very low HR; guard against it.
    if (calories > 0) {
      return { calories: Math.round(calories), method: "heart_rate" };
    }
  }

  // MET fallback.
  const met = resolveMet(input);
  const calories = metCalories(met, weightKg, durationSeconds);
  if (calories <= 0) return { calories: null, method: null };

  return {
    calories: Math.round(calories),
    method: "met",
    met: Math.round(met * 10) / 10,
  };
}
