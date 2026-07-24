"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { PartnerHubSkeleton } from "@/components/ui/partnerhub-skeleton";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { MobileFAB } from "@/components/ui/mobile-fab";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import EditAgentCompanies from "@/components/agentCRM/agentCompanies/view/view-agent-companies";
import ViewPartnership from "./view/view-partnership";
import { createClient } from '@supabase/supabase-js';
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import { PartnershipsTableToolbar } from "./table/partnerships-table-toolbar";
import { PartnershipsTableHeader } from "./table/partnerships-table-header";
import { PartnershipsTableRow } from "./table/partnerships-table-row";
import {
  Partnership,
  PartnershipContent,
  PartnershipHashtagDetail,
  Filters,
  ImageStates,
  PartnershipSortDirection,
  PartnershipSortField,
} from "./types";
import { PartnerHubFilter } from "@/components/filters/partnerhub-filter";
import { fetchCompanySocialUrls } from "@/lib/company-social";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


const ITEMS_PER_PAGE = 50;

interface PartnershipsListCache {
  partnerships: Partnership[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  availableHqs: string[];
  availableCategories: string[];
  filters: Filters;
}

// Module-level in-memory cache — persists across tab navigation, cleared on page refresh
let inMemoryPartnershipsCache: PartnershipsListCache | null = null;

// Cache keys and expiry time
const PARTNERSHIPS_CACHE_KEY = 'walls-partnerships-cache';
const PARTNERSHIPS_CACHE_TIMESTAMP_KEY = 'walls-partnerships-cache-timestamp';

const EMPTY_FILTERS: Filters = {
  platform: "",
  searchTerm: "",
  talentHq: "",
  talentCategory: "",
};

function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.platform === b.platform &&
    a.searchTerm === b.searchTerm &&
    a.talentHq === b.talentHq &&
    a.talentCategory === b.talentCategory
  );
}

function buildPartnershipsUrl(filters: Filters, page: number): string {
  const query = new URLSearchParams();
  if (page !== 1) query.set("page", page.toString());
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "") query.set(key, value);
  });
  return query.toString() ? `?${query.toString()}` : "";
}

