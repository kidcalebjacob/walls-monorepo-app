import { createClient } from "@walls/supabase/server";

import { type AdDataScope, withAdScope } from "@/lib/ad-scope";
import { META_PROVIDER } from "@/lib/connections";
import {
  getDaysHoursAnalytics,
} from "@/lib/days-hours-analytics";
import type { DaysHoursAnalytics } from "@/lib/days-hours";
import {
  getAudienceBreakdownsAnalytics,
} from "@/lib/audience-breakdowns-analytics";
import type { AudienceBreakdownsAnalytics } from "@/lib/audience-breakdowns";
import {
  getFrequencyBreakdownsAnalytics,
} from "@/lib/frequency-breakdowns-analytics";
import type { FrequencyBreakdownsAnalytics } from "@/lib/frequency-breakdowns";
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
  purchaseValue: number;
  purchaseValueMicros: number;
  impressions: number;
  clicks: number;
  websitePurchases: number;
  ctr: number;
  roas: number | null;
};

export type DashboardTopPerformingAd = {
  id: string;
  name: string;
  overallRank: number;
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
  bottomByObjective: Record<DashboardObjectiveBucket, DashboardTopPerformingAd[]>;
};

export type DashboardAnalytics = {
  periodLabel: string;
  syncing: boolean;
  hasData: boolean;
  stats: DashboardStat[];
  spendByDay: DashboardSpendDay[];
  accounts: DashboardAccountRow[];
  topPerformingAds: DashboardTopAdsByObjective;
  daysHours: DaysHoursAnalytics;
  audienceBreakdowns: AudienceBreakdownsAnalytics;
  frequencyBreakdowns: FrequencyBreakdownsAnalytics;
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
  account_connection_id: string;
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

function buildDateRange(rangeDays: number): string[] {
  const dates: string[] = [];
  const end = new Date();

  for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function buildSpendByDay(rows: MetricRow[], rangeDays = 30): DashboardSpendDay[] {
  const totalsByDate = new Map<
    string,
    {
      spendMicros: number;
      conversionValueMicros: number;
      impressions: number;
      clicks: number;
      websitePurchases: number;
    }
  >();

  for (const row of rows) {
    const existing = totalsByDate.get(row.metric_date) ?? {
      spendMicros: 0,
      conversionValueMicros: 0,
      impressions: 0,
      clicks: 0,
      websitePurchases: 0,
    };

    totalsByDate.set(row.metric_date, {
      spendMicros: existing.spendMicros + (row.spend_micros ?? 0),
      conversionValueMicros:
        existing.conversionValueMicros + (row.conversion_value_micros ?? 0),
      impressions: existing.impressions + (row.impressions ?? 0),
      clicks: existing.clicks + (row.clicks ?? 0),
      websitePurchases:
        existing.websitePurchases + Number(row.website_purchases ?? 0),
    });
  }

  return buildDateRange(rangeDays).map((date) => {
    const totals = totalsByDate.get(date) ?? {
      spendMicros: 0,
      conversionValueMicros: 0,
      impressions: 0,
      clicks: 0,
      websitePurchases: 0,
    };
    const spend = totals.spendMicros / 1_000_000;
    const purchaseValue = totals.conversionValueMicros / 1_000_000;
    const ctr =
      totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const roas = spend > 0 ? purchaseValue / spend : null;

    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      spend,
      spendMicros: totals.spendMicros,
      purchaseValue,
      purchaseValueMicros: totals.conversionValueMicros,
      impressions: totals.impressions,
      clicks: totals.clicks,
      websitePurchases: totals.websitePurchases,
      ctr,
      roas,
    };
  });
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
  bottomByObjective: {
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
  ad: Pick<
    DashboardTopPerformingAd,
    | "spendMicros"
    | "impressions"
    | "clicks"
    | "ctr"
    | "roas"
    | "websitePurchases"
  >,
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

function selectTopAndBottomAds(
  ads: Omit<DashboardTopPerformingAd, "overallRank">[],
  objectiveBucket: DashboardObjectiveBucket,
): {
  top: DashboardTopPerformingAd[];
  bottom: DashboardTopPerformingAd[];
} {
  const ranked = [...ads]
    .sort(
      (left, right) =>
        scoreTopAd(right, objectiveBucket) - scoreTopAd(left, objectiveBucket),
    )
    .map((ad, index) => ({ ...ad, overallRank: index + 1 }));

  const top = ranked.slice(0, TOP_ADS_LIMIT);
  const topIds = new Set(top.map((ad) => ad.id));
  const bottom = ranked
    .filter((ad) => !topIds.has(ad.id))
    .slice(-TOP_ADS_LIMIT);

  return { top, bottom };
}

async function buildTopPerformingAds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: AdDataScope,
  currentStartIso: string,
): Promise<DashboardTopAdsByObjective> {
  const { data: ads } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id, name, parent_id")
      .eq("provider", META_PROVIDER)
      .eq("entity_type", "ad"),
    scope,
  );

  if (!ads?.length) return EMPTY_TOP_PERFORMING_ADS;

  const adList = ads as AdEntityRow[];
  const adSetIds = Array.from(
    new Set(adList.map((ad) => ad.parent_id).filter(Boolean)),
  ) as string[];

  if (adSetIds.length === 0) return EMPTY_TOP_PERFORMING_ADS;

  const { data: adSetEntities } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id, name, entity_type, parent_id, objective")
      .eq("provider", META_PROVIDER)
      .eq("entity_type", "ad_group")
      .in("id", adSetIds),
    scope,
  );

  const adSetById = new Map<string, HierarchyEntityRow>();
  const campaignIds = new Set<string>();

  for (const entity of (adSetEntities ?? []) as HierarchyEntityRow[]) {
    adSetById.set(entity.id, entity);
    if (entity.parent_id) campaignIds.add(entity.parent_id);
  }

  const campaignById = new Map<string, HierarchyEntityRow>();

  if (campaignIds.size > 0) {
    const { data: campaigns } = await withAdScope(
      supabase
        .from("ad_entities")
        .select("id, name, entity_type, parent_id, objective")
        .eq("provider", META_PROVIDER)
        .eq("entity_type", "campaign")
        .in("id", Array.from(campaignIds)),
      scope,
    );

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

  const adsByObjective = new Map<
    DashboardObjectiveBucket,
    Omit<DashboardTopPerformingAd, "overallRank">[]
  >();

  for (const ad of adList) {
    const adSet = ad.parent_id ? adSetById.get(ad.parent_id) : undefined;
    const campaign = adSet?.parent_id ? campaignById.get(adSet.parent_id) : undefined;
    const objectiveBucket = resolveObjectiveBucket(campaign?.objective ?? null);
    if (!objectiveBucket) continue;

    const totals = sumMetrics(metricsByAd.get(ad.id) ?? []);
    const tracksWebsitePurchases = isSalesObjective(campaign?.objective ?? null);

    const row: Omit<DashboardTopPerformingAd, "overallRank"> = {
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
  const bottomByObjective = { ...EMPTY_TOP_PERFORMING_ADS.bottomByObjective };

  for (const bucket of DASHBOARD_OBJECTIVE_BUCKETS) {
    const { top, bottom } = selectTopAndBottomAds(
      adsByObjective.get(bucket.value) ?? [],
      bucket.value,
    );

    byObjective[bucket.value] = top;
    bottomByObjective[bucket.value] = bottom;
  }

  const enriched = await attachCreativePreviews(supabase, {
    top: byObjective,
    bottom: bottomByObjective,
  });

  const objectives = DASHBOARD_OBJECTIVE_BUCKETS.map((bucket) => ({
    value: bucket.value,
    label: getObjectiveBucketLabel(bucket.value),
    adCount: adsByObjective.get(bucket.value)?.length ?? 0,
  })).filter((bucket) => bucket.adCount > 0);

  return {
    objectives,
    byObjective: enriched.top,
    bottomByObjective: enriched.bottom,
  };
}

async function attachCreativePreviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lists: {
    top: Record<DashboardObjectiveBucket, DashboardTopPerformingAd[]>;
    bottom: Record<DashboardObjectiveBucket, DashboardTopPerformingAd[]>;
  },
): Promise<{
  top: Record<DashboardObjectiveBucket, DashboardTopPerformingAd[]>;
  bottom: Record<DashboardObjectiveBucket, DashboardTopPerformingAd[]>;
}> {
  const adIds = Array.from(
    new Set(
      [...Object.values(lists.top), ...Object.values(lists.bottom)]
        .flat()
        .map((ad) => ad.id),
    ),
  );

  if (adIds.length === 0) return lists;

  const { data: creatives } = await supabase
    .from("ad_creatives")
    .select(
      `ad_entity_id, creative_type, title, body, thumbnail_url, image_url, image_permalink_url, video_thumbnail_url, video_source_url,
      ad_creative_assets (
        id, asset_type, ordinal, image_url, permalink_url, video_source_url, video_thumbnail_url, title, body
      )`,
    )
    .in("ad_entity_id", adIds);

  const previewByAdId = new Map<string, AdCreativePreview>();
  for (const creative of creatives ?? []) {
    const preview = buildAdCreativePreview(creative);
    if (preview) {
      previewByAdId.set(creative.ad_entity_id as string, preview);
    }
  }

  const enrichList = (ads: DashboardTopPerformingAd[]) =>
    ads.map((ad) => {
      const preview = previewByAdId.get(ad.id) ?? null;
      return {
        ...ad,
        thumbnailUrl: preview?.thumbnailUrl ?? null,
        creativeType: preview?.creativeType ?? null,
        creativePreview: preview,
      };
    });

  const top = { ...lists.top };
  const bottom = { ...lists.bottom };

  for (const bucket of DASHBOARD_OBJECTIVE_BUCKETS) {
    top[bucket.value] = enrichList(lists.top[bucket.value] ?? []);
    bottom[bucket.value] = enrichList(lists.bottom[bucket.value] ?? []);
  }

  return { top, bottom };
}

export async function getDashboardAnalytics(
  scope: AdDataScope,
  options?: { rangeDays?: number },
): Promise<DashboardAnalytics> {
  const rangeDays = options?.rangeDays ?? 30;
  const periodLabel =
    rangeDays === 1 ? "Last 24 hours" : `Last ${rangeDays} days`;

  const supabase = await createClient();
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - rangeDays);
  const previousStart = new Date(now);
  previousStart.setDate(now.getDate() - rangeDays * 2);
  const previousEnd = new Date(now);
  previousEnd.setDate(now.getDate() - (rangeDays + 1));

  const currentStartIso = currentStart.toISOString().slice(0, 10);
  const previousStartIso = previousStart.toISOString().slice(0, 10);
  const previousEndIso = previousEnd.toISOString().slice(0, 10);

  const [{ data: accountEntities }, { data: syncStates }] = await Promise.all([
    withAdScope(
      supabase
        .from("ad_entities")
        .select("id, account_connection_id, name, status, provider_entity_id")
        .eq("provider", META_PROVIDER)
        .eq("entity_type", "account"),
      scope,
    ),
    withAdScope(supabase.from("ad_sync_state").select("sync_status"), scope),
  ]);

  const entities = (accountEntities ?? []) as AccountEntity[];
  const syncing = (syncStates ?? []).some((state) => state.sync_status === "running");

  if (entities.length === 0) {
    return {
      periodLabel,
      syncing,
      hasData: false,
      stats: [...ZERO_DASHBOARD_STATS],
      spendByDay: [],
      accounts: [],
      topPerformingAds: EMPTY_TOP_PERFORMING_ADS,
      daysHours: { hasData: false, cells: [] },
      audienceBreakdowns: {
        hasData: false,
        byType: { age: [], gender: [], age_gender: [], country: [] },
      },
      frequencyBreakdowns: { hasData: false, totalReach: 0, buckets: [] },
    };
  }

  const entityIds = entities.map((entity) => entity.id);

  const [
    { data: metrics },
    topPerformingAds,
    daysHours,
    audienceBreakdowns,
    frequencyBreakdowns,
  ] = await Promise.all([
      supabase
        .from("ad_metrics_daily")
        .select(
          "entity_id, metric_date, impressions, clicks, spend_micros, conversion_value_micros, website_purchases, ctr, roas",
        )
        .in("entity_id", entityIds)
        .gte("metric_date", previousStartIso)
        .order("metric_date", { ascending: true }),
      buildTopPerformingAds(supabase, scope, currentStartIso),
      getDaysHoursAnalytics(scope, { rangeDays }),
      getAudienceBreakdownsAnalytics(scope, { rangeDays }),
      getFrequencyBreakdownsAnalytics(scope, { rangeDays }),
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
    periodLabel,
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
            : "-",
        change: purchaseValueChange.label,
        positive: purchaseValueChange.positive,
      },
    ],
    spendByDay: buildSpendByDay(currentMetrics, rangeDays),
    accounts,
    topPerformingAds,
    daysHours,
    audienceBreakdowns,
    frequencyBreakdowns,
  };
}
