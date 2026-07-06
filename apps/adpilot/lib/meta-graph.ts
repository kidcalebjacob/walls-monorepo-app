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

export function getMetaDateRange(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - days);

  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { since: format(since), until: format(until) };
}

export type MetaInsightRow = {
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
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
};

export async function fetchMetaInsights(
  accountId: string,
  accessToken: string,
  level: "account" | "campaign",
  since: string,
  until: string,
): Promise<MetaInsightRow[]> {
  const fields =
    level === "campaign"
      ? "campaign_id,campaign_name,impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,actions,action_values"
      : "impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,actions,action_values";

  return fetchMetaGraphCollection<MetaInsightRow>(
    `${accountId}/insights`,
    accessToken,
    {
      fields,
      level,
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
    },
  );
}
