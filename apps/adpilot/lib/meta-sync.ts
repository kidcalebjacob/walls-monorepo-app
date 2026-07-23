import { createAdminClient } from "@walls/supabase/admin";

import { type AdDataScope, adScopeFields } from "@/lib/ad-scope";
import { META_PROVIDER } from "@/lib/connections";
import {
  fetchMetaDeliveryEstimate,
  fetchMetaFrequencyBreakdowns,
  fetchMetaGraphCollection,
  fetchMetaHourlyInsights,
  fetchMetaInsightBreakdowns,
  fetchMetaInsights,
  fetchMetaLifetimeTotals,
  frequencyRangeDaysFromDates,
  getMetaDateRange,
  parseMetaHourOfDay,
  type FrequencyRangeDays,
  type MetaAdSetTargeting,
  type MetaDeliveryEstimate,
  type MetaInsightBreakdownType,
  type MetaInsightLevel,
  type MetaInsightRow,
} from "@/lib/meta-graph";

import {
  AD_CREATIVE_FIELDS,
  parseCreative,
  persistAdCreative,
  type MetaAdCreative,
} from "@/lib/meta-creatives";

import { syncMetaAudiences } from "@/lib/meta-audiences";

import { listMetaConnectionsWithTokens } from "./connections-server";
import type { MetaConnectionRecord } from "@/lib/connections";

/** Meta returns overlapping purchase types - pick one, never sum them. */
const PURCHASE_ACTION_PRIORITY = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "web_in_store_purchase",
] as const;

const WEBSITE_PURCHASE_ACTION = "offsite_conversion.fb_pixel_purchase" as const;

const ADD_TO_CART_ACTION_PRIORITY = [
  "omni_add_to_cart",
  "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
] as const;

type EntityType = "account" | "campaign" | "ad_group" | "ad";

type BudgetOptimization = "cbo" | "abo";

const BREAKDOWN_SYNC_LEVELS: MetaInsightLevel[] = ["account", "campaign", "adset"];
/** Device/placement - multi-level, runs after core metrics. */
const DEVICE_PLACEMENT_BREAKDOWN_TYPES: MetaInsightBreakdownType[] = [
  "device_platform",
  "placement_device",
];
/**
 * Dashboard audience table only needs account-level demos. Sync these early
 * (before rate-limit-heavy delivery estimates / multi-level placement pulls).
 */
const DEMOGRAPHIC_BREAKDOWN_TYPES: MetaInsightBreakdownType[] = [
  "age",
  "gender",
  "age_gender",
  "country",
];
const FREQUENCY_SYNC_LEVELS = ["account", "campaign", "adset"] as const;

/** Meta's learning phase is reported on the ad set. Higher rank = "more in learning". */
type MetaLearningStageInfo = {
  status?: string;
  conversions?: number | string;
  last_sig_edit_ts?: number | string;
};

type LearningFields = {
  learningStatus: string | null;
  learningConversions: number | null;
  learningLastSigEditAt: string | null;
};

const LEARNING_STATUS_RANK: Record<string, number> = {
  LEARNING: 3,
  LEARNING_LIMITED: 2,
  FAIL: 1,
  SUCCESS: 0,
};

const EMPTY_LEARNING_FIELDS: LearningFields = {
  learningStatus: null,
  learningConversions: null,
  learningLastSigEditAt: null,
};

