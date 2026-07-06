import { createClient } from "@walls/supabase/server";

import { META_PROVIDER } from "@/lib/connections";
import {
  formatChange,
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";

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

export type DashboardAnalytics = {
  periodLabel: string;
  syncing: boolean;
  hasData: boolean;
  stats: DashboardStat[];
  spendByWeek: DashboardWeekBar[];
  accounts: DashboardAccountRow[];
};

type MetricRow = {
  metric_date: string;
  impressions: number;
  clicks: number;
  spend_micros: number;
  conversion_value_micros: number;
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
  };

  for (const row of rows) {
    totals.impressions += row.impressions ?? 0;
    totals.clicks += row.clicks ?? 0;
    totals.spend_micros += row.spend_micros ?? 0;
    totals.conversion_value_micros += row.conversion_value_micros ?? 0;
  }

  const spend = totals.spend_micros / 1_000_000;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const roas =
    spend > 0 ? totals.conversion_value_micros / 1_000_000 / spend : null;

  return { ...totals, ctr, roas };
}

function buildWeeklyBars(rows: MetricRow[]): DashboardWeekBar[] {
  if (rows.length === 0) {
    return [
      { label: "W1", value: 0, spendMicros: 0 },
      { label: "W2", value: 0, spendMicros: 0 },
      { label: "W3", value: 0, spendMicros: 0 },
      { label: "W4", value: 0, spendMicros: 0 },
    ];
  }

  const sorted = [...rows].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  const chunkSize = Math.max(1, Math.ceil(sorted.length / 4));
  const weeks: DashboardWeekBar[] = [];

  for (let index = 0; index < 4; index += 1) {
    const slice = sorted.slice(index * chunkSize, (index + 1) * chunkSize);
    const spendMicros = slice.reduce((sum, row) => sum + row.spend_micros, 0);
    weeks.push({
      label: `W${index + 1}`,
      value: 0,
      spendMicros,
    });
  }

  const maxSpend = Math.max(...weeks.map((week) => week.spendMicros), 1);
  return weeks.map((week) => ({
    ...week,
    value: Math.max(8, Math.round((week.spendMicros / maxSpend) * 100)),
  }));
}

function formatAccountStatus(status: string | null): string {
  if (!status) return "Connected";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
      stats: [],
      spendByWeek: buildWeeklyBars([]),
      accounts: [],
    };
  }

  const entityIds = entities.map((entity) => entity.id);

  const { data: metrics } = await supabase
    .from("ad_metrics_daily")
    .select(
      "entity_id, metric_date, impressions, clicks, spend_micros, conversion_value_micros, ctr, roas",
    )
    .in("entity_id", entityIds)
    .gte("metric_date", previousStartIso)
    .order("metric_date", { ascending: true });

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
    ],
    spendByWeek: buildWeeklyBars(currentMetrics),
    accounts,
  };
}
