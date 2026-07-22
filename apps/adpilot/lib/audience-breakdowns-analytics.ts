import { createClient } from "@walls/supabase/server";

import { type AdDataScope, withAdScope } from "@/lib/ad-scope";
import { META_PROVIDER } from "@/lib/connections";
import {
  AUDIENCE_BREAKDOWN_TYPES,
  formatAudienceBreakdownLabel,
  type AudienceBreakdownRow,
  type AudienceBreakdownType,
  type AudienceBreakdownsAnalytics,
} from "@/lib/audience-breakdowns";

type BreakdownMetricRow = {
  breakdown_type: AudienceBreakdownType;
  age: string | null;
  gender: string | null;
  country: string | null;
  impressions: number;
  clicks: number;
  spend_micros: number;
  conversion_value_micros: number;
  website_purchases: number;
};

type Totals = {
  impressions: number;
  clicks: number;
  spendMicros: number;
  conversionValueMicros: number;
  websitePurchases: number;
};

function emptyByType(): Record<AudienceBreakdownType, AudienceBreakdownRow[]> {
  return {
    age: [],
    gender: [],
    age_gender: [],
    country: [],
  };
}

function dimensionKey(
  type: AudienceBreakdownType,
  age: string,
  gender: string,
  country: string,
): string {
  switch (type) {
    case "age":
      return `age:${age || "unknown"}`;
    case "gender":
      return `gender:${gender || "unknown"}`;
    case "age_gender":
      return `age_gender:${age || "unknown"}:${gender || "unknown"}`;
    case "country":
      return `country:${country || "unknown"}`;
    default:
      return "unknown";
  }
}

function toRow(
  type: AudienceBreakdownType,
  key: string,
  age: string,
  gender: string,
  country: string,
  totals: Totals,
): AudienceBreakdownRow {
  const spend = totals.spendMicros / 1_000_000;
  const ctr =
    totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const roas =
    spend > 0 ? totals.conversionValueMicros / 1_000_000 / spend : null;
  const cpaMicros =
    totals.websitePurchases > 0
      ? Math.round(totals.spendMicros / totals.websitePurchases)
      : null;

  return {
    key,
    label: formatAudienceBreakdownLabel(type, { age, gender, country }),
    age: age || null,
    gender: gender || null,
    country: country || null,
    impressions: totals.impressions,
    clicks: totals.clicks,
    spendMicros: totals.spendMicros,
    conversionValueMicros: totals.conversionValueMicros,
    websitePurchases: totals.websitePurchases,
    ctr,
    roas,
    cpaMicros,
  };
}

function sortRows(rows: AudienceBreakdownRow[]): AudienceBreakdownRow[] {
  return [...rows].sort((a, b) => {
    const aRoas = a.roas ?? -1;
    const bRoas = b.roas ?? -1;
    if (bRoas !== aRoas) return bRoas - aRoas;
    return b.spendMicros - a.spendMicros;
  });
}

export async function getAudienceBreakdownsAnalytics(
  scope: AdDataScope,
  options?: { rangeDays?: number },
): Promise<AudienceBreakdownsAnalytics> {
  const rangeDays = options?.rangeDays ?? 30;
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - rangeDays);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data: accountEntities, error: entitiesError } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id")
      .eq("provider", META_PROVIDER)
      .eq("entity_type", "account"),
    scope,
  );

  if (entitiesError) {
    console.error("Failed to load account entities for audience breakdowns:", entitiesError);
    return { hasData: false, byType: emptyByType() };
  }

  const entityIds = (accountEntities ?? []).map((row) => row.id as string);
  if (entityIds.length === 0) {
    return { hasData: false, byType: emptyByType() };
  }

  const { data: rows, error } = await supabase
    .from("ad_metrics_daily_breakdowns")
    .select(
      "breakdown_type, age, gender, country, impressions, clicks, spend_micros, conversion_value_micros, website_purchases",
    )
    .in("entity_id", entityIds)
    .in("breakdown_type", [...AUDIENCE_BREAKDOWN_TYPES])
    .gte("metric_date", sinceIso);

  if (error) {
    console.error("Failed to load audience demographic breakdowns:", error);
    return { hasData: false, byType: emptyByType() };
  }

  const metrics = (rows ?? []) as BreakdownMetricRow[];
  const buckets = new Map<
    string,
    {
      type: AudienceBreakdownType;
      age: string;
      gender: string;
      country: string;
      totals: Totals;
    }
  >();

  for (const row of metrics) {
    if (!AUDIENCE_BREAKDOWN_TYPES.includes(row.breakdown_type)) continue;

    const age = (row.age ?? "").trim();
    const gender = (row.gender ?? "").trim();
    const country = (row.country ?? "").trim();
    const key = dimensionKey(row.breakdown_type, age, gender, country);
    const existing = buckets.get(key) ?? {
      type: row.breakdown_type,
      age,
      gender,
      country,
      totals: {
        impressions: 0,
        clicks: 0,
        spendMicros: 0,
        conversionValueMicros: 0,
        websitePurchases: 0,
      },
    };

    existing.totals.impressions += Number(row.impressions ?? 0);
    existing.totals.clicks += Number(row.clicks ?? 0);
    existing.totals.spendMicros += Number(row.spend_micros ?? 0);
    existing.totals.conversionValueMicros += Number(
      row.conversion_value_micros ?? 0,
    );
    existing.totals.websitePurchases += Number(row.website_purchases ?? 0);
    buckets.set(key, existing);
  }

  const byType = emptyByType();
  for (const [key, bucket] of buckets) {
    byType[bucket.type].push(
      toRow(bucket.type, key, bucket.age, bucket.gender, bucket.country, bucket.totals),
    );
  }

  for (const type of AUDIENCE_BREAKDOWN_TYPES) {
    byType[type] = sortRows(byType[type]);
  }

  const hasData = AUDIENCE_BREAKDOWN_TYPES.some((type) =>
    byType[type].some((row) => row.impressions > 0 || row.spendMicros > 0),
  );

  return { hasData, byType };
}
