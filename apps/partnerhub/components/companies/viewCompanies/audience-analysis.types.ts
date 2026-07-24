export type AudienceDistributionItem = {
  label: string;
  value: number;
  percentage: number;
  color: string;
};

export type AudiencePlatformReach = {
  label: string;
  followers: number;
  percentage: number;
};

export type AudienceHashtagStat = {
  tag: string;
  count: number;
  percentage: number;
};

export type AudienceKnownHashtag = {
  tag: string;
  platforms: string[];
  postedAts: string[];
  isLikelyCampaign?: boolean;
};

export type CompanyAudienceAnalysis = {
  partnerCount: number;
  totalContentPieces: number;
  estimatedReach: number;
  platformDistribution: AudienceDistributionItem[];
  nicheDistribution: AudienceDistributionItem[];
  geographyDistribution: AudienceDistributionItem[];
  genderDistribution: AudienceDistributionItem[];
  platformReach: AudiencePlatformReach[];
  topHashtags: AudienceHashtagStat[];
  knownHashtags: AudienceKnownHashtag[];
  insights: string[];
};

export type AudiencePartnershipRecord = {
  id: string;
  talentProfileId: string | null;
  talentCategory: string | null;
  talentCountry: string | null;
  talentGender: string | null;
  contentPlatforms: string[];
};

export type AudienceSocialAccount = {
  profileId: string;
  platform: string;
  followers: number | null;
};
