import type { RepresentationContractType } from "@/lib/representation/contract-type";

export interface TalentDetail {
  id: string;
  name: string;
  about: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  category: string | null;
  slug: string | null;
  /** Canonical public handle for /representation/{handle} (Instagram username). */
  instagram_username: string | null;
  walls_email: string | null;
  contract_type: RepresentationContractType;
  socialAccounts: {
    platform: string;
    username: string | null;
    url: string;
    followers: number | null;
    avg_likes?: number | null;
    avg_comments?: number | null;
    avg_views?: number | null;
    engagement_rate?: number | null;
  }[];
}

export interface RelatedTalentCard {
  id: string;
  name: string;
  avatar_url: string | null;
  category: string | null;
  representation_path: string;
  instagram_username: string | null;
}
