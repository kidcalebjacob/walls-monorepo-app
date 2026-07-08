/** Meta campaign objectives that optimize for purchases / sales. */
export function isSalesObjective(objective: string | null | undefined): boolean {
  if (!objective) return false;
  const normalized = objective.toUpperCase();
  return (
    normalized === "OUTCOME_SALES" ||
    normalized === "CONVERSIONS" ||
    normalized === "PRODUCT_CATALOG_SALES" ||
    normalized.includes("SALES")
  );
}

/** Dashboard objective buckets for grouping and ranking top ads. */
export const DASHBOARD_OBJECTIVE_BUCKETS = [
  {
    value: "OUTCOME_SALES",
    label: "Sales",
    matchers: [
      "OUTCOME_SALES",
      "CONVERSIONS",
      "PRODUCT_CATALOG_SALES",
    ],
  },
  {
    value: "OUTCOME_TRAFFIC",
    label: "Traffic",
    matchers: ["OUTCOME_TRAFFIC", "LINK_CLICKS"],
  },
  {
    value: "OUTCOME_AWARENESS",
    label: "Awareness",
    matchers: ["OUTCOME_AWARENESS", "BRAND_AWARENESS", "REACH"],
  },
  {
    value: "OUTCOME_ENGAGEMENT",
    label: "Engagement",
    matchers: ["OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT", "VIDEO_VIEWS"],
  },
  {
    value: "OUTCOME_LEADS",
    label: "Leads",
    matchers: ["OUTCOME_LEADS", "LEAD_GENERATION", "MESSAGES"],
  },
  {
    value: "OUTCOME_APP_PROMOTION",
    label: "App",
    matchers: ["OUTCOME_APP_PROMOTION", "APP_INSTALLS"],
  },
] as const;

export type DashboardObjectiveBucket =
  (typeof DASHBOARD_OBJECTIVE_BUCKETS)[number]["value"];

/** Map a Meta campaign objective to a dashboard OUTCOME bucket. */
export function resolveObjectiveBucket(
  objective: string | null | undefined,
): DashboardObjectiveBucket | null {
  if (!objective?.trim()) return null;

  const normalized = objective.trim().toUpperCase();
  for (const bucket of DASHBOARD_OBJECTIVE_BUCKETS) {
    if ((bucket.matchers as readonly string[]).includes(normalized)) {
      return bucket.value;
    }
  }

  if (normalized.startsWith("OUTCOME_")) {
    const direct = DASHBOARD_OBJECTIVE_BUCKETS.find(
      (bucket) => bucket.value === normalized,
    );
    if (direct) return direct.value;
  }

  return null;
}

export function getObjectiveBucketLabel(
  bucket: DashboardObjectiveBucket,
): string {
  return (
    DASHBOARD_OBJECTIVE_BUCKETS.find((item) => item.value === bucket)?.label ??
    formatObjectiveLabel(bucket)
  );
}

export type ObjectiveProgressMetricKey =
  | "roas"
  | "ctr"
  | "clicks"
  | "impressions"
  | "spend";

export type ObjectiveProgressMetric = {
  key: ObjectiveProgressMetricKey;
  label: string;
};

/** Primary + secondary metrics to chart for each outcome bucket. */
export function getObjectiveProgressConfig(
  bucket: DashboardObjectiveBucket | null,
): {
  primary: ObjectiveProgressMetric;
  secondary: ObjectiveProgressMetric | null;
} {
  switch (bucket) {
    case "OUTCOME_SALES":
      return {
        primary: { key: "roas", label: "ROAS" },
        secondary: { key: "spend", label: "Spend" },
      };
    case "OUTCOME_TRAFFIC":
      return {
        primary: { key: "clicks", label: "Clicks" },
        secondary: { key: "ctr", label: "CTR" },
      };
    case "OUTCOME_AWARENESS":
      return {
        primary: { key: "impressions", label: "Impressions" },
        secondary: { key: "spend", label: "Spend" },
      };
    case "OUTCOME_ENGAGEMENT":
      return {
        primary: { key: "ctr", label: "CTR" },
        secondary: { key: "clicks", label: "Clicks" },
      };
    case "OUTCOME_LEADS":
      return {
        primary: { key: "clicks", label: "Clicks" },
        secondary: { key: "ctr", label: "CTR" },
      };
    case "OUTCOME_APP_PROMOTION":
      return {
        primary: { key: "clicks", label: "Clicks" },
        secondary: { key: "spend", label: "Spend" },
      };
    default:
      return {
        primary: { key: "spend", label: "Spend" },
        secondary: null,
      };
  }
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: "Sales",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_LEADS: "Leads",
  OUTCOME_APP_PROMOTION: "App promotion",
  CONVERSIONS: "Conversions",
  LINK_CLICKS: "Link clicks",
  POST_ENGAGEMENT: "Post engagement",
  REACH: "Reach",
  BRAND_AWARENESS: "Brand awareness",
  VIDEO_VIEWS: "Video views",
  LEAD_GENERATION: "Lead generation",
  MESSAGES: "Messages",
  APP_INSTALLS: "App installs",
  STORE_VISITS: "Store visits",
  PRODUCT_CATALOG_SALES: "Catalog sales",
};

/** Human-readable label for Meta campaign objective API values. */
export function formatObjectiveLabel(
  objective: string | null | undefined,
): string {
  if (!objective?.trim()) return "—";

  const normalized = objective.trim().toUpperCase();
  const mapped = OBJECTIVE_LABELS[normalized];
  if (mapped) return mapped;

  const withoutPrefix = normalized.replace(/^OUTCOME_/, "");
  return withoutPrefix
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}
