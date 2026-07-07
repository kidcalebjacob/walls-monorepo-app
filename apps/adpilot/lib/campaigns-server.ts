import { createClient } from "@walls/supabase/server";

import { META_PROVIDER } from "@/lib/connections";
import { isSalesObjective, formatObjectiveLabel } from "@/lib/meta-objectives";

import type { AutomationStatus } from "@/lib/spend-automation-settings";

export type CampaignEntityType = "campaign" | "ad_group" | "ad";

export type EntityPerformanceRow = {
  id: string;
  entityType: CampaignEntityType;
  name: string;
  status: string | null;
  objective: string | null;
  accountName: string;
  parentId: string | null;
  parentName: string | null;
  userConnectionId: string;
  spendMicros: number;
  impressions: number;
  clicks: number;
  websitePurchases: number | null;
  conversionValueMicros: number;
  dailyBudgetMicros: number | null;
  adpilotEnabled: boolean;
  automationStatus: AutomationStatus | null;
  ctr: number;
  roas: number | null;
  learningStatus: string | null;
  lastSyncedAt: string | null;
};

export type CampaignAccountOption = {
  id: string;
  name: string;
  userConnectionId: string;
};

export type CampaignsListResult = {
  rows: EntityPerformanceRow[];
  totalCount: number;
  accounts: CampaignAccountOption[];
  syncing: boolean;
};

const PAGE_SIZE_DEFAULT = 25;

type EntityRecord = {
  id: string;
  entity_type: CampaignEntityType;
  name: string | null;
  status: string | null;
  objective: string | null;
  parent_id: string | null;
  user_connection_id: string;
  last_synced_at: string | null;
  daily_budget_micros: number | null;
  learning_status: string | null;
};

function resolveDailyBudgetMicros(
  entity: EntityRecord,
  budgetByEntityId: Map<string, number | null>,
  adGroupToCampaignId: Map<string, string>,
): number | null {
  const ownBudget = entity.daily_budget_micros;
  if (ownBudget != null && ownBudget > 0) return ownBudget;

  if (entity.entity_type === "ad_group" && entity.parent_id) {
    const campaignBudget = budgetByEntityId.get(entity.parent_id);
    if (campaignBudget != null && campaignBudget > 0) return campaignBudget;
  }

  if (entity.entity_type === "ad" && entity.parent_id) {
    const adGroupBudget = budgetByEntityId.get(entity.parent_id);
    if (adGroupBudget != null && adGroupBudget > 0) return adGroupBudget;

    const campaignId = adGroupToCampaignId.get(entity.parent_id);
    if (campaignId) {
      const campaignBudget = budgetByEntityId.get(campaignId);
      if (campaignBudget != null && campaignBudget > 0) return campaignBudget;
    }
  }

  return null;
}

type MetricRecord = {
  entity_id: string;
  spend_micros: number;
  impressions: number;
  clicks: number;
  conversion_value_micros: number;
  website_purchases: number;
};

function aggregateMetrics(rows: MetricRecord[]) {
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

  return { ...totals, ctr, roas };
}

function resolveTracksWebsitePurchases(
  entity: EntityRecord,
  campaignObjectiveById: Map<string, string | null>,
  adGroupToCampaignId: Map<string, string>,
): boolean {
  if (entity.entity_type === "campaign") {
    return isSalesObjective(entity.objective);
  }

  if (entity.entity_type === "ad_group") {
    const campaignId = entity.parent_id;
    return campaignId
      ? isSalesObjective(campaignObjectiveById.get(campaignId) ?? null)
      : false;
  }

  const adGroupId = entity.parent_id;
  const campaignId = adGroupId ? adGroupToCampaignId.get(adGroupId) : undefined;
  return campaignId
    ? isSalesObjective(campaignObjectiveById.get(campaignId) ?? null)
    : false;
}

/** Lower rank = shown first. Active delivery wins over paused/archived. */
function statusRank(status: string | null): number {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "active") return 0;
  if (normalized === "learning" || normalized === "in_process") return 1;
  if (normalized === "pending_review" || normalized === "pending") return 2;
  if (normalized === "paused") return 3;
  if (normalized === "campaign_paused" || normalized === "adset_paused") return 4;
  if (normalized === "archived") return 5;
  if (normalized === "deleted" || normalized === "disapproved") return 6;

  return 4;
}

