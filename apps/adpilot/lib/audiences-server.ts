import { createClient } from "@walls/supabase/server";

import { type AdDataScope, withAdScope } from "@/lib/ad-scope";
import type {
  AdAudienceType,
  AudienceCatalogSource,
  AudienceTargetingContext,
} from "@/lib/audience-types";
import { AUDIENCE_TYPE_LABELS } from "@/lib/audience-types";
import { META_PROVIDER } from "@/lib/connections";
import type { EntityDetailMetrics } from "@/lib/entity-detail-server";

export type AudiencePerformanceRow = {
  id: string;
  name: string;
  audienceType: AdAudienceType;
  subtype: string | null;
  provider: string;
  status: string | null;
  isReady: boolean | null;
  originType: string | null;
  approximateSizeLower: number | null;
  approximateSizeUpper: number | null;
  adSetCount: number;
  spendMicros: number;
  impressions: number;
  clicks: number;
  websitePurchases: number;
  addToCart: number;
  conversionValueMicros: number;
  ctr: number;
  roas: number | null;
  costPerPurchaseMicros: number | null;
  costPerAddToCartMicros: number | null;
  lastSyncedAt: string | null;
};

export type AudienceTypeOption = {
  value: AdAudienceType;
  label: string;
};

export type AudiencesListResult = {
  rows: AudiencePerformanceRow[];
  totalCount: number;
  types: AudienceTypeOption[];
  syncing: boolean;
};

export type AudienceUsageSummary = {
  id: string;
  inclusion: "include" | "exclude";
  source: string;
  targetingContext: AudienceTargetingContext;
  entityId: string;
  entityName: string;
  entityStatus: string | null;
  campaignId: string | null;
  campaignName: string | null;
  spendMicros: number;
  impressions: number;
  clicks: number;
  ctr: number;
  roas: number | null;
  websitePurchases: number;
};

export type AudienceDetailResult = {
  id: string;
  name: string;
  audienceType: AdAudienceType;
  subtype: string | null;
  description: string | null;
  provider: string;
  providerAudienceId: string;
  status: string | null;
  statusCode: number | null;
  isReady: boolean | null;
  catalogSource: AudienceCatalogSource | null;
  originType: string | null;
  retentionDays: number | null;
  dataSourceId: string | null;
  dataSourceType: string | null;
  approximateSizeLower: number | null;
  approximateSizeUpper: number | null;
  lookalikeRatio: number | null;
  lookalikeStartingRatio: number | null;
  lookalikeCountryCodes: string[];
  lookalikeOriginAudienceIds: string[];
  lookalikeOriginNames: string[];
  lookalikeSpec: Record<string, unknown> | null;
  ruleSpec: Record<string, unknown> | null;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
  lastSyncedAt: string | null;
  accountName: string;
  metrics: EntityDetailMetrics & {
    addToCart: number;
    costPerPurchaseMicros: number | null;
    costPerAddToCartMicros: number | null;
  };
  usages: AudienceUsageSummary[];
  includeCount: number;
  excludeCount: number;
};

const PAGE_SIZE_DEFAULT = 25;

const PRIMARY_TYPES: AdAudienceType[] = ["lookalike", "interest", "custom"];

type AudienceRecord = {
  id: string;
  name: string;
  audience_type: AdAudienceType;
  subtype: string | null;
  provider: string;
  status: string | null;
  is_ready: boolean | null;
  origin_type: string | null;
  approximate_size_lower: number | null;
  approximate_size_upper: number | null;
  last_synced_at: string | null;
};

type UsageRecord = {
  audience_id: string;
  entity_id: string;
  inclusion: string;
};

type MetricRecord = {
  entity_id: string;
  spend_micros: number;
  impressions: number;
  clicks: number;
  conversion_value_micros: number;
  website_purchases: number;
  add_to_cart: number;
};

function rangeStartIso(rangeDays: number): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (rangeDays - 1));
  return start.toISOString().slice(0, 10);
}

