import { createClient } from "@walls/supabase/server";

import { type AdDataScope, withAdScope } from "@/lib/ad-scope";
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
  buildAdCreativePreview,
  type AdCreativePreview,
} from "@/lib/meta-creatives";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";
import {
  isSalesObjective,
  resolveObjectiveBucket,
  type DashboardObjectiveBucket,
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

export type AdSetAdSummary = {
  id: string;
  name: string;
  status: string | null;
  spendMicros: number;
  impressions: number;
  clicks: number;
  ctr: number;
  roas: number | null;
  websitePurchases: number | null;
  thumbnailUrl: string | null;
  creativeType: string | null;
  creativePreview: AdCreativePreview | null;
};

export type AdSetDetailResult = EntityDetailResult & {
  entityType: "ad_group";
  campaignId: string;
  campaignObjective: string | null;
  objectiveBucket: DashboardObjectiveBucket | null;
  dailyProgress: EntityDailyProgress;
  ads: AdSetAdSummary[];
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

function adPerformanceScore(ad: AdSetAdSummary): number {
  const spend = ad.spendMicros / 1_000_000;
  const hasDelivery = ad.impressions > 0 || spend > 0;
  if (!hasDelivery) return 0;

  return (
    spend * 1_000 +
    (ad.roas ?? 0) * spend * 250 +
    (ad.websitePurchases ?? 0) * 100 +
    ad.ctr * 15 +
    ad.clicks * 2
  );
}

function sortAdSummaries(ads: AdSetAdSummary[]): AdSetAdSummary[] {
  return [...ads].sort((left, right) => {
    const scoreDiff = adPerformanceScore(right) - adPerformanceScore(left);
    if (scoreDiff !== 0) return scoreDiff;
    return right.spendMicros - left.spendMicros;
  });
}

async function buildEntityDetail(input: {
  scope: AdDataScope;
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
      getEntityAutomation({ scope: input.scope, entityId }),
      listAutomationProfiles(input.scope),
      listBudgetAdjustments({
        scope: input.scope,
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
  scope: AdDataScope;
  entityId: string;
}): Promise<EntityDetailResult | null> {
  const supabase = await createClient();

  const { data: entity, error } = await withAdScope(
    supabase
      .from("ad_entities")
      .select(
        "id, entity_type, name, status, objective, parent_id, user_connection_id, daily_budget_micros",
      )
      .eq("id", input.entityId),
    input.scope,
  ).maybeSingle();

  if (error) throw error;
  if (!entity) return null;

  return buildEntityDetail({
    scope: input.scope,
    entity: entity as Parameters<typeof buildEntityDetail>[0]["entity"],
  });
}

export async function getCampaignDetail(input: {
  scope: AdDataScope;
  campaignId: string;
}): Promise<CampaignDetailResult | null> {
  const supabase = await createClient();

  const { data: entity, error } = await withAdScope(
    supabase
      .from("ad_entities")
      .select(
        "id, entity_type, name, status, objective, parent_id, user_connection_id, daily_budget_micros",
      )
      .eq("id", input.campaignId),
    input.scope,
  ).maybeSingle();

  if (error) throw error;
  if (!entity || entity.entity_type !== "campaign") return null;

  const base = await buildEntityDetail({
    scope: input.scope,
    entity: entity as Parameters<typeof buildEntityDetail>[0]["entity"],
  });

  const { data: adSetEntities } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id, name, status, daily_budget_micros, learning_status")
      .eq("parent_id", input.campaignId)
      .eq("entity_type", "ad_group")
      .order("name", { ascending: true }),
    input.scope,
  );

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
  scope: AdDataScope;
  campaignId: string;
  adSetId: string;
}): Promise<AdSetDetailResult | null> {
  const supabase = await createClient();

  const { data: entity, error } = await withAdScope(
    supabase
      .from("ad_entities")
      .select(
        "id, entity_type, name, status, objective, parent_id, user_connection_id, daily_budget_micros",
      )
      .eq("id", input.adSetId),
    input.scope,
  ).maybeSingle();

  if (error) throw error;
  if (!entity || entity.entity_type !== "ad_group") return null;
  if (entity.parent_id !== input.campaignId) return null;

  const base = await buildEntityDetail({
    scope: input.scope,
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

  const tracksWebsitePurchases = isSalesObjective(campaignObjective);

  const { data: adEntities } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id, name, status")
      .eq("parent_id", input.adSetId)
      .eq("entity_type", "ad")
      .order("name", { ascending: true }),
    input.scope,
  );

  const adList = adEntities ?? [];
  const adIds = adList.map((row) => row.id as string);

  const [{ data: adMetrics }, { data: adCreatives }] = await Promise.all([
    adIds.length > 0
      ? supabase
          .from("ad_metrics_daily")
          .select(
            "entity_id, spend_micros, impressions, clicks, conversion_value_micros, website_purchases",
          )
          .in("entity_id", adIds)
          .gte("metric_date", metricsStartDateIso())
      : Promise.resolve({ data: [] }),
    adIds.length > 0
      ? supabase
          .from("ad_creatives")
          .select(
            `ad_entity_id, creative_type, title, body, thumbnail_url, image_url, image_permalink_url, video_thumbnail_url, video_source_url,
            ad_creative_assets (
              id, asset_type, ordinal, image_url, permalink_url, video_source_url, video_thumbnail_url, title, body
            )`,
          )
          .in("ad_entity_id", adIds)
      : Promise.resolve({ data: [] }),
  ]);

  const metricsByAd = new Map<string, MetricRow[]>();
  for (const row of adMetrics ?? []) {
    const bucket = metricsByAd.get(row.entity_id as string) ?? [];
    bucket.push(row as MetricRow);
    metricsByAd.set(row.entity_id as string, bucket);
  }

  const creativeByAd = new Map<string, AdCreativePreview>();
  for (const creative of adCreatives ?? []) {
    const preview = buildAdCreativePreview(creative);
    if (preview) {
      creativeByAd.set(creative.ad_entity_id as string, preview);
    }
  }

  const ads = sortAdSummaries(
    adList.map((ad) => {
      const totals = aggregateMetricRows(metricsByAd.get(ad.id as string) ?? []);
      const creative = creativeByAd.get(ad.id as string);

      return {
        id: ad.id as string,
        name: (ad.name as string) ?? "Untitled",
        status: ad.status as string | null,
        spendMicros: totals.spendMicros,
        impressions: totals.impressions,
        clicks: totals.clicks,
        ctr: totals.ctr,
        roas: totals.roas,
        websitePurchases: tracksWebsitePurchases ? totals.websitePurchases : null,
        thumbnailUrl: creative?.thumbnailUrl ?? null,
        creativeType: creative?.creativeType ?? null,
        creativePreview: creative ?? null,
      };
    }),
  );

  return {
    ...base,
    entityType: "ad_group",
    campaignId: input.campaignId,
    campaignObjective,
    objectiveBucket,
    dailyProgress,
    ads,
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
