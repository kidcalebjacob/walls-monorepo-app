import { getCountryDisplayName } from "@/types/country.types";
import type {
  AudienceDistributionItem,
  AudienceHashtagStat,
  AudiencePartnershipRecord,
  AudiencePlatformReach,
  AudienceSocialAccount,
  CompanyAudienceAnalysis,
} from "./audience-analysis.types";

export const AUDIENCE_CHART_COLORS = [
  "#6eadc0",
  "#8ec4d4",
  "#4e96aa",
  "#ceff00",
  "#5a9ba8",
  "#b8dce6",
  "#3d8496",
  "#d4f066",
] as const;

export function formatAudienceNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString();
}

function countBy(
  items: string[],
  labelFn?: (value: string) => string
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of items) {
    const label = labelFn ? labelFn(raw) : raw;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

function toDistribution(
  counts: Map<string, number>,
  unknownLabel = "Unknown"
): AudienceDistributionItem[] {
  const entries = Array.from(counts.entries())
    .map(([label, value]) => ({ label: label || unknownLabel, value }))
    .sort((a, b) => b.value - a.value);

  const total = entries.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];

  return entries.map((item, index) => ({
    ...item,
    percentage: Math.round((item.value / total) * 100),
    color: AUDIENCE_CHART_COLORS[index % AUDIENCE_CHART_COLORS.length],
  }));
}

function normalizeGender(gender: string | null): string | null {
  if (!gender) return null;
  switch (gender) {
    case "male": return "Male";
    case "female": return "Female";
    case "non_binary": return "Non-binary";
    case "other": return "Other";
    default: return null;
  }
}

function normalizePlatform(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  if (normalized === "youtube") return "YouTube";
  if (normalized === "instagram") return "Instagram";
  if (normalized === "tiktok") return "TikTok";
  if (normalized === "twitter" || normalized === "x") return "X";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildPlatformReach(
  socialAccounts: AudienceSocialAccount[]
): AudiencePlatformReach[] {
  const totals = new Map<string, number>();

  for (const account of socialAccounts) {
    if (!account.followers || account.followers <= 0) continue;
    const label = normalizePlatform(account.platform);
    totals.set(label, (totals.get(label) ?? 0) + account.followers);
  }

  const entries = Array.from(totals.entries())
    .map(([label, followers]) => ({ label, followers }))
    .sort((a, b) => b.followers - a.followers);

  const max = entries[0]?.followers ?? 0;
  if (max === 0) return [];

  return entries.map((entry) => ({
    ...entry,
    percentage: Math.round((entry.followers / max) * 100),
  }));
}

function estimateReach(socialAccounts: AudienceSocialAccount[]): number {
  const bestByProfile = new Map<string, number>();

  for (const account of socialAccounts) {
    if (!account.profileId || !account.followers || account.followers <= 0) continue;
    const current = bestByProfile.get(account.profileId) ?? 0;
    if (account.followers > current) {
      bestByProfile.set(account.profileId, account.followers);
    }
  }

  return Array.from(bestByProfile.values()).reduce((sum, value) => sum + value, 0);
}

function buildHashtagStats(hashtags: string[]): AudienceHashtagStat[] {
  const counts = countBy(hashtags.map((tag) => tag.toLowerCase()));
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];

  return Array.from(counts.entries())
    .map(([tag, count]) => ({
      tag: tag.startsWith("#") ? tag : `#${tag}`,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function buildInsights(analysis: Omit<CompanyAudienceAnalysis, "insights">): string[] {
  const insights: string[] = [];

  if (analysis.partnerCount > 0) {
    insights.push(
      `Based on ${analysis.partnerCount} partnered talent${analysis.partnerCount === 1 ? "" : "s"} and ${analysis.totalContentPieces} sponsored content piece${analysis.totalContentPieces === 1 ? "" : "s"}.`
    );
  }

  const topNiche = analysis.nicheDistribution[0];
  const secondNiche = analysis.nicheDistribution[1];
  if (topNiche) {
    insights.push(
      secondNiche
        ? `${topNiche.percentage}% of partners sit in ${topNiche.label}, with ${secondNiche.label} as the next strongest niche at ${secondNiche.percentage}%.`
        : `${topNiche.percentage}% of partners sit in ${topNiche.label}.`
    );
  }

  const topCountry = analysis.geographyDistribution[0];
  const secondCountry = analysis.geographyDistribution[1];
  if (topCountry) {
    insights.push(
      secondCountry
        ? `Primary talent markets skew toward ${topCountry.label} (${topCountry.percentage}%) and ${secondCountry.label} (${secondCountry.percentage}%).`
        : `Primary talent market skews toward ${topCountry.label} (${topCountry.percentage}%).`
    );
  }

  const topPlatform = analysis.platformDistribution[0];
  if (topPlatform) {
    insights.push(
      `${topPlatform.label} accounts for ${topPlatform.percentage}% of sponsored content across this partner set.`
    );
  }

  if (analysis.estimatedReach > 0) {
    insights.push(
      `Estimated combined audience reach across partnered talent is ~${formatAudienceNumber(analysis.estimatedReach)} (using best platform per talent).`
    );
  }

  const topHashtag = analysis.topHashtags[0];
  if (topHashtag) {
    insights.push(
      `Recurring content themes include ${topHashtag.tag}, appearing in ${topHashtag.percentage}% of tagged posts.`
    );
  }

  return insights.slice(0, 5);
}

export function analyzePartnershipAudience({
  partnerships,
  socialAccounts,
  hashtags,
}: {
  partnerships: AudiencePartnershipRecord[];
  socialAccounts: AudienceSocialAccount[];
  hashtags: string[];
}): CompanyAudienceAnalysis | null {
  if (partnerships.length === 0) return null;

  const platformItems = partnerships.flatMap((partnership) =>
    partnership.contentPlatforms.map(normalizePlatform)
  );
  const nicheItems = partnerships
    .map((partnership) => partnership.talentCategory?.trim() || "Uncategorized")
    .filter(Boolean);
  const countryItems = partnerships
    .map((partnership) =>
      partnership.talentCountry
        ? getCountryDisplayName(partnership.talentCountry)
        : "Unknown"
    )
    .filter(Boolean);
  const genderItems = partnerships
    .map((partnership) => normalizeGender(partnership.talentGender))
    .filter((g): g is string => g !== null);

  const platformDistribution = toDistribution(countBy(platformItems));
  const nicheDistribution = toDistribution(countBy(nicheItems));
  const geographyDistribution = toDistribution(countBy(countryItems));
  const genderDistribution = toDistribution(countBy(genderItems));
  const platformReach = buildPlatformReach(socialAccounts);
  const topHashtags = buildHashtagStats(hashtags);
  const estimatedReach = estimateReach(socialAccounts);
  const totalContentPieces = platformItems.length;

  const base = {
    partnerCount: partnerships.length,
    totalContentPieces,
    estimatedReach,
    platformDistribution,
    nicheDistribution,
    geographyDistribution,
    genderDistribution,
    platformReach,
    topHashtags,
    knownHashtags: [],
    insights: [] as string[],
  };

  return {
    ...base,
    insights: buildInsights(base),
  };
}