function aggregateEntityMetrics(rows: MetricRecord[]) {
  const totals = {
    spend_micros: 0,
    impressions: 0,
    clicks: 0,
    conversion_value_micros: 0,
    website_purchases: 0,
    add_to_cart: 0,
  };

  for (const row of rows) {
    totals.spend_micros += row.spend_micros ?? 0;
    totals.impressions += row.impressions ?? 0;
    totals.clicks += row.clicks ?? 0;
    totals.conversion_value_micros += row.conversion_value_micros ?? 0;
    totals.website_purchases += Number(row.website_purchases ?? 0);
    totals.add_to_cart += Number(row.add_to_cart ?? 0);
  }

  const spend = totals.spend_micros / 1_000_000;
  const ctr =
    totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const roas =
    spend > 0 ? totals.conversion_value_micros / 1_000_000 / spend : null;
  const costPerPurchaseMicros =
    totals.website_purchases > 0
      ? Math.round(totals.spend_micros / totals.website_purchases)
      : null;
  const costPerAddToCartMicros =
    totals.add_to_cart > 0
      ? Math.round(totals.spend_micros / totals.add_to_cart)
      : null;

  return {
    ...totals,
    ctr,
    roas,
    costPerPurchaseMicros,
    costPerAddToCartMicros,
  };
}

