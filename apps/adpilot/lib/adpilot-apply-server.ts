import { createAdminClient } from "@walls/supabase/admin";
import { createClient } from "@walls/supabase/server";

import type { AdPilotPreview } from "@/lib/adpilot-preview";
import {
  type AdDataScope,
  adScopeFields,
  withAdScope,
} from "@/lib/ad-scope";
import {
  getEntityAutomation,
  type BudgetAdjustmentRow,
} from "@/lib/automation-server";
import {
  updateMetaEntityDailyBudget,
  updateMetaEntityStatus,
} from "@/lib/meta-graph";
import type { AutomationStatus } from "@/lib/spend-automation-settings";

export type ApplyAdPilotResult = {
  adjustment: BudgetAdjustmentRow;
  entityDailyBudgetMicros: number | null;
  automationStatus: AutomationStatus;
};

const APPLYABLE_ACTIONS = new Set(["increase", "decrease", "deactivate"]);

function resolveAutomationStatusAfterApply(
  action: AdPilotPreview["decision"]["action"],
): AutomationStatus {
  if (action === "deactivate") return "paused";
  return "cooldown";
}

export function validatePreviewForApply(
  entityId: string,
  preview: AdPilotPreview,
): string | null {
  if (preview.entity.id !== entityId) {
    return "Preview does not match this entity. Run preview again.";
  }

  if (!preview.wouldApply) {
    return "AdPilot would not change anything right now.";
  }

  if (!APPLYABLE_ACTIONS.has(preview.decision.action)) {
    return "This decision cannot be applied manually.";
  }

  const finalMicros = preview.decision.budget.finalMicros;
  if (preview.decision.action !== "deactivate") {
    if (finalMicros == null || finalMicros <= 0) {
      return "Preview is missing a valid target budget.";
    }

    if (finalMicros < preview.allowedRange.minMicros) {
      return "Target budget is below the allowed minimum.";
    }

    if (
      preview.allowedRange.maxMicros != null &&
      finalMicros > preview.allowedRange.maxMicros
    ) {
      return "Target budget is above the allowed maximum.";
    }
  }

  return null;
}

export async function applyAdPilotPreview(input: {
  scope: AdDataScope;
  entityId: string;
  preview: AdPilotPreview;
}): Promise<ApplyAdPilotResult> {
  const validationError = validatePreviewForApply(input.entityId, input.preview);
  if (validationError) {
    throw new Error(validationError);
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: entity, error: entityError } = await withAdScope(
    supabase
      .from("ad_entities")
      .select(
        "id, entity_type, provider_entity_id, user_connection_id, daily_budget_micros",
      )
      .eq("id", input.entityId),
    input.scope,
  ).maybeSingle();

  if (entityError) throw entityError;
  if (!entity) throw new Error("Entity not found");
  if (entity.entity_type !== "campaign" && entity.entity_type !== "ad_group") {
    throw new Error("Only campaigns and ad sets support budget automation.");
  }

  const automation = await getEntityAutomation({
    scope: input.scope,
    entityId: input.entityId,
  });

  if (!automation?.enabled) {
    throw new Error("Enable AdPilot for this entity before applying changes.");
  }

  const { data: connection, error: connectionError } = await admin
    .from("user_connections")
    .select("access_token")
    .eq("id", entity.user_connection_id)
    .eq("user_id", input.scope.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (connectionError) throw connectionError;

  const accessToken = connection?.access_token as string | undefined;
  if (!accessToken) {
    throw new Error("Meta connection is not available for this ad account.");
  }

  const providerEntityId = entity.provider_entity_id as string;
  const previousMicros =
    input.preview.decision.budget.previousMicros ??
    (entity.daily_budget_micros as number | null);
  const finalMicros = input.preview.decision.budget.finalMicros;
  const changePct = input.preview.decision.budget.changePct;
  const now = new Date().toISOString();

  let providerResponse: Record<string, unknown> | null = null;
  let providerApplied = false;
  let nextDailyBudgetMicros =
    (entity.daily_budget_micros as number | null) ?? previousMicros;

  if (input.preview.decision.action === "deactivate") {
    providerResponse = await updateMetaEntityStatus(
      providerEntityId,
      accessToken,
      "PAUSED",
    );
    providerApplied = true;
  } else if (finalMicros != null) {
    providerResponse = await updateMetaEntityDailyBudget(
      providerEntityId,
      accessToken,
      finalMicros,
    );
    providerApplied = true;
    nextDailyBudgetMicros = finalMicros;
  }

  const automationStatus = resolveAutomationStatusAfterApply(
    input.preview.decision.action,
  );

  const { data: adjustmentRow, error: adjustmentError } = await supabase
    .from("ad_budget_adjustments")
    .insert({
      ...adScopeFields(input.scope),
      user_connection_id: entity.user_connection_id,
      entity_id: input.entityId,
      profile_id: automation.profileId,
      previous_daily_budget_micros: previousMicros,
      new_daily_budget_micros: finalMicros,
      change_pct: changePct,
      optimization_goal: input.preview.decision.optimizationGoal,
      metric_snapshot: input.preview.metricSnapshot ?? {},
      decision_reason: input.preview.decision.reason,
      provider_applied: providerApplied,
      provider_response: providerResponse,
    })
    .select(
      "id, created_at, previous_daily_budget_micros, new_daily_budget_micros, change_pct, optimization_goal, decision_reason, provider_applied",
    )
    .single();

  if (adjustmentError) throw adjustmentError;

  const entityPatch: Record<string, unknown> = {
    updated_at: now,
  };

  if (input.preview.decision.action === "deactivate") {
    entityPatch.status = "paused";
  }

  if (finalMicros != null) {
    entityPatch.daily_budget_micros = finalMicros;
  }

  const { error: entityUpdateError } = await withAdScope(
    admin.from("ad_entities").update(entityPatch).eq("id", input.entityId),
    input.scope,
  );

  if (entityUpdateError) throw entityUpdateError;

  const { error: automationUpdateError } = await withAdScope(
    supabase
      .from("ad_entity_automation")
      .update({
        automation_status: automationStatus,
        last_adjusted_at: now,
        last_reviewed_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq("entity_id", input.entityId),
    input.scope,
  );

  if (automationUpdateError) throw automationUpdateError;

  return {
    adjustment: {
      id: adjustmentRow.id as string,
      createdAt: adjustmentRow.created_at as string,
      previousDailyBudgetMicros:
        (adjustmentRow.previous_daily_budget_micros as number | null) ?? null,
      newDailyBudgetMicros:
        (adjustmentRow.new_daily_budget_micros as number | null) ?? null,
      changePct:
        adjustmentRow.change_pct != null
          ? Number(adjustmentRow.change_pct)
          : null,
      optimizationGoal:
        (adjustmentRow.optimization_goal as ApplyAdPilotResult["adjustment"]["optimizationGoal"]) ??
        null,
      decisionReason: (adjustmentRow.decision_reason as string | null) ?? null,
      providerApplied: Boolean(adjustmentRow.provider_applied),
    },
    entityDailyBudgetMicros: nextDailyBudgetMicros,
    automationStatus,
  };
}
