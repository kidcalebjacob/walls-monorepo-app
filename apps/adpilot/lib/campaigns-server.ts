import { createClient } from "@walls/supabase/server";

import { type AdDataScope, withAdScope } from "@/lib/ad-scope";
import { META_PROVIDER } from "@/lib/connections";
import {
  buildAdCreativePreview,
  type AdCreativePreview,
} from "@/lib/meta-creatives";
import {
  DASHBOARD_OBJECTIVE_BUCKETS,
  resolveObjectiveBucket,
  isSalesObjective,
  formatObjectiveLabel,
  type DashboardObjectiveBucket,
} from "@/lib/meta-objectives";

import type { AutomationStatus } from "@/lib/spend-automation-settings";

export type CampaignEntityType = "campaign" | "ad_group" | "ad";

export type EntityPerformanceRow = {
  id: string;
  entityType: CampaignEntityType;
  name: string;
  /** Ad platform provider (e.g. `meta`). From `ad_entities.provider`. */
  provider: string;
  status: string | null;
  objective: string | null;
  objectiveBucket: DashboardObjectiveBucket | null;
  accountName: string;
  parentId: string | null;
  parentName: string | null;
  /** Campaign id for an ad's ad-set parent (used for parent detail links). */
  parentCampaignId: string | null;
  accountConnectionId: string;
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
  thumbnailUrl: string | null;
  creativeType: string | null;
  creativePreview: AdCreativePreview | null;
  lastSyncedAt: string | null;
};

export type CampaignAccountOption = {
  id: string;
  name: string;
  accountConnectionId: string;
};

export type CampaignObjectiveOption = {
  value: DashboardObjectiveBucket;
  label: string;
};

export type CampaignsListResult = {
  rows: EntityPerformanceRow[];
  totalCount: number;
  accounts: CampaignAccountOption[];
  objectives: CampaignObjectiveOption[];
  syncing: boolean;
};

export type CampaignSortColumn =
  | "name"
  | "platform"
  | "context"
  | "account"
  | "status"
  | "dailyBudget"
  | "spend"
  | "websitePurchases"
  | "cpa"
  | "purchaseValue"
  | "impressions"
  | "clicks"
  | "ctr"
  | "roas";

export type CampaignSortDirection = "asc" | "desc";

export const CAMPAIGN_SORT_COLUMNS = new Set<CampaignSortColumn>([
  "name",
  "platform",
  "context",
  "account",
  "status",
  "dailyBudget",
  "spend",
  "websitePurchases",
  "cpa",
  "purchaseValue",
  "impressions",
  "clicks",
  "ctr",
  "roas",
]);

const PAGE_SIZE_DEFAULT = 25;

