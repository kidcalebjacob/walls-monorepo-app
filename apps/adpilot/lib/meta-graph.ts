const META_GRAPH_VERSION = "v21.0";

type MetaPaging = {
  data?: unknown[];
  paging?: { next?: string };
};

export async function fetchMetaGraphCollection<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const results: T[] = [];
  const search = new URLSearchParams({
    access_token: accessToken,
    limit: "100",
    ...params,
  });

  let url: string | null =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${path}?${search.toString()}`;

  while (url) {
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Meta API ${path} failed: ${body}`);
    }

    const payload = (await response.json()) as MetaPaging;
    results.push(...((payload.data ?? []) as T[]));
    url = payload.paging?.next ?? null;
  }

  return results;
}

/** Fetch a single Graph node (object, not an edge/collection). */
export async function fetchMetaGraphNode<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  const search = new URLSearchParams({
    access_token: accessToken,
    ...params,
  });

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${path}?${search.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta API ${path} failed: ${body}`);
  }

  return (await response.json()) as T;
}

export type MetaAdImage = {
  hash?: string;
  permalink_url?: string;
  url_128?: string;
  width?: number;
  height?: number;
};

/**
 * Resolve durable image permalinks for a set of image hashes via the
 * act_{id}/adimages edge. Chunks requests to stay within URL length limits.
 */
export async function fetchMetaAdImagesByHash(
  accountId: string,
  accessToken: string,
  hashes: string[],
): Promise<Map<string, MetaAdImage>> {
  const byHash = new Map<string, MetaAdImage>();
  const unique = Array.from(new Set(hashes.filter(Boolean)));
  const CHUNK = 40;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const images = await fetchMetaGraphCollection<MetaAdImage>(
      `${accountId}/adimages`,
      accessToken,
      {
        fields: "hash,permalink_url,url_128,width,height",
        hashes: JSON.stringify(chunk),
      },
    );
    for (const image of images) {
      if (image.hash) byHash.set(image.hash, image);
    }
  }

  return byHash;
}

export type MetaVideoDetails = {
  id?: string;
  source?: string;
  picture?: string;
  permalink_url?: string;
  length?: number;
  title?: string;
};

/** Fetch playable/source details for a single video id. Returns null on failure. */
export async function fetchMetaVideoDetails(
  videoId: string,
  accessToken: string,
): Promise<MetaVideoDetails | null> {
  try {
    return await fetchMetaGraphNode<MetaVideoDetails>(videoId, accessToken, {
      fields: "id,source,picture,permalink_url,length,title",
    });
  } catch {
    return null;
  }
}

export function getMetaDateRange(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - days);

  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { since: format(since), until: format(until) };
}

/** Inclusive calendar window matching AdPilot UI presets (today + prior N-1 days). */
export function getMetaInclusiveDateRange(days: number): {
  since: string;
  until: string;
} {
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - (days - 1));

  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { since: format(since), until: format(until) };
}

/** UI preset windows for frequency_value period snapshots. */
export const FREQUENCY_RANGE_DAYS = [1, 7, 14, 30] as const;
export type FrequencyRangeDays = (typeof FREQUENCY_RANGE_DAYS)[number];

/**
 * Ad preview formats to try, in order, spanning Facebook + Instagram feed,
 * stories and reels placements. Meta renders a playable iframe preview of the
 * actual ad - the reliable way to view video/carousel/dynamic creatives when
 * the raw MP4 `source` field is restricted for our token.
 */
const AD_PREVIEW_FORMATS = [
  "MOBILE_FEED_STANDARD",
  "DESKTOP_FEED_STANDARD",
  "INSTAGRAM_STANDARD",
  "INSTAGRAM_STORY",
  "FACEBOOK_STORY_MOBILE",
  "INSTAGRAM_REELS",
  "FACEBOOK_REELS_MOBILE",
] as const;

// Meta renders "Story Unavailable"/permission errors inside the iframe content
// (not in the returned HTML), so we detect them by fetching the iframe src.
const PREVIEW_UNAVAILABLE_PATTERN =
  /unavailable for preview|story (?:in this ad )?is unavailable|do(?:es)? not (?:exist|have permission)/i;

type MetaAdPreviewResponse = {
  data?: Array<{ body?: string }>;
};

function extractIframeSrc(body: string): string | null {
  const match = body.match(/src="([^"]+)"/i);
  if (!match) return null;
  // Graph returns HTML-escaped attribute values.
  return match[1]
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

/**
 * Load the actual iframe content and confirm Meta rendered the creative rather
 * than a "Story Unavailable"/permission placeholder for this placement.
 */
async function previewRendersContent(body: string): Promise<boolean> {
  const src = extractIframeSrc(body);
  if (!src) return true; // Can't verify - assume it's fine.

  try {
    const response = await fetch(src);
    if (!response.ok) return false;
    const html = await response.text();
    return !PREVIEW_UNAVAILABLE_PATTERN.test(html);
  } catch {
    // Network hiccup verifying - don't discard a possibly-good preview.
    return true;
  }
}

/**
 * Generate an embeddable ad preview iframe for a provider ad id. Tries each
 * placement until one renders real creative content; if none do (genuine
 * permission/existence issue) it still returns the first iframe so the user
 * sees Meta's own message rather than a blank state. Returns null only when
 * Meta returns no iframe at all.
 */
export async function fetchMetaAdPreview(
  providerAdId: string,
  accessToken: string,
  adFormat?: string,
): Promise<string | null> {
  const formats = adFormat ? [adFormat] : AD_PREVIEW_FORMATS;
  let fallbackBody: string | null = null;

  for (const format of formats) {
    const search = new URLSearchParams({
      access_token: accessToken,
      ad_format: format,
    });
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${providerAdId}/previews?${search.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const payload = (await response.json()) as MetaAdPreviewResponse;
      const body = payload.data?.[0]?.body;
      if (!body || !body.includes("<iframe")) continue;

      // Keep the first valid iframe as a last-resort fallback.
      if (fallbackBody === null) fallbackBody = body;

      if (await previewRendersContent(body)) {
        return body;
      }
    } catch {
      // Try the next format.
    }
  }

  return fallbackBody;
}

export type MetaInsightRow = {
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ action_type: string; value: string }>;
  /** Present when requesting device/placement breakdowns. */
  publisher_platform?: string;
  platform_position?: string;
  device_platform?: string;
  impression_device?: string;
  /** Present when requesting age / gender / country demographic breakdowns. */
  age?: string;
  gender?: string;
  country?: string;
  /** Present when requesting frequency_value breakdowns (e.g. "1", "6-10"). */
  frequency_value?: string;
  /** Present when requesting hourly breakdowns, e.g. "14:00:00 - 14:59:59". */
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
  hourly_stats_aggregated_by_audience_time_zone?: string;
};

export type MetaInsightLevel = "account" | "campaign" | "adset" | "ad";

/** Meta Insights breakdown combos AdPilot syncs into ad_metrics_daily_breakdowns. */
export type MetaInsightBreakdownType =
  | "device_platform"
  | "placement_device"
  | "age"
  | "gender"
  | "age_gender"
  | "country";

const META_BREAKDOWN_PARAMS: Record<MetaInsightBreakdownType, string> = {
  device_platform: "device_platform",
  placement_device: "publisher_platform,platform_position,impression_device",
  age: "age",
  gender: "gender",
  age_gender: "age,gender",
  country: "country",
};

const INSIGHT_METRIC_FIELDS =
  "impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,actions,action_values,purchase_roas";

/** Hourly breakdowns do not support reach/frequency (Meta returns 0). */
const HOURLY_INSIGHT_METRIC_FIELDS =
  "impressions,clicks,spend,ctr,cpc,cpm,actions,action_values,purchase_roas";

const INSIGHT_FIELDS_BY_LEVEL: Record<MetaInsightLevel, string> = {
  account: INSIGHT_METRIC_FIELDS,
  campaign: `campaign_id,campaign_name,${INSIGHT_METRIC_FIELDS}`,
  adset: `adset_id,adset_name,${INSIGHT_METRIC_FIELDS}`,
  ad: `ad_id,ad_name,${INSIGHT_METRIC_FIELDS}`,
};

const HOURLY_INSIGHT_FIELDS_BY_LEVEL: Record<MetaInsightLevel, string> = {
  account: HOURLY_INSIGHT_METRIC_FIELDS,
  campaign: `campaign_id,campaign_name,${HOURLY_INSIGHT_METRIC_FIELDS}`,
  adset: `adset_id,adset_name,${HOURLY_INSIGHT_METRIC_FIELDS}`,
  ad: `ad_id,ad_name,${HOURLY_INSIGHT_METRIC_FIELDS}`,
};

export async function fetchMetaInsights(
  accountId: string,
  accessToken: string,
  level: MetaInsightLevel,
  since: string,
  until: string,
): Promise<MetaInsightRow[]> {
  return fetchMetaGraphCollection<MetaInsightRow>(
    `${accountId}/insights`,
    accessToken,
    {
      fields: INSIGHT_FIELDS_BY_LEVEL[level],
      level,
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      use_unified_attribution_setting: "true",
    },
  );
}

/**
 * Daily insights with Meta breakdown dimensions (device, placement, demographics).
 * Only certain breakdown combinations are allowed by Meta - see META_BREAKDOWN_PARAMS.
 */
export async function fetchMetaInsightBreakdowns(
  accountId: string,
  accessToken: string,
  level: MetaInsightLevel,
  breakdownType: MetaInsightBreakdownType,
  since: string,
  until: string,
): Promise<MetaInsightRow[]> {
  return fetchMetaGraphCollection<MetaInsightRow>(
    `${accountId}/insights`,
    accessToken,
    {
      fields: INSIGHT_FIELDS_BY_LEVEL[level],
      level,
      breakdowns: META_BREAKDOWN_PARAMS[breakdownType],
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      use_unified_attribution_setting: "true",
    },
  );
}

const FREQUENCY_REACH_FIELDS_BY_LEVEL: Record<
  "account" | "campaign" | "adset",
  string
> = {
  account: "reach",
  campaign: "campaign_id,reach",
  adset: "adset_id,reach",
};

/**
 * Period-level frequency_value reach distribution (Ads Manager Frequency Breakdown).
 * Uses overlapping time_ranges for 1/7/14/30d presets - no daily time_increment,
 * because unique reach is not additive across days. Reach-only fields per Meta docs.
 */
export async function fetchMetaFrequencyBreakdowns(
  accountId: string,
  accessToken: string,
  level: "account" | "campaign" | "adset",
): Promise<MetaInsightRow[]> {
  const timeRanges = FREQUENCY_RANGE_DAYS.map((days) =>
    getMetaInclusiveDateRange(days),
  );

  return fetchMetaGraphCollection<MetaInsightRow>(
    `${accountId}/insights`,
    accessToken,
    {
      fields: FREQUENCY_REACH_FIELDS_BY_LEVEL[level],
      level,
      breakdowns: "frequency_value",
      time_ranges: JSON.stringify(timeRanges),
      use_unified_attribution_setting: "true",
    },
  );
}

/** Map Meta date_start/date_stop span back to an AdPilot range_days preset. */
export function frequencyRangeDaysFromDates(
  dateStart: string | undefined,
  dateStop: string | undefined,
): FrequencyRangeDays | null {
  if (!dateStart || !dateStop) return null;
  const start = Date.parse(`${dateStart}T00:00:00Z`);
  const stop = Date.parse(`${dateStop}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < start) {
    return null;
  }
  const days = Math.round((stop - start) / 86_400_000) + 1;
  if (days === 1 || days === 7 || days === 14 || days === 30) {
    return days;
  }
  return null;
}

