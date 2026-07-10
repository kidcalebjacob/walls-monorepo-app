import { createClient } from "@walls/supabase/server";

import {
  type AdDataScope,
  adScopeFields,
  withAdScope,
} from "@/lib/ad-scope";
import {
  DEFAULT_SPEND_AUTOMATION_SETTINGS,
  normalizeCooldownHours,
  parseAutomationSettings,
  type AutomationStatus,
  type OptimizationGoal,
  type SpendAutomationSettings,
} from "@/lib/spend-automation-settings";

export type AutomationProfile = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  optimizationGoal: OptimizationGoal;
  settings: SpendAutomationSettings;
};

export type EntityAutomationState = {
  enabled: boolean;
  profileId: string | null;
  settingsOverride: Partial<SpendAutomationSettings>;
  effectiveSettings: SpendAutomationSettings;
  cooldownHours: number | null;
  minDailyBudgetMicros: number | null;
  maxDailyBudgetMicros: number | null;
  automationStatus: AutomationStatus;
  lastReviewedAt: string | null;
  lastAdjustedAt: string | null;
  lastError: string | null;
};

export type BudgetAdjustmentRow = {
  id: string;
  createdAt: string;
  previousDailyBudgetMicros: number | null;
  newDailyBudgetMicros: number | null;
  changePct: number | null;
  optimizationGoal: OptimizationGoal | null;
  decisionReason: string | null;
  providerApplied: boolean;
};

function mapProfile(row: Record<string, unknown>): AutomationProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    isDefault: Boolean(row.is_default),
    optimizationGoal: row.optimization_goal as OptimizationGoal,
    settings: parseAutomationSettings(row.settings),
  };
}

export async function ensureDefaultAutomationProfile(
  scope: AdDataScope,
): Promise<AutomationProfile> {
  const supabase = await createClient();

  const { data: existing } = await withAdScope(
    supabase
      .from("ad_automation_profiles")
      .select("id, name, description, is_default, optimization_goal, settings")
      .eq("is_default", true),
    scope,
  ).maybeSingle();

  if (existing) return mapProfile(existing);

  const { data, error } = await supabase
    .from("ad_automation_profiles")
    .insert({
      ...adScopeFields(scope),
      name: "Balanced ROAS",
      description: "Default AdPilot preset — moderate ramp toward ROAS targets.",
      is_default: true,
      optimization_goal: "roas",
      settings: DEFAULT_SPEND_AUTOMATION_SETTINGS,
    })
    .select("id, name, description, is_default, optimization_goal, settings")
    .single();

  if (error) throw error;
  return mapProfile(data);
}

export async function listAutomationProfiles(
  scope: AdDataScope,
): Promise<AutomationProfile[]> {
  const supabase = await createClient();

  const { data, error } = await withAdScope(
    supabase
      .from("ad_automation_profiles")
      .select("id, name, description, is_default, optimization_goal, settings"),
    scope,
  )
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapProfile);
}

/** Settings workspace — guarantees at least one preset exists. */
export async function listAutomationProfilesForSettings(
  scope: AdDataScope,
): Promise<AutomationProfile[]> {
  await ensureDefaultAutomationProfile(scope);
  return listAutomationProfiles(scope);
}

export async function createAutomationProfile(input: {
  scope: AdDataScope;
  name: string;
  description?: string | null;
  optimizationGoal?: OptimizationGoal;
  settings?: SpendAutomationSettings;
  isDefault?: boolean;
}): Promise<AutomationProfile> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (input.isDefault) {
    await withAdScope(
      supabase
        .from("ad_automation_profiles")
        .update({ is_default: false, updated_at: now }),
      input.scope,
    );
  }

  const { data, error } = await supabase
    .from("ad_automation_profiles")
    .insert({
      ...adScopeFields(input.scope),
      name: input.name,
      description: input.description ?? null,
      is_default: input.isDefault ?? false,
      optimization_goal: input.optimizationGoal ?? "roas",
      settings: input.settings ?? DEFAULT_SPEND_AUTOMATION_SETTINGS,
    })
    .select("id, name, description, is_default, optimization_goal, settings")
    .single();

  if (error) throw error;
  return mapProfile(data);
}

