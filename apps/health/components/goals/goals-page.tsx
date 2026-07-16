"use client";

import * as React from "react";
import { Loader2, Plus, Target } from "lucide-react";

import { Button } from "@walls/ui/button";
import { Card, CardContent } from "@walls/ui/card";
import { Input } from "@walls/ui/input";

import type { HealthGoal } from "@/lib/goals-server";

const GOAL_PRESETS = [
  {
    name: "Workout 3x per week",
    goal_type: "workouts_per_week",
    target_value: 3,
    target_unit: "workouts",
    period: "weekly",
  },
  {
    name: "10k steps daily",
    goal_type: "daily_steps",
    target_value: 10000,
    target_unit: "steps",
    period: "daily",
  },
  {
    name: "30 km per week",
    goal_type: "weekly_distance_km",
    target_value: 30,
    target_unit: "km",
    period: "weekly",
  },
] as const;

export function GoalsPage() {
  const [goals, setGoals] = React.useState<HealthGoal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [customName, setCustomName] = React.useState("");

  const loadGoals = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/goals");
      if (!response.ok) return;
      const payload = (await response.json()) as { goals?: HealthGoal[] };
      setGoals(payload.goals ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  const createGoal = async (
    input: (typeof GOAL_PRESETS)[number] | {
      name: string;
      goal_type: string;
      target_value: number;
      target_unit: string;
      period: string;
    },
  ) => {
    setSaving(true);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (response.ok) {
        setCustomName("");
        await loadGoals();
      }
    } finally {
      setSaving(false);
    }
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
            Goals
          </h1>
          <p className="mt-1 text-sm font-light text-neutral-500">
            Fitness targets for Wallie to coach you on and track in your dashboard.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {GOAL_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              disabled={saving}
              className="rounded-full font-light"
              onClick={() => void createGoal(preset)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {preset.name}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Custom goal name"
            className="max-w-sm"
          />
          <Button
            disabled={saving || !customName.trim()}
            className="rounded-full bg-kenoo-yellow text-black hover:bg-kenoo-yellow"
            onClick={() =>
              void createGoal({
                name: customName.trim(),
                goal_type: "custom",
                target_value: 1,
                target_unit: "times",
                period: "weekly",
              })
            }
          >
            Add custom
          </Button>
        </div>

        {goals.length === 0 ? (
          <Card className="rounded-xl border-dashed border-neutral-200 shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Target className="h-8 w-8 text-neutral-300" />
              <p className="text-sm font-light text-neutral-500">
                No goals yet. Pick a preset or add your own.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <Card
                key={goal.id}
                className="rounded-xl border-neutral-200 shadow-none"
              >
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {goal.name}
                    </p>
                    <p className="mt-0.5 text-xs font-light text-neutral-500">
                      {goal.target_value} {goal.target_unit} · {goal.period}
                    </p>
                  </div>
                  <span
                    className={
                      goal.is_active
                        ? "text-[11px] font-medium uppercase tracking-wide text-emerald-600"
                        : "text-[11px] font-medium uppercase tracking-wide text-neutral-400"
                    }
                  >
                    {goal.is_active ? "Active" : "Inactive"}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