/**
 * Parse Meta hourly breakdown label ("14:00:00 - 14:59:59") → 0–23.
 */
export function parseMetaHourOfDay(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):/);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

/**
 * Day + hour insights in the advertiser timezone.
 * Prefer account-level sync for dashboard heatmaps (keeps row volume small).
 */
export async function fetchMetaHourlyInsights(
  accountId: string,
  accessToken: string,
  level: MetaInsightLevel,
  since: string,
  until: string,
): Promise<MetaInsightRow[]> {
  return fetchMetaGraphCollection<MetaInsightRow>(
    `${accountId}/insights`,
    accessToken,
    {
      fields: HOURLY_INSIGHT_FIELDS_BY_LEVEL[level],
      level,
      breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      use_unified_attribution_setting: "true",
    },
  );
}

/**
 * Lifetime totals over the entity's full available history.
 * Omits time_increment so Meta returns one aggregated row per entity
 * (unique reach + total spend for date_preset=maximum).
 */
export async function fetchMetaLifetimeTotals(
  accountId: string,
  accessToken: string,
  level: MetaInsightLevel,
): Promise<MetaInsightRow[]> {
  const idFields =
    level === "account"
      ? "reach,spend"
      : level === "campaign"
        ? "campaign_id,reach,spend"
        : level === "adset"
          ? "adset_id,reach,spend"
          : "ad_id,reach,spend";

  return fetchMetaGraphCollection<MetaInsightRow>(
    `${accountId}/insights`,
    accessToken,
    {
      fields: idFields,
      level,
      date_preset: "maximum",
      use_unified_attribution_setting: "true",
    },
  );
}

