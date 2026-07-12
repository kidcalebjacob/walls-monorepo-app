import { createAdminClient } from "@walls/supabase/admin";

import { estimateCaloriesBurned } from "@/lib/calorie-estimator";
import { getStravaConnectionWithTokens } from "@/lib/connections-server";
import { refreshStravaToken } from "@/lib/strava-oauth";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const PER_PAGE = 200;
// Safety cap so a runaway loop can't hammer Strava's API. 50 * 200 = 10k
// activities, well beyond any realistic athlete history for a manual sync.
const MAX_PAGES = 50;
// Refresh the access token if it expires within this window.
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type HealthActivityType =
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

/** Strava `SummaryActivity` fields we care about (athlete/activities list). */
type StravaSummaryActivity = {
  id: number;
  name?: string | null;
  type?: string | null;
  sport_type?: string | null;
  start_date?: string | null;
  elapsed_time?: number | null;
  moving_time?: number | null;
  distance?: number | null;
  total_elevation_gain?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_speed?: number | null;
  kilojoules?: number | null;
  // Only present on detailed activity responses, but honored when Strava
  // happens to include it so we always prefer a provider-reported figure.
  calories?: number | null;
};

/** Athlete context used to estimate calories when Strava doesn't report them. */
type AthleteMetrics = {
  weightKg: number | null;
  sex: "male" | "female" | "other" | null;
  ageYears: number | null;
};

export type StravaSyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
};

// Strava sport_type / type -> our health_activities.activity_type enum.
const SPORT_TYPE_MAP: Record<string, HealthActivityType> = {
  Run: "run",
  TrailRun: "run",
  VirtualRun: "run",
  Ride: "ride",
  MountainBikeRide: "ride",
  GravelRide: "ride",
  VirtualRide: "ride",
  EBikeRide: "ride",
  EMountainBikeRide: "ride",
  Handcycle: "ride",
  Velomobile: "ride",
  Swim: "swim",
  Walk: "walk",
  Hike: "hike",
  Yoga: "yoga",
  WeightTraining: "strength",
  Crossfit: "crossfit",
  Workout: "workout",
};

// Anything competitive/ball-sport-ish that isn't mapped above lands on "sport".
const SPORT_KEYWORDS = [
  "Soccer",
  "Tennis",
  "Golf",
  "Ski",
  "Snowboard",
  "Skate",
  "Surf",
  "Row",
  "Kayak",
  "Canoe",
  "Climb",
  "Sail",
  "Windsurf",
  "Badminton",
  "Squash",
  "Racquet",
  "Hockey",
  "Basketball",
  "Volleyball",
];

function mapActivityType(activity: StravaSummaryActivity): HealthActivityType {
  const sport = activity.sport_type ?? activity.type ?? "";
  if (SPORT_TYPE_MAP[sport]) return SPORT_TYPE_MAP[sport];
  if (SPORT_KEYWORDS.some((keyword) => sport.includes(keyword))) return "sport";
  return "other";
}

function toSmallInt(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age > 0 && age < 130 ? age : null;
}

/**
 * Pulls the athlete's weight, sex and age so the calorie estimator can produce
 * personalized figures. All fields are optional; missing data just narrows how
 * accurate (or possible) an estimate can be.
 */