function parseLearningStageInfo(info: MetaLearningStageInfo | undefined): LearningFields {
  if (!info) return EMPTY_LEARNING_FIELDS;

  const learningStatus = info.status ? String(info.status).toUpperCase() : null;

  let learningConversions: number | null = null;
  if (info.conversions !== undefined && info.conversions !== null && info.conversions !== "") {
    const parsed = Number(info.conversions);
    learningConversions = Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  let learningLastSigEditAt: string | null = null;
  if (
    info.last_sig_edit_ts !== undefined &&
    info.last_sig_edit_ts !== null &&
    info.last_sig_edit_ts !== ""
  ) {
    const ts = Number(info.last_sig_edit_ts);
    if (Number.isFinite(ts) && ts > 0) {
      learningLastSigEditAt = new Date(ts * 1000).toISOString();
    }
  }

  return { learningStatus, learningConversions, learningLastSigEditAt };
}

/** Roll a child ad set's learning state into a campaign-level aggregate. */
function mergeCampaignLearning(
  current: LearningFields | undefined,
  child: LearningFields,
): LearningFields {
  if (!child.learningStatus) return current ?? EMPTY_LEARNING_FIELDS;
  if (!current || !current.learningStatus) return child;

  const currentRank = LEARNING_STATUS_RANK[current.learningStatus] ?? -1;
  const childRank = LEARNING_STATUS_RANK[child.learningStatus] ?? -1;
  const winner = childRank > currentRank ? child : current;

  const learningConversions =
    current.learningConversions !== null || child.learningConversions !== null
      ? (current.learningConversions ?? 0) + (child.learningConversions ?? 0)
      : null;

  const lastEdits = [current.learningLastSigEditAt, child.learningLastSigEditAt].filter(
    (value): value is string => Boolean(value),
  );
  const learningLastSigEditAt = lastEdits.length
    ? lastEdits.reduce((latest, value) => (value > latest ? value : latest))
    : null;

  return {
    learningStatus: winner.learningStatus,
    learningConversions,
    learningLastSigEditAt,
  };
}

function centsToMicros(cents: number | string | undefined | null): number | null {
  if (cents === undefined || cents === null || cents === "") return null;
  return Math.round(Number(cents) * 10_000);
}

function dollarsToMicros(dollars: string | number | undefined): number {
  const value = typeof dollars === "string" ? parseFloat(dollars) : dollars ?? 0;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000);
}

function parseFirstActionValue(
  items: Array<{ action_type: string; value: string }> | undefined,
  types: readonly string[],
): number {
  if (!items?.length) return 0;
  for (const type of types) {
    const match = items.find((item) => item.action_type === type);
    if (match) {
      const value = parseFloat(match.value);
      return Number.isFinite(value) ? value : 0;
    }
  }
  return 0;
}

function parsePurchaseRoas(row: MetaInsightRow): number | null {
  if (!row.purchase_roas?.length) return null;
  for (const type of PURCHASE_ACTION_PRIORITY) {
    const match = row.purchase_roas.find((item) => item.action_type === type);
    if (match) {
      const value = parseFloat(match.value);
      return Number.isFinite(value) ? value : 0;
    }
  }
  const fallback = parseFloat(row.purchase_roas[0].value);
  return Number.isFinite(fallback) ? fallback : null;
}

function parseInsightMetrics(row: MetaInsightRow) {
  const spendMicros = dollarsToMicros(row.spend);
  const conversionValueMicros = dollarsToMicros(
    parseFirstActionValue(row.action_values, PURCHASE_ACTION_PRIORITY),
  );
  const conversions = parseFirstActionValue(row.actions, PURCHASE_ACTION_PRIORITY);
  const websitePurchases = parseFirstActionValue(row.actions, [WEBSITE_PURCHASE_ACTION]);
  const addToCart = parseFirstActionValue(row.actions, ADD_TO_CART_ACTION_PRIORITY);
  const spend = spendMicros / 1_000_000;
  const roasFromApi = parsePurchaseRoas(row);
  const roas =
    roasFromApi !== null
      ? roasFromApi
      : spend > 0
        ? conversionValueMicros / 1_000_000 / spend
        : null;

  return {
    impressions: parseInt(row.impressions ?? "0", 10) || 0,
    clicks: parseInt(row.clicks ?? "0", 10) || 0,
    spend_micros: spendMicros,
    reach: row.reach ? parseInt(row.reach, 10) : null,
    frequency: row.frequency ? parseFloat(row.frequency) : null,
    conversions,
    conversion_value_micros: Math.round(conversionValueMicros),
    website_purchases: websitePurchases,
    add_to_cart: addToCart,
    ctr: row.ctr ? parseFloat(row.ctr) : null,
    cpc_micros: row.cpc ? dollarsToMicros(row.cpc) : null,
    cpm_micros: row.cpm ? dollarsToMicros(row.cpm) : null,
    roas,
  };
}

