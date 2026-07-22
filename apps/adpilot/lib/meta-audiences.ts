import { createAdminClient } from "@walls/supabase/admin";

import { type AdDataScope, adScopeFields } from "@/lib/ad-scope";
import {
  type AdAudienceType,
  type AudienceCatalogSource,
  type AudienceTargetingContext,
} from "@/lib/audience-types";
import { META_PROVIDER } from "@/lib/connections";
import {
  fetchMetaCustomAudiences,
  fetchMetaInterestAudienceSizes,
  type MetaAdSetTargeting,
  type MetaCustomAudience,
  type MetaGeoLocations,
  type MetaTargetingSegment,
} from "@/lib/meta-graph";

export type { AdAudienceType } from "@/lib/audience-types";
export { AUDIENCE_TYPE_LABELS, formatAudienceTypeLabel } from "@/lib/audience-types";

type AudienceUpsertInput = {
  scope: AdDataScope;
  connectionId: string;
  providerAudienceId: string;
  audienceType: AdAudienceType;
  name: string;
  subtype?: string | null;
  description?: string | null;
  approximateSizeLower?: number | null;
  approximateSizeUpper?: number | null;
  lookalikeSpec?: Record<string, unknown> | null;
  rawPayload?: Record<string, unknown>;
  status?: string | null;
  statusCode?: number | null;
  isReady?: boolean | null;
  catalogSource?: AudienceCatalogSource | null;
  originType?: string | null;
  retentionDays?: number | null;
  dataSourceId?: string | null;
  dataSourceType?: string | null;
  ruleSpec?: Record<string, unknown> | null;
  lookalikeRatio?: number | null;
  lookalikeStartingRatio?: number | null;
  lookalikeCountryCodes?: string[] | null;
  lookalikeOriginAudienceIds?: string[] | null;
  lookalikeOriginNames?: string[] | null;
  providerCreatedAt?: string | null;
  providerUpdatedAt?: string | null;
};

type TargetingUsage = {
  providerAudienceId: string;
  audienceType: AdAudienceType;
  name: string;
  inclusion: "include" | "exclude";
  source: string;
  originType: string;
  raw?: Record<string, unknown>;
};