async function getAthleteMetrics(userId: string): Promise<AthleteMetrics> {
  const admin = createAdminClient();

  const [{ data: profile }, { data: user }] = await Promise.all([
    admin
      .from("health_profiles")
      .select("current_weight_kg, sex")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("users")
      .select("date_of_birth")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const rawSex = (profile?.sex as string | null) ?? null;
  const sex =
    rawSex === "male" || rawSex === "female" || rawSex === "other"
      ? rawSex
      : null;

  return {
    weightKg:
      profile?.current_weight_kg != null
        ? Number(profile.current_weight_kg)
        : null,
    sex,
    ageYears: ageFromBirthDate(user?.date_of_birth as string | null),
  };
}

/**
 * Calories burned for an activity. Prefers a provider-reported figure (Strava's
 * detailed `calories`, or `kilojoules` which ~= kcal for rides) and falls back
 * to our own MET/heart-rate estimate so every activity gets a value.
 */
function resolveCaloriesBurned(
  activity: StravaSummaryActivity,
  activityType: HealthActivityType,
  metrics: AthleteMetrics,
): number | null {
  if (activity.calories != null && activity.calories > 0) {
    return Math.round(activity.calories);
  }
  if (activity.kilojoules != null && activity.kilojoules > 0) {
    return Math.round(activity.kilojoules);
  }

  const { calories } = estimateCaloriesBurned({
    activityType,
    durationSeconds: activity.moving_time ?? activity.elapsed_time ?? null,
    distanceMeters: activity.distance ?? null,
    elevationGainMeters: activity.total_elevation_gain ?? null,
    avgSpeedMps: activity.average_speed ?? null,
    avgHeartRate: activity.average_heartrate ?? null,
    weightKg: metrics.weightKg,
    sex: metrics.sex,
    ageYears: metrics.ageYears,
  });

  return calories;
}

/**
 * Returns a valid Strava access token, refreshing (and persisting the rotated
 * tokens) when the stored one is missing or about to expire.
 */
async function getValidAccessToken(connection: {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string | null;
}): Promise<string> {
  const expiresAt = connection.token_expiry
    ? new Date(connection.token_expiry).getTime()
    : 0;

  if (connection.access_token && expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
    return connection.access_token;
  }

  const refreshed = await refreshStravaToken(connection.refresh_token);

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("user_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expiry: new Date(refreshed.expires_at * 1000).toISOString(),
      last_token_refresh: now,
      updated_at: now,
    })
    .eq("id", connection.id);

  if (error) throw error;

  return refreshed.access_token;
}

async function fetchActivityPage(
  accessToken: string,
  page: number,
): Promise<StravaSummaryActivity[]> {
  const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava activities fetch failed (${response.status}): ${body}`);
  }

  return (await response.json()) as StravaSummaryActivity[];
}

function toActivityRow(
  activity: StravaSummaryActivity,
  userId: string,
  connectionId: string,
  metrics: AthleteMetrics,
) {
  const activityType = mapActivityType(activity);
  return {
    user_id: userId,
    user_connection_id: connectionId,
    provider: "strava" as const,
    provider_activity_id: String(activity.id),
    activity_type: activityType,
    name: activity.name ?? null,
    started_at: activity.start_date ?? null,
    duration_seconds: activity.moving_time ?? activity.elapsed_time ?? null,
    distance_meters: activity.distance ?? null,
    elevation_gain_meters: activity.total_elevation_gain ?? null,
    // Prefer Strava's own calorie figure; otherwise estimate from activity
    // type, athlete weight and (when available) heart rate. See
    // `resolveCaloriesBurned` / `calorie-estimator.ts`.
    calories_burned: resolveCaloriesBurned(activity, activityType, metrics),
    avg_heart_rate: toSmallInt(activity.average_heartrate),
    max_heart_rate: toSmallInt(activity.max_heartrate),
    avg_speed_mps: activity.average_speed ?? null,
    raw_payload: activity as unknown as Record<string, unknown>,
  };
}

/**
 * Pulls the full Strava activity history for the user's connected account into
 * `health_activities`. Idempotent: existing activities (matched on
 * `provider_activity_id`) are updated in place rather than duplicated.
 */
export async function syncStravaActivities(
  userId: string,
): Promise<StravaSyncResult> {
  const connection = await getStravaConnectionWithTokens(userId);
  if (!connection) {
    throw new Error("No Strava connection found for user.");
  }

  const accessToken = await getValidAccessToken(connection);
  const admin = createAdminClient();
  const athleteMetrics = await getAthleteMetrics(userId);

  // Existing provider ids for this connection, so we can split insert vs update
  // (avoids relying on the partial unique index for ON CONFLICT inference).
  const { data: existingRows, error: existingError } = await admin
    .from("health_activities")
    .select("id, provider_activity_id")
    .eq("user_connection_id", connection.id);

  if (existingError) throw existingError;

  const existingByProviderId = new Map<string, string>();
  for (const row of existingRows ?? []) {
    if (row.provider_activity_id) {
      existingByProviderId.set(row.provider_activity_id, row.id as string);
    }
  }

  let fetched = 0;
  let inserted = 0;
  let updated = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const activities = await fetchActivityPage(accessToken, page);
    if (activities.length === 0) break;

    const toInsert: ReturnType<typeof toActivityRow>[] = [];

    for (const activity of activities) {
      if (activity.id == null || !activity.start_date) continue;
      fetched += 1;

      const providerId = String(activity.id);
      const row = toActivityRow(activity, userId, connection.id, athleteMetrics);
      const existingId = existingByProviderId.get(providerId);

      if (existingId) {
        const { error } = await admin
          .from("health_activities")
          .update(row)
          .eq("id", existingId);
        if (error) throw error;
        updated += 1;
      } else {
        toInsert.push(row);
      }
    }

    if (toInsert.length > 0) {
      const { error } = await admin.from("health_activities").insert(toInsert);
      if (error) throw error;
      inserted += toInsert.length;
      for (const row of toInsert) {
        if (row.provider_activity_id) {
          existingByProviderId.set(row.provider_activity_id, "inserted");
        }
      }
    }

    if (activities.length < PER_PAGE) break;
  }

  const now = new Date().toISOString();
  await admin.from("health_sync_state").upsert(
    {
      user_id: userId,
      user_connection_id: connection.id,
      provider: "strava",
      sync_status: "idle",
      last_full_sync_at: now,
      last_incremental_sync_at: now,
      last_error: null,
      updated_at: now,
    },
    { onConflict: "user_connection_id" },
  );

  return { fetched, inserted, updated };
}