/** Meta Ads Manager "Estimated audience size" band for an ad set's targeting. */
export type MetaDeliveryEstimate = {
  estimate_mau_lower_bound?: number | string;
  estimate_mau_upper_bound?: number | string;
  /** Legacy field some Graph versions still return instead of the bound pair. */
  estimate_mau?: number | string;
  estimate_ready?: boolean;
};

export async function fetchMetaDeliveryEstimate(
  adSetId: string,
  accessToken: string,
): Promise<MetaDeliveryEstimate | null> {
  const rows = await fetchMetaGraphCollection<MetaDeliveryEstimate>(
    `${adSetId}/delivery_estimate`,
    accessToken,
  );
  return rows[0] ?? null;
}

/** Custom / lookalike audience from act_{id}/customaudiences. */
export type MetaCustomAudience = {
  id: string;
  name?: string;
  subtype?: string;
  description?: string;
  approximate_count_lower_bound?: number | string;
  approximate_count_upper_bound?: number | string;
  lookalike_spec?: Record<string, unknown>;
  delivery_status?: { code?: number; description?: string };
  operation_status?: { code?: number; description?: string };
  time_created?: string | number;
  time_updated?: string | number;
  retention_days?: number | string;
  pixel_id?: string | number;
  rule?: string | Record<string, unknown>;
  rule_aggregation?: string | Record<string, unknown>;
  customer_file_source?: string;
  data_source?: { type?: string; sub_type?: string; creation_params?: unknown };
  lookalike_audience_ids?: Array<string | number>;
  permission_for_actions?: Record<string, unknown>;
  is_value_based?: boolean;
};

