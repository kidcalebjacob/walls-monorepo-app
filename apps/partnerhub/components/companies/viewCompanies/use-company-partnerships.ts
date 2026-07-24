"use client";

import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanyPartnership } from "./types";
import { formatPlatformLabel, unwrapRelation } from "./utils";

// Module-level in-memory cache — persists across tab navigation, cleared on page refresh
const inMemoryCompanyPartnershipsCache = new Map<string, CompanyPartnership[]>();

type PartnershipContentRow = {
  id: string;
  platform: string | null;
  posted_at: string | null;
  content_url: string | null;
};

type PartnershipQueryRow = {
  id: string;
  talent_name: string | null;
  talent_profile_id: string | null;
  last_post_at: string | null;
  video_url: string | null;
  profile: {
    avatar_url: string | null;
    country: string | null;
    profile_categories: { name: string | null } | { name: string | null }[] | null;
  } | {
    avatar_url: string | null;
    country: string | null;
    profile_categories: { name: string | null } | { name: string | null }[] | null;
  }[] | null;
  partnership_content: PartnershipContentRow | PartnershipContentRow[] | null;
};

function mapPartnershipRow(partnership: PartnershipQueryRow): CompanyPartnership {
  const profile = unwrapRelation(partnership.profile);
  const category = unwrapRelation(profile?.profile_categories ?? null);
  const contentItems = Array.isArray(partnership.partnership_content)
    ? partnership.partnership_content
    : partnership.partnership_content
      ? [partnership.partnership_content]
      : [];

  const sortedContent = [...contentItems].sort((a, b) => {
    const aTime = a.posted_at ? new Date(a.posted_at).getTime() : 0;
    const bTime = b.posted_at ? new Date(b.posted_at).getTime() : 0;
    return bTime - aTime;
  });

  const mostRecent = sortedContent[0];
  const platform = formatPlatformLabel(mostRecent?.platform ?? null);

  return {
    id: partnership.id,
    talentName: partnership.talent_name || "Unknown",
    talentAvatar: profile?.avatar_url || null,
    talentCategory: category?.name || null,
    talentCountry: profile?.country || null,
    platform,
    contentCount: contentItems.length,
    lastPostedAt: partnership.last_post_at || mostRecent?.posted_at || null,
    contentUrl: partnership.video_url || mostRecent?.content_url || null,
  };
}

export function useCompanyPartnerships(companyId: string | null | undefined) {
  const { user } = useAuth();
  const cached = companyId ? inMemoryCompanyPartnershipsCache.get(companyId) : undefined;

  const [loading, setLoading] = useState(() => !cached);
  const [partnerships, setPartnerships] = useState<CompanyPartnership[]>(() => cached ?? []);
  const fetchedKeyRef = useRef<string | null>(cached && companyId ? companyId : null);

  const fetchPartnerships = useCallback(async () => {
    if (!user || !companyId) {
      setPartnerships([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("partnerships")
        .select(`
          id,
          talent_name,
          talent_profile_id,
          last_post_at,
          video_url,
          profile:profiles!partnerships_talent_profile_id_fkey(
            avatar_url,
            country,
            profile_categories(name)
          ),
          partnership_content:partnership_content(
            id,
            platform,
            posted_at,
            content_url
          )
        `)
        .eq("company_id", companyId)
        .not("talent_profile_id", "is", null)
        .order("last_post_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const list = (data as PartnershipQueryRow[] | null)?.map(mapPartnershipRow) ?? [];
      setPartnerships(list);
      inMemoryCompanyPartnershipsCache.set(companyId, list);
    } catch (err) {
      console.error("PartnerHub company partnerships error:", err);
      setPartnerships([]);
    } finally {
      setLoading(false);
    }
  }, [user, companyId]);

  // Initial load only — skip if cached data was hydrated synchronously on mount,
  // and don't refetch when navigating back to a previously viewed company
  useEffect(() => {
    if (!companyId) {
      setPartnerships([]);
      setLoading(false);
      return;
    }
    if (fetchedKeyRef.current === companyId) return;

    const cachedPartnerships = inMemoryCompanyPartnershipsCache.get(companyId);
    if (cachedPartnerships) {
      setPartnerships(cachedPartnerships);
      setLoading(false);
      fetchedKeyRef.current = companyId;
      return;
    }

    if (!user) return;

    fetchedKeyRef.current = companyId;
    setLoading(true);
    fetchPartnerships();
  }, [user, companyId, fetchPartnerships]);

  return { loading, partnerships };
}
