import { NextResponse } from "next/server";

import { getHealthDataScope } from "@/lib/health-scope";
import {
  ensureHealthProfile,
  estimateBmr,
  estimateTdee,
  getUserBirthDate,
  updateHealthProfile,
  type HealthProfileInput,
} from "@/lib/profile-server";
import { insertWeightLog } from "@/lib/weight-logs-server";

export async function GET() {
  const scope = await getHealthDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureHealthProfile(scope);
  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const scope = await getHealthDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HealthProfileInput;
  const existing = await ensureHealthProfile(scope);
  const merged = { ...existing, ...body };
  const birthDate = await getUserBirthDate(scope);

  const bmr =
    body.bmr_calories ??
    estimateBmr(merged, birthDate) ??
    existing.bmr_calories;
  const tdee =
    body.tdee_calories ??
    (bmr != null ? estimateTdee(bmr, merged.activity_level) : null) ??
    existing.tdee_calories;

  const calorieTarget =
    body.calorie_target_daily ??
    existing.calorie_target_daily ??
    (tdee != null ? Math.max(1200, tdee) : null);

  const profile = await updateHealthProfile(scope, {
    ...body,
    bmr_calories: bmr,
    tdee_calories: tdee,
    calorie_target_daily: calorieTarget,
  });

  // Record a weight-log entry whenever the saved weight changes so we can
  // chart weight loss over time.
  const newWeight = body.current_weight_kg;
  if (
    newWeight != null &&
    Number.isFinite(Number(newWeight)) &&
    Number(newWeight) !== existing.current_weight_kg
  ) {
    await insertWeightLog(scope, {
      weight_kg: Number(newWeight),
      source: "manual",
      source_metadata: { origin: "settings" },
    });
  }

  return NextResponse.json({ profile });
}
