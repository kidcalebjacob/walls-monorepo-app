import { createAdminClient } from "@walls/supabase/admin";

import { META_PROVIDER } from "@/lib/connections";
import {
  fetchMetaGraphCollection,
  fetchMetaInsights,
  getMetaDateRange,
  type MetaInsightRow,
} from "@/lib/meta-graph";

import {
  AD_CREATIVE_FIELDS,
  parseCreative,
  persistAdCreative,
  type MetaAdCreative,
} from "@/lib/meta-creatives";

import { listMetaConnectionsWithTokens } from "./connections-server";
import type { MetaConnectionRecord } from "@/lib/connections";

/** Meta returns overlapping purchase types — pick one, never sum them. */
const PURCHASE_ACTION_PRIORITY = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "web_in_store_purchase",
] as const;

const WEBSITE_PURCHASE_ACTION = "offsite_conversion.fb_pixel_purchase" as const;

type EntityType = "account" | "campaign" | "ad_group" | "ad";

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
    ctr: row.ctr ? parseFloat(row.ctr) : null,
    cpc_micros: row.cpc ? dollarsToMicros(row.cpc) : null,
    cpm_micros: row.cpm ? dollarsToMicros(row.cpm) : null,
    roas,
  };
}

async function upsertSyncState(
  connectionId: string,
  userId: string,
  patch: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("ad_sync_state")
    .select("id")
    .eq("user_connection_id", connectionId)
    .maybeSingle();

  const row = {
    user_connection_id: connectionId,
    user_id: userId,
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
  userId: string;
  connectionId: string;
  entityType: EntityType;
  providerEntityId: string;
  parentId: string | null;
  name: string | null;
  status: string | null;
  objective?: string | null;
  dailyBudgetMicros?: number | null;
  lifetimeBudgetMicros?: number | null;
  learning?: LearningFields;
  rawPayload: Record<string, unknown>;
}): Promise<string> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const learning = input.learning ?? EMPTY_LEARNING_FIELDS;

  const row = {
    user_id: input.userId,
    user_connection_id: input.connectionId,
    provider: META_PROVIDER,
    entity_type: input.entityType,
    provider_entity_id: input.providerEntityId,
    parent_id: input.parentId,
    name: input.name,
    status: input.status,
    objective: input.objective ?? null,
    daily_budget_micros: input.dailyBudgetMicros ?? null,
    lifetime_budget_micros: input.lifetimeBudgetMicros ?? null,
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
    .eq("user_connection_id", input.connectionId)
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

async function upsertDailyMetrics(input: {
  userId: string;
  connectionId: string;
  entityId: string;
  metricDate: string;
  metrics: ReturnType<typeof parseInsightMetrics>;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const row = {
    user_id: input.userId,
    user_connection_id: input.connectionId,
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
): Promise<void> {
  if (!connection.account_id) {
    throw new Error("Meta connection is missing account_id.");
  }

  const accountId = connection.account_id;
  const accessToken = connection.access_token;
  const accountName =
    connection.token_payload?.account_name ?? accountId.replace(/^act_/, "Ad account ");

  await upsertSyncState(connection.id, connection.user_id, {
    sync_status: "running",
    last_error: null,
  });

  try {
    const entityIds = new Map<string, string>();

    const accountEntityId = await upsertEntity({
      userId: connection.user_id,
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
      const campaignEntityId = await upsertEntity({
        userId: connection.user_id,
        connectionId: connection.id,
        entityType: "campaign",
        providerEntityId: campaign.id,
        parentId: accountEntityId,
        name: campaign.name ?? null,
        status: normalizeStatus(campaign.status),
        objective: campaign.objective ?? null,
        dailyBudgetMicros: centsToMicros(campaign.daily_budget),
        lifetimeBudgetMicros: centsToMicros(campaign.lifetime_budget),
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
    }>(`${accountId}/adsets`, accessToken, {
      fields:
        "id,name,status,campaign_id,daily_budget,lifetime_budget,start_time,end_time,learning_stage_info",
    });

    const campaignLearning = new Map<string, LearningFields>();

    for (const adSet of adSets) {
      const parentId = adSet.campaign_id
        ? (entityIds.get(adSet.campaign_id) ?? accountEntityId)
        : accountEntityId;

      const learning = parseLearningStageInfo(adSet.learning_stage_info);

      const adSetEntityId = await upsertEntity({
        userId: connection.user_id,
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

      if (adSet.campaign_id && learning.learningStatus) {
        campaignLearning.set(
          adSet.campaign_id,
          mergeCampaignLearning(campaignLearning.get(adSet.campaign_id), learning),
        );
      }
    }

    for (const [campaignId, learning] of campaignLearning) {
      const campaignEntityId = entityIds.get(campaignId);
      if (campaignEntityId) {
        await updateEntityLearning(campaignEntityId, learning);
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
        userId: connection.user_id,
        connectionId: connection.id,
        entityType: "ad",
        providerEntityId: ad.id,
        parentId,
        name: ad.name ?? null,
        status: normalizeStatus(ad.status),
        rawPayload: ad,
      });
      entityIds.set(ad.id, adEntityId);

      // Capture creative metadata + media assets. Non-fatal: a creative issue
      // must never abort the wider sync.
      const parsedCreative = parseCreative(ad.creative);
      if (parsedCreative) {
        try {
          await persistAdCreative({
            userId: connection.user_id,
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

    const { since, until } = getMetaDateRange(30);

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
        userId: connection.user_id,
        connectionId: connection.id,
        entityId: accountEntityId,
        metricDate: row.date_start,
        metrics: parseInsightMetrics(row),
      });
    }

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
        userId: connection.user_id,
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
        userId: connection.user_id,
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
        userId: connection.user_id,
        connectionId: connection.id,
        entityId: adEntityId,
        metricDate: row.date_start,
        metrics: parseInsightMetrics(row),
      });
    }

    const now = new Date().toISOString();
    await upsertSyncState(connection.id, connection.user_id, {
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
    await upsertSyncState(connection.id, connection.user_id, {
      sync_status: "error",
      last_error: message,
    });
    throw error;
  }
}

export async function syncMetaConnectionsForUser(userId: string) {
  const connections = await listMetaConnectionsWithTokens(userId);
  const results: Array<{ connectionId: string; ok: boolean; error?: string }> = [];

  for (const connection of connections) {
    try {
      await syncMetaConnection(connection);
      results.push({ connectionId: connection.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      results.push({ connectionId: connection.id, ok: false, error: message });
    }
  }

  return results;
}
