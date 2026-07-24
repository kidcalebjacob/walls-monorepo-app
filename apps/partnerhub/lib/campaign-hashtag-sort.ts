export type CampaignHashtagCompanyContext = {
  name?: string | null;
  website?: string | null;
  domain?: string | null;
};

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]/g, "");
}

function companyTokens(company: CampaignHashtagCompanyContext): string[] {
  const tokens = new Set<string>();
  for (const raw of [company.name, company.website, company.domain]) {
    if (!raw?.trim()) continue;
    const cleaned = raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(/[\s./\-_]+/)
      .map(normalizeToken)
      .filter((token) => token.length >= 3);
    for (const token of cleaned) tokens.add(token);
  }
  return Array.from(tokens);
}

export function isLikelyCampaignHashtag(
  tag: string,
  company: CampaignHashtagCompanyContext,
): boolean {
  const normalizedTag = normalizeToken(tag);
  if (!normalizedTag) return false;
  return companyTokens(company).some(
    (token) =>
      normalizedTag.includes(token) || token.includes(normalizedTag),
  );
}

export function sortHashtagsByCampaignLikelihood<
  T extends { tag: string; isLikelyCampaign?: boolean },
>(hashtags: T[], company: CampaignHashtagCompanyContext): T[] {
  return [...hashtags].sort((left, right) => {
    const leftLikely =
      left.isLikelyCampaign ?? isLikelyCampaignHashtag(left.tag, company);
    const rightLikely =
      right.isLikelyCampaign ?? isLikelyCampaignHashtag(right.tag, company);
    if (leftLikely !== rightLikely) return leftLikely ? -1 : 1;
    return left.tag.localeCompare(right.tag);
  });
}
