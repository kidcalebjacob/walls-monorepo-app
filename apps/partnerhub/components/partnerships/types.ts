export interface PartnershipContent {
  id: string;
  platform: string;
  postedAt: string;
  contentUrl: string;
  postId: string;
}

export interface PartnershipHashtagDetail {
  tag: string;
  platforms: string[];
  postedAts: string[];
}

export interface Partnership {
  id: string;
  talentName: string;
  talentProfileId?: string;
  talentAvatar?: string;
  talentHq?: string;
  talentCategory?: string;
  company: string;
  companyId?: string;
  companyLogo?: string;
  companyWebsite?: string;
  contentItems: PartnershipContent[]; // Array of content items
  platform: string; // From the most recent content item (for display)
  postedAt: string | null; // partnerships.last_post_at
  partnershipUrl: string | null; // partnerships.video_url, fallback to latest content URL
  createdAt: string | null;
  taggedHandle?: string;
  hashtags: string[];
  hashtagDetails: PartnershipHashtagDetail[];
}

export type PartnershipSortField = "lastPost" | "createdAt" | "talentName";

export type PartnershipSortDirection = "asc" | "desc";

export interface Filters {
  platform: string;
  searchTerm: string;
  talentHq: string;
  talentCategory: string;
}

export interface ImageStates {
  [partnershipId: string]: {
    profileFailed: boolean;
    companyFailed: boolean;
  };
}

