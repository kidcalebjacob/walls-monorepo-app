"use client";

import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useCallback, useEffect, useRef, useState } from "react";
import { analyzePartnershipAudience } from "./analyze-partnership-audience";
import type {
  AudiencePartnershipRecord,
  AudienceSocialAccount,
  CompanyAudienceAnalysis,
} from "./audience-analysis.types";
import { buildKnownHashtags } from "./known-hashtags";
import { unwrapRelation } from "./utils";

// Module-level in-memory cache — persists across tab navigation, cleared on page refresh
const inMemoryCompanyAudienceCache = new Map<string, CompanyAudienceAnalysis | null>();

type PartnershipContentRow = {
  platform: string | null;
  post_id: string | null;
  posted_at: string | null;
};

type PartnershipQueryRow = {
  id: string;
  talent_profile_id: string | null;
  profile: {
    country: string | null;
    profile_categories: { name: string | null } | { name: string | null }[] | null;
  } | {
    country: string | null;
    profile_categories: { name: string | null } | { name: string | null }[] | null;
  }[] | null;
  partnership_content: PartnershipContentRow | PartnershipContentRow[] | null;
};

const BATCH_SIZE = 100;

function mapPartnershipRecord(
  partnership: PartnershipQueryRow,
  genderByProfileId: Map<string, string | null>
): AudiencePartnershipRecord {
  const profile = unwrapRelation(partnership.profile);
  const category = unwrapRelation(profile?.profile_categories ?? null);
  const contentItems = Array.isArray(partnership.partnership_content)
    ? partnership.partnership_content
    : partnership.partnership_content
      ? [partnership.partnership_content]
      : [];

  return {
    id: partnership.id,
    talentProfileId: partnership.talent_profile_id,
    talentCategory: category?.name || null,
    talentCountry: profile?.country || null,
    talentGender: partnership.talent_profile_id
      ? (genderByProfileId.get(partnership.talent_profile_id) ?? null)
      : null,
    contentPlatforms: contentItems
      .map((item) => item.platform?.trim() || "")
      .filter(Boolean),
  };
}