export async function fetchMetaCustomAudiences(
  accountId: string,
  accessToken: string,
): Promise<MetaCustomAudience[]> {
  return fetchMetaGraphCollection<MetaCustomAudience>(
    `${accountId}/customaudiences`,
    accessToken,
    {
      fields: [
        "id",
        "name",
        "subtype",
        "description",
        "approximate_count_lower_bound",
        "approximate_count_upper_bound",
        "lookalike_spec",
        "delivery_status",
        "operation_status",
        "time_created",
        "time_updated",
        "retention_days",
        "pixel_id",
        "rule",
        "rule_aggregation",
        "customer_file_source",
        "data_source",
        "lookalike_audience_ids",
        "permission_for_actions",
        "is_value_based",
      ].join(","),
    },
  );
}

/** Targeting segment id+name pairs found on ad set targeting. */
export type MetaTargetingSegment = {
  id?: string;
  name?: string;
};

export type MetaGeoLocations = {
  countries?: string[];
  country_groups?: string[];
  regions?: Array<{ key?: string; name?: string }>;
  cities?: Array<{ key?: string; name?: string; radius?: number; distance_unit?: string }>;
  zips?: Array<{ key?: string; name?: string }>;
  location_types?: string[];
};

export type MetaAdSetTargeting = {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  locales?: Array<number | string>;
  geo_locations?: MetaGeoLocations;
  excluded_geo_locations?: MetaGeoLocations;
  publisher_platforms?: string[];
  device_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  messenger_positions?: string[];
  audience_network_positions?: string[];
  flexible_spec?: Array<{
    interests?: MetaTargetingSegment[];
    behaviors?: MetaTargetingSegment[];
    life_events?: MetaTargetingSegment[];
    family_statuses?: MetaTargetingSegment[];
    industries?: MetaTargetingSegment[];
    income?: MetaTargetingSegment[];
    education_statuses?: MetaTargetingSegment[];
    work_positions?: MetaTargetingSegment[];
    work_employers?: MetaTargetingSegment[];
    relationship_statuses?: MetaTargetingSegment[];
  }>;
  exclusions?: {
    interests?: MetaTargetingSegment[];
    behaviors?: MetaTargetingSegment[];
    life_events?: MetaTargetingSegment[];
    family_statuses?: MetaTargetingSegment[];
    industries?: MetaTargetingSegment[];
    income?: MetaTargetingSegment[];
    education_statuses?: MetaTargetingSegment[];
    work_positions?: MetaTargetingSegment[];
    work_employers?: MetaTargetingSegment[];
    relationship_statuses?: MetaTargetingSegment[];
  };
  /** Legacy top-level interest targeting. */
  interests?: MetaTargetingSegment[];
  behaviors?: MetaTargetingSegment[];
  custom_audiences?: MetaTargetingSegment[];
  excluded_custom_audiences?: MetaTargetingSegment[];
};

