import type { HealthDataScope } from "@/lib/health-scope";
import { healthScopeFields } from "@/lib/health-scope";
import { createClient } from "@walls/supabase/server";

export type WeightLog = {
  id: string;
  user_id: string;
  logged_at: string;
  weight_kg: number;
  body_fat_percent: number | null;
  source: "manual" | "wallie" | "scale" | "import";
  notes: string | null;
  source_metadata: Record<string, unknown>;
};

export type WeightLogInput = {
  weight_kg: number;
  logged_at?: string;
  body_fat_percent?: number | null;
  source?: WeightLog["source"];
  notes?: string | null;
  source_metadata?: Record<string, unknown>;
};

export async function insertWeightLog(
  scope: HealthDataScope,
  input: WeightLogInput,
): Promise<WeightLog | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("health_weight_logs")
    .insert({
      ...healthScopeFields(scope),
      weight_kg: input.weight_kg,
      logged_at: input.logged_at ?? new Date().toISOString(),
      body_fat_percent: input.body_fat_percent ?? null,
      source: input.source ?? "manual",
      notes: input.notes ?? null,
      source_metadata: input.source_metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    console.error("[health] insert weight log:", error);
    return null;
  }

  return data as WeightLog;
}
