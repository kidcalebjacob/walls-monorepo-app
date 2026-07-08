import { createClient } from "@walls/supabase/server";

import {
  getEntityAutomation,
  listAutomationProfiles,
  listBudgetAdjustments,
  type AutomationProfile,
  type BudgetAdjustmentRow,
  type EntityAutomationState,
} from "@/lib/automation-server";
import type { CampaignEntityType } from "@/lib/campaigns-server";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";
import {
  isSalesObjective,
  resolveObjectiveBucket,
} from "@/lib/meta-objectives";
import {
  buildEntityDailyProgress,
  type EntityDailyProgress,
} from "@/lib/entity-daily-progress";
import type { AutomationStatus } from "@/lib/spend-automation-settings";

export type EntityDetailMetrics = {
  spendMicros: number;
  impressions: number;
  clicks: number;
  ctr: number;
  roas: number | null;
  websitePurchases: number | null;
  conversionValueMicros: number;
};

export type CampaignAdSetSummary = {
  id: string;
  name: string;
  status: string | null;
  spendMicros: number;
  impressions: number;
  clicks: number;
  ctr: number;
  roas: number | null;
  websitePurchases: number | null;
  dailyBudgetMicros: number | null;
  adpilotEnabled: boolean;
  automationStatus: AutomationStatus | null;
  learningStatus: string | null;
};

export type EntityDetailResult = {
  id: string;
  entityType: CampaignEntityType;
  name: string;
  status: string | null;
  objective: string | null;
  accountName: string;
  parentId: string | null;
  parentName: string | null;
  dailyBudgetMicros: number | null;
  canAutomate: boolean;
  metrics: EntityDetailMetrics;
  automation: EntityAutomationState;
  profiles: AutomationProfile[];
  recentAdjustments: BudgetAdjustmentRow[];
};

export type CampaignDetailResult = EntityDetailResult & {
  entityType: "campaign";
  adSets: CampaignAdSetSummary[];
};

export type AdSetDetailResult = EntityDetailResult & {
  entityType: "ad_group";
  campaignId: string;
  campaignObjective: string | null;
  dailyProgress: EntityDailyProgress;
};

type MetricRow = {
  spend_micros: number | null;
  impressions: number | null;
  clicks: number | null;
  conversion_value_micros: number | null;
  website_purchases: number | null;
};

function aggregateMetricRows(rows: MetricRow[]) {
  const totals = {
    spend_micros: 0,
    impressions: 0,
    clicks: 0,
    conversion_value_micros: 0,
    website_purchases: 0,
  };

  for (const row of rows) {
    totals.spend_micros += row.spend_micros ?? 0;
    totals.impressions += row.impressions ?? 0;
    totals.clicks += row.clicks ?? 0;
    totals.conversion_value_micros += row.conversion_value_micros ?? 0;
    totals.website_purchases += Number(row.website_purchases ?? 0);
  }

  const spend = totals.spend_micros / 1_000_000;
  const ctr =
    totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const roas =
    spend > 0 ? totals.conversion_value_micros / 1_000_000 / spend : null;

  return {
    spendMicros: totals.spend_micros,
    impressions: totals.impressions,
    clicks: totals.clicks,
    ctr,
    roas,
    websitePurchases: totals.website_purchases,
    conversionValueMicros: totals.conversion_value_micros,
  };
}

function metricsStartDateIso() {
  const currentStart = new Date();
  currentStart.setDate(currentStart.getDate() - 30);
  return currentStart.toISOString().slice(0, 10);
}