/**
 * Best-effort audience size for Meta interest / behavior IDs via the Graph
 * multi-id endpoint. Non-fatal callers should swallow failures.
 */
export async function fetchMetaInterestAudienceSizes(
  accessToken: string,
  interestIds: string[],
): Promise<
  Map<
    string,
    {
      name?: string;
      audience_size_lower_bound?: number;
      audience_size_upper_bound?: number;
    }
  >
> {
  const byId = new Map<
    string,
    {
      name?: string;
      audience_size_lower_bound?: number;
      audience_size_upper_bound?: number;
    }
  >();
  const unique = Array.from(new Set(interestIds.filter(Boolean)));
  const CHUNK = 40;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const search = new URLSearchParams({
      access_token: accessToken,
      ids: chunk.join(","),
      fields: "id,name,audience_size_lower_bound,audience_size_upper_bound",
    });
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/?${search.toString()}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const payload = (await response.json()) as Record<
        string,
        {
          id?: string;
          name?: string;
          audience_size_lower_bound?: number;
          audience_size_upper_bound?: number;
          error?: unknown;
        }
      >;
      for (const [id, value] of Object.entries(payload)) {
        if (!value || value.error || !value.id) continue;
        byId.set(id, {
          name: value.name,
          audience_size_lower_bound: value.audience_size_lower_bound,
          audience_size_upper_bound: value.audience_size_upper_bound,
        });
      }
    } catch {
      // Non-fatal enrichment.
    }
  }

  return byId;
}

function microsToMetaBudgetCents(micros: number): string {
  return String(Math.round(micros / 10_000));
}

async function postMetaGraph(
  providerEntityId: string,
  accessToken: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    access_token: accessToken,
    ...params,
  });

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${providerEntityId}`,
    { method: "POST", body },
  );

  const payload = (await response.json()) as Record<string, unknown> & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Meta API update failed (${response.status})`);
  }

  return payload;
}

export async function updateMetaEntityDailyBudget(
  providerEntityId: string,
  accessToken: string,
  dailyBudgetMicros: number,
): Promise<Record<string, unknown>> {
  return postMetaGraph(providerEntityId, accessToken, {
    daily_budget: microsToMetaBudgetCents(dailyBudgetMicros),
  });
}

export async function updateMetaEntityStatus(
  providerEntityId: string,
  accessToken: string,
  status: "ACTIVE" | "PAUSED",
): Promise<Record<string, unknown>> {
  return postMetaGraph(providerEntityId, accessToken, { status });
}