export async function updateAutomationProfile(input: {
  scope: AdDataScope;
  profileId: string;
  patch: Partial<{
    name: string;
    description: string | null;
    isDefault: boolean;
    optimizationGoal: OptimizationGoal;
    settings: SpendAutomationSettings;
  }>;
}): Promise<AutomationProfile> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (input.patch.isDefault) {
    await withAdScope(
      supabase
        .from("ad_automation_profiles")
        .update({ is_default: false, updated_at: now })
        .neq("id", input.profileId),
      input.scope,
    );
  }

  const row: Record<string, unknown> = { updated_at: now };
  if (input.patch.name !== undefined) row.name = input.patch.name;
  if (input.patch.description !== undefined) row.description = input.patch.description;
  if (input.patch.isDefault !== undefined) row.is_default = input.patch.isDefault;
  if (input.patch.optimizationGoal !== undefined) {
    row.optimization_goal = input.patch.optimizationGoal;
  }
  if (input.patch.settings !== undefined) row.settings = input.patch.settings;

  const { data, error } = await withAdScope(
    supabase
      .from("ad_automation_profiles")
      .update(row)
      .eq("id", input.profileId),
    input.scope,
  )
    .select("id, name, description, is_default, optimization_goal, settings")
    .single();

  if (error) throw error;
  return mapProfile(data);
}

function stripCooldownFromOverride(
  override: Partial<SpendAutomationSettings>,
): Partial<SpendAutomationSettings> {
  const { cooldownHours: _ignored, ...rest } = override;
  return rest;
}

function mapEntityAutomation(
  row: Record<string, unknown> | null,
  profile: AutomationProfile | null,
): EntityAutomationState {
  const settingsOverride = stripCooldownFromOverride(
    row?.settings_override && typeof row.settings_override === "object"
      ? (row.settings_override as Partial<SpendAutomationSettings>)
      : {},
  );
  const baseSettings = profile?.settings ?? DEFAULT_SPEND_AUTOMATION_SETTINGS;
  const cooldownHours =
    row?.cooldown_hours != null
      ? normalizeCooldownHours(Number(row.cooldown_hours))
      : null;

  return {
    enabled: Boolean(row?.enabled),
    profileId: (row?.profile_id as string | null) ?? profile?.id ?? null,
    settingsOverride,
    cooldownHours,
    effectiveSettings: {
      ...baseSettings,
      ...settingsOverride,
      cooldownHours: normalizeCooldownHours(
        cooldownHours ?? baseSettings.cooldownHours,
      ),
    },
    minDailyBudgetMicros:
      (row?.min_daily_budget_micros as number | null) ?? null,
    maxDailyBudgetMicros:
      (row?.max_daily_budget_micros as number | null) ?? null,
    automationStatus:
      (row?.automation_status as AutomationStatus) ?? "inactive",
    lastReviewedAt: (row?.last_reviewed_at as string | null) ?? null,
    lastAdjustedAt: (row?.last_adjusted_at as string | null) ?? null,
    lastError: (row?.last_error as string | null) ?? null,
  };
}

export async function getEntityAutomation(input: {
  scope: AdDataScope;
  entityId: string;
}): Promise<EntityAutomationState> {
  const supabase = await createClient();

  const { data: automation } = await withAdScope(
    supabase
      .from("ad_entity_automation")
      .select(
        "enabled, profile_id, settings_override, cooldown_hours, min_daily_budget_micros, max_daily_budget_micros, automation_status, last_reviewed_at, last_adjusted_at, last_error",
      )
      .eq("entity_id", input.entityId),
    input.scope,
  ).maybeSingle();

  let profile: AutomationProfile | null = null;
  if (automation?.profile_id) {
    const { data: profileRow } = await withAdScope(
      supabase
        .from("ad_automation_profiles")
        .select("id, name, description, is_default, optimization_goal, settings")
        .eq("id", automation.profile_id),
      input.scope,
    ).maybeSingle();
    if (profileRow) profile = mapProfile(profileRow);
  }

  return mapEntityAutomation(automation, profile);
}

