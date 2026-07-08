import { createClient } from "@walls/supabase/server";

import { META_PROVIDER } from "@/lib/connections";
import {
  formatChange,
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatResultCount,
  formatRoas,
} from "@/lib/format-analytics";
import { ZERO_DASHBOARD_STATS } from "@/lib/dashboard-defaults";
import {
  buildAdCreativePreview,
  type AdCreativePreview,
} from "@/lib/meta-creatives";
import {
  DASHBOARD_OBJECTIVE_BUCKETS,
  type DashboardObjectiveBucket,
  getObjectiveBucketLabel,
  isSalesObjective,
  resolveObjectiveBucket,
} from "@/lib/meta-objectives";

export type DashboardStat = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
};

export type DashboardWeekBar = {
  label: string;
  value: number;
  spendMicros: number;
};

export type DashboardAccountRow = {
  id: string;
  name: string;
  platform: string;
  spend: string;
  impressions: string;
  ctr: string;
  status: string;
};

export type DashboardSpendDay = {
  date: string;
  label: string;
  spend: number;
  spendMicros: number;
};

export type DashboardTopPerformingAd = {
  id: string;
  name: string;
  campaignId: string | null;
  adSetId: string | null;
  campaignName: string | null;
  adSetName: string | null;
  objectiveBucket: DashboardObjectiveBucket;
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

export type DashboardTopAdsByObjective = {
  objectives: Array<{
    value: DashboardObjectiveBucket;
    label: string;
    adCount: number;
  }>;
  byObjective: Record<DashboardObjectiveBucket, DashboardTopPerformingAd[]>;
};

export type DashboardAnalytics = {
  periodLabel: string;
  syncing: boolean;
  hasData: boolean;
  stats: DashboardStat[];
  spendByDay: DashboardSpendDay[];
  accounts: DashboardAccountRow[];
  topPerformingAds: DashboardTopAdsByObjective;
};

type MetricRow = {
  metric_date: string;
  impressions: number;
  clicks: number;
  spend_micros: number;
  conversion_value_micros: number;
  website_purchases: number;
  ctr: number | null;
  roas: number | null;
};

type AccountEntity = {
  id: string;
  user_connection_id: string;
  name: string | null;
  status: string | null;
  provider_entity_id: string;
};

function sumMetrics(rows: MetricRow[]) {
  const totals = {
    impressions: 0,
    clicks: 0,
    spend_micros: 0,
    conversion_value_micros: 0,
    website_purchases: 0,
  };

  for (const row of rows) {
    totals.impressions += row.impressions ?? 0;
    totals.clicks += row.clicks ?? 0;
    totals.spend_micros += row.spend_micros ?? 0;
    totals.conversion_value_micros += row.conversion_value_micros ?? 0;
    totals.website_purchases += Number(row.website_purchases ?? 0);
  }

  const spend = totals.spend_micros / 1_000_000;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const roas =
    spend > 0 ? totals.conversion_value_micros / 1_000_000 / spend : null;

  return { ...totals, ctr, roas };
}

function buildSpendByDay(rows: MetricRow[]): DashboardSpendDay[] {
  const totalsByDate = new Map<string, number>();

  for (const row of rows) {
    totalsByDate.set(
      row.metric_date,
      (totalsByDate.get(row.metric_date) ?? 0) + row.spend_micros,
    );
  }

  return Array.from(totalsByDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, spendMicros]) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      spend: spendMicros / 1_000_000,
      spendMicros,
    }));
}