function readLocalPartnershipsCache(): PartnershipsListCache | null {
  try {
    const cachedData = localStorage.getItem(PARTNERSHIPS_CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(PARTNERSHIPS_CACHE_TIMESTAMP_KEY);
    if (!cachedData || !cachedTimestamp) return null;

    const cacheAge = Date.now() - parseInt(cachedTimestamp, 10);
    if (cacheAge >= 5000) return null;

    const parsed = JSON.parse(cachedData);
    if (parsed && Array.isArray(parsed.partnerships)) {
      return {
        ...parsed,
        filters: parsed.filters ?? EMPTY_FILTERS,
      } as PartnershipsListCache;
    }
    if (Array.isArray(parsed)) {
      return {
        partnerships: parsed as Partnership[],
        currentPage: 1,
        totalPages: 1,
        totalItems: parsed.length,
        availableHqs: [],
        availableCategories: [],
        filters: EMPTY_FILTERS,
      };
    }
  } catch (error) {
    console.error("Error loading cached partnerships data:", error);
  }
  return null;
}

function writePartnershipsCache(cache: PartnershipsListCache) {
  inMemoryPartnershipsCache = cache;
  try {
    localStorage.setItem(PARTNERSHIPS_CACHE_KEY, JSON.stringify(cache));
    localStorage.setItem(PARTNERSHIPS_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error("Error caching partnerships data:", error);
  }
}

interface PartnerHubPartnershipsProps {
  analyticsData: any;
}

const ensureHttps = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

function PartnerHubPartnershipsContent({ analyticsData }: PartnerHubPartnershipsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = user?.id;

  const initialFilters: Filters = {
    platform: searchParams.get("platform") || "",
    searchTerm: searchParams.get("searchTerm") || "",
    talentHq: searchParams.get("talentHq") || "",
    talentCategory: searchParams.get("talentCategory") || "",
  };
  const cacheMatchesFilters =
    !!inMemoryPartnershipsCache && filtersEqual(inMemoryPartnershipsCache.filters, initialFilters);

  const [partnerships, setPartnerships] = useState<Partnership[]>(
    () => (cacheMatchesFilters ? inMemoryPartnershipsCache!.partnerships : [])
  );
  const [currentPage, setCurrentPage] = useState(
    () => (cacheMatchesFilters ? inMemoryPartnershipsCache!.currentPage : parseInt(searchParams.get("page") || "1", 10))
  );
  const [totalPages, setTotalPages] = useState(
    () => (cacheMatchesFilters ? inMemoryPartnershipsCache!.totalPages : 1)
  );
  const [loading, setLoading] = useState(() => !cacheMatchesFilters);
  const [totalItems, setTotalItems] = useState(
    () => (cacheMatchesFilters ? inMemoryPartnershipsCache!.totalItems : 0)
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [imageStates, setImageStates] = useState<ImageStates>({});
  const [availableHqs, setAvailableHqs] = useState<string[]>(
    () => (cacheMatchesFilters ? inMemoryPartnershipsCache!.availableHqs : [])
  );
  const [availableCategories, setAvailableCategories] = useState<string[]>(
    () => (cacheMatchesFilters ? inMemoryPartnershipsCache!.availableCategories : [])
  );

  const [sortBy, setSortBy] = useState<PartnershipSortField>("lastPost");
  const [sortDirection, setSortDirection] = useState<PartnershipSortDirection>("desc");

  // Column width state - single source of truth
  const [columnWidths, setColumnWidths] = useState({
    name: 250,
    talentHq: 150,
    talentCategory: 170,
    company: 200,
    platform: 150,
    postedAt: 150,
    createdAt: 150,
    hashtags: 280,
    partnershipUrl: 200,
  });
  const scrollableRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const hasInitialFetchRef = useRef(cacheMatchesFilters);
  const skipFilterEffectRef = useRef(true);
  const skipSortEffectRef = useRef(true);
  const fetchRequestIdRef = useRef(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyData, setSelectedCompanyData] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loadingCompanyData, setLoadingCompanyData] = useState(false);
  const [companySelectOpenId, setCompanySelectOpenId] = useState<string | null>(null);
  const [selectedPartnership, setSelectedPartnership] = useState<Partnership | null>(null);
  const [isPartnershipSheetOpen, setIsPartnershipSheetOpen] = useState(false);
  const [updatingPartnershipIds, setUpdatingPartnershipIds] = useState<Set<string>>(
    new Set()
  );

  const fetchPartnerships = async (pageNumber: number = 1) => {
    const requestId = ++fetchRequestIdRef.current;

    if (!user) {
      console.log('No user authenticated, skipping fetch');
      setLoading(false);
      return;
    }

    // Fallback: check localStorage cache if very fresh (< 5 seconds), prevents blink on hard reload
    if (!hasInitialFetchRef.current) {
      const localCache = readLocalPartnershipsCache();
      if (localCache && filtersEqual(localCache.filters, filters)) {
        setPartnerships(localCache.partnerships);
        setCurrentPage(localCache.currentPage);
        setTotalPages(localCache.totalPages);
        setTotalItems(localCache.totalItems);
        setAvailableHqs(localCache.availableHqs);
        setAvailableCategories(localCache.availableCategories);
        setLoading(false);
        hasInitialFetchRef.current = true;
        writePartnershipsCache(localCache);
        return;
      }
    }

    setLoading(true);
    try {
      // Get authenticated Supabase client
      const supabase = getSupabaseClient();
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        console.error('No Supabase session found');
        wallsToast.error("Authentication Error", "Please log in to view partnerships");
        setLoading(false);
        return;
      }
      
      // Build the query - fetch partnerships with joins to companies, profiles, and partnership_content
      let query = supabase
        .from('partnerships')
        .select(`
          id,
          talent_name,
          talent_profile_id,
          company_name,
          company_id,
          created_at,
          last_post_at,
          video_url,
          tagged_handle,
          company:companies!partnerships_company_id_fkey(
            name,
            logo_url,
            website
          ),
          profile:profiles!partnerships_talent_profile_id_fkey(
            avatar_url,
            country,
            profile_categories(name)
          ),
          partnership_content:partnership_content(
            id,
            platform,
            posted_at,
            content_url,
            post_id
          )
        `, { count: 'exact' });

      // Platform filter is applied in memory after fetching content

      query = query.order('last_post_at', { ascending: false, nullsFirst: false });

      // Don't apply pagination yet - we need to filter in memory first
      query = query.limit(10000); // Set a reasonable limit

      // Execute query
      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log(`Fetched ${data?.length || 0} partnerships from Supabase`);

      // Get profile IDs for social accounts query
      const profileIds = (data || [])
        .map((p: any) => p.talent_profile_id)
        .filter(Boolean) as string[];

      // Fetch social accounts for all profiles to get YouTube profile pictures
      // Supabase has a limit on .in() queries (typically 100 items), so we need to batch if needed
      const BATCH_SIZE = 100;
      let allSocialAccounts: any[] = [];
      
      if (profileIds.length > 0) {
        for (let i = 0; i < profileIds.length; i += BATCH_SIZE) {
          const batch = profileIds.slice(i, i + BATCH_SIZE);
          const { data: socialAccountsData, error: socialError } = await supabase
            .from('social_accounts')
            .select('*')
            .in('profile_id', batch);
          
          if (socialError) {
            console.error(`Error fetching social accounts (batch ${i / BATCH_SIZE + 1}):`, socialError);
          } else if (socialAccountsData) {
            allSocialAccounts = [...allSocialAccounts, ...socialAccountsData];
          }
        }
      }

      // Create a map of profile_id to social accounts
      const socialAccountsMap = new Map<string, any[]>();
      allSocialAccounts.forEach((account) => {
        if (!account.profile_id) {
          return;
        }
        if (!socialAccountsMap.has(account.profile_id)) {
          socialAccountsMap.set(account.profile_id, []);
        }
        socialAccountsMap.get(account.profile_id)!.push(account);
      });

      // Collect post IDs from partnership_content and load hashtags from post_hashtags
      const seenPostIds = new Set<string>();
      const allPostIds: string[] = [];
      (data || []).forEach((p: any) => {
        (p.partnership_content || []).forEach((c: any) => {
          const postId = c.post_id as string | undefined;
          if (postId && !seenPostIds.has(postId)) {
            seenPostIds.add(postId);
            allPostIds.push(postId);
          }
        });
      });

      const hashtagsByPostId = new Map<string, string[]>();
      if (allPostIds.length > 0) {
        for (let i = 0; i < allPostIds.length; i += BATCH_SIZE) {
          const batch = allPostIds.slice(i, i + BATCH_SIZE);
          const { data: hashtagRows, error: hashtagError } = await supabase
            .from('post_hashtags')
            .select('post_id, hashtag')
            .in('post_id', batch);

          if (hashtagError) {
            console.error(`Error fetching post hashtags (batch ${i / BATCH_SIZE + 1}):`, hashtagError);
          } else if (hashtagRows) {
            hashtagRows.forEach((row: { post_id: string; hashtag: string }) => {
              if (!hashtagsByPostId.has(row.post_id)) {
                hashtagsByPostId.set(row.post_id, []);
              }
              hashtagsByPostId.get(row.post_id)!.push(row.hashtag);
            });
          }
        }
      }

      const getPartnershipHashtagDetails = (
        contentItems: PartnershipContent[]
      ): PartnershipHashtagDetail[] => {
        const byTag = new Map<
          string,
          { platforms: Set<string>; postedAts: string[] }
        >();

        contentItems.forEach((item) => {
          (hashtagsByPostId.get(item.postId) || []).forEach((tag) => {
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
          });
        });

        return Array.from(byTag.entries())
          .map(([tag, { platforms, postedAts }]) => ({
            tag,
            platforms: Array.from(platforms),
            postedAts,
          }))
          .sort((a, b) => a.tag.localeCompare(b.tag));
      };

      // Create a map of profile_id -> YouTube profile picture URL
      let youtubeProfilePicMap = new Map<string, string>();
      socialAccountsMap.forEach((accounts, profileId) => {
        accounts.forEach((account: any) => {
          const platform = account.platform?.toLowerCase();
          if (platform === 'youtube') {
            // Check for YouTube profile picture URL (may be stored as profile_pic_url, avatar_url, or similar)
            const youtubePicUrl = account.profile_pic_url || account.avatar_url || account.profile_picture_url || null;
            if (youtubePicUrl) {
              youtubeProfilePicMap.set(profileId, youtubePicUrl);
            }
          }
        });
      });

      // Transform partnerships - keep one row per partnership with all content items
      let partnershipsData: Partnership[] = [];
      
      (data || []).forEach((partnership: any) => {
        // Determine the best profile picture URL with fallback chain:
        // 1. profiles.avatar_url (primary)
        // 2. YouTube social account profile picture (unexpiring URLs)
        let finalProfilePictureUrl = partnership.profile?.avatar_url || '';
        if (!finalProfilePictureUrl && partnership.talent_profile_id) {
          const youtubePicUrl = youtubeProfilePicMap.get(partnership.talent_profile_id);
          if (youtubePicUrl) {
            finalProfilePictureUrl = youtubePicUrl;
          }
        }

        // Transform content items
        const contentItems: PartnershipContent[] = (partnership.partnership_content || [])
          .map((content: any) => ({
            id: content.id,
            platform: content.platform,
            postedAt: content.posted_at,
            contentUrl: content.content_url,
            postId: content.post_id,
          }))
          .sort((a: PartnershipContent, b: PartnershipContent) => {
            // Sort by posted_at descending (most recent first)
            const aTime = new Date(a.postedAt).getTime();
            const bTime = new Date(b.postedAt).getTime();
            return bTime - aTime;
          });

        const mostRecentContent = contentItems.length > 0 ? contentItems[0] : null;

        partnershipsData.push({
          id: partnership.id,
          talentName: partnership.talent_name || '—',
          talentProfileId: partnership.talent_profile_id || undefined,
          talentAvatar: finalProfilePictureUrl || undefined,
          talentHq: partnership.profile?.country || undefined,
          talentCategory: partnership.profile?.profile_categories?.name || undefined,
          company: partnership.company?.name || partnership.company_name || '—',
          companyId: partnership.company_id || undefined,
          companyLogo: partnership.company?.logo_url || undefined,
          companyWebsite: partnership.company?.website || undefined,
          contentItems: contentItems,
          platform: mostRecentContent?.platform || '—',
          postedAt: partnership.last_post_at || null,
          partnershipUrl: partnership.video_url || mostRecentContent?.contentUrl || null,
          createdAt: partnership.created_at || null,
          taggedHandle: partnership.tagged_handle || undefined,
          hashtagDetails: getPartnershipHashtagDetails(contentItems),
          hashtags: getPartnershipHashtagDetails(contentItems).map((d) => d.tag),
        });
      });

      // Derive available filter options from the full unfiltered dataset
      const hqSet = new Set<string>();
      const categorySet = new Set<string>();
      partnershipsData.forEach((p) => {
        if (p.talentHq) hqSet.add(p.talentHq);
        if (p.talentCategory) categorySet.add(p.talentCategory);
      });
      const sortedHqs = Array.from(hqSet).sort();
      const sortedCategories = Array.from(categorySet).sort();
      setAvailableHqs(sortedHqs);
      setAvailableCategories(sortedCategories);

      // Apply platform filter in memory (check if any content item matches)
      if (filters.platform) {
        partnershipsData = partnershipsData.filter(partnership =>
          partnership.contentItems.some(content =>
            content.platform?.toLowerCase() === filters.platform.toLowerCase()
          )
        );
      }

      // Apply talent HQ filter
      if (filters.talentHq) {
        partnershipsData = partnershipsData.filter(p =>
          p.talentHq?.toLowerCase() === filters.talentHq.toLowerCase()
        );
      }

      // Apply talent category filter
      if (filters.talentCategory) {
        partnershipsData = partnershipsData.filter(p =>
          p.talentCategory?.toLowerCase() === filters.talentCategory.toLowerCase()
        );
      }

      // Apply search filter in memory
      if (filters.searchTerm) {
        const searchTerms = filters.searchTerm.toLowerCase().split(' ');
        partnershipsData = partnershipsData.filter(partnership => {
          return searchTerms.every(term => {
            const matchesTalentName = partnership.talentName?.toLowerCase().includes(term);
            const matchesCompany = partnership.company?.toLowerCase().includes(term);
            const matchesPlatform = partnership.contentItems.some(content => 
              content.platform?.toLowerCase().includes(term)
            );
            const matchesTaggedHandle = partnership.taggedHandle?.toLowerCase().includes(term);
            const matchesHashtags = partnership.hashtags.some((tag) =>
              tag.toLowerCase().includes(term)
            );
            
            return matchesTalentName || matchesCompany || matchesPlatform || matchesTaggedHandle || matchesHashtags;
          });
        });
      }

      partnershipsData.sort((a, b) => {
        const directionMultiplier = sortDirection === "asc" ? 1 : -1;

        if (sortBy === "talentName") {
          return (
            directionMultiplier *
            (a.talentName || "").localeCompare(b.talentName || "", undefined, {
              sensitivity: "base",
            })
          );
        }

        const getDateValue = (partnership: Partnership) => {
          const dateString =
            sortBy === "createdAt" ? partnership.createdAt : partnership.postedAt;
          if (!dateString) return null;
          const time = new Date(dateString).getTime();
          return Number.isNaN(time) ? null : time;
        };

        const aDate = getDateValue(a);
        const bDate = getDateValue(b);

        if (aDate === null && bDate === null) return 0;
        if (aDate === null) return 1;
        if (bDate === null) return -1;

        return directionMultiplier * (aDate - bDate);
      });

      // A newer fetch was kicked off while this one was in flight (e.g. the user
      // kept typing in the search box) — drop these results so the list never
      // flickers between stale and fresh result sets.
      if (fetchRequestIdRef.current !== requestId) {
        return;
      }

      // Calculate total pages based on filtered data
      const filteredTotal = partnershipsData.length;
      const totalPages = Math.ceil(filteredTotal / ITEMS_PER_PAGE);
      setTotalPages(totalPages);
      setTotalItems(filteredTotal);

      // Get the current page's data (paginate after filtering)
      const startIndex = (pageNumber - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const pageData = partnershipsData.slice(startIndex, endIndex);

      setPartnerships(pageData);
      setCurrentPage(pageNumber);
      hasInitialFetchRef.current = true;

      writePartnershipsCache({
        partnerships: pageData,
        currentPage: pageNumber,
        totalPages,
        totalItems: filteredTotal,
        availableHqs: sortedHqs,
        availableCategories: sortedCategories,
        filters,
      });
    } catch (error) {
      console.error("Error fetching partnerships:", error);
      wallsToast.error("Error", "Failed to load partnerships data");
    } finally {
      if (fetchRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  // Initial load only — skip if in-memory cache was hydrated synchronously on mount
  useEffect(() => {
    if (!userId) return;
    if (cacheMatchesFilters) {
      hasInitialFetchRef.current = true;
      return;
    }
    if (hasInitialFetchRef.current) return;
    fetchPartnerships(currentPage);
  }, [userId]);

  // Re-fetch only when filters change after mount, not when returning to this tab
  useEffect(() => {
    if (!userId) return;
    if (skipFilterEffectRef.current) {
      skipFilterEffectRef.current = false;
      return;
    }
    if (!hasInitialFetchRef.current) return;
    fetchPartnerships(1);
  }, [filters, userId]);

  useEffect(() => {
    if (!userId) return;
    if (skipSortEffectRef.current) {
      skipSortEffectRef.current = false;
      return;
    }
    if (!hasInitialFetchRef.current) return;
    fetchPartnerships(1);
  }, [sortBy, sortDirection]);

  useLayoutEffect(() => {
    const syncScrollPositions = () => {
      const headerScrollLeft = headerScrollRef.current?.scrollLeft ?? 0;
      scrollableRefs.current.forEach((ref) => {
        if (ref) ref.scrollLeft = headerScrollLeft;
      });
    };

    const raf = requestAnimationFrame(syncScrollPositions);
    return () => cancelAnimationFrame(raf);
  }, [partnerships, columnWidths]);

  // Single wheel-event handler that syncs ALL scroll containers simultaneously.
  // Rows and header use overflow-x-hidden so only this handler drives horizontal scroll —
  // no per-row onScroll races possible.
  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      const hasDeltaX = Math.abs(e.deltaX) > 0;
      const hasShiftY = e.shiftKey && Math.abs(e.deltaY) > 0;
      if (!hasDeltaX && !hasShiftY) return;

      e.preventDefault();

      const rawDelta = hasDeltaX ? e.deltaX : e.deltaY;
      const pixelDelta = e.deltaMode === 1 ? rawDelta * 40 : rawDelta;

      const sourceRef =
        headerScrollRef.current ?? scrollableRefs.current.find((r) => r != null) ?? null;
      if (!sourceRef) return;

      const maxScroll = sourceRef.scrollWidth - sourceRef.clientWidth;
      const newScrollLeft = Math.max(0, Math.min(maxScroll, sourceRef.scrollLeft + pixelDelta));

      if (headerScrollRef.current) headerScrollRef.current.scrollLeft = newScrollLeft;
      scrollableRefs.current.forEach((ref) => {
        if (ref) ref.scrollLeft = newScrollLeft;
      });
    };

    wrapper.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePageChange = (page: number) => {
    setLoading(true);
    fetchPartnerships(page);
    router.replace(`/deal-board${buildPartnershipsUrl(filters, page)}`);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatPlatform = (platform: string | null | undefined) => {
    if (!platform) return '—';
    const platformLower = platform.toLowerCase();
    switch (platformLower) {
      case 'instagram':
        return 'Instagram';
      case 'youtube':
        return 'YouTube';
      case 'tiktok':
        return 'TikTok';
      default:
        // Capitalize first letter for other platforms
        return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
    }
  };

  const getPlatformIcon = (platform: string | null | undefined) => {
    if (!platform) return null;
    const platformLower = platform.toLowerCase();
    switch (platformLower) {
      case 'instagram':
        return <FaInstagram className="w-4 h-4 text-pink-500 flex-shrink-0" />;
      case 'youtube':
        return <FaYoutube className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'tiktok':
        return <FaTiktok className="w-4 h-4 text-black flex-shrink-0" />;
      default:
        return null;
    }
  };

  const handleImageError = (partnershipId: string, type: 'profile' | 'company') => {
    setImageStates(prev => ({
      ...prev,
      [partnershipId]: {
        ...prev[partnershipId] || { profileFailed: false, companyFailed: false },
        [type === 'profile' ? 'profileFailed' : 'companyFailed']: true
      }
    }));
  };


  const handleFilterChange = (filterKey: string, value: string) => {
    const updatedFilters = { ...filters, [filterKey]: value };
    setFilters(updatedFilters);
    setCurrentPage(1);
    router.replace(`/deal-board${buildPartnershipsUrl(updatedFilters, 1)}`);
  };

  const handlePartnershipCompanyUpdate = async (
    partnershipId: string,
    company: { id: string; name: string; logo_url?: string | null }
  ) => {
    setCompanySelectOpenId(null);

    setUpdatingPartnershipIds((prev) => new Set(prev).add(partnershipId));
    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("partnerships")
        .update({ company_id: company.id, company_name: company.name })
        .eq("id", partnershipId);

      if (updateError) {
        console.error("Error updating partnership company:", updateError);
        wallsToast.error("Couldn't update company", updateError.message);
        return;
      }

      const { data: fullCompany } = await supabase
        .from("companies")
        .select("id, name, website, logo_url")
        .eq("id", company.id)
        .maybeSingle();

      setPartnerships((prev) => {
        const next = prev.map((p) => {
          if (p.id !== partnershipId) return p;
          return {
            ...p,
            companyId: company.id,
            company: company.name,
            companyLogo: fullCompany?.logo_url ?? company.logo_url ?? undefined,
            companyWebsite: fullCompany?.website ?? p.companyWebsite,
          };
        });

        if (inMemoryPartnershipsCache) {
          writePartnershipsCache({
            ...inMemoryPartnershipsCache,
            partnerships: next,
          });
        }

        return next;
      });

      wallsToast.success("Company updated");
    } finally {
      setUpdatingPartnershipIds((prev) => {
        const next = new Set(prev);
        next.delete(partnershipId);
        return next;
      });
    }
  };

  const handleCompanyClick = async (companyId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!companyId) return;
    
    setSelectedCompanyId(companyId);
    setLoadingCompanyData(true);
    setIsSheetOpen(true);

    try {
      const supabase = getSupabaseClient();
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) {
        console.error("Error fetching company:", error);
        wallsToast.error("Error", "Failed to load company data");
        setIsSheetOpen(false);
        return;
      }

      if (company) {
        let linkedinUrl = "";
        let twitterUrl = "";
        let facebookUrl = "";

        try {
          const socialUrls = await fetchCompanySocialUrls(supabase, company.id);
          linkedinUrl = socialUrls.linkedin;
          twitterUrl = socialUrls.twitter;
          facebookUrl = socialUrls.facebook;
        } catch (socialError) {
          console.error("Error fetching social accounts:", socialError);
        }

        // Fetch headcount data
        let departmentalHeadCount: any = {};
        try {
          const { data: headcountData } = await supabase
            .from('companies_headcount')
            .select('department, headcount')
            .eq('company_id', company.id);

          if (headcountData) {
            headcountData.forEach((item) => {
              departmentalHeadCount[item.department] = item.headcount;
            });
          }
        } catch (headcountError) {
          console.error("Error fetching headcount data:", headcountError);
        }

        // Fetch technologies
        let current_technologies: Array<{ name: string; category: string | null }> = [];
        try {
          const { data: technologiesData } = await supabase
            .from('companies_technologies_join')
            .select(`
              technology_id,
              companies_technologies (
                name,
                category
              )
            `)
            .eq('company_id', company.id);

          if (technologiesData) {
            current_technologies = technologiesData
              .filter((item: any) => item.companies_technologies)
              .map((item: any) => ({
                name: item.companies_technologies.name,
                category: item.companies_technologies.category || null
              }));
          }
        } catch (technologiesError) {
          console.error("Error fetching technologies data:", technologiesError);
        }

        // Fetch suborganizations from companies_suborganizations table
        let suborganizations: any[] = [];
        try {
          const { data: suborgs } = await supabase
            .from('companies_suborganizations')
            .select('id, name, website, apollo_organization_id, created_at')
            .eq('company_id', company.id)
            .order('name', { ascending: true });

          if (suborgs) {
            suborganizations = suborgs.map(suborg => ({
              id: suborg.id,
              name: suborg.name,
              website_url: suborg.website,
              apollo_organization_id: suborg.apollo_organization_id,
              created_at: suborg.created_at,
            }));
          }
        } catch (suborgError) {
          console.error("Error fetching suborganizations data:", suborgError);
        }

        // Fetch funding events from companies_funding_events table
        let funding_events: any[] = [];
        try {
          const { data: fundingData } = await supabase
            .from('companies_funding_events')
            .select('id, event_id, type, amount, currency, date, investors, news_url, created_at')
            .eq('company_id', company.id)
            .order('date', { ascending: false });

          if (fundingData) {
            funding_events = fundingData.map(event => ({
              id: event.id,
              event_id: event.event_id,
              type: event.type,
              amount: event.amount,
              currency: event.currency,
              date: event.date,
              investors: event.investors,
              news_url: event.news_url,
              created_at: event.created_at,
            }));
          }
        } catch (fundingError) {
          console.error("Error fetching funding events data:", fundingError);
        }

        // Map Supabase fields to the expected format
        setSelectedCompanyData({
          id: company.id || "",
          organization_name: company.name || "",
          logo: company.logo_url || "",
          website: company.website || "",
          linkedinUrl: linkedinUrl,
          twitterUrl: twitterUrl,
          facebookUrl: facebookUrl,
          annualRevenue: company.annual_revenue?.toString() || "0",
          employeeCount: company.employee_count?.toString() || "",
          industry: company.industry || "",
          foundingYear: company.founding_year?.toString() || "",
          country: company.country || "",
          vendorCompanyName: "",
          vendorCountry: "",
          vendorState: "",
          vendorCity: "",
          vendorStreetAddress: company.street_address || "",
          vendorZipCode: company.postal_code || "",
          vendorContact: "",
          shortDescription: company.overview || "",
          createdAt: company.created_at || "",
          createdBy: company.created_by || "",
          apolloOrganizationId: company.apollo_organization_id || "",
          apolloAccountId: company.apollo_account_id || "",
          apollo_organization_name: company.apollo_organization_name || "",
          alexaRanking: company.alexa_ranking?.toString() || "",
          lastEnriched: company.last_enriched || "",
          phone: company.phone || "",
          retail_location_count: "",
          updatedAt: company.updated_at || "",
          updated_at: company.updated_at || "",
          departmentalHeadCount: departmentalHeadCount,
          current_technologies: current_technologies,
          suborganizations: suborganizations,
          funding_events: funding_events,
        });
      }
    } catch (error) {
      console.error("Error fetching company data:", error);
      wallsToast.error("Error", "Failed to load company data");
      setIsSheetOpen(false);
    } finally {
      setLoadingCompanyData(false);
    }
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedCompanyId(null);
    setSelectedCompanyData(null);
  };

  const handleTalentClick = (partnership: Partnership, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPartnership(partnership);
    setIsPartnershipSheetOpen(true);
  };

  const handleClosePartnershipSheet = () => {
    setIsPartnershipSheetOpen(false);
    setSelectedPartnership(null);
  };

  const refreshPartnershipsList = () => {
    fetchPartnerships(1);
  };

  const handleSortChange = (field: PartnershipSortField) => {
    if (field === sortBy) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(field);
    setSortDirection(field === "talentName" ? "asc" : "desc");
  };


  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 w-full flex flex-col min-h-0">
        <PartnershipsTableToolbar
          filters={filters}
          onFilterChange={handleFilterChange}
          onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
          onCreateClick={() => {
            // TODO: Add create partnership route if needed
            // router.push('/deal-board/create');
          }}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          showPagination={!loading && totalItems > 0}
        />

        <div className="flex-1 overflow-y-auto overscroll-none pl-8 pr-0">
          <TooltipPrimitive.Provider delayDuration={200}>
            <div ref={tableWrapperRef} className="flex flex-col gap-0 min-h-full">
            {/* Header Row - Always visible */}
            <PartnershipsTableHeader
              headerScrollRef={headerScrollRef}
              columnWidths={columnWidths}
              setColumnWidths={setColumnWidths}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />

            {/* Content Area - Loading or Data */}
            <div className="flex-1 bg-gray-50 flex flex-col">
            {loading ? (
              <PartnerHubSkeleton count={12} />
            ) : (
              <>
                {partnerships.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground font-light">No partnerships found matching your criteria.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {partnerships.map((partnership, index) => (
                      <div key={partnership.id}>
                        <PartnershipsTableRow
                          partnership={partnership}
                          index={index}
                          imageStates={imageStates}
                          scrollableRefs={scrollableRefs}
                          onImageError={handleImageError}
                          onTalentClick={handleTalentClick}
                          onCompanyClick={handleCompanyClick}
                          companySelectOpen={companySelectOpenId === partnership.id}
                          onCompanySelectOpenChange={(open) =>
                            setCompanySelectOpenId(open ? partnership.id : null)
                          }
                          onPartnershipCompanyUpdate={(company) =>
                            void handlePartnershipCompanyUpdate(partnership.id, company)
                          }
                          isUpdatingCompany={updatingPartnershipIds.has(partnership.id)}
                          formatDate={formatDate}
                          formatPlatform={formatPlatform}
                          getPlatformIcon={getPlatformIcon}
                          ensureHttps={ensureHttps}
                          columnWidths={columnWidths}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            </div>

          </div>
          </TooltipPrimitive.Provider>
        </div>

      </div>
      <PartnerHubFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        availableHqs={availableHqs}
        availableCategories={availableCategories}
      />

      {/* Mobile Floating Action Button */}
      <MobileFAB
        onClick={() => {
        }}
      />
      
      {/* Company Detail Sheet */}
      {selectedCompanyId && selectedCompanyData && (
        <EditAgentCompanies
          analyticsData={null}
          companyId={selectedCompanyId}
          initialData={selectedCompanyData}
          isOpen={isSheetOpen}
          onClose={handleCloseSheet}
          onSaved={refreshPartnershipsList}
        />
      )}

      {/* Partnership Detail Sheet */}
      {selectedPartnership && (
        <ViewPartnership
          partnershipId={selectedPartnership.id}
          initialData={selectedPartnership}
          isOpen={isPartnershipSheetOpen}
          onClose={handleClosePartnershipSheet}
          onSaved={() => {
            handleClosePartnershipSheet();
            refreshPartnershipsList();
          }}
        />
      )}
    </div>
  );
}

export default function PartnerHubPartnerships(props: PartnerHubPartnershipsProps) {
  return <PartnerHubPartnershipsContent {...props} />;
}