/** Composite score for ad sets / ads — favors spend with ROAS and conversion efficiency. */
function performanceScore(row: EntityPerformanceRow): number {
  const spend = row.spendMicros / 1_000_000;
  const roas = row.roas ?? 0;
  const hasDelivery = row.impressions > 0 || spend > 0;

  if (!hasDelivery) return 0;

  return (
    spend * 1_000 +
    roas * spend * 250 +
    (row.websitePurchases ?? 0) * 100 +
    row.ctr * 15 +
    row.clicks * 2
  );
}

function sortEntityRows(
  left: EntityPerformanceRow,
  right: EntityPerformanceRow,
  entityType: CampaignEntityType,
): number {
  if (entityType === "campaign") {
    return right.spendMicros - left.spendMicros;
  }

  const statusDiff = statusRank(left.status) - statusRank(right.status);
  if (statusDiff !== 0) return statusDiff;

  const scoreDiff = performanceScore(right) - performanceScore(left);
  if (scoreDiff !== 0) return scoreDiff;

  return right.spendMicros - left.spendMicros;
}

export async function listCampaignPerformance(input: {
  userId: string;
  entityType: CampaignEntityType;
  search?: string;
  accountId?: string;
  page?: number;
  pageSize?: number;
  rangeDays?: number;
}): Promise<CampaignsListResult> {
  const supabase = await createClient();
  const page = input.page ?? 0;
  const pageSize = input.pageSize ?? PAGE_SIZE_DEFAULT;
  const search = input.search?.trim().toLowerCase() ?? "";
  const rangeDays = input.rangeDays ?? 30;

  const currentStart = new Date();
  currentStart.setDate(currentStart.getDate() - rangeDays);
  const currentStartIso = currentStart.toISOString().slice(0, 10);

  const [{ data: accountEntities }, { data: syncStates }, { data: budgetEntities }] =
    await Promise.all([
      supabase
        .from("ad_entities")
        .select("id, name, user_connection_id")
        .eq("user_id", input.userId)
        .eq("provider", META_PROVIDER)
        .eq("entity_type", "account"),
      supabase
        .from("ad_sync_state")
        .select("sync_status")
        .eq("user_id", input.userId),
      supabase
        .from("ad_entities")
        .select("id, objective, entity_type, parent_id, daily_budget_micros")
        .eq("user_id", input.userId)
        .eq("provider", META_PROVIDER)
        .in("entity_type", ["campaign", "ad_group"]),
    ]);

  const accounts: CampaignAccountOption[] = (accountEntities ?? []).map(
    (account) => ({
      id: account.id as string,
      name: (account.name as string) ?? "Ad account",
      userConnectionId: account.user_connection_id as string,
    }),
  );

  const accountNameByConnection = new Map(
    accounts.map((account) => [account.userConnectionId, account.name]),
  );

  const campaignObjectiveById = new Map<string, string | null>();
  const budgetByEntityId = new Map<string, number | null>();

  for (const entity of budgetEntities ?? []) {
    const id = entity.id as string;
    const dailyBudget = entity.daily_budget_micros as number | null;

    budgetByEntityId.set(id, dailyBudget);

    if (entity.entity_type === "campaign") {
      campaignObjectiveById.set(id, (entity.objective as string | null) ?? null);
    }
  }

  const selectedAccount = input.accountId
    ? accounts.find((account) => account.id === input.accountId)
    : undefined;

  let entityQuery = supabase
    .from("ad_entities")
    .select(
      "id, entity_type, name, status, objective, parent_id, user_connection_id, last_synced_at, daily_budget_micros, learning_status",
    )
    .eq("user_id", input.userId)
    .eq("provider", META_PROVIDER)
    .eq("entity_type", input.entityType);

  if (selectedAccount) {
    entityQuery = entityQuery.eq(
      "user_connection_id",
      selectedAccount.userConnectionId,
    );
  }

  const { data: entities, error: entitiesError } = await entityQuery;
  if (entitiesError) throw entitiesError;

  const entityList = (entities ?? []) as EntityRecord[];
  if (entityList.length === 0) {
    return {
      rows: [],
      totalCount: 0,
      accounts,
      syncing: (syncStates ?? []).some((state) => state.sync_status === "running"),
    };
  }

  const parentIds = Array.from(
    new Set(entityList.map((entity) => entity.parent_id).filter(Boolean)),
  ) as string[];

  const parentNameById = new Map<string, string>();
  const adGroupToCampaignId = new Map<string, string>();

  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("ad_entities")
      .select("id, name, entity_type, parent_id")
      .in("id", parentIds);

    for (const parent of parents ?? []) {
      parentNameById.set(parent.id as string, (parent.name as string) ?? "—");
      if (parent.entity_type === "ad_group" && parent.parent_id) {
        adGroupToCampaignId.set(parent.id as string, parent.parent_id as string);
      }
    }
  }

  if (input.entityType === "ad" && parentIds.length > 0) {
    const { data: adGroups } = await supabase
      .from("ad_entities")
      .select("id, parent_id")
      .eq("entity_type", "ad_group")
      .in("id", parentIds);

    for (const adGroup of adGroups ?? []) {
      if (adGroup.parent_id) {
        adGroupToCampaignId.set(adGroup.id as string, adGroup.parent_id as string);
      }
    }
  }

  const entityIds = entityList.map((entity) => entity.id);
  const [{ data: metrics }, { data: automations }] = await Promise.all([
    supabase
      .from("ad_metrics_daily")
      .select(
        "entity_id, spend_micros, impressions, clicks, conversion_value_micros, website_purchases",
      )
      .in("entity_id", entityIds)
      .gte("metric_date", currentStartIso),
    supabase
      .from("ad_entity_automation")
      .select("entity_id, enabled, automation_status")
      .in("entity_id", entityIds),
  ]);

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

  const metricsByEntity = new Map<string, MetricRecord[]>();
  for (const metric of (metrics ?? []) as MetricRecord[]) {
    const bucket = metricsByEntity.get(metric.entity_id) ?? [];
    bucket.push(metric);
    metricsByEntity.set(metric.entity_id, bucket);
  }

  let rows: EntityPerformanceRow[] = entityList.map((entity) => {
    const totals = aggregateMetrics(metricsByEntity.get(entity.id) ?? []);
    const tracksWebsitePurchases = resolveTracksWebsitePurchases(
      entity,
      campaignObjectiveById,
      adGroupToCampaignId,
    );
    const automation = automationByEntity.get(entity.id);

    return {
      id: entity.id,
      entityType: entity.entity_type,
      name: entity.name ?? "Untitled",
      status: entity.status,
      objective: entity.objective,
      accountName:
        accountNameByConnection.get(entity.user_connection_id) ?? "Ad account",
      parentId: entity.parent_id,
      parentName: entity.parent_id
        ? (parentNameById.get(entity.parent_id) ?? null)
        : null,
      userConnectionId: entity.user_connection_id,
      spendMicros: totals.spend_micros,
      impressions: totals.impressions,
      clicks: totals.clicks,
      websitePurchases: tracksWebsitePurchases ? totals.website_purchases : null,
      conversionValueMicros: totals.conversion_value_micros,
      dailyBudgetMicros: resolveDailyBudgetMicros(
        entity,
        budgetByEntityId,
        adGroupToCampaignId,
      ),
      adpilotEnabled: automation?.enabled ?? false,
      automationStatus: automation?.status ?? null,
      ctr: totals.ctr,
      roas: totals.roas,
      learningStatus: entity.learning_status,
      lastSyncedAt: entity.last_synced_at,
    };
  });

  if (search) {
    rows = rows.filter((row) => {
      const haystack = [
        row.name,
        row.accountName,
        row.parentName,
        row.status,
        row.objective,
        formatObjectiveLabel(row.objective),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  rows.sort((left, right) => sortEntityRows(left, right, input.entityType));

  const totalCount = rows.length;
  const pagedRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  return {
    rows: pagedRows,
    totalCount,
    accounts,
    syncing: (syncStates ?? []).some((state) => state.sync_status === "running"),
  };
}
