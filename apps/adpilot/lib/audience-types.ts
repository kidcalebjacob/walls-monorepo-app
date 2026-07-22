export type AdAudienceType =
  | "lookalike"
  | "interest"
  | "custom"
  | "behavior"
  | "life_event"
  | "family_status"
  | "industry"
  | "income"
  | "education"
  | "work"
  | "relationship"
  | "remarketing"
  | "similar"
  | "in_market"
  | "affinity"
  | "custom_intent"
  | "other";

export const AUDIENCE_TYPE_LABELS: Record<AdAudienceType, string> = {
  lookalike: "Lookalike Audience",
  interest: "Interest",
  custom: "Custom Audience",
  behavior: "Behavior",
  life_event: "Life event",
  family_status: "Family status",
  industry: "Industry",
  income: "Income",
  education: "Education",
  work: "Work",
  relationship: "Relationship",
  remarketing: "Remarketing",
  similar: "Similar Audience",
  in_market: "In-market",
  affinity: "Affinity",
  custom_intent: "Custom intent",
  other: "Other",
};

export const AUDIENCE_ORIGIN_LABELS: Record<string, string> = {
  website: "Website",
  customer_file: "Customer file",
  engagement: "Engagement",
  app: "App activity",
  offline: "Offline events",
  video: "Video",
  lookalike: "Lookalike",
  interest: "Interest",
  behavior: "Behavior",
  life_event: "Life event",
  family_status: "Family status",
  industry: "Industry",
  income: "Income",
  education: "Education",
  work: "Work",
  relationship: "Relationship",
  remarketing: "Remarketing",
  similar: "Similar",
  in_market: "In-market",
  affinity: "Affinity",
  custom_intent: "Custom intent",
  page: "Page",
  store: "Store visits",
  other: "Other",
};

export type AudienceCatalogSource = "account_catalog" | "targeting_segment";

/** Provider-agnostic targeting snapshot stored on audience usages. */
export type AudienceTargetingContext = {
  ageMin?: number | null;
  ageMax?: number | null;
  genders?: string[];
  countries?: string[];
  regions?: string[];
  cities?: string[];
  locales?: string[];
  publisherPlatforms?: string[];
  devicePlatforms?: string[];
  positions?: string[];
};

export function formatAudienceTypeLabel(type: AdAudienceType): string {
  return AUDIENCE_TYPE_LABELS[type] ?? type;
}

export function formatAudienceOriginLabel(originType: string | null | undefined): string {
  if (!originType) return "—";
  return AUDIENCE_ORIGIN_LABELS[originType] ?? originType.replaceAll("_", " ");
}
