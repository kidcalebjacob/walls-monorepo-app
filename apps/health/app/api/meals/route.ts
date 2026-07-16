import { NextResponse } from "next/server";

import { getHealthDataScope } from "@/lib/health-scope";
import {
  deleteMeal,
  listMealsForDate,
  logMeal,
  type LogMealInput,
} from "@/lib/meals-server";
import { resolveHealthTimezone } from "@/lib/profile-server";
import { todayDateKey } from "@/lib/time-range";

export async function GET(request: Request) {
  const scope = await getHealthDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeZone = await resolveHealthTimezone(scope);
  const mealDate = searchParams.get("date") ?? todayDateKey(timeZone);
  const meals = await listMealsForDate(scope, mealDate);
  return NextResponse.json({ meals, mealDate });
}

export async function POST(request: Request) {
  const scope = await getHealthDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as LogMealInput;
  if (!body.meal_type || !body.items?.length) {
    return NextResponse.json(
      { error: "meal_type and at least one item are required" },
      { status: 400 },
    );
  }

  const meal = await logMeal(scope, body);
  return NextResponse.json({ meal });
}

export async function DELETE(request: Request) {
  const scope = await getHealthDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mealId = searchParams.get("id");
  if (!mealId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await deleteMeal(scope, mealId);
  return NextResponse.json({ ok: true });
}