function parseAudienceCount(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function parseOptionalInt(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseProviderTimestamp(value: string | number | undefined | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Meta sometimes returns unix seconds.
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() === String(asNumber)) {
    const ms = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseRuleSpec(
  rule: string | Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!rule) return null;
  if (typeof rule === "object") return rule;
  try {
    const parsed = JSON.parse(rule) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw: rule };
  }
}

function mapCustomAudienceType(subtype: string | undefined): AdAudienceType {
  const normalized = (subtype ?? "").toUpperCase();
  if (normalized === "LOOKALIKE") return "lookalike";
  if (normalized) return "custom";
  return "custom";
}

function mapMetaSubtypeToOrigin(subtype: string | undefined): string {
  switch ((subtype ?? "").toUpperCase()) {
    case "LOOKALIKE":
      return "lookalike";
    case "WEBSITE":
      return "website";
    case "APP":
      return "app";
    case "OFFLINE_EVENT":
      return "offline";
    case "ENGAGEMENT":
      return "engagement";
    case "VIDEO":
      return "video";
    case "CUSTOM":
      return "customer_file";
    case "CLAIM":
    case "PARTNER":
    case "MANAGED":
      return "other";
    default:
      return subtype ? subtype.toLowerCase() : "other";
  }
}

function mapMetaDataSourceType(
  audience: MetaCustomAudience,
  originType: string,
): string | null {
  const fromDataSource =
    audience.data_source?.type ?? audience.data_source?.sub_type ?? null;
  if (fromDataSource) return String(fromDataSource).toLowerCase();
  if (audience.pixel_id) return "pixel";
  if (audience.customer_file_source) return "customer_file";
  if (originType === "website") return "pixel";
  if (originType === "app") return "app";
  if (originType === "lookalike") return "lookalike_seed";
  return originType === "other" ? null : originType;
}

function extractLookalikeFields(spec: Record<string, unknown> | null | undefined) {
  if (!spec) {
    return {
      ratio: null as number | null,
      startingRatio: null as number | null,
      countryCodes: null as string[] | null,
      originIds: null as string[] | null,
      originNames: null as string[] | null,
    };
  }

  const ratio = parseOptionalNumber(spec.ratio);
  const startingRatio = parseOptionalNumber(spec.starting_ratio);

  const countryCodes = new Set<string>();
  if (typeof spec.country === "string" && spec.country.trim()) {
    countryCodes.add(spec.country.trim().toUpperCase());
  }
  if (Array.isArray(spec.target_countries)) {
    for (const code of spec.target_countries) {
      if (typeof code === "string" && code.trim()) {
        countryCodes.add(code.trim().toUpperCase());
      }
    }
  }

  const originIds: string[] = [];
  const originNames: string[] = [];
  const origins = Array.isArray(spec.origin) ? spec.origin : [];
  for (const origin of origins) {
    if (!origin || typeof origin !== "object") continue;
    const row = origin as Record<string, unknown>;
    if (row.id != null) originIds.push(String(row.id));
    if (typeof row.name === "string" && row.name.trim()) {
      originNames.push(row.name.trim());
    }
  }
  if (spec.origin_audience_id != null) {
    originIds.push(String(spec.origin_audience_id));
  }

  return {
    ratio,
    startingRatio,
    countryCodes: countryCodes.size > 0 ? Array.from(countryCodes) : null,
    originIds: originIds.length > 0 ? Array.from(new Set(originIds)) : null,
    originNames: originNames.length > 0 ? Array.from(new Set(originNames)) : null,
  };
}

function metaDeliveryStatus(audience: MetaCustomAudience): {
  status: string | null;
  statusCode: number | null;
  isReady: boolean | null;
} {
  const delivery = audience.delivery_status;
  const operation = audience.operation_status;
  const statusCode =
    parseOptionalInt(delivery?.code) ?? parseOptionalInt(operation?.code);
  const description =
    delivery?.description?.trim() ||
    operation?.description?.trim() ||
    null;

  // Meta delivery_status code 200 ≈ ready for delivery.
  const isReady =
    statusCode == null ? null : statusCode === 200 || statusCode === 300;

  return {
    status: description,
    statusCode,
    isReady,
  };
}

function segmentKey(type: AdAudienceType, id: string): string {
  return `${type}:${id}`;
}

function collectSegments(
  segments: MetaTargetingSegment[] | undefined,
  audienceType: AdAudienceType,
  inclusion: "include" | "exclude",
  source: string,
  originType: string,
  into: Map<string, TargetingUsage>,
) {
  if (!segments?.length) return;
  for (const segment of segments) {
    const id = segment.id?.trim();
    const name = segment.name?.trim();
    if (!id || !name) continue;
    const key = segmentKey(audienceType, id);
    into.set(`${key}:${inclusion}`, {
      providerAudienceId: id,
      audienceType,
      name,
      inclusion,
      source,
      originType,
      raw: segment as Record<string, unknown>,
    });
  }
}

function geoNames(locations: MetaGeoLocations | undefined, key: "regions" | "cities"): string[] {
  const rows = locations?.[key];
  if (!rows?.length) return [];
  return rows
    .map((row) => row.name?.trim() || row.key?.trim() || "")
    .filter(Boolean);
}

function normalizeGenders(genders: number[] | undefined): string[] {
  if (!genders?.length) return [];
  const labels: string[] = [];
  for (const gender of genders) {
    if (gender === 1) labels.push("male");
    else if (gender === 2) labels.push("female");
    else labels.push(String(gender));
  }
  return labels;
}

/** Build a provider-agnostic targeting snapshot from a Meta ad set targeting object. */
export function extractTargetingContext(
  targeting: MetaAdSetTargeting | null | undefined,
): AudienceTargetingContext {
  if (!targeting) return {};

  const positions = [
    ...(targeting.facebook_positions ?? []),
    ...(targeting.instagram_positions ?? []),
    ...(targeting.messenger_positions ?? []),
    ...(targeting.audience_network_positions ?? []),
  ];

  const countries = [
    ...(targeting.geo_locations?.countries ?? []),
    ...(targeting.geo_locations?.country_groups ?? []),
  ]
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  const locales = (targeting.locales ?? [])
    .map((locale) => String(locale).trim())
    .filter(Boolean);

  return {
    ageMin: targeting.age_min ?? null,
    ageMax: targeting.age_max ?? null,
    genders: normalizeGenders(targeting.genders),
    countries,
    regions: geoNames(targeting.geo_locations, "regions"),
    cities: geoNames(targeting.geo_locations, "cities"),
    locales,
    publisherPlatforms: targeting.publisher_platforms ?? [],
    devicePlatforms: targeting.device_platforms ?? [],
    positions,
  };
}

/** Extract include/exclude audience segments from a Meta ad set targeting object. */
export function extractTargetingUsages(
  targeting: MetaAdSetTargeting | null | undefined,
): TargetingUsage[] {
  if (!targeting) return [];

  const usages = new Map<string, TargetingUsage>();

  collectSegments(
    targeting.interests,
    "interest",
    "include",
    "targeting.interests",
    "interest",
    usages,
  );
  collectSegments(
    targeting.behaviors,
    "behavior",
    "include",
    "targeting.behaviors",
    "behavior",
    usages,
  );
  collectSegments(
    targeting.custom_audiences,
    "custom",
    "include",
    "targeting.custom_audiences",
    "other",
    usages,
  );
  collectSegments(
    targeting.excluded_custom_audiences,
    "custom",
    "exclude",
    "targeting.excluded_custom_audiences",
    "other",
    usages,
  );

  for (const spec of targeting.flexible_spec ?? []) {
    collectSegments(
      spec.interests,
      "interest",
      "include",
      "targeting.flexible_spec",
      "interest",
      usages,
    );
    collectSegments(
      spec.behaviors,
      "behavior",
      "include",
      "targeting.flexible_spec",
      "behavior",
      usages,
    );
    collectSegments(
      spec.life_events,
      "life_event",
      "include",
      "targeting.flexible_spec",
      "life_event",
      usages,
    );
    collectSegments(
      spec.family_statuses,
      "family_status",
      "include",
      "targeting.flexible_spec",
      "family_status",
      usages,
    );
    collectSegments(
      spec.industries,
      "industry",
      "include",
      "targeting.flexible_spec",
      "industry",
      usages,
    );
    collectSegments(
      spec.income,
      "income",
      "include",
      "targeting.flexible_spec",
      "income",
      usages,
    );
    collectSegments(
      spec.education_statuses,
      "education",
      "include",
      "targeting.flexible_spec",
      "education",
      usages,
    );
    collectSegments(
      spec.work_positions,
      "work",
      "include",
      "targeting.flexible_spec",
      "work",
      usages,
    );
    collectSegments(
      spec.work_employers,
      "work",
      "include",
      "targeting.flexible_spec",
      "work",
      usages,
    );
    collectSegments(
      spec.relationship_statuses,
      "relationship",
      "include",
      "targeting.flexible_spec",
      "relationship",
      usages,
    );
  }

  const exclusions = targeting.exclusions;
  if (exclusions) {
    collectSegments(
      exclusions.interests,
      "interest",
      "exclude",
      "targeting.exclusions",
      "interest",
      usages,
    );
    collectSegments(
      exclusions.behaviors,
      "behavior",
      "exclude",
      "targeting.exclusions",
      "behavior",
      usages,
    );
    collectSegments(
      exclusions.life_events,
      "life_event",
      "exclude",
      "targeting.exclusions",
      "life_event",
      usages,
    );
    collectSegments(
      exclusions.family_statuses,
      "family_status",
      "exclude",
      "targeting.exclusions",
      "family_status",
      usages,
    );
    collectSegments(
      exclusions.industries,
      "industry",
      "exclude",
      "targeting.exclusions",
      "industry",
      usages,
    );
    collectSegments(
      exclusions.income,
      "income",
      "exclude",
      "targeting.exclusions",
      "income",
      usages,
    );
    collectSegments(
      exclusions.education_statuses,
      "education",
      "exclude",
      "targeting.exclusions",
      "education",
      usages,
    );
    collectSegments(
      exclusions.work_positions,
      "work",
      "exclude",
      "targeting.exclusions",
      "work",
      usages,
    );
    collectSegments(
      exclusions.work_employers,
      "work",
      "exclude",
      "targeting.exclusions",
      "work",
      usages,
    );
    collectSegments(
      exclusions.relationship_statuses,
      "relationship",
      "exclude",
      "targeting.exclusions",
      "relationship",
      usages,
    );
  }

  return Array.from(usages.values());
}

async function upsertAudience(input: AudienceUpsertInput): Promise<string> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const row = {
    ...adScopeFields(input.scope),
    account_connection_id: input.connectionId,
    provider: META_PROVIDER,
    provider_audience_id: input.providerAudienceId,
    audience_type: input.audienceType,
    name: input.name,
    subtype: input.subtype ?? null,
    description: input.description ?? null,
    approximate_size_lower: input.approximateSizeLower ?? null,
    approximate_size_upper: input.approximateSizeUpper ?? null,
    lookalike_spec: input.lookalikeSpec ?? null,
    raw_payload: input.rawPayload ?? {},
    status: input.status ?? null,
    status_code: input.statusCode ?? null,
    is_ready: input.isReady ?? null,
    catalog_source: input.catalogSource ?? null,
    origin_type: input.originType ?? null,
    retention_days: input.retentionDays ?? null,
    data_source_id: input.dataSourceId ?? null,
    data_source_type: input.dataSourceType ?? null,
    rule_spec: input.ruleSpec ?? null,
    lookalike_ratio: input.lookalikeRatio ?? null,
    lookalike_starting_ratio: input.lookalikeStartingRatio ?? null,
    lookalike_country_codes: input.lookalikeCountryCodes ?? null,
    lookalike_origin_audience_ids: input.lookalikeOriginAudienceIds ?? null,
    lookalike_origin_names: input.lookalikeOriginNames ?? null,
    provider_created_at: input.providerCreatedAt ?? null,
    provider_updated_at: input.providerUpdatedAt ?? null,
    last_synced_at: now,
    updated_at: now,
  };

  const { data: existing } = await admin
    .from("ad_audiences")
    .select(
      "id, approximate_size_lower, approximate_size_upper, name, catalog_source, origin_type, status, description, lookalike_spec, rule_spec, raw_payload",
    )
    .eq("account_connection_id", input.connectionId)
    .eq("provider", META_PROVIDER)
    .eq("provider_audience_id", input.providerAudienceId)
    .eq("audience_type", input.audienceType)
    .maybeSingle();

  if (existing?.id) {
    // Prefer account-catalog richness over sparse targeting-segment upserts.
    const preferExistingCatalog =
      existing.catalog_source === "account_catalog" &&
      input.catalogSource === "targeting_segment";

    const merged = preferExistingCatalog
      ? {
          approximate_size_lower:
            input.approximateSizeLower ?? existing.approximate_size_lower ?? null,
          approximate_size_upper:
            input.approximateSizeUpper ?? existing.approximate_size_upper ?? null,
          name: input.name || existing.name,
          last_synced_at: now,
          updated_at: now,
        }
      : {
          ...row,
          approximate_size_lower:
            input.approximateSizeLower ?? existing.approximate_size_lower ?? null,
          approximate_size_upper:
            input.approximateSizeUpper ?? existing.approximate_size_upper ?? null,
          name: input.name || existing.name,
          description: input.description ?? existing.description ?? null,
          catalog_source: input.catalogSource ?? existing.catalog_source ?? null,
          origin_type: input.originType ?? existing.origin_type ?? null,
          status: input.status ?? existing.status ?? null,
          lookalike_spec: input.lookalikeSpec ?? existing.lookalike_spec ?? null,
          rule_spec: input.ruleSpec ?? existing.rule_spec ?? null,
          raw_payload:
            Object.keys(input.rawPayload ?? {}).length > 0
              ? (input.rawPayload ?? {})
              : ((existing.raw_payload as Record<string, unknown> | null) ?? {}),
        };

    const { error } = await admin.from("ad_audiences").update(merged).eq("id", existing.id);
    if (error) throw error;
    return existing.id as string;
  }

  const { data, error } = await admin.from("ad_audiences").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function upsertAudienceUsage(input: {
  scope: AdDataScope;
  connectionId: string;
  audienceId: string;
  entityId: string;
  inclusion: "include" | "exclude";
  source: string;
  targetingContext?: AudienceTargetingContext;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const row = {
    ...adScopeFields(input.scope),
    account_connection_id: input.connectionId,
    audience_id: input.audienceId,
    entity_id: input.entityId,
    inclusion: input.inclusion,
    source: input.source,
    targeting_context: input.targetingContext ?? {},
    updated_at: now,
  };

  const { error } = await admin.from("ad_audience_usages").upsert(row, {
    onConflict: "audience_id,entity_id,inclusion",
  });

  if (error) throw error;
}

function customAudienceToUpsert(
  audience: MetaCustomAudience,
  scope: AdDataScope,
  connectionId: string,
): AudienceUpsertInput {
  const audienceType = mapCustomAudienceType(audience.subtype);
  const originType = mapMetaSubtypeToOrigin(audience.subtype);
  const lookalike = extractLookalikeFields(audience.lookalike_spec);
  const delivery = metaDeliveryStatus(audience);
  const ruleSpec = parseRuleSpec(audience.rule);
  const pixelId =
    audience.pixel_id != null && String(audience.pixel_id).trim()
      ? String(audience.pixel_id)
      : null;

  return {
    scope,
    connectionId,
    providerAudienceId: audience.id,
    audienceType,
    name: audience.name?.trim() || `Audience ${audience.id}`,
    subtype: audience.subtype ?? null,
    description: audience.description ?? null,
    approximateSizeLower: parseAudienceCount(audience.approximate_count_lower_bound),
    approximateSizeUpper: parseAudienceCount(audience.approximate_count_upper_bound),
    lookalikeSpec: audience.lookalike_spec ?? null,
    rawPayload: audience as Record<string, unknown>,
    status: delivery.status,
    statusCode: delivery.statusCode,
    isReady: delivery.isReady,
    catalogSource: "account_catalog",
    originType,
    retentionDays: parseOptionalInt(audience.retention_days),
    dataSourceId: pixelId,
    dataSourceType: mapMetaDataSourceType(audience, originType),
    ruleSpec,
    lookalikeRatio: lookalike.ratio,
    lookalikeStartingRatio: lookalike.startingRatio,
    lookalikeCountryCodes: lookalike.countryCodes,
    lookalikeOriginAudienceIds: lookalike.originIds,
    lookalikeOriginNames: lookalike.originNames,
    providerCreatedAt: parseProviderTimestamp(audience.time_created),
    providerUpdatedAt: parseProviderTimestamp(audience.time_updated),
  };
}

/**
 * Sync Meta custom/lookalike audiences + ad-set targeting segments into
 * ad_audiences / ad_audience_usages. Non-fatal for callers.
 */
export async function syncMetaAudiences(input: {
  scope: AdDataScope;
  connectionId: string;
  accountId: string;
  accessToken: string;
  adSets: Array<{
    id: string;
    entityId: string;
    targeting?: MetaAdSetTargeting | null;
  }>;
}): Promise<{ audiences: number; usages: number }> {
  const audienceIds = new Map<string, string>();
  let usageCount = 0;

  // 1) Account custom audiences (includes lookalikes).
  try {
    const customAudiences = await fetchMetaCustomAudiences(
      input.accountId,
      input.accessToken,
    );
    for (const audience of customAudiences) {
      if (!audience.id) continue;
      const upsert = customAudienceToUpsert(
        audience,
        input.scope,
        input.connectionId,
      );
      const id = await upsertAudience(upsert);
      audienceIds.set(segmentKey(upsert.audienceType, audience.id), id);
      // Also index as custom so targeting.custom_audiences links resolve for lookalikes.
      if (upsert.audienceType === "lookalike") {
        audienceIds.set(segmentKey("custom", audience.id), id);
      }
    }
  } catch (error) {
    console.error("Failed to sync Meta custom audiences:", error);
  }

  // 2) Targeting segments from each ad set.
  const interestIdsNeedingSize = new Set<string>();

  for (const adSet of input.adSets) {
    const usages = extractTargetingUsages(adSet.targeting);
    const targetingContext = extractTargetingContext(adSet.targeting);

    for (const usage of usages) {
      let resolvedType = usage.audienceType;
      // Lookalikes show up as custom_audiences[] in targeting — prefer catalog type.
      if (
        usage.audienceType === "custom" &&
        audienceIds.has(segmentKey("lookalike", usage.providerAudienceId))
      ) {
        resolvedType = "lookalike";
      }

      const key = segmentKey(resolvedType, usage.providerAudienceId);
      let audienceId =
        audienceIds.get(key) ??
        (usage.audienceType === "custom"
          ? audienceIds.get(segmentKey("lookalike", usage.providerAudienceId))
          : undefined);

      if (!audienceId) {
        audienceId = await upsertAudience({
          scope: input.scope,
          connectionId: input.connectionId,
          providerAudienceId: usage.providerAudienceId,
          audienceType: resolvedType,
          name: usage.name,
          catalogSource: "targeting_segment",
          originType: usage.originType,
          rawPayload: usage.raw ?? {},
        });
        audienceIds.set(segmentKey(resolvedType, usage.providerAudienceId), audienceId);
      }

      if (resolvedType === "interest" || resolvedType === "behavior") {
        interestIdsNeedingSize.add(usage.providerAudienceId);
      }

      await upsertAudienceUsage({
        scope: input.scope,
        connectionId: input.connectionId,
        audienceId,
        entityId: adSet.entityId,
        inclusion: usage.inclusion,
        source: usage.source,
        targetingContext,
      });
      usageCount += 1;
    }
  }

  // 3) Best-effort interest/behavior size enrichment.
  if (interestIdsNeedingSize.size > 0) {
    try {
      const sizes = await fetchMetaInterestAudienceSizes(
        input.accessToken,
        Array.from(interestIdsNeedingSize),
      );
      for (const [providerId, size] of sizes) {
        const audienceId =
          audienceIds.get(segmentKey("interest", providerId)) ??
          audienceIds.get(segmentKey("behavior", providerId));
        if (!audienceId) continue;
        const lower = parseAudienceCount(size.audience_size_lower_bound);
        const upper = parseAudienceCount(size.audience_size_upper_bound);
        if (lower == null && upper == null && !size.name) continue;

        const admin = createAdminClient();
        const patch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (lower != null) patch.approximate_size_lower = lower;
        if (upper != null) patch.approximate_size_upper = upper;
        if (size.name) patch.name = size.name;
        await admin.from("ad_audiences").update(patch).eq("id", audienceId);
      }
    } catch (error) {
      console.error("Failed to enrich Meta interest audience sizes:", error);
    }
  }

  return { audiences: audienceIds.size, usages: usageCount };
}