export async function upsertEntityAutomation(input: {
  scope: AdDataScope;
  entityId: string;
  patch: {
    enabled?: boolean;
    profileId?: string | null;
    settingsOverride?: Partial<SpendAutomationSettings>;
    cooldownHours?: number | null;
    minDailyBudgetMicros?: number | null;
    maxDailyBudgetMicros?: number | null;
    automationStatus?: AutomationStatus;
  };
}): Promise<EntityAutomationState> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: entity, error: entityError } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id, entity_type, user_connection_id")
      .eq("id", input.entityId),
    input.scope,
  ).maybeSingle();

  if (entityError) throw entityError;
  if (!entity) throw new Error("Entity not found");

  if (entity.entity_type !== "campaign" && entity.entity_type !== "ad_group") {
    throw new Error("Only campaigns and ad sets support budget automation.");
  }

  const defaultProfile = await ensureDefaultAutomationProfile(input.scope);

  const { data: existing } = await withAdScope(
    supabase
      .from("ad_entity_automation")
      .select(
        "enabled, profile_id, settings_override, cooldown_hours, min_daily_budget_micros, max_daily_budget_micros, automation_status",
      )
      .eq("entity_id", input.entityId),
    input.scope,
  ).maybeSingle();

  const nextEnabled = input.patch.enabled ?? Boolean(existing?.enabled);
  const profileId =
    input.patch.profileId !== undefined
      ? input.patch.profileId
      : (existing?.profile_id as string | null) ?? defaultProfile.id;
  const settingsOverride = stripCooldownFromOverride(
    input.patch.settingsOverride !== undefined
      ? input.patch.settingsOverride
      : (existing?.settings_override as Partial<SpendAutomationSettings> | null) ?? {},
  );
  const cooldownHours =
    input.patch.cooldownHours !== undefined
      ? input.patch.cooldownHours != null
        ? normalizeCooldownHours(input.patch.cooldownHours)
        : null
      : existing?.cooldown_hours != null
        ? normalizeCooldownHours(Number(existing.cooldown_hours))
        : null;
  const minDailyBudgetMicros =
    input.patch.minDailyBudgetMicros !== undefined
      ? input.patch.minDailyBudgetMicros
      : (existing?.min_daily_budget_micros as number | null) ?? null;
  const maxDailyBudgetMicros =
    input.patch.maxDailyBudgetMicros !== undefined
      ? input.patch.maxDailyBudgetMicros
      : (existing?.max_daily_budget_micros as number | null) ?? null;

  const automationStatus: AutomationStatus = nextEnabled
    ? input.patch.automationStatus ??
      (existing?.automation_status as AutomationStatus) ??
      "active"
    : "inactive";

  const row = {
    ...adScopeFields(input.scope),
    user_connection_id: entity.user_connection_id as string,
    entity_id: input.entityId,
    enabled: nextEnabled,
    profile_id: profileId,
    settings_override: settingsOverride,
    cooldown_hours: cooldownHours,
    min_daily_budget_micros: minDailyBudgetMicros,
    max_daily_budget_micros: maxDailyBudgetMicros,
    automation_status: automationStatus,
    updated_at: now,
  };

  const { error } = await supabase
    .from("ad_entity_automation")
    .upsert(row, { onConflict: "entity_id" });

  if (error) throw error;

  return getEntityAutomation({
    scope: input.scope,
    entityId: input.entityId,
  });
}

export async function listBudgetAdjustments(input: {
  scope: AdDataScope;
  entityId: string;
  limit?: number;
}): Promise<BudgetAdjustmentRow[]> {
  const supabase = await createClient();
  const limit = input.limit ?? 10;

  const { data, error } = await withAdScope(
    supabase
      .from("ad_budget_adjustments")
      .select(
        "id, created_at, previous_daily_budget_micros, new_daily_budget_micros, change_pct, optimization_goal, decision_reason, provider_applied",
      )
      .eq("entity_id", input.entityId)
      .order("created_at", { ascending: false })
      .limit(limit),
    input.scope,
  );

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    previousDailyBudgetMicros:
      (row.previous_daily_budget_micros as number | null) ?? null,
    newDailyBudgetMicros: (row.new_daily_budget_micros as number | null) ?? null,
    changePct: row.change_pct != null ? Number(row.change_pct) : null,
    optimizationGoal: (row.optimization_goal as OptimizationGoal | null) ?? null,
    decisionReason: (row.decision_reason as string | null) ?? null,
    providerApplied: Boolean(row.provider_applied),
  }));
}
