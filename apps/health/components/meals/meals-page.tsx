"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@walls/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@walls/ui/card";
import { Input } from "@walls/ui/input";

import type { MealWithItems } from "@/lib/meals-server";
import { formatCalories, mealTypeLabel } from "@/lib/format-health";
import type { MealType } from "@/lib/meals-server";

const MEAL_TYPES: MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
];

export function MealsPage() {
  const [meals, setMeals] = React.useState<MealWithItems[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [mealType, setMealType] = React.useState<MealType>("lunch");
  const [itemName, setItemName] = React.useState("");
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");

  const loadMeals = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/meals");
      if (!response.ok) return;
      const payload = (await response.json()) as { meals?: MealWithItems[] };
      setMeals(payload.meals ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadMeals();
  }, [loadMeals]);

  const handleLogMeal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemName.trim() || !calories) return;

    setSaving(true);
    try {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_type: mealType,
          items: [
            {
              name: itemName.trim(),
              calories: Number(calories),
              protein_g: protein ? Number(protein) : 0,
              carbs_g: carbs ? Number(carbs) : 0,
              fat_g: fat ? Number(fat) : 0,
            },
          ],
        }),
      });

      if (!response.ok) return;

      setItemName("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      await loadMeals();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mealId: string) => {
    await fetch(`/api/meals?id=${mealId}`, { method: "DELETE" });
    await loadMeals();
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-kenoo-white px-6 py-8 md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-neutral-900">
            Meals
          </h1>
          <p className="mt-1 text-sm font-light text-neutral-500">
            Log what you ate today. Wallie can do this for you in chat soon.
          </p>
        </div>

        <Card className="rounded-xl border-neutral-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">Quick log</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogMeal} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="meal-type" className="text-sm font-medium text-neutral-700">
                    Meal
                  </label>
                  <select
                    id="meal-type"
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as MealType)}
                    className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
                  >
                    {MEAL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {mealTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="item-name" className="text-sm font-medium text-neutral-700">
                    Food / meal
                  </label>
                  <Input
                    id="item-name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Chicken salad bowl"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-2">
                  <label htmlFor="calories" className="text-sm font-medium text-neutral-700">
                    Calories
                  </label>
                  <Input
                    id="calories"
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="650"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="protein" className="text-sm font-medium text-neutral-700">
                    Protein (g)
                  </label>
                  <Input
                    id="protein"
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    placeholder="40"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="carbs" className="text-sm font-medium text-neutral-700">
                    Carbs (g)
                  </label>
                  <Input
                    id="carbs"
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    placeholder="55"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="fat" className="text-sm font-medium text-neutral-700">
                    Fat (g)
                  </label>
                  <Input
                    id="fat"
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    placeholder="22"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving || !itemName.trim() || !calories}
                className="rounded-full bg-kenoo-yellow text-black hover:bg-kenoo-yellow"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {saving ? "Saving…" : "Log meal"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Today
          </h2>
          {meals.length === 0 ? (
            <p className="text-sm font-light text-neutral-400">
              No meals logged yet today.
            </p>
          ) : (
            meals.map((meal) => (
              <Card
                key={meal.id}
                className="rounded-xl border-neutral-200 shadow-none"
              >
                <CardContent className="flex items-start justify-between gap-4 pt-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {meal.name ?? mealTypeLabel(meal.meal_type)}
                    </p>
                    <p className="mt-0.5 text-xs font-light text-neutral-500">
                      {mealTypeLabel(meal.meal_type)} ·{" "}
                      {formatCalories(meal.calories)} cal
                    </p>
                    <ul className="mt-3 space-y-1">
                      {meal.items.map((item) => (
                        <li
                          key={item.id}
                          className="text-xs font-light text-neutral-600"
                        >
                          {item.name} — {formatCalories(item.calories)} cal
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-neutral-400 hover:text-red-600"
                    onClick={() => void handleDelete(meal.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
