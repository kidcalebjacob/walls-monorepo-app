import { createClient } from "@walls/supabase/server";

import type { HealthDataScope } from "@/lib/health-scope";
import { healthScopeFields, withHealthScope } from "@/lib/health-scope";
import { resolveHealthTimezone } from "@/lib/profile-server";
import { todayDateKey } from "@/lib/time-range";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";

export type HealthMeal = {
  id: string;
  user_id: string;
  meal_date: string;
  logged_at: string;
  meal_type: MealType;
  name: string | null;
  notes: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  source: string;
};

export type HealthMealItem = {
  id: string;
  meal_id: string;
  name: string;
  quantity: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  sort_order: number;
};

export type MealWithItems = HealthMeal & {
  items: HealthMealItem[];
};

export type LogMealInput = {
  meal_date?: string;
  meal_type: MealType;
  name?: string;
  notes?: string;
  items: Array<{
    name: string;
    quantity?: number;
    serving_unit?: string;
    calories: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  }>;
  source?: string;
};

function sumItems(items: LogMealInput["items"]) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + (item.calories ?? 0),
      protein_g: acc.protein_g + (item.protein_g ?? 0),
      carbs_g: acc.carbs_g + (item.carbs_g ?? 0),
      fat_g: acc.fat_g + (item.fat_g ?? 0),
      fiber_g: acc.fiber_g + (item.fiber_g ?? 0),
      sugar_g: acc.sugar_g + (item.sugar_g ?? 0),
      sodium_mg: acc.sodium_mg + (item.sodium_mg ?? 0),
    }),
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    },
  );
}

export async function listMealsForDate(
  scope: HealthDataScope,
  mealDate: string,
): Promise<MealWithItems[]> {
  const supabase = await createClient();
  const { data: meals, error } = await withHealthScope(
    supabase
      .from("health_meals")
      .select("*")
      .eq("meal_date", mealDate)
      .order("logged_at", { ascending: true }),
    scope,
  );

  if (error) {
    console.error("[health] list meals:", error);
    return [];
  }

  const mealRows = (meals ?? []) as HealthMeal[];
  if (mealRows.length === 0) return [];

  const mealIds = mealRows.map((meal) => meal.id);
  const { data: items, error: itemsError } = await withHealthScope(
    supabase
      .from("health_meal_items")
      .select("*")
      .in("meal_id", mealIds)
      .order("sort_order", { ascending: true }),
    scope,
  );

  if (itemsError) {
    console.error("[health] list meal items:", itemsError);
    return mealRows.map((meal) => ({ ...meal, items: [] }));
  }

  const itemsByMeal = new Map<string, HealthMealItem[]>();
  for (const item of (items ?? []) as HealthMealItem[]) {
    const list = itemsByMeal.get(item.meal_id) ?? [];
    list.push(item);
    itemsByMeal.set(item.meal_id, list);
  }

  return mealRows.map((meal) => ({
    ...meal,
    items: itemsByMeal.get(meal.id) ?? [],
  }));
}

export async function listMealsInRange(
  scope: HealthDataScope,
  startDate: string,
  endDate: string,
): Promise<HealthMeal[]> {
  const supabase = await createClient();
  const { data, error } = await withHealthScope(
    supabase
      .from("health_meals")
      .select("*")
      .gte("meal_date", startDate)
      .lte("meal_date", endDate)
      .order("meal_date", { ascending: true }),
    scope,
  );

  if (error) {
    console.error("[health] list meals in range:", error);
    return [];
  }

  return (data ?? []) as HealthMeal[];
}

export async function logMeal(
  scope: HealthDataScope,
  input: LogMealInput,
): Promise<MealWithItems> {
  const supabase = await createClient();
  const totals = sumItems(input.items);
  const timeZone = await resolveHealthTimezone(scope);
  const mealDate = input.meal_date ?? todayDateKey(timeZone);

  const { data: meal, error: mealError } = await supabase
    .from("health_meals")
    .insert({
      ...healthScopeFields(scope),
      meal_date: mealDate,
      meal_type: input.meal_type,
      name: input.name ?? null,
      notes: input.notes ?? null,
      ...totals,
      source: input.source ?? "manual",
    })
    .select("*")
    .single();

  if (mealError) {
    console.error("[health] log meal:", mealError);
    throw mealError;
  }

  const mealRow = meal as HealthMeal;
  const itemRows = input.items.map((item, index) => ({
    ...healthScopeFields(scope),
    meal_id: mealRow.id,
    name: item.name,
    quantity: item.quantity ?? 1,
    serving_unit: item.serving_unit ?? "serving",
    calories: item.calories,
    protein_g: item.protein_g ?? 0,
    carbs_g: item.carbs_g ?? 0,
    fat_g: item.fat_g ?? 0,
    fiber_g: item.fiber_g ?? 0,
    sugar_g: item.sugar_g ?? 0,
    sodium_mg: item.sodium_mg ?? 0,
    sort_order: index,
    source: input.source ?? "manual",
  }));

  const { data: items, error: itemsError } = await supabase
    .from("health_meal_items")
    .insert(itemRows)
    .select("*");

  if (itemsError) {
    console.error("[health] log meal items:", itemsError);
    throw itemsError;
  }

  return {
    ...mealRow,
    items: (items ?? []) as HealthMealItem[],
  };
}

export async function deleteMeal(
  scope: HealthDataScope,
  mealId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await withHealthScope(
    supabase.from("health_meals").delete().eq("id", mealId),
    scope,
  );

  if (error) {
    console.error("[health] delete meal:", error);
    throw error;
  }
}