function formatAccountStatus(status: string | null): string {
  if (!status) return "Connected";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const TOP_ADS_LIMIT = 5;

const EMPTY_TOP_PERFORMING_ADS: DashboardTopAdsByObjective = {
  objectives: [],
  byObjective: {
    OUTCOME_SALES: [],
    OUTCOME_TRAFFIC: [],
    OUTCOME_AWARENESS: [],
    OUTCOME_ENGAGEMENT: [],
    OUTCOME_LEADS: [],
    OUTCOME_APP_PROMOTION: [],
  },
};

type AdEntityRow = {
  id: string;
  name: string | null;
  parent_id: string | null;
};

type HierarchyEntityRow = {
  id: string;
  name: string | null;
  entity_type: "campaign" | "ad_group";
  parent_id: string | null;
  objective: string | null;
};

function scoreTopAd(
  ad: DashboardTopPerformingAd,
  objectiveBucket: DashboardObjectiveBucket,
): number {
  const spend = ad.spendMicros / 1_000_000;
  const hasDelivery = ad.impressions > 0 || spend > 0;
  if (!hasDelivery) return 0;

  switch (objectiveBucket) {
    case "OUTCOME_SALES":
      return (
        (ad.roas ?? 0) * spend * 250 +
        (ad.websitePurchases ?? 0) * 100 +
        spend * 10 +
        ad.ctr * 5
      );
    case "OUTCOME_TRAFFIC":
      return ad.clicks * 12 + ad.ctr * 25 + spend * 5;
    case "OUTCOME_AWARENESS":
      return ad.impressions * 0.02 + spend * 2;
    case "OUTCOME_ENGAGEMENT":
      return ad.clicks * 10 + ad.ctr * 30 + spend * 3;
    case "OUTCOME_LEADS":
      return ad.clicks * 8 + ad.ctr * 20 + spend * 4;
    case "OUTCOME_APP_PROMOTION":
      return ad.clicks * 15 + spend * 6 + ad.ctr * 10;
    default:
      return spend * 10 + (ad.roas ?? 0) * 50 + ad.clicks;
  }
}

async function buildTopPerformingAds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  currentStartIso: string,
): Promise<DashboardTopAdsByObjective> {
  const { data: ads } = await supabase
    .from("ad_entities")
    .select("id, name, parent_id")
    .eq("user_id", userId)
    .eq("provider", META_PROVIDER)
    .eq("entity_type", "ad");

  if (!ads?.length) return EMPTY_TOP_PERFORMING_ADS;

  const adList = ads as AdEntityRow[];
  const adSetIds = Array.from(
    new Set(adList.map((ad) => ad.parent_id).filter(Boolean)),
  ) as string[];

  if (adSetIds.length === 0) return EMPTY_TOP_PERFORMING_ADS;

  const { data: adSetEntities } = await supabase
    .from("ad_entities")
    .select("id, name, entity_type, parent_id, objective")
    .eq("user_id", userId)
    .eq("provider", META_PROVIDER)
    .eq("entity_type", "ad_group")
    .in("id", adSetIds);

  const adSetById = new Map<string, HierarchyEntityRow>();
  const campaignIds = new Set<string>();

  for (const entity of (adSetEntities ?? []) as HierarchyEntityRow[]) {
    adSetById.set(entity.id, entity);
    if (entity.parent_id) campaignIds.add(entity.parent_id);
  }

  const campaignById = new Map<string, HierarchyEntityRow>();

  if (campaignIds.size > 0) {
    const { data: campaigns } = await supabase
      .from("ad_entities")
      .select("id, name, entity_type, parent_id, objective")
      .eq("user_id", userId)
      .eq("provider", META_PROVIDER)
      .eq("entity_type", "campaign")
      .in("id", Array.from(campaignIds));

    for (const campaign of (campaigns ?? []) as HierarchyEntityRow[]) {
      campaignById.set(campaign.id, campaign);
    }
  }

  const adIds = adList.map((ad) => ad.id);
  const { data: metrics } = await supabase
    .from("ad_metrics_daily")
    .select(
      "entity_id, impressions, clicks, spend_micros, conversion_value_micros, website_purchases",
    )
    .in("entity_id", adIds)
    .gte("metric_date", currentStartIso);

  const metricsByAd = new Map<string, MetricRow[]>();
  for (const row of (metrics ?? []) as Array<MetricRow & { entity_id: string }>) {
    const bucket = metricsByAd.get(row.entity_id) ?? [];
    bucket.push(row);
    metricsByAd.set(row.entity_id, bucket);
  }

  const adsByObjective = new Map<DashboardObjectiveBucket, DashboardTopPerformingAd[]>();

  for (const ad of adList) {
    const adSet = ad.parent_id ? adSetById.get(ad.parent_id) : undefined;
    const campaign = adSet?.parent_id ? campaignById.get(adSet.parent_id) : undefined;
    const objectiveBucket = resolveObjectiveBucket(campaign?.objective ?? null);
    if (!objectiveBucket) continue;

    const totals = sumMetrics(metricsByAd.get(ad.id) ?? []);
    const tracksWebsitePurchases = isSalesObjective(campaign?.objective ?? null);

    const row: DashboardTopPerformingAd = {
      id: ad.id,
      name: ad.name ?? "Untitled ad",
      campaignId: campaign?.id ?? null,
      adSetId: adSet?.id ?? null,
      campaignName: campaign?.name ?? null,
      adSetName: adSet?.name ?? null,
      objectiveBucket,
      spendMicros: totals.spend_micros,
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.ctr,
      roas: totals.roas,
      websitePurchases: tracksWebsitePurchases ? totals.website_purchases : null,
      thumbnailUrl: null,
      creativeType: null,
      creativePreview: null,
    };

    if (row.impressions <= 0 && row.spendMicros <= 0) continue;

    const bucket = adsByObjective.get(objectiveBucket) ?? [];
    bucket.push(row);
    adsByObjective.set(objectiveBucket, bucket);
  }

  const byObjective = { ...EMPTY_TOP_PERFORMING_ADS.byObjective };

  for (const bucket of DASHBOARD_OBJECTIVE_BUCKETS) {
    const ranked = (adsByObjective.get(bucket.value) ?? [])
      .sort(
        (left, right) =>
          scoreTopAd(right, bucket.value) - scoreTopAd(left, bucket.value),
      )
      .slice(0, TOP_ADS_LIMIT);

    byObjective[bucket.value] = ranked;
  }

  const enrichedByObjective = await attachCreativePreviews(supabase, byObjective);

  const objectives = DASHBOARD_OBJECTIVE_BUCKETS.map((bucket) => ({
    value: bucket.value,
    label: getObjectiveBucketLabel(bucket.value),
    adCount: adsByObjective.get(bucket.value)?.length ?? 0,
  })).filter((bucket) => bucket.adCount > 0);

  return { objectives, byObjective: enrichedByObjective };
}