function performanceScore(row: AudiencePerformanceRow): number {
  const spend = row.spendMicros / 1_000_000;
  const roas = row.roas ?? 0;
  if (row.impressions <= 0 && spend <= 0) return 0;
  return (
    spend * 1_000 +
    roas * spend * 250 +
    row.websitePurchases * 100 +
    row.addToCart * 40 +
    row.ctr * 15
  );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

function asTargetingContext(value: unknown): AudienceTargetingContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  return {
    ageMin: typeof row.ageMin === "number" ? row.ageMin : null,
    ageMax: typeof row.ageMax === "number" ? row.ageMax : null,
    genders: asStringArray(row.genders),
    countries: asStringArray(row.countries),
    regions: asStringArray(row.regions),
    cities: asStringArray(row.cities),
    locales: asStringArray(row.locales),
    publisherPlatforms: asStringArray(row.publisherPlatforms),
    devicePlatforms: asStringArray(row.devicePlatforms),
    positions: asStringArray(row.positions),
  };
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function listAudiencePerformance(input: {
  scope: AdDataScope;
  search?: string;
  audienceType?: AdAudienceType;
  page?: number;
  pageSize?: number;
  rangeDays?: number;
}): Promise<AudiencesListResult> {
  const supabase = await createClient();
  const page = Math.max(0, input.page ?? 0);
  const pageSize = input.pageSize ?? PAGE_SIZE_DEFAULT;
  const rangeDays = input.rangeDays ?? 30;
  const currentStartIso = rangeStartIso(rangeDays);

  const { data: syncStates } = await withAdScope(
    supabase.from("ad_sync_state").select("sync_status"),
    input.scope,
  );
  const syncing = (syncStates ?? []).some(
    (row) => (row.sync_status as string | null) === "running",
  );

  let audiencesQuery = withAdScope(
    supabase
      .from("ad_audiences")
      .select(
        "id, name, audience_type, subtype, provider, status, is_ready, origin_type, approximate_size_lower, approximate_size_upper, last_synced_at",
      )
      .order("name", { ascending: true }),
    input.scope,
  );

  if (input.audienceType) {
    audiencesQuery = audiencesQuery.eq("audience_type", input.audienceType);
  }

  if (input.search?.trim()) {
    audiencesQuery = audiencesQuery.ilike("name", `%${input.search.trim()}%`);
  }

  const { data: audiences, error: audiencesError } = await audiencesQuery;
  if (audiencesError) throw audiencesError;

  const audienceList = (audiences ?? []) as AudienceRecord[];

  const typeCounts = new Map<AdAudienceType, number>();
  for (const audience of audienceList) {
    typeCounts.set(
      audience.audience_type,
      (typeCounts.get(audience.audience_type) ?? 0) + 1,
    );
  }

  const types: AudienceTypeOption[] = (
    Array.from(typeCounts.keys()) as AdAudienceType[]
  )
    .sort((left, right) => {
      const leftRank = PRIMARY_TYPES.indexOf(left);
      const rightRank = PRIMARY_TYPES.indexOf(right);
      const normalizedLeft = leftRank === -1 ? PRIMARY_TYPES.length : leftRank;
      const normalizedRight = rightRank === -1 ? PRIMARY_TYPES.length : rightRank;
      if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
      return AUDIENCE_TYPE_LABELS[left].localeCompare(AUDIENCE_TYPE_LABELS[right]);
    })
    .map((value) => ({
      value,
      label: AUDIENCE_TYPE_LABELS[value],
    }));

  if (audienceList.length === 0) {
    return { rows: [], totalCount: 0, types, syncing };
  }

  const audienceIds = audienceList.map((audience) => audience.id);

  const { data: usages, error: usagesError } = await withAdScope(
    supabase
      .from("ad_audience_usages")
      .select("audience_id, entity_id, inclusion")
      .in("audience_id", audienceIds)
      .eq("inclusion", "include"),
    input.scope,
  );
  if (usagesError) throw usagesError;

  const usageList = (usages ?? []) as UsageRecord[];
  const entityIdsByAudience = new Map<string, Set<string>>();
  const allEntityIds = new Set<string>();

  for (const usage of usageList) {
    const bucket = entityIdsByAudience.get(usage.audience_id) ?? new Set<string>();
    bucket.add(usage.entity_id);
    entityIdsByAudience.set(usage.audience_id, bucket);
    allEntityIds.add(usage.entity_id);
  }

  const metricsByEntity = new Map<string, MetricRecord[]>();
  if (allEntityIds.size > 0) {
    const { data: metrics, error: metricsError } = await supabase
      .from("ad_metrics_daily")
      .select(
        "entity_id, spend_micros, impressions, clicks, conversion_value_micros, website_purchases, add_to_cart",
      )
      .in("entity_id", Array.from(allEntityIds))
      .gte("metric_date", currentStartIso);
    if (metricsError) throw metricsError;

    for (const metric of (metrics ?? []) as MetricRecord[]) {
      const bucket = metricsByEntity.get(metric.entity_id) ?? [];
      bucket.push(metric);
      metricsByEntity.set(metric.entity_id, bucket);
    }
  }

  let rows: AudiencePerformanceRow[] = audienceList.map((audience) => {
    const entityIds = entityIdsByAudience.get(audience.id) ?? new Set<string>();
    const metricRows: MetricRecord[] = [];
    for (const entityId of entityIds) {
      const entityMetrics = metricsByEntity.get(entityId);
      if (entityMetrics) metricRows.push(...entityMetrics);
    }

    const totals = aggregateEntityMetrics(metricRows);

    return {
      id: audience.id,
      name: audience.name,
      audienceType: audience.audience_type,
      subtype: audience.subtype,
      provider: audience.provider || META_PROVIDER,
      status: audience.status,
      isReady: audience.is_ready,
      originType: audience.origin_type,
      approximateSizeLower: audience.approximate_size_lower,
      approximateSizeUpper: audience.approximate_size_upper,
      adSetCount: entityIds.size,
      spendMicros: totals.spend_micros,
      impressions: totals.impressions,
      clicks: totals.clicks,
      websitePurchases: totals.website_purchases,
      addToCart: totals.add_to_cart,
      conversionValueMicros: totals.conversion_value_micros,
      ctr: totals.ctr,
      roas: totals.roas,
      costPerPurchaseMicros: totals.costPerPurchaseMicros,
      costPerAddToCartMicros: totals.costPerAddToCartMicros,
      lastSyncedAt: audience.last_synced_at,
    };
  });

  // Prefer audiences with delivery; then by performance score.
  rows.sort((left, right) => {
    const leftScore = performanceScore(left);
    const rightScore = performanceScore(right);
    if (rightScore !== leftScore) return rightScore - leftScore;
    if (right.adSetCount !== left.adSetCount) return right.adSetCount - left.adSetCount;
    return left.name.localeCompare(right.name);
  });

  const totalCount = rows.length;
  const start = page * pageSize;
  rows = rows.slice(start, start + pageSize);

  return { rows, totalCount, types, syncing };
}

export async function getAudienceDetail(input: {
  scope: AdDataScope;
  audienceId: string;
  rangeDays?: number;
}): Promise<AudienceDetailResult | null> {
  const supabase = await createClient();
  const rangeDays = input.rangeDays ?? 30;
  const currentStartIso = rangeStartIso(rangeDays);

  const { data: audience, error: audienceError } = await withAdScope(
    supabase
      .from("ad_audiences")
      .select(
        "id, name, audience_type, subtype, description, provider, provider_audience_id, status, status_code, is_ready, catalog_source, origin_type, retention_days, data_source_id, data_source_type, approximate_size_lower, approximate_size_upper, lookalike_ratio, lookalike_starting_ratio, lookalike_country_codes, lookalike_origin_audience_ids, lookalike_origin_names, lookalike_spec, rule_spec, provider_created_at, provider_updated_at, last_synced_at, account_id",
      )
      .eq("id", input.audienceId)
      .maybeSingle(),
    input.scope,
  );
  if (audienceError) throw audienceError;
  if (!audience) return null;

  const audienceRow = audience as {
    id: string;
    name: string;
    audience_type: AdAudienceType;
    subtype: string | null;
    description: string | null;
    provider: string;
    provider_audience_id: string;
    status: string | null;
    status_code: number | null;
    is_ready: boolean | null;
    catalog_source: AudienceCatalogSource | null;
    origin_type: string | null;
    retention_days: number | null;
    data_source_id: string | null;
    data_source_type: string | null;
    approximate_size_lower: number | null;
    approximate_size_upper: number | null;
    lookalike_ratio: number | null;
    lookalike_starting_ratio: number | null;
    lookalike_country_codes: string[] | null;
    lookalike_origin_audience_ids: string[] | null;
    lookalike_origin_names: string[] | null;
    lookalike_spec: unknown;
    rule_spec: unknown;
    provider_created_at: string | null;
    provider_updated_at: string | null;
    last_synced_at: string | null;
    account_id: string;
  };

  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", audienceRow.account_id)
    .maybeSingle();

  const { data: usages, error: usagesError } = await withAdScope(
    supabase
      .from("ad_audience_usages")
      .select("id, inclusion, source, targeting_context, entity_id")
      .eq("audience_id", input.audienceId),
    input.scope,
  );
  if (usagesError) throw usagesError;

  const usageRows = usages ?? [];
  const entityIds = Array.from(
    new Set(usageRows.map((row) => row.entity_id as string).filter(Boolean)),
  );

  type EntityRow = {
    id: string;
    name: string;
    status: string | null;
    parent_id: string | null;
  };

  const entitiesById = new Map<string, EntityRow>();
  const parentIds = new Set<string>();

  if (entityIds.length > 0) {
    const { data: entities, error: entitiesError } = await supabase
      .from("ad_entities")
      .select("id, name, status, parent_id")
      .in("id", entityIds);
    if (entitiesError) throw entitiesError;

    for (const entity of (entities ?? []) as EntityRow[]) {
      entitiesById.set(entity.id, entity);
      if (entity.parent_id) parentIds.add(entity.parent_id);
    }
  }

  const parentsById = new Map<string, { id: string; name: string }>();
  if (parentIds.size > 0) {
    const { data: parents, error: parentsError } = await supabase
      .from("ad_entities")
      .select("id, name")
      .in("id", Array.from(parentIds));
    if (parentsError) throw parentsError;
    for (const parent of parents ?? []) {
      parentsById.set(parent.id as string, {
        id: parent.id as string,
        name: parent.name as string,
      });
    }
  }

  const metricsByEntity = new Map<string, MetricRecord[]>();
  if (entityIds.length > 0) {
    const { data: metrics, error: metricsError } = await supabase
      .from("ad_metrics_daily")
      .select(
        "entity_id, spend_micros, impressions, clicks, conversion_value_micros, website_purchases, add_to_cart",
      )
      .in("entity_id", entityIds)
      .gte("metric_date", currentStartIso);
    if (metricsError) throw metricsError;

    for (const metric of (metrics ?? []) as MetricRecord[]) {
      const bucket = metricsByEntity.get(metric.entity_id) ?? [];
      bucket.push(metric);
      metricsByEntity.set(metric.entity_id, bucket);
    }
  }

  const includeEntityIds = new Set<string>();
  let includeCount = 0;
  let excludeCount = 0;

  const usageSummaries: AudienceUsageSummary[] = usageRows.map((usage) => {
    const entity = entitiesById.get(usage.entity_id as string);
    const parent = entity?.parent_id ? parentsById.get(entity.parent_id) : null;
    const entityMetrics = metricsByEntity.get(usage.entity_id as string) ?? [];
    const totals = aggregateEntityMetrics(entityMetrics);
    const inclusion =
      usage.inclusion === "exclude" ? ("exclude" as const) : ("include" as const);

    if (inclusion === "include") {
      includeCount += 1;
      includeEntityIds.add(usage.entity_id as string);
    } else {
      excludeCount += 1;
    }

    return {
      id: usage.id as string,
      inclusion,
      source: (usage.source as string) || "targeting",
      targetingContext: asTargetingContext(usage.targeting_context),
      entityId: usage.entity_id as string,
      entityName: entity?.name ?? "Unknown ad set",
      entityStatus: entity?.status ?? null,
      campaignId: parent?.id ?? null,
      campaignName: parent?.name ?? null,
      spendMicros: totals.spend_micros,
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.ctr,
      roas: totals.roas,
      websitePurchases: totals.website_purchases,
    };
  });

  usageSummaries.sort((left, right) => {
    if (left.inclusion !== right.inclusion) {
      return left.inclusion === "include" ? -1 : 1;
    }
    if (right.spendMicros !== left.spendMicros) {
      return right.spendMicros - left.spendMicros;
    }
    return left.entityName.localeCompare(right.entityName);
  });

  const includeMetricRows: MetricRecord[] = [];
  for (const entityId of includeEntityIds) {
    const rows = metricsByEntity.get(entityId);
    if (rows) includeMetricRows.push(...rows);
  }
  const totals = aggregateEntityMetrics(includeMetricRows);

  return {
    id: audienceRow.id,
    name: audienceRow.name,
    audienceType: audienceRow.audience_type,
    subtype: audienceRow.subtype,
    description: audienceRow.description,
    provider: audienceRow.provider || META_PROVIDER,
    providerAudienceId: audienceRow.provider_audience_id,
    status: audienceRow.status,
    statusCode: audienceRow.status_code,
    isReady: audienceRow.is_ready,
    catalogSource: audienceRow.catalog_source,
    originType: audienceRow.origin_type,
    retentionDays: audienceRow.retention_days,
    dataSourceId: audienceRow.data_source_id,
    dataSourceType: audienceRow.data_source_type,
    approximateSizeLower: audienceRow.approximate_size_lower,
    approximateSizeUpper: audienceRow.approximate_size_upper,
    lookalikeRatio: audienceRow.lookalike_ratio,
    lookalikeStartingRatio: audienceRow.lookalike_starting_ratio,
    lookalikeCountryCodes: asStringArray(audienceRow.lookalike_country_codes),
    lookalikeOriginAudienceIds: asStringArray(
      audienceRow.lookalike_origin_audience_ids,
    ),
    lookalikeOriginNames: asStringArray(audienceRow.lookalike_origin_names),
    lookalikeSpec: asJsonObject(audienceRow.lookalike_spec),
    ruleSpec: asJsonObject(audienceRow.rule_spec),
    providerCreatedAt: audienceRow.provider_created_at,
    providerUpdatedAt: audienceRow.provider_updated_at,
    lastSyncedAt: audienceRow.last_synced_at,
    accountName: (account?.name as string | null) ?? "Account",
    metrics: {
      spendMicros: totals.spend_micros,
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.ctr,
      roas: totals.roas,
      websitePurchases: totals.website_purchases,
      conversionValueMicros: totals.conversion_value_micros,
      addToCart: totals.add_to_cart,
      costPerPurchaseMicros: totals.costPerPurchaseMicros,
      costPerAddToCartMicros: totals.costPerAddToCartMicros,
    },
    usages: usageSummaries,
    includeCount,
    excludeCount,
  };
}
