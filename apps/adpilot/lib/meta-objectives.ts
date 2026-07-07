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