async function attachCreativePreviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
  byObjective: Record<DashboardObjectiveBucket, DashboardTopPerformingAd[]>,
): Promise<Record<DashboardObjectiveBucket, DashboardTopPerformingAd[]>> {
  const topAdIds = Array.from(
    new Set(Object.values(byObjective).flat().map((ad) => ad.id)),
  );

  if (topAdIds.length === 0) return byObjective;

  const { data: creatives } = await supabase
    .from("ad_creatives")
    .select(
      `ad_entity_id, creative_type, title, body, thumbnail_url, image_url, image_permalink_url, video_thumbnail_url, video_source_url,
      ad_creative_assets (
        id, asset_type, ordinal, image_url, permalink_url, video_source_url, video_thumbnail_url, title, body
      )`,
    )
    .in("ad_entity_id", topAdIds);

  const previewByAdId = new Map<string, AdCreativePreview>();
  for (const creative of creatives ?? []) {
    const preview = buildAdCreativePreview(creative);
    if (preview) {
      previewByAdId.set(creative.ad_entity_id as string, preview);
    }
  }

  const enriched = { ...byObjective };
  for (const bucket of DASHBOARD_OBJECTIVE_BUCKETS) {
    enriched[bucket.value] = (byObjective[bucket.value] ?? []).map((ad) => {
      const preview = previewByAdId.get(ad.id) ?? null;
      return {
        ...ad,
        thumbnailUrl: preview?.thumbnailUrl ?? null,
        creativeType: preview?.creativeType ?? null,
        creativePreview: preview,
      };
    });
  }

  return enriched;
}

