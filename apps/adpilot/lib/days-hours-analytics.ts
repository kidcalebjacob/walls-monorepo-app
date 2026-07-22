import { createClient } from "@walls/supabase/server";

import { type AdDataScope, withAdScope } from "@/lib/ad-scope";
import type { DaysHoursAnalytics, DaysHoursCellTotals } from "@/lib/days-hours";

type RollupRow = {
  day_of_week: number;
  hour_of_day: number;
  impressions: number;
  clicks: number;
  spend_micros: number;
  conversion_value_micros: number;
};

function normalizeRangeDays(rangeDays: number): 1 | 7 | 14 | 30 {
  if (rangeDays <= 1) return 1;
  if (rangeDays <= 7) return 7;
  if (rangeDays <= 14) return 14;
  return 30;
}

export async function getDaysHoursAnalytics(
  scope: AdDataScope,
  options?: { rangeDays?: number },
): Promise<DaysHoursAnalytics> {
  const rangeDays = normalizeRangeDays(options?.rangeDays ?? 30);
  const supabase = await createClient();

  const { data: rows, error } = await withAdScope(
    supabase
      .from("ad_metrics_days_hours_rollups")
      .select(
        "day_of_week, hour_of_day, impressions, clicks, spend_micros, conversion_value_micros",
      )
      .eq("range_days", rangeDays),
    scope,
  );

  if (error) {
    console.error("Failed to load days/hours rollups:", error);
    return { hasData: false, cells: [] };
  }

  const rollups = (rows ?? []) as RollupRow[];

  // Merge multiple Meta connections into one grid for the account.
  const merged = new Map<string, DaysHoursCellTotals>();
  for (const row of rollups) {
    const key = `${row.day_of_week}:${row.hour_of_day}`;
    const existing = merged.get(key) ?? {
      dayOfWeek: row.day_of_week,
      hour: row.hour_of_day,
      impressions: 0,
      clicks: 0,
      spendMicros: 0,
      conversionValueMicros: 0,
    };
    existing.impressions += Number(row.impressions ?? 0);
    existing.clicks += Number(row.clicks ?? 0);
    existing.spendMicros += Number(row.spend_micros ?? 0);
    existing.conversionValueMicros += Number(row.conversion_value_micros ?? 0);
    merged.set(key, existing);
  }

  const cells = Array.from(merged.values());
  const hasData = cells.some(
    (cell) => cell.impressions > 0 || cell.spendMicros > 0,
  );

  return { hasData, cells };
}