async function buildEntityDetail(input: {
  userId: string;
  entity: {
    id: string;
    entity_type: CampaignEntityType;
    name: string | null;
    status: string | null;
    objective: string | null;
    parent_id: string | null;
    user_connection_id: string;
    daily_budget_micros: number | null;
  };
}): Promise<EntityDetailResult> {
  const supabase = await createClient();
  const entity = input.entity;
  const entityType = entity.entity_type;
  const entityId = entity.id;

  const [{ data: connection }, parentResult, metricsResult, automation, profiles, adjustments] =
    await Promise.all([
      supabase
        .from("ad_entities")
        .select("name")
        .eq("user_connection_id", entity.user_connection_id)
        .eq("entity_type", "account")
        .maybeSingle(),
      entity.parent_id
        ? supabase
            .from("ad_entities")
            .select("name, objective")
            .eq("id", entity.parent_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("ad_metrics_daily")
        .select(
          "spend_micros, impressions, clicks, conversion_value_micros, website_purchases",
        )
        .eq("entity_id", entityId)
        .gte("metric_date", metricsStartDateIso()),
      getEntityAutomation({ userId: input.userId, entityId }),
      listAutomationProfiles(input.userId),
      listBudgetAdjustments({
        userId: input.userId,
        entityId,
        limit: 8,
      }),
    ]);

  const aggregated = aggregateMetricRows(metricsResult.data ?? []);

  let campaignObjective = entity.objective;
  if (entityType === "ad_group" && parentResult.data?.objective) {
    campaignObjective = parentResult.data.objective as string;
  }
  if (entityType === "ad" && entity.parent_id) {
    const { data: adGroup } = await supabase
      .from("ad_entities")
      .select("parent_id")
      .eq("id", entity.parent_id)
      .maybeSingle();
    if (adGroup?.parent_id) {
      const { data: campaign } = await supabase
        .from("ad_entities")
        .select("objective")
        .eq("id", adGroup.parent_id)
        .maybeSingle();
      campaignObjective = (campaign?.objective as string | null) ?? campaignObjective;
    }
  }

  const tracksWebsitePurchases = isSalesObjective(campaignObjective);

  return {
    id: entityId,
    entityType,
    name: entity.name ?? "Untitled",
    status: entity.status,
    objective: entity.objective,
    accountName: (connection?.name as string) ?? "Ad account",
    parentId: entity.parent_id,
    parentName: (parentResult.data?.name as string | null) ?? null,
    dailyBudgetMicros: entity.daily_budget_micros,
    canAutomate: entityType === "campaign" || entityType === "ad_group",
    metrics: {
      spendMicros: aggregated.spendMicros,
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      ctr: aggregated.ctr,
      roas: aggregated.roas,
      websitePurchases: tracksWebsitePurchases ? aggregated.websitePurchases : null,
      conversionValueMicros: aggregated.conversionValueMicros,
    },
    automation,
    profiles,
    recentAdjustments: adjustments,
  };
}

export async function getEntityDetail(input: {
  userId: string;
  entityId: string;
}): Promise<EntityDetailResult | null> {
  const supabase = await createClient();

  const { data: entity, error } = await supabase
    .from("ad_entities")
    .select(
      "id, entity_type, name, status, objective, parent_id, user_connection_id, daily_budget_micros",
    )
    .eq("id", input.entityId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) throw error;
  if (!entity) return null;

  return buildEntityDetail({
    userId: input.userId,
    entity: entity as Parameters<typeof buildEntityDetail>[0]["entity"],
  });
}

export async function getCampaignDetail(input: {
  userId: string;
  campaignId: string;
}): Promise<CampaignDetailResult | null> {
  const supabase = await createClient();

  const { data: entity, error } = await supabase
    .from("ad_entities")
    .select(
      "id, entity_type, name, status, objective, parent_id, user_connection_id, daily_budget_micros",
    )
    .eq("id", input.campaignId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) throw error;
  if (!entity || entity.entity_type !== "campaign") return null;

  const base = await buildEntityDetail({
    userId: input.userId,
    entity: entity as Parameters<typeof buildEntityDetail>[0]["entity"],
  });

  const { data: adSetEntities } = await supabase
    .from("ad_entities")
    .select("id, name, status, daily_budget_micros, learning_status")
    .eq("user_id", input.userId)
    .eq("parent_id", input.campaignId)
    .eq("entity_type", "ad_group")
    .order("name", { ascending: true });

  const adSetList = adSetEntities ?? [];
  const adSetIds = adSetList.map((row) => row.id as string);

  const [{ data: metrics }, { data: automations }] = await Promise.all([
    adSetIds.length > 0
      ? supabase
          .from("ad_metrics_daily")
          .select(
            "entity_id, spend_micros, impressions, clicks, conversion_value_micros, website_purchases",
          )
          .in("entity_id", adSetIds)
          .gte("metric_date", metricsStartDateIso())
      : Promise.resolve({ data: [] }),
    adSetIds.length > 0
      ? supabase
          .from("ad_entity_automation")
          .select("entity_id, enabled, automation_status")
          .in("entity_id", adSetIds)
      : Promise.resolve({ data: [] }),
  ]);

  const metricsByEntity = new Map<string, MetricRow[]>();
  for (const row of metrics ?? []) {
    const bucket = metricsByEntity.get(row.entity_id as string) ?? [];
    bucket.push(row as MetricRow);
    metricsByEntity.set(row.entity_id as string, bucket);
  }

  const automationByEntity = new Map<
    string,
    { enabled: boolean; status: AutomationStatus }
  >();
  for (const row of automations ?? []) {
    automationByEntity.set(row.entity_id as string, {
      enabled: Boolean(row.enabled),
      status: row.automation_status as AutomationStatus,
    });
  }

  const campaignBudget = entity.daily_budget_micros as number | null;
  const tracksWebsitePurchases = isSalesObjective(entity.objective as string | null);

  const adSets: CampaignAdSetSummary[] = adSetList.map((adSet) => {
    const totals = aggregateMetricRows(metricsByEntity.get(adSet.id as string) ?? []);
    const automation = automationByEntity.get(adSet.id as string);
    const ownBudget = adSet.daily_budget_micros as number | null;
    const dailyBudgetMicros =
      ownBudget != null && ownBudget > 0 ? ownBudget : campaignBudget;

    return {
      id: adSet.id as string,
      name: (adSet.name as string) ?? "Untitled",
      status: adSet.status as string | null,
      spendMicros: totals.spendMicros,
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.ctr,
      roas: totals.roas,
      websitePurchases: tracksWebsitePurchases ? totals.websitePurchases : null,
      dailyBudgetMicros,
      adpilotEnabled: automation?.enabled ?? false,
      automationStatus: automation?.status ?? null,
      learningStatus: (adSet.learning_status as string | null) ?? null,
    };
  });

  adSets.sort((left, right) => right.spendMicros - left.spendMicros);

  return {
    ...base,
    entityType: "campaign",
    adSets,
  };
}

export async function getAdSetDetail(input: {
  userId: string;
  campaignId: string;
  adSetId: string;
}): Promise<AdSetDetailResult | null> {
  const supabase = await createClient();

  const { data: entity, error } = await supabase
    .from("ad_entities")
    .select(
      "id, entity_type, name, status, objective, parent_id, user_connection_id, daily_budget_micros",
    )
    .eq("id", input.adSetId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) throw error;
  if (!entity || entity.entity_type !== "ad_group") return null;
  if (entity.parent_id !== input.campaignId) return null;

  const base = await buildEntityDetail({
    userId: input.userId,
    entity: entity as Parameters<typeof buildEntityDetail>[0]["entity"],
  });

  const [{ data: campaign }, { data: dailyMetrics }] = await Promise.all([
    supabase
      .from("ad_entities")
      .select("objective")
      .eq("id", input.campaignId)
      .maybeSingle(),
    supabase
      .from("ad_metrics_daily")
      .select(
        "metric_date, spend_micros, impressions, clicks, conversion_value_micros, website_purchases",
      )
      .eq("entity_id", input.adSetId)
      .gte("metric_date", metricsStartDateIso())
      .order("metric_date", { ascending: true }),
  ]);

  const campaignObjective = (campaign?.objective as string | null) ?? null;
  const objectiveBucket = resolveObjectiveBucket(campaignObjective);
  const dailyProgress = buildEntityDailyProgress(
    (dailyMetrics ?? []) as Parameters<typeof buildEntityDailyProgress>[0],
    objectiveBucket,
  );

  return {
    ...base,
    entityType: "ad_group",
    campaignId: input.campaignId,
    campaignObjective,
    dailyProgress,
  };
}

export function formatEntityDetailMetrics(metrics: EntityDetailMetrics) {
  return [
    { label: "Spend", value: formatCurrencyFromMicros(metrics.spendMicros) },
    { label: "Impressions", value: formatCompactNumber(metrics.impressions) },
    { label: "CTR", value: formatPercent(metrics.ctr) },
    { label: "ROAS", value: formatRoas(metrics.roas) },
  ];
}