export async function getDashboardAnalytics(
  userId: string,
): Promise<DashboardAnalytics> {
  const supabase = await createClient();
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - 30);
  const previousStart = new Date(now);
  previousStart.setDate(now.getDate() - 60);
  const previousEnd = new Date(now);
  previousEnd.setDate(now.getDate() - 31);

  const currentStartIso = currentStart.toISOString().slice(0, 10);
  const previousStartIso = previousStart.toISOString().slice(0, 10);
  const previousEndIso = previousEnd.toISOString().slice(0, 10);

  const [{ data: accountEntities }, { data: syncStates }] = await Promise.all([
    supabase
      .from("ad_entities")
      .select("id, user_connection_id, name, status, provider_entity_id")
      .eq("user_id", userId)
      .eq("provider", META_PROVIDER)
      .eq("entity_type", "account"),
    supabase
      .from("ad_sync_state")
      .select("sync_status")
      .eq("user_id", userId),
  ]);

  const entities = (accountEntities ?? []) as AccountEntity[];
  const syncing = (syncStates ?? []).some((state) => state.sync_status === "running");

  if (entities.length === 0) {
    return {
      periodLabel: "Last 30 days",
      syncing,
      hasData: false,
      stats: [...ZERO_DASHBOARD_STATS],
      spendByDay: [],
      accounts: [],
      topPerformingAds: EMPTY_TOP_PERFORMING_ADS,
    };
  }

  const entityIds = entities.map((entity) => entity.id);

  const [{ data: metrics }, topPerformingAds] = await Promise.all([
    supabase
      .from("ad_metrics_daily")
      .select(
        "entity_id, metric_date, impressions, clicks, spend_micros, conversion_value_micros, website_purchases, ctr, roas",
      )
      .in("entity_id", entityIds)
      .gte("metric_date", previousStartIso)
      .order("metric_date", { ascending: true }),
    buildTopPerformingAds(supabase, userId, currentStartIso),
  ]);

  const metricRows = (metrics ?? []) as Array<MetricRow & { entity_id: string }>;
  const currentMetrics = metricRows.filter(
    (row) => row.metric_date >= currentStartIso,
  );
  const previousMetrics = metricRows.filter(
    (row) => row.metric_date >= previousStartIso && row.metric_date <= previousEndIso,
  );

  const currentTotals = sumMetrics(currentMetrics);
  const previousTotals = sumMetrics(previousMetrics);
  const hasData = currentTotals.spend_micros > 0 || currentTotals.impressions > 0;

  const spendChange = formatChange(
    currentTotals.spend_micros,
    previousTotals.spend_micros,
  );
  const impressionsChange = formatChange(
    currentTotals.impressions,
    previousTotals.impressions,
  );
  const ctrChange = formatChange(currentTotals.ctr, previousTotals.ctr);
  const roasChange = formatChange(
    currentTotals.roas ?? 0,
    previousTotals.roas ?? 0,
  );
  const websitePurchasesChange = formatChange(
    currentTotals.website_purchases,
    previousTotals.website_purchases,
  );
  const purchaseValueChange = formatChange(
    currentTotals.conversion_value_micros,
    previousTotals.conversion_value_micros,
  );

  const accounts: DashboardAccountRow[] = entities.map((entity) => {
    const entityMetrics = currentMetrics.filter(
      (row) => row.entity_id === entity.id,
    );
    const totals = sumMetrics(entityMetrics);

    return {
      id: entity.id,
      name: entity.name ?? entity.provider_entity_id.replace(/^act_/, "Ad account "),
      platform: "Meta",
      spend: formatCurrencyFromMicros(totals.spend_micros),
      impressions: formatCompactNumber(totals.impressions),
      ctr: formatPercent(totals.ctr),
      status: formatAccountStatus(entity.status),
    };
  });

  return {
    periodLabel: "Last 30 days",
    syncing,
    hasData,
    stats: [
      {
        label: "Ad spend",
        value: formatCurrencyFromMicros(currentTotals.spend_micros),
        change: spendChange.label,
        positive: spendChange.positive,
      },
      {
        label: "Impressions",
        value: formatCompactNumber(currentTotals.impressions),
        change: impressionsChange.label,
        positive: impressionsChange.positive,
      },
      {
        label: "CTR",
        value: formatPercent(currentTotals.ctr),
        change: ctrChange.label,
        positive: ctrChange.positive,
      },
      {
        label: "ROAS",
        value: formatRoas(currentTotals.roas),
        change: roasChange.label,
        positive: roasChange.positive,
      },
      {
        label: "Website purchases",
        value: formatResultCount(currentTotals.website_purchases),
        change: websitePurchasesChange.label,
        positive: websitePurchasesChange.positive,
      },
      {
        label: "Purchase value",
        value:
          currentTotals.conversion_value_micros > 0
            ? formatCurrencyFromMicros(currentTotals.conversion_value_micros)
            : "—",
        change: purchaseValueChange.label,
        positive: purchaseValueChange.positive,
      },
    ],
    spendByDay: buildSpendByDay(currentMetrics),
    accounts,
    topPerformingAds,
  };
}
