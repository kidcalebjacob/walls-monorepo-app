import {
  isLikelyCampaignHashtag,
  sortHashtagsByCampaignLikelihood,
  type CampaignHashtagCompanyContext,
} from "@/lib/campaign-hashtag-sort";
import type { AudienceKnownHashtag } from "./audience-analysis.types";

export type AudienceContentHashtagSource = {
  postId: string;
  platform: string | null;
  postedAt: string | null;
};

export function buildKnownHashtags(
  contentItems: AudienceContentHashtagSource[],
  hashtagsByPostId: Map<string, string[]>,
  company?: CampaignHashtagCompanyContext,
): AudienceKnownHashtag[] {
  const byTag = new Map<string, { platforms: Set<string>; postedAts: string[] }>();

  for (const item of contentItems) {
    if (!item.postId) continue;

    for (const tag of hashtagsByPostId.get(item.postId) ?? []) {
      if (!tag) continue;

      if (!byTag.has(tag)) {
        byTag.set(tag, { platforms: new Set(), postedAts: [] });
      }

      const entry = byTag.get(tag)!;
      if (item.platform) {
        entry.platforms.add(item.platform.toLowerCase());
      }
      if (item.postedAt) {
        entry.postedAts.push(item.postedAt);
      }
    }
  }

  const hashtags = Array.from(byTag.entries()).map(([tag, { platforms, postedAts }]) => ({
    tag,
    platforms: Array.from(platforms),
    postedAts,
    isLikelyCampaign: company?.name?.trim()
      ? isLikelyCampaignHashtag(tag, company)
      : false,
  }));

  if (company?.name?.trim()) {
    return sortHashtagsByCampaignLikelihood(hashtags, company);
  }

  return hashtags.sort((a, b) => a.tag.localeCompare(b.tag));
}