function normalizeBreakdownDim(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Campaign has its own budget → CBO; otherwise ad sets own budget → ABO. */
function resolveBudgetOptimization(
  dailyBudgetMicros: number | null,
  lifetimeBudgetMicros: number | null,
): BudgetOptimization {
  const hasCampaignBudget =
    (dailyBudgetMicros != null && dailyBudgetMicros > 0) ||
    (lifetimeBudgetMicros != null && lifetimeBudgetMicros > 0);
  return hasCampaignBudget ? "cbo" : "abo";
}

async function upsertSyncState(
  connectionId: string,
  scope: AdDataScope,
  patch: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("ad_sync_state")
    .select("id")
    .eq("account_connection_id", connectionId)
    .maybeSingle();

  const row = {
    account_connection_id: connectionId,
    ...adScopeFields(scope),
    updated_at: now,
    ...patch,
  };

  if (existing?.id) {
    await admin.from("ad_sync_state").update(row).eq("id", existing.id);
  } else {
    await admin.from("ad_sync_state").insert(row);
  }
}

async function upsertEntity(input: {
  scope: AdDataScope;
  connectionId: string;
  entityType: EntityType;
  providerEntityId: string;
  parentId: string | null;
  name: string | null;
  status: string | null;
  objective?: string | null;
  dailyBudgetMicros?: number | null;
  lifetimeBudgetMicros?: number | null;
  budgetOptimization?: BudgetOptimization | null;
  learning?: LearningFields;
  rawPayload: Record<string, unknown>;
}): Promise<string> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const learning = input.learning ?? EMPTY_LEARNING_FIELDS;

  const row = {
    ...adScopeFields(input.scope),
    account_connection_id: input.connectionId,
    provider: META_PROVIDER,
    entity_type: input.entityType,
    provider_entity_id: input.providerEntityId,
    parent_id: input.parentId,
    name: input.name,
    status: input.status,
    objective: input.objective ?? null,
    daily_budget_micros: input.dailyBudgetMicros ?? null,
    lifetime_budget_micros: input.lifetimeBudgetMicros ?? null,
    budget_optimization: input.budgetOptimization ?? null,
    learning_status: learning.learningStatus,
    learning_conversions: learning.learningConversions,
    learning_last_sig_edit_at: learning.learningLastSigEditAt,
    raw_payload: input.rawPayload,
    last_synced_at: now,
    updated_at: now,
  };

  const { data: existing } = await admin
    .from("ad_entities")
    .select("id")
    .eq("account_connection_id", input.connectionId)
    .eq("entity_type", input.entityType)
    .eq("provider_entity_id", input.providerEntityId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("ad_entities")
      .update(row)
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await admin
    .from("ad_entities")
    .insert(row)
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function updateEntityLearning(entityId: string, learning: LearningFields) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ad_entities")
    .update({
      learning_status: learning.learningStatus,
      learning_conversions: learning.learningConversions,
      learning_last_sig_edit_at: learning.learningLastSigEditAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entityId);

  if (error) throw error;
}

type AudienceEstimateFields = {
  estimatedAudienceLower: number | null;
  estimatedAudienceUpper: number | null;
  audienceEstimateReady: boolean | null;
};

const EMPTY_AUDIENCE_ESTIMATE: AudienceEstimateFields = {
  estimatedAudienceLower: null,
  estimatedAudienceUpper: null,
  audienceEstimateReady: null,
};

/** Meta returns -1 when an estimate is unavailable (e.g. cold lookalikes). */
function parseEstimateCount(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function parseDeliveryEstimate(estimate: MetaDeliveryEstimate | null): AudienceEstimateFields {
  if (!estimate) return EMPTY_AUDIENCE_ESTIMATE;

  const lower = parseEstimateCount(estimate.estimate_mau_lower_bound);
  const upper = parseEstimateCount(estimate.estimate_mau_upper_bound);
  const legacyMau = parseEstimateCount(estimate.estimate_mau);

  return {
    estimatedAudienceLower: lower ?? legacyMau,
    estimatedAudienceUpper: upper ?? legacyMau,
    audienceEstimateReady:
      typeof estimate.estimate_ready === "boolean" ? estimate.estimate_ready : null,
  };
}

async function updateEntityAudienceEstimate(
  entityId: string,
  estimate: AudienceEstimateFields,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ad_entities")
    .update({
      estimated_audience_lower: estimate.estimatedAudienceLower,
      estimated_audience_upper: estimate.estimatedAudienceUpper,
      audience_estimate_ready: estimate.audienceEstimateReady,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entityId);

  if (error) throw error;
}

async function updateEntityLifetimeTotals(
  entityId: string,
  input: { lifetimeReach: number | null; lifetimeSpendMicros: number | null },
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ad_entities")
    .update({
      lifetime_reach: input.lifetimeReach,
      lifetime_spend_micros: input.lifetimeSpendMicros,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entityId);

  if (error) throw error;
}

async function upsertDailyMetrics(input: {
  scope: AdDataScope;
  connectionId: string;
  entityId: string;
  metricDate: string;
  metrics: ReturnType<typeof parseInsightMetrics>;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const row = {
    ...adScopeFields(input.scope),
    account_connection_id: input.connectionId,
    entity_id: input.entityId,
    metric_date: input.metricDate,
    impressions: input.metrics.impressions,
    clicks: input.metrics.clicks,
    spend_micros: input.metrics.spend_micros,
    reach: input.metrics.reach,
    frequency: input.metrics.frequency,
    conversions: input.metrics.conversions,
    conversion_value_micros: input.metrics.conversion_value_micros,
    website_purchases: input.metrics.website_purchases,
    add_to_cart: input.metrics.add_to_cart,
    ctr: input.metrics.ctr,
    cpc_micros: input.metrics.cpc_micros,
    cpm_micros: input.metrics.cpm_micros,
    roas: input.metrics.roas,
    updated_at: now,
  };

  const { error } = await admin
    .from("ad_metrics_daily")
    .upsert(row, { onConflict: "entity_id,metric_date" });

  if (error) throw error;
}

async function upsertDailyBreakdownMetrics(input: {
  scope: AdDataScope;
  connectionId: string;
  entityId: string;
  metricDate: string;
  breakdownType: MetaInsightBreakdownType;
  publisherPlatform: string;
  platformPosition: string;
  devicePlatform: string;
  impressionDevice: string;
  age: string;
  gender: string;
  country: string;
  metrics: ReturnType<typeof parseInsightMetrics>;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const row = {
    ...adScopeFields(input.scope),
    account_connection_id: input.connectionId,
    entity_id: input.entityId,
    metric_date: input.metricDate,
    breakdown_type: input.breakdownType,
    publisher_platform: input.publisherPlatform,
    platform_position: input.platformPosition,
    device_platform: input.devicePlatform,
    impression_device: input.impressionDevice,
    age: input.age,
    gender: input.gender,
    country: input.country,
    impressions: input.metrics.impressions,
    clicks: input.metrics.clicks,
    spend_micros: input.metrics.spend_micros,
    reach: input.metrics.reach,
    frequency: input.metrics.frequency,
    conversions: input.metrics.conversions,
    conversion_value_micros: input.metrics.conversion_value_micros,
    website_purchases: input.metrics.website_purchases,
    add_to_cart: input.metrics.add_to_cart,
    ctr: input.metrics.ctr,
    cpc_micros: input.metrics.cpc_micros,
    cpm_micros: input.metrics.cpm_micros,
    roas: input.metrics.roas,
    updated_at: now,
  };

  const { error } = await admin.from("ad_metrics_daily_breakdowns").upsert(row, {
    onConflict:
      "entity_id,metric_date,breakdown_type,publisher_platform,platform_position,device_platform,impression_device,age,gender,country",
  });

  if (error) throw error;
}

async function replaceFrequencyBreakdowns(input: {
  scope: AdDataScope;
  connectionId: string;
  rows: Array<{
    entityId: string;
    rangeDays: FrequencyRangeDays;
    frequencyValue: string;
    reach: number;
  }>;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Empty can mean Meta returned nothing (opt-in / throttle) - keep prior snapshots.
  if (input.rows.length === 0) return;

  // Full replace per connection so buckets that disappear (no reach) don't linger.
  const { error: deleteError } = await admin
    .from("ad_metrics_frequency_breakdowns")
    .delete()
    .eq("account_connection_id", input.connectionId);

  if (deleteError) throw deleteError;

  const payload = input.rows.map((row) => ({
    ...adScopeFields(input.scope),
    account_connection_id: input.connectionId,
    entity_id: row.entityId,
    range_days: row.rangeDays,
    frequency_value: row.frequencyValue,
    reach: row.reach,
    updated_at: now,
  }));

  const { error } = await admin
    .from("ad_metrics_frequency_breakdowns")
    .upsert(payload, { onConflict: "entity_id,range_days,frequency_value" });

  if (error) throw error;
}

async function upsertHourlyMetrics(input: {
  scope: AdDataScope;
  connectionId: string;
  entityId: string;
  metricDate: string;
  hourOfDay: number;
  metrics: ReturnType<typeof parseInsightMetrics>;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const row = {
    ...adScopeFields(input.scope),
    account_connection_id: input.connectionId,
    entity_id: input.entityId,
    metric_date: input.metricDate,
    hour_of_day: input.hourOfDay,
    impressions: input.metrics.impressions,
    clicks: input.metrics.clicks,
    spend_micros: input.metrics.spend_micros,
    conversions: input.metrics.conversions,
    conversion_value_micros: input.metrics.conversion_value_micros,
    website_purchases: input.metrics.website_purchases,
    ctr: input.metrics.ctr,
    cpc_micros: input.metrics.cpc_micros,
    cpm_micros: input.metrics.cpm_micros,
    roas: input.metrics.roas,
    updated_at: now,
  };

  const { error } = await admin.from("ad_metrics_hourly").upsert(row, {
    onConflict: "entity_id,metric_date,hour_of_day",
  });

  if (error) throw error;
}

async function refreshDaysHoursRollups(scope: AdDataScope, connectionId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("refresh_ad_metrics_days_hours_rollups", {
    p_account_id: scope.accountId,
    p_account_connection_id: connectionId,
  });
  if (error) throw error;
}

function resolveInsightEntityId(
  row: MetaInsightRow,
  level: MetaInsightLevel,
  entityIds: Map<string, string>,
  accountEntityId: string,
): string | undefined {
  if (level === "account") return accountEntityId;
  if (level === "campaign") {
    return row.campaign_id ? entityIds.get(row.campaign_id) : undefined;
  }
  if (level === "adset") {
    return row.adset_id ? entityIds.get(row.adset_id) : undefined;
  }
  return row.ad_id ? entityIds.get(row.ad_id) : undefined;
}

function normalizeStatus(status: string | undefined): string | null {
  if (!status) return null;
  return status.toLowerCase();
}

function metaAccountStatusLabel(status: number | null | undefined): string {
  if (status === 1) return "Active";
  if (status === 2) return "Disabled";
  if (status === 3) return "Unsettled";
  if (status === 7) return "Pending review";
  if (status === 9) return "In grace period";
  if (status === 100) return "Pending closure";
  if (status === 101) return "Closed";
  return "Connected";
}

export async function syncMetaConnection(
  connection: MetaConnectionRecord,
  scope: AdDataScope,
): Promise<void> {
  if (!connection.provider_account_id) {
    throw new Error("Meta connection is missing provider_account_id.");
  }

  const accountId = connection.provider_account_id;
  const accessToken = connection.access_token;
  const accountName =
    connection.token_payload?.account_name ?? accountId.replace(/^act_/, "Ad account ");

  await upsertSyncState(connection.id, scope, {
    sync_status: "running",
    last_error: null,
  });

  try {
    const entityIds = new Map<string, string>();

    const accountEntityId = await upsertEntity({
      scope,
      connectionId: connection.id,
      entityType: "account",
      providerEntityId: accountId,
      parentId: null,
      name: accountName,
      status: metaAccountStatusLabel(connection.token_payload?.account_status).toLowerCase(),
      rawPayload: {
        account_status: connection.token_payload?.account_status ?? null,
      },
    });
    entityIds.set(accountId, accountEntityId);

    const { since, until } = getMetaDateRange(30);

    // Dashboard-critical account metrics first - so rate limits later on
    // ad sets / delivery estimates don't leave the UI empty.
    const accountInsights = await fetchMetaInsights(
      accountId,
      accessToken,
      "account",
      since,
      until,
    );

    for (const row of accountInsights) {
      if (!row.date_start) continue;
      await upsertDailyMetrics({
        scope,
        connectionId: connection.id,
        entityId: accountEntityId,
        metricDate: row.date_start,
        metrics: parseInsightMetrics(row),
      });
    }

    const syncBreakdowns = async (
      level: MetaInsightLevel,
      breakdownType: MetaInsightBreakdownType,
    ) => {
      try {
        const rows = await fetchMetaInsightBreakdowns(
          accountId,
          accessToken,
          level,
          breakdownType,
          since,
          until,
        );
        let upserted = 0;
        for (const row of rows) {
          if (!row.date_start) continue;
          const entityId = resolveInsightEntityId(
            row,
            level,
            entityIds,
            accountEntityId,
          );
          if (!entityId) continue;

          await upsertDailyBreakdownMetrics({
            scope,
            connectionId: connection.id,
            entityId,
            metricDate: row.date_start,
            breakdownType,
            publisherPlatform: normalizeBreakdownDim(row.publisher_platform),
            platformPosition: normalizeBreakdownDim(row.platform_position),
            devicePlatform: normalizeBreakdownDim(row.device_platform),
            impressionDevice: normalizeBreakdownDim(row.impression_device),
            age: normalizeBreakdownDim(row.age),
            gender: normalizeBreakdownDim(row.gender),
            country: normalizeBreakdownDim(row.country),
            metrics: parseInsightMetrics(row),
          });
          upserted += 1;
        }
        console.info(
          `[adpilot] Meta breakdowns ${level}/${breakdownType}: ${rows.length} rows, ${upserted} upserted`,
        );
      } catch (breakdownError) {
        console.error(
          `Failed to sync Meta insight breakdowns (${level}/${breakdownType}):`,
          breakdownError,
        );
      }
    };

    for (const breakdownType of DEMOGRAPHIC_BREAKDOWN_TYPES) {
      await syncBreakdowns("account", breakdownType);
    }

    const campaigns = await fetchMetaGraphCollection<{
      id: string;
      name?: string;
      status?: string;
      objective?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      start_time?: string;
      stop_time?: string;
    }>(`${accountId}/campaigns`, accessToken, {
      fields:
        "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    });

    for (const campaign of campaigns) {
      const dailyBudgetMicros = centsToMicros(campaign.daily_budget);
      const lifetimeBudgetMicros = centsToMicros(campaign.lifetime_budget);
      const campaignEntityId = await upsertEntity({
        scope,
        connectionId: connection.id,
        entityType: "campaign",
        providerEntityId: campaign.id,
        parentId: accountEntityId,
        name: campaign.name ?? null,
        status: normalizeStatus(campaign.status),
        objective: campaign.objective ?? null,
        dailyBudgetMicros,
        lifetimeBudgetMicros,
        budgetOptimization: resolveBudgetOptimization(
          dailyBudgetMicros,
          lifetimeBudgetMicros,
        ),
        rawPayload: campaign,
      });
      entityIds.set(campaign.id, campaignEntityId);
    }

    const adSets = await fetchMetaGraphCollection<{
      id: string;
      name?: string;
      status?: string;
      campaign_id?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      start_time?: string;
      end_time?: string;
      learning_stage_info?: MetaLearningStageInfo;
      targeting?: MetaAdSetTargeting;
    }>(`${accountId}/adsets`, accessToken, {
      fields:
        "id,name,status,campaign_id,daily_budget,lifetime_budget,start_time,end_time,learning_stage_info,targeting",
    });

    const campaignLearning = new Map<string, LearningFields>();
    const adSetAudienceSyncInput: Array<{
      id: string;
      entityId: string;
      targeting?: MetaAdSetTargeting | null;
    }> = [];

    for (const adSet of adSets) {
      const parentId = adSet.campaign_id
        ? (entityIds.get(adSet.campaign_id) ?? accountEntityId)
        : accountEntityId;

      const learning = parseLearningStageInfo(adSet.learning_stage_info);

      const adSetEntityId = await upsertEntity({
        scope,
        connectionId: connection.id,
        entityType: "ad_group",
        providerEntityId: adSet.id,
        parentId,
        name: adSet.name ?? null,
        status: normalizeStatus(adSet.status),
        dailyBudgetMicros: centsToMicros(adSet.daily_budget),
        lifetimeBudgetMicros: centsToMicros(adSet.lifetime_budget),
        learning,
        rawPayload: adSet,
      });
      entityIds.set(adSet.id, adSetEntityId);
      adSetAudienceSyncInput.push({
        id: adSet.id,
        entityId: adSetEntityId,
        targeting: adSet.targeting ?? null,
      });

      if (adSet.campaign_id && learning.learningStatus) {
        campaignLearning.set(
          adSet.campaign_id,
          mergeCampaignLearning(campaignLearning.get(adSet.campaign_id), learning),
        );
      }
    }

    // Custom/lookalike catalog + targeting segment usages. Non-fatal.
    try {
      const audienceSync = await syncMetaAudiences({
        scope,
        connectionId: connection.id,
        accountId,
        accessToken,
        adSets: adSetAudienceSyncInput,
      });
      console.info(
        `[adpilot] Meta audiences synced for ${accountId}: ${audienceSync.audiences} audiences, ${audienceSync.usages} usages`,
      );
    } catch (audienceError) {
      console.error(`Failed to sync Meta audiences for ${accountId}:`, audienceError);
    }

    for (const [campaignId, learning] of campaignLearning) {
      const campaignEntityId = entityIds.get(campaignId);
      if (campaignEntityId) {
        await updateEntityLearning(campaignEntityId, learning);
      }
    }

    // Estimated audience size lives on ad-set targeting (Ads Manager demographics band).
    // Campaigns don't have their own targeting - only ad sets do. Ads inherit from parent.
    const adSetAudienceEstimates = new Map<string, AudienceEstimateFields>();

    for (const adSet of adSets) {
      const adSetEntityId = entityIds.get(adSet.id);
      if (!adSetEntityId) continue;

      try {
        const rawEstimate = await fetchMetaDeliveryEstimate(adSet.id, accessToken);
        const estimate = parseDeliveryEstimate(rawEstimate);
        adSetAudienceEstimates.set(adSet.id, estimate);
        await updateEntityAudienceEstimate(adSetEntityId, estimate);
      } catch (estimateError) {
        console.error(
          `Failed to fetch delivery estimate for ad set ${adSet.id}:`,
          estimateError,
        );
      }
    }

    const ads = await fetchMetaGraphCollection<{
      id: string;
      name?: string;
      status?: string;
      adset_id?: string;
      campaign_id?: string;
      creative?: MetaAdCreative;
    }>(`${accountId}/ads`, accessToken, {
      fields: AD_CREATIVE_FIELDS,
    });

    for (const ad of ads) {
      const parentId = ad.adset_id
        ? (entityIds.get(ad.adset_id) ?? accountEntityId)
        : accountEntityId;

      const adEntityId = await upsertEntity({
        scope,
        connectionId: connection.id,
        entityType: "ad",
        providerEntityId: ad.id,
        parentId,
        name: ad.name ?? null,
        status: normalizeStatus(ad.status),
        rawPayload: ad,
      });
      entityIds.set(ad.id, adEntityId);

      if (ad.adset_id) {
        const parentEstimate = adSetAudienceEstimates.get(ad.adset_id);
        if (parentEstimate) {
          try {
            await updateEntityAudienceEstimate(adEntityId, parentEstimate);
          } catch (estimateError) {
            console.error(
              `Failed to copy audience estimate onto ad ${ad.id}:`,
              estimateError,
            );
          }
        }
      }

      // Capture creative metadata + media assets. Non-fatal: a creative issue
      // must never abort the wider sync.
      const parsedCreative = parseCreative(ad.creative);
      if (parsedCreative) {
        try {
          await persistAdCreative({
            scope,
            connectionId: connection.id,
            accountId,
            accessToken,
            adEntityId,
            providerAdId: ad.id,
            parsed: parsedCreative,
          });
        } catch (creativeError) {
          console.error(
            `Failed to persist creative for ad ${ad.id}:`,
            creativeError,
          );
        }
      }
    }

    // Account daily metrics already synced at the start of this run.
    const campaignInsights = await fetchMetaInsights(
      accountId,
      accessToken,
      "campaign",
      since,
      until,
    );

    for (const row of campaignInsights) {
      if (!row.date_start || !row.campaign_id) continue;
      const campaignEntityId = entityIds.get(row.campaign_id);
      if (!campaignEntityId) continue;

      await upsertDailyMetrics({
        scope,
        connectionId: connection.id,
        entityId: campaignEntityId,
        metricDate: row.date_start,
        metrics: parseInsightMetrics(row),
      });
    }

    const adSetInsights = await fetchMetaInsights(
      accountId,
      accessToken,
      "adset",
      since,
      until,
    );

    for (const row of adSetInsights) {
      if (!row.date_start || !row.adset_id) continue;
      const adSetEntityId = entityIds.get(row.adset_id);
      if (!adSetEntityId) continue;

      await upsertDailyMetrics({
        scope,
        connectionId: connection.id,
        entityId: adSetEntityId,
        metricDate: row.date_start,
        metrics: parseInsightMetrics(row),
      });
    }

    const adInsights = await fetchMetaInsights(
      accountId,
      accessToken,
      "ad",
      since,
      until,
    );

    for (const row of adInsights) {
      if (!row.date_start || !row.ad_id) continue;
      const adEntityId = entityIds.get(row.ad_id);
      if (!adEntityId) continue;

      await upsertDailyMetrics({
        scope,
        connectionId: connection.id,
        entityId: adEntityId,
        metricDate: row.date_start,
        metrics: parseInsightMetrics(row),
      });
    }

    // Account-level hourly insights for Days & Hours heatmaps. Non-fatal.
    try {
      const hourlyRows = await fetchMetaHourlyInsights(
        accountId,
        accessToken,
        "account",
        since,
        until,
      );
      for (const row of hourlyRows) {
        if (!row.date_start) continue;
        const hourOfDay = parseMetaHourOfDay(
          row.hourly_stats_aggregated_by_advertiser_time_zone,
        );
        if (hourOfDay === null) continue;

        await upsertHourlyMetrics({
          scope,
          connectionId: connection.id,
          entityId: accountEntityId,
          metricDate: row.date_start,
          hourOfDay,
          metrics: parseInsightMetrics(row),
        });
      }

      await refreshDaysHoursRollups(scope, connection.id);
    } catch (hourlyError) {
      console.error("Failed to sync Meta hourly insights:", hourlyError);
    }

    // Device + placement breakdowns (Auction Insights–style). Demographics
    // already synced at account level above. Non-fatal.
    for (const level of BREAKDOWN_SYNC_LEVELS) {
      for (const breakdownType of DEVICE_PLACEMENT_BREAKDOWN_TYPES) {
        await syncBreakdowns(level, breakdownType);
      }
    }

    // Frequency distribution (Ads Manager Frequency Breakdown). Period snapshots
    // for 1/7/14/30d - unique reach is not additive across days. Non-fatal.
    try {
      const frequencyRows: Array<{
        entityId: string;
        rangeDays: FrequencyRangeDays;
        frequencyValue: string;
        reach: number;
      }> = [];

      for (const level of FREQUENCY_SYNC_LEVELS) {
        const rows = await fetchMetaFrequencyBreakdowns(
          accountId,
          accessToken,
          level,
        );
        for (const row of rows) {
          const frequencyValue = (row.frequency_value ?? "").trim();
          if (!frequencyValue) continue;

          const rangeDays = frequencyRangeDaysFromDates(
            row.date_start,
            row.date_stop,
          );
          if (!rangeDays) continue;

          const entityId = resolveInsightEntityId(
            row,
            level,
            entityIds,
            accountEntityId,
          );
          if (!entityId) continue;

          const reach = row.reach ? parseInt(row.reach, 10) : 0;
          if (!Number.isFinite(reach) || reach < 0) continue;

          frequencyRows.push({
            entityId,
            rangeDays,
            frequencyValue,
            reach,
          });
        }
      }

      await replaceFrequencyBreakdowns({
        scope,
        connectionId: connection.id,
        rows: frequencyRows,
      });
    } catch (frequencyError) {
      console.error(
        "Failed to sync Meta frequency_value breakdowns:",
        frequencyError,
      );
    }

    // Lifetime unique reach + total spend for saturation / potential-spend bars.
    // Non-fatal: daily metrics already landed; missing lifetime totals shouldn't fail sync.
    const applyLifetimeTotals = async (
      level: "account" | "campaign" | "adset" | "ad",
      resolveEntityId: (row: MetaInsightRow) => string | undefined,
    ) => {
      try {
        const rows = await fetchMetaLifetimeTotals(accountId, accessToken, level);
        for (const row of rows) {
          const entityId = resolveEntityId(row);
          if (!entityId) continue;
          const reach = row.reach ? parseInt(row.reach, 10) : null;
          const spendMicros = row.spend != null && row.spend !== ""
            ? dollarsToMicros(row.spend)
            : null;
          await updateEntityLifetimeTotals(entityId, {
            lifetimeReach:
              Number.isFinite(reach) && reach !== null && reach >= 0 ? reach : null,
            lifetimeSpendMicros:
              spendMicros != null && Number.isFinite(spendMicros) && spendMicros >= 0
                ? spendMicros
                : null,
          });
        }
      } catch (lifetimeError) {
        console.error(`Failed to fetch lifetime totals (${level}):`, lifetimeError);
      }
    };

    await applyLifetimeTotals("account", () => accountEntityId);
    await applyLifetimeTotals("campaign", (row) =>
      row.campaign_id ? entityIds.get(row.campaign_id) : undefined,
    );
    await applyLifetimeTotals("adset", (row) =>
      row.adset_id ? entityIds.get(row.adset_id) : undefined,
    );
    await applyLifetimeTotals("ad", (row) =>
      row.ad_id ? entityIds.get(row.ad_id) : undefined,
    );

    const now = new Date().toISOString();
    await upsertSyncState(connection.id, scope, {
      sync_status: "idle",
      last_full_sync_at: now,
      last_insights_sync_at: now,
      last_incremental_sync_at: now,
      insights_cursor: { since, until },
      entity_cursor: {
        campaigns: campaigns.length,
        ad_sets: adSets.length,
        ads: ads.length,
      },
      last_error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta sync failed";
    await upsertSyncState(connection.id, scope, {
      sync_status: "error",
      last_error: message,
    });
    throw error;
  }
}

export async function syncMetaConnectionsForAccount(scope: AdDataScope) {
  const connections = await listMetaConnectionsWithTokens(scope.accountId);
  const results: Array<{ connectionId: string; ok: boolean; error?: string }> = [];

  for (const connection of connections) {
    try {
      await syncMetaConnection(connection, scope);
      results.push({ connectionId: connection.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      results.push({ connectionId: connection.id, ok: false, error: message });
    }
  }

  return results;
}
