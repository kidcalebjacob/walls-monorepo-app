import type { HealthDataScope } from "@/lib/health-scope";
import { withHealthScope } from "@/lib/health-scope";
import { createClient } from "@walls/supabase/server";

export type HealthProfile = {
  id: string;
  user_id: string;
  sex: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  activity_level: string;
  bmr_calories: number | null;
  tdee_calories: number | null;
  calorie_target_daily: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  fiber_target_g: number | null;
  sugar_limit_g: number | null;
  sodium_limit_mg: number | null;
  goal_type: string;
  target_weight_kg: number | null;
  target_date: string | null;
  unit_system: "metric" | "imperial";
  timezone: string;
  settings: Record<string, unknown>;
};

export type HealthProfileInput = Partial<
  Omit<HealthProfile, "id" | "user_id" | "settings">
> & {
  settings?: Record<string, unknown>;
};

const DEFAULT_PROFILE: Omit<HealthProfileInput, "settings"> = {
  activity_level: "moderate",
  goal_type: "maintain",
  unit_system: "imperial",
  timezone: "America/New_York",
};

export async function getHealthProfile(
  scope: HealthDataScope,
): Promise<HealthProfile | null> {
  const supabase = await createClient();
  const { data, error } = await withHealthScope(
    supabase.from("health_profiles").select("*"),
    scope,
  ).maybeSingle();

  if (error) {
    console.error("[health] get profile:", error);
    return null;
  }

  return (data as HealthProfile | null) ?? null;
}

export async function ensureHealthProfile(
  scope: HealthDataScope,
): Promise<HealthProfile> {
  const existing = await getHealthProfile(scope);
  if (existing) return existing;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_profiles")
    .insert({
      user_id: scope.userId,
      ...DEFAULT_PROFILE,
      settings: {},
    })
    .select("*")
    .single();

  if (error) {
    console.error("[health] create profile:", error);
    throw error;
  }

  return data as HealthProfile;
}

export async function updateHealthProfile(
  scope: HealthDataScope,
  input: HealthProfileInput,
): Promise<HealthProfile> {
  await ensureHealthProfile(scope);
  const supabase = await createClient();

  const { data, error } = await withHealthScope(
    supabase.from("health_profiles").update(input).select("*"),
    scope,
  ).single();

  if (error) {
    console.error("[health] update profile:", error);
    throw error;
  }

  return data as HealthProfile;
}

/** Birth date lives on public.users (single source of truth), not health_profiles. */
export async function getUserBirthDate(
  scope: HealthDataScope,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("date_of_birth")
    .eq("id", scope.userId)
    .maybeSingle();

  if (error) {
    console.error("[health] get user birth date:", error);
    return null;
  }

  return (data?.date_of_birth as string | null) ?? null;
}

/**
 * Prefer `users.timezone` (settings), then health profile, then Eastern.
 */
export async function resolveHealthTimezone(
  scope: HealthDataScope,
): Promise<string> {
  const supabase = await createClient();
  const [{ data: user }, profile] = await Promise.all([
    supabase
      .from("users")
      .select("timezone")
      .eq("id", scope.userId)
      .maybeSingle(),
    ensureHealthProfile(scope),
  ]);

  const userTz =
    typeof user?.timezone === "string" ? user.timezone.trim() : "";
  const healthTz =
    typeof profile.timezone === "string" ? profile.timezone.trim() : "";

  return userTz || healthTz || DEFAULT_PROFILE.timezone || "America/New_York";
}

export function estimateBmr(
  profile: Pick<HealthProfile, "sex" | "height_cm" | "current_weight_kg">,
  birthDate: string | null,
): number | null {
  const { sex, height_cm, current_weight_kg } = profile;
  if (!birthDate || !height_cm || !current_weight_kg) return null;

  const age =
    new Date().getFullYear() - new Date(birthDate).getFullYear();
  const weight = Number(current_weight_kg);
  const height = Number(height_cm);

  if (!Number.isFinite(age) || !Number.isFinite(weight) || !Number.isFinite(height)) {
    return null;
  }

  if (sex === "female") {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }

  return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function estimateTdee(
  bmr: number,
  activityLevel: string,
): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  return Math.round(bmr * multiplier);
}