export function useCompanyAudienceAnalysis(companyId: string | null | undefined) {
  const { user } = useAuth();
  const cached = companyId ? inMemoryCompanyAudienceCache.get(companyId) : undefined;
  const hasCached = companyId ? inMemoryCompanyAudienceCache.has(companyId) : false;

  const [loading, setLoading] = useState(() => !hasCached);
  const [analysis, setAnalysis] = useState<CompanyAudienceAnalysis | null>(() => cached ?? null);
  const fetchedKeyRef = useRef<string | null>(hasCached && companyId ? companyId : null);

  const fetchAnalysis = useCallback(async () => {
    if (!user || !companyId) {
      setAnalysis(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data: companyRow, error: companyError } = await supabase
        .from("companies")
        .select("name, domain, website")
        .eq("id", companyId)
        .single();

      if (companyError) throw companyError;

      const { data, error } = await supabase
        .from("partnerships")
        .select(`
          id,
          talent_profile_id,
          profile:profiles!partnerships_talent_profile_id_fkey(
            country,
            profile_categories(name)
          ),
          partnership_content:partnership_content(
            platform,
            post_id,
            posted_at
          )
        `)
        .eq("company_id", companyId)
        .not("talent_profile_id", "is", null);

      if (error) throw error;

      const rawRows = (data as PartnershipQueryRow[] | null) ?? [];
      const allProfileIds = Array.from(
        new Set(rawRows.map((r) => r.talent_profile_id).filter(Boolean))
      ) as string[];

      const genderByProfileId = new Map<string, string | null>();
      if (allProfileIds.length > 0) {
        for (let i = 0; i < allProfileIds.length; i += BATCH_SIZE) {
          const batch = allProfileIds.slice(i, i + BATCH_SIZE);
          const { data: peopleRows, error: peopleError } = await supabase
            .from("people")
            .select("profile_id, gender")
            .in("profile_id", batch)
            .not("profile_id", "is", null);

          if (peopleError) throw peopleError;

          for (const row of peopleRows ?? []) {
            if (row.profile_id) {
              genderByProfileId.set(row.profile_id as string, (row.gender as string | null) ?? null);
            }
          }
        }
      }

      const partnerships = rawRows.map((r) => mapPartnershipRecord(r, genderByProfileId));
      if (partnerships.length === 0) {
        setAnalysis(null);
        inMemoryCompanyAudienceCache.set(companyId, null);
        return;
      }

      const profileIds = Array.from(
        new Set(partnerships.map((partnership) => partnership.talentProfileId).filter(Boolean))
      ) as string[];

      let socialAccounts: AudienceSocialAccount[] = [];
      if (profileIds.length > 0) {
        for (let i = 0; i < profileIds.length; i += BATCH_SIZE) {
          const batch = profileIds.slice(i, i + BATCH_SIZE);
          const { data: accountRows, error: accountError } = await supabase
            .from("social_accounts")
            .select("profile_id, platform, followers")
            .in("profile_id", batch);

          if (accountError) throw accountError;

          socialAccounts = [
            ...socialAccounts,
            ...(accountRows ?? []).map((row) => ({
              profileId: row.profile_id as string,
              platform: (row.platform as string) || "Unknown",
              followers: typeof row.followers === "number" ? row.followers : null,
            })),
          ];
        }
      }

      const partnershipRows = (data as PartnershipQueryRow[] | null) ?? [];

      const contentHashtagSources = partnershipRows.flatMap((partnership) => {
        const contentItems = Array.isArray(partnership.partnership_content)
          ? partnership.partnership_content
          : partnership.partnership_content
            ? [partnership.partnership_content]
            : [];

        return contentItems
          .filter((item) => Boolean(item.post_id))
          .map((item) => ({
            postId: item.post_id as string,
            platform: item.platform,
            postedAt: item.posted_at,
          }));
      });

      const postIds = Array.from(
        new Set(contentHashtagSources.map((item) => item.postId)),
      );

      const hashtagsByPostId = new Map<string, string[]>();
      if (postIds.length > 0) {
        for (let i = 0; i < postIds.length; i += BATCH_SIZE) {
          const batch = postIds.slice(i, i + BATCH_SIZE);
          const { data: hashtagRows, error: hashtagError } = await supabase
            .from("post_hashtags")
            .select("post_id, hashtag")
            .in("post_id", batch);

          if (hashtagError) throw hashtagError;

          for (const row of hashtagRows ?? []) {
            const postId = row.post_id as string;
            const hashtag = row.hashtag as string;
            if (!postId || !hashtag) continue;

            const existing = hashtagsByPostId.get(postId) ?? [];
            existing.push(hashtag);
            hashtagsByPostId.set(postId, existing);
          }
        }
      }

      const knownHashtags = buildKnownHashtags(contentHashtagSources, hashtagsByPostId, {
        name: companyRow?.name || "",
        domain: companyRow?.domain ?? null,
        website: companyRow?.website ?? null,
      });
      const hashtags = Array.from(hashtagsByPostId.values()).flat();

      const result = {
        ...analyzePartnershipAudience({
          partnerships,
          socialAccounts,
          hashtags,
        }),
        knownHashtags,
      };
      setAnalysis(result);
      inMemoryCompanyAudienceCache.set(companyId, result);
    } catch (err) {
      console.error("PartnerHub company audience analysis error:", err);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [user, companyId]);

  // Initial load only — skip if cached data was hydrated synchronously on mount,
  // and don't refetch when navigating back to a previously viewed company
  useEffect(() => {
    if (!companyId) {
      setAnalysis(null);
      setLoading(false);
      return;
    }
    if (fetchedKeyRef.current === companyId) return;

    if (inMemoryCompanyAudienceCache.has(companyId)) {
      setAnalysis(inMemoryCompanyAudienceCache.get(companyId) ?? null);
      setLoading(false);
      fetchedKeyRef.current = companyId;
      return;
    }

    if (!user) return;

    fetchedKeyRef.current = companyId;
    setLoading(true);
    fetchAnalysis();
  }, [user, companyId, fetchAnalysis]);

  return { loading, analysis };
}
