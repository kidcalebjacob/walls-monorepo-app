import type { AudienceBreakdownRow } from "@/lib/audience-breakdowns";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";

export const COUNTRY_MAP_METRICS = [
  "spend",
  "roas",
  "purchases",
  "impressions",
] as const;

export type CountryMapMetric = (typeof COUNTRY_MAP_METRICS)[number];

export const COUNTRY_MAP_METRIC_OPTIONS: Array<{
  value: CountryMapMetric;
  label: string;
}> = [
  { value: "spend", label: "Spend" },
  { value: "roas", label: "ROAS" },
  { value: "purchases", label: "Purchases" },
  { value: "impressions", label: "Impressions" },
];

/** Spectral heat - cool blues up through hot reds, like a true heatmap. */
const HEAT_STOPS = [
  { t: 0, color: [147, 197, 253] }, // sky
  { t: 0.22, color: [52, 211, 153] }, // emerald
  { t: 0.45, color: [250, 204, 21] }, // yellow
  { t: 0.7, color: [249, 115, 22] }, // orange
  { t: 1, color: [220, 38, 38] }, // red
] as const;

type HeatStop = (typeof HEAT_STOPS)[number];

export const COUNTRY_LAND_FILL = "#e8ecf1";
export const COUNTRY_LAND_STROKE = "#ffffff";
export const COUNTRY_HOVER_STROKE = "#0a0a0a";
export const COUNTRY_OCEAN = "#f3f5f7";

export function countryMetricValue(
  row: AudienceBreakdownRow,
  metric: CountryMapMetric,
): number | null {
  switch (metric) {
    case "spend":
      return row.spendMicros > 0 ? row.spendMicros : null;
    case "roas":
      return row.roas !== null && Number.isFinite(row.roas) && row.roas > 0
        ? row.roas
        : null;
    case "purchases":
      return row.websitePurchases > 0 ? row.websitePurchases : null;
    case "impressions":
      return row.impressions > 0 ? row.impressions : null;
    default:
      return null;
  }
}

export function formatCountryMapMetricValue(
  row: AudienceBreakdownRow,
  metric: CountryMapMetric,
): string {
  switch (metric) {
    case "spend":
      return formatCompactCurrencyFromMicros(row.spendMicros);
    case "roas":
      return formatRoas(row.roas);
    case "purchases":
      return formatCompactNumber(row.websitePurchases);
    case "impressions":
      return formatCompactNumber(row.impressions);
    default:
      return "-";
  }
}

export function formatCompactCurrencyFromMicros(
  micros: number,
  currency = "USD",
): string {
  const amount = micros / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: amount >= 1_000_000 ? 1 : amount >= 1000 ? 1 : 0,
  }).format(amount);
}

export function formatCountryDisplayName(country: string): string {
  const code = country.trim().toUpperCase();
  if (!code) return "Unknown";
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    if (name && name !== code) return name;
  } catch {
    // Invalid region code.
  }
  return code;
}

export function heatIntensity(value: number, maxValue: number): number {
  if (maxValue <= 0 || value <= 0) return 0;
  const t = Math.min(1, Math.max(0, value / maxValue));
  return Math.pow(t, 0.65);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function heatColor(intensity: number): string {
  if (intensity <= 0) return COUNTRY_LAND_FILL;

  let lower: HeatStop = HEAT_STOPS[0];
  let upper: HeatStop = HEAT_STOPS[HEAT_STOPS.length - 1];
  for (let i = 0; i < HEAT_STOPS.length - 1; i += 1) {
    if (intensity >= HEAT_STOPS[i].t && intensity <= HEAT_STOPS[i + 1].t) {
      lower = HEAT_STOPS[i];
      upper = HEAT_STOPS[i + 1];
      break;
    }
  }

  const span = upper.t - lower.t || 1;
  const local = (intensity - lower.t) / span;
  const r = Math.round(lerp(lower.color[0], upper.color[0], local));
  const g = Math.round(lerp(lower.color[1], upper.color[1], local));
  const b = Math.round(lerp(lower.color[2], upper.color[2], local));
  return `rgb(${r}, ${g}, ${b})`;
}

export function buildCountryMetricLookup(
  rows: AudienceBreakdownRow[],
  metric: CountryMapMetric,
): {
  byIso: Map<string, { row: AudienceBreakdownRow; value: number; color: string }>;
  maxValue: number;
} {
  const values: Array<{ iso: string; row: AudienceBreakdownRow; value: number }> =
    [];

  for (const row of rows) {
    const iso = row.country?.trim().toUpperCase();
    if (!iso || iso.length !== 2) continue;
    const value = countryMetricValue(row, metric);
    if (value === null) continue;
    values.push({ iso, row, value });
  }

  const maxValue = values.reduce((max, item) => Math.max(max, item.value), 0);
  const byIso = new Map<
    string,
    { row: AudienceBreakdownRow; value: number; color: string }
  >();

  for (const item of values) {
    byIso.set(item.iso, {
      row: item.row,
      value: item.value,
      color: heatColor(heatIntensity(item.value, maxValue || 1)),
    });
  }

  return { byIso, maxValue };
}

export function countryMapSecondaryStats(row: AudienceBreakdownRow): string {
  const spend = formatCurrencyFromMicros(row.spendMicros);
  const ctr = formatPercent(row.ctr);
  const roas = formatRoas(row.roas);
  return `${spend} · CTR ${ctr} · ROAS ${roas}`;
}
