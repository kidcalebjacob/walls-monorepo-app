import {
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";
import { formatCpaFromMicros } from "@/lib/entity-daily-progress";

export const AUDIENCE_BREAKDOWN_TYPES = [
  "age",
  "gender",
  "age_gender",
  "country",
] as const;

export type AudienceBreakdownType = (typeof AUDIENCE_BREAKDOWN_TYPES)[number];

export const AUDIENCE_BREAKDOWN_OPTIONS: Array<{
  value: AudienceBreakdownType;
  label: string;
}> = [
  { value: "age", label: "Age" },
  { value: "gender", label: "Gender" },
  { value: "age_gender", label: "Age & Gender" },
  { value: "country", label: "Country" },
];

export type AudienceBreakdownRow = {
  key: string;
  label: string;
  age: string | null;
  gender: string | null;
  country: string | null;
  impressions: number;
  clicks: number;
  spendMicros: number;
  conversionValueMicros: number;
  websitePurchases: number;
  ctr: number;
  roas: number | null;
  cpaMicros: number | null;
};

export type AudienceBreakdownsAnalytics = {
  hasData: boolean;
  byType: Record<AudienceBreakdownType, AudienceBreakdownRow[]>;
};

const countryDisplayNames =
  typeof Intl !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function formatGenderLabel(gender: string): string {
  const normalized = gender.trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  if (normalized === "unknown" || normalized === "") return "Unknown";
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

export function formatCountryLabel(country: string): string {
  const code = country.trim().toUpperCase();
  if (!code) return "Unknown";
  try {
    const name = countryDisplayNames?.of(code);
    if (name && name !== code) return `${name} (${code})`;
  } catch {
    // Invalid region code — fall through.
  }
  return code;
}

export function formatAudienceBreakdownLabel(
  type: AudienceBreakdownType,
  dims: { age: string; gender: string; country: string },
): string {
  switch (type) {
    case "age":
      return dims.age || "Unknown";
    case "gender":
      return formatGenderLabel(dims.gender);
    case "age_gender": {
      const age = dims.age || "Unknown";
      return `${age} · ${formatGenderLabel(dims.gender)}`;
    }
    case "country":
      return formatCountryLabel(dims.country);
    default:
      return "Unknown";
  }
}

export function formatAudienceBreakdownCtr(ctr: number): string {
  return formatPercent(ctr);
}

export function formatAudienceBreakdownRoas(roas: number | null): string {
  return formatRoas(roas);
}

export function formatAudienceBreakdownCpa(
  spendMicros: number,
  websitePurchases: number,
): string {
  return formatCpaFromMicros(spendMicros, websitePurchases);
}

export function formatAudienceBreakdownSpend(spendMicros: number): string {
  return formatCurrencyFromMicros(spendMicros);
}
