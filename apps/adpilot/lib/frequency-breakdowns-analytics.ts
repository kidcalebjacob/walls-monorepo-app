import { createClient } from "@walls/supabase/server";

import { type AdDataScope, withAdScope } from "@/lib/ad-scope";
import { META_PROVIDER } from "@/lib/connections";
import {
  formatFrequencyBucketLabel,
  frequencyBucketSortKey,
  type FrequencyBreakdownBucket,
  type FrequencyBreakdownsAnalytics,
} from "@/lib/frequency-breakdowns";
import { FREQUENCY_RANGE_DAYS, type FrequencyRangeDays } from "@/lib/meta-graph";

type FrequencyMetricRow = {
  frequency_value: string;
  reach: number | null;
};

function normalizeRangeDays(rangeDays: number): FrequencyRangeDays {
  for (const preset of FREQUENCY_RANGE_DAYS) {
    if (rangeDays <= preset) return preset;
  }
  return 30;
}

function emptyAnalytics(): FrequencyBreakdownsAnalytics {
  return { hasData: false, totalReach: 0, buckets: [] };
}

export async function getFrequencyBreakdownsAnalytics(
  scope: AdDataScope,
  options?: { rangeDays?: number },
): Promise<FrequencyBreakdownsAnalytics> {
  const rangeDays = normalizeRangeDays(options?.rangeDays ?? 30);
  const supabase = await createClient();

  const { data: accountEntities, error: entitiesError } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id")
      .eq("provider", META_PROVIDER)
      .eq("entity_type", "account"),
    scope,
  );

  if (entitiesError) throw entitiesError;

  const entityIds = (accountEntities ?? []).map((entity) => entity.id as string);
  if (entityIds.length === 0) return emptyAnalytics();

  const { data: rows, error } = await supabase
    .from("ad_metrics_frequency_breakdowns")
    .select("frequency_value, reach")
    .in("entity_id", entityIds)
    .eq("range_days", rangeDays);

  if (error) throw error;

  const reachByBucket = new Map<string, number>();
  for (const row of (rows ?? []) as FrequencyMetricRow[]) {
    const frequencyValue = (row.frequency_value ?? "").trim();
    if (!frequencyValue) continue;
    const reach = Number(row.reach ?? 0);
    if (!Number.isFinite(reach) || reach < 0) continue;
    reachByBucket.set(
      frequencyValue,
      (reachByBucket.get(frequencyValue) ?? 0) + reach,
    );
  }

  if (reachByBucket.size === 0) return emptyAnalytics();

  const totalReach = Array.from(reachByBucket.values()).reduce(
    (sum, reach) => sum + reach,
    0,
  );

  const buckets: FrequencyBreakdownBucket[] = Array.from(reachByBucket.entries())
    .map(([frequencyValue, reach]) => ({
      frequencyValue,
      label: formatFrequencyBucketLabel(frequencyValue),
      reach,
      percentOfTotal: totalReach > 0 ? (reach / totalReach) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        frequencyBucketSortKey(a.frequencyValue) -
        frequencyBucketSortKey(b.frequencyValue),
    );

  return {
    hasData: totalReach > 0,
    totalReach,
    buckets,
  };
}