type EntityRecord = {
  id: string;
  entity_type: CampaignEntityType;
  name: string | null;
  provider: string;
  status: string | null;
  objective: string | null;
  parent_id: string | null;
  account_connection_id: string;
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

function resolveEntityCampaignObjective(
  entity: EntityRecord,
  campaignObjectiveById: Map<string, string | null>,
  adGroupToCampaignId: Map<string, string>,
): string | null {
  if (entity.entity_type === "campaign") {
    return entity.objective;
  }

  if (entity.entity_type === "ad_group" && entity.parent_id) {
    return campaignObjectiveById.get(entity.parent_id) ?? null;
  }

  if (entity.entity_type === "ad" && entity.parent_id) {
    const campaignId = adGroupToCampaignId.get(entity.parent_id);
    if (!campaignId) return null;
    return campaignObjectiveById.get(campaignId) ?? null;
  }

  return null;
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

/** Composite score for ad sets / ads - favors spend with ROAS and conversion efficiency. */
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

function campaignSortValue(
  row: EntityPerformanceRow,
  column: CampaignSortColumn,
  entityType: CampaignEntityType,
): string | number | null {
  switch (column) {
    case "name":
      return row.name.toLowerCase();
    case "platform":
      return row.provider.toLowerCase();
    case "context":
      if (entityType === "campaign") {
        return (formatObjectiveLabel(row.objective) || row.objective || "")
          .toLowerCase() || null;
      }
      return row.parentName?.toLowerCase() ?? null;
    case "account":
      return row.accountName.toLowerCase();
    case "status":
      return row.status?.toLowerCase() ?? null;
    case "dailyBudget":
      return row.dailyBudgetMicros != null && row.dailyBudgetMicros > 0
        ? row.dailyBudgetMicros
        : null;
    case "spend":
      return row.spendMicros;
    case "websitePurchases":
      return row.websitePurchases;
    case "cpa":
      return row.websitePurchases != null && row.websitePurchases > 0
        ? row.spendMicros / row.websitePurchases
        : null;
    case "purchaseValue":
      return row.conversionValueMicros > 0 ? row.conversionValueMicros : null;
    case "impressions":
      return row.impressions;
    case "clicks":
      return row.clicks;
    case "ctr":
      return row.ctr;
    case "roas":
      return row.roas;
    default:
      return null;
  }
}

function compareCampaignRows(
  left: EntityPerformanceRow,
  right: EntityPerformanceRow,
  column: CampaignSortColumn,
  direction: CampaignSortDirection,
  entityType: CampaignEntityType,
): number {
  const leftValue = campaignSortValue(left, column, entityType);
  const rightValue = campaignSortValue(right, column, entityType);

  // Always keep empty / missing values at the bottom.
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;

  let result = 0;
  if (typeof leftValue === "string" && typeof rightValue === "string") {
    result = leftValue.localeCompare(rightValue);
  } else {
    result = Number(leftValue) - Number(rightValue);
  }

  if (result !== 0) {
    return direction === "asc" ? result : -result;
  }

  return left.name.localeCompare(right.name);
}

export async function listCampaignPerformance(input: {
  scope: AdDataScope;
  entityType: CampaignEntityType;
  search?: string;
  accountId?: string;
  objective?: DashboardObjectiveBucket;
  page?: number;
  pageSize?: number;
  rangeDays?: number;
  sortBy?: CampaignSortColumn;
  sortDirection?: CampaignSortDirection;
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
      withAdScope(
        supabase
          .from("ad_entities")
          .select("id, name, account_connection_id")
          .eq("provider", META_PROVIDER)
          .eq("entity_type", "account"),
        input.scope,
      ),
      withAdScope(
        supabase.from("ad_sync_state").select("sync_status"),
        input.scope,
      ),
      withAdScope(
        supabase
          .from("ad_entities")
          .select("id, objective, entity_type, parent_id, daily_budget_micros")
          .eq("provider", META_PROVIDER)
          .in("entity_type", ["campaign", "ad_group"]),
        input.scope,
      ),
    ]);

  const accounts: CampaignAccountOption[] = (accountEntities ?? []).map(
    (account) => ({
      id: account.id as string,
      name: (account.name as string) ?? "Ad account",
      accountConnectionId: account.account_connection_id as string,
    }),
  );

  const accountNameByConnection = new Map(
    accounts.map((account) => [account.accountConnectionId, account.name]),
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

  let entityQuery = withAdScope(
    supabase
      .from("ad_entities")
      .select(
        "id, entity_type, name, provider, status, objective, parent_id, account_connection_id, last_synced_at, daily_budget_micros, learning_status",
      )
      .eq("provider", META_PROVIDER)
      .eq("entity_type", input.entityType),
    input.scope,
  );

  if (selectedAccount) {
    entityQuery = entityQuery.eq(
      "account_connection_id",
      selectedAccount.accountConnectionId,
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
      objectives: [],
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
      parentNameById.set(parent.id as string, (parent.name as string) ?? "-");
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

  const objectiveBucketsPresent = new Set<DashboardObjectiveBucket>();
  for (const entity of entityList) {
    const campaignObjective = resolveEntityCampaignObjective(
      entity,
      campaignObjectiveById,
      adGroupToCampaignId,
    );
    const bucket = resolveObjectiveBucket(campaignObjective);
    if (bucket) objectiveBucketsPresent.add(bucket);
  }

  const objectives: CampaignObjectiveOption[] = DASHBOARD_OBJECTIVE_BUCKETS.filter(
    (bucket) => objectiveBucketsPresent.has(bucket.value),
  ).map((bucket) => ({
    value: bucket.value,
    label: bucket.label,
  }));

  const entityIds = entityList.map((entity) => entity.id);

  const creativesQuery =
    input.entityType === "ad" && entityIds.length > 0
      ? supabase
          .from("ad_creatives")
          .select(
            `ad_entity_id, creative_type, title, body, thumbnail_url, image_url, image_permalink_url, video_thumbnail_url, video_source_url,
            ad_creative_assets (
              id, asset_type, ordinal, image_url, permalink_url, video_source_url, video_thumbnail_url, title, body
            )`,
          )
          .in("ad_entity_id", entityIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> });

  const [{ data: metrics }, { data: automations }, { data: creatives }] =
    await Promise.all([
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
    creativesQuery,
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

  const creativeByAdEntity = new Map<string, AdCreativePreview>();
  for (const creative of creatives ?? []) {
    const preview = buildAdCreativePreview(creative);
    if (preview) {
      creativeByAdEntity.set(creative.ad_entity_id as string, preview);
    }
  }

  let rows: EntityPerformanceRow[] = entityList.map((entity) => {
    const totals = aggregateMetrics(metricsByEntity.get(entity.id) ?? []);
    const tracksWebsitePurchases = resolveTracksWebsitePurchases(
      entity,
      campaignObjectiveById,
      adGroupToCampaignId,
    );
    const automation = automationByEntity.get(entity.id);
    const creative = creativeByAdEntity.get(entity.id);
    const campaignObjective = resolveEntityCampaignObjective(
      entity,
      campaignObjectiveById,
      adGroupToCampaignId,
    );
    const objectiveBucket = resolveObjectiveBucket(campaignObjective);

    return {
      id: entity.id,
      entityType: entity.entity_type,
      name: entity.name ?? "Untitled",
      provider: entity.provider,
      status: entity.status,
      objective:
        entity.entity_type === "campaign" ? entity.objective : campaignObjective,
      objectiveBucket,
      accountName:
        accountNameByConnection.get(entity.account_connection_id) ?? "Ad account",
      parentId: entity.parent_id,
      parentName: entity.parent_id
        ? (parentNameById.get(entity.parent_id) ?? null)
        : null,
      parentCampaignId:
        entity.entity_type === "ad" && entity.parent_id
          ? (adGroupToCampaignId.get(entity.parent_id) ?? null)
          : null,
      accountConnectionId: entity.account_connection_id,
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
      thumbnailUrl: creative?.thumbnailUrl ?? null,
      creativeType: creative?.creativeType ?? null,
      creativePreview: creative ?? null,
      lastSyncedAt: entity.last_synced_at,
    };
  });

  if (input.objective) {
    rows = rows.filter((row) => row.objectiveBucket === input.objective);
  }

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

  if (input.sortBy) {
    const direction = input.sortDirection ?? "desc";
    rows.sort((left, right) =>
      compareCampaignRows(
        left,
        right,
        input.sortBy!,
        direction,
        input.entityType,
      ),
    );
  } else {
    rows.sort((left, right) => sortEntityRows(left, right, input.entityType));
  }

  const totalCount = rows.length;
  const pagedRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  return {
    rows: pagedRows,
    totalCount,
    accounts,
    objectives,
    syncing: (syncStates ?? []).some((state) => state.sync_status === "running"),
  };
}
