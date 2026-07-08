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

/**
 * Ad preview formats to try, in order. Meta renders a playable iframe preview
 * of the actual ad — the reliable way to view video/carousel/dynamic creatives
 * when the raw MP4 `source` field is restricted for our token.
 */
const AD_PREVIEW_FORMATS = [
  "MOBILE_FEED_STANDARD",
  "INSTAGRAM_STANDARD",
  "FACEBOOK_STORY_MOBILE",
  "DESKTOP_FEED_STANDARD",
] as const;

type MetaAdPreviewResponse = {
  data?: Array<{ body?: string }>;
};

/**
 * Generate an embeddable ad preview iframe for a provider ad id. Returns the
 * raw iframe HTML string (Meta's signed, short-lived preview) or null.
 */
export async function fetchMetaAdPreview(
  providerAdId: string,
  accessToken: string,
  adFormat?: string,
): Promise<string | null> {
  const formats = adFormat ? [adFormat] : AD_PREVIEW_FORMATS;

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
      if (body && body.includes("<iframe")) {
        return body;
      }
    } catch {
      // Try the next format.
    }
  }

  return null;
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
};

export type MetaInsightLevel = "account" | "campaign" | "adset" | "ad";

const INSIGHT_METRIC_FIELDS =
  "impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,actions,action_values,purchase_roas";

const INSIGHT_FIELDS_BY_LEVEL: Record<MetaInsightLevel, string> = {
  account: INSIGHT_METRIC_FIELDS,
  campaign: `campaign_id,campaign_name,${INSIGHT_METRIC_FIELDS}`,
  adset: `adset_id,adset_name,${INSIGHT_METRIC_FIELDS}`,
  ad: `ad_id,ad_name,${INSIGHT_METRIC_FIELDS}`,
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
