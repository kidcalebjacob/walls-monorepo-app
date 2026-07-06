"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import Image from "next/image";
import { useInView } from 'react-intersection-observer';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { createClient } from "@walls/supabase/client";
import { Card } from "@walls/ui/card";
import Link from 'next/link';
import { countryCodeMapping } from "@/types/country.types";

const MotionLink = motion(Link);

// Create reverse mapping from country code to country name
const countryCodeToName: { [key: string]: string } = {};
Object.entries(countryCodeMapping).forEach(([name, code]) => {
  countryCodeToName[code] = name;
});

/** Match agent-roster card bottom: layout + social reveal */
const rosterBottomLayoutTransition = {
  type: "spring" as const,
  stiffness: 200,
  damping: 34,
  mass: 1.05,
};

const rosterSocialContainerVariants = {
  visible: {
    maxHeight: 52,
    opacity: 1,
    pointerEvents: "auto" as const,
    transition: {
      maxHeight: { duration: 0.56, ease: [0.2, 0.75, 0.15, 1] as const },
      opacity: { duration: 0.42, ease: [0.2, 0.75, 0.15, 1] as const },
      staggerChildren: 0.05,
      delayChildren: 0.06,
    },
  },
  hidden: {
    maxHeight: 0,
    opacity: 0,
    pointerEvents: "none" as const,
    transition: {
      maxHeight: { duration: 0.42, ease: [0.35, 0, 0.2, 1] as const },
      opacity: { duration: 0.28, ease: [0.4, 0, 1, 1] as const },
      staggerChildren: 0.028,
      staggerDirection: -1 as const,
    },
  },
};

const rosterSocialItemVariants = {
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 320,
      damping: 30,
      mass: 0.55,
    },
  },
  hidden: {
    opacity: 0,
    y: 10,
    transition: {
      duration: 0.3,
      ease: [0.35, 0, 0.25, 1] as const,
    },
  },
};

interface RosterMember {
  id: string;
  profilePictureUrl: string;
  creatorAlias: string;
  manager: string;
  tikTokURL: string;
  instagramURL: string;
  youtubeURL: string;
  country?: string;
  city?: string;
  instagramFollowing?: number;
  tiktokFollowing?: number;
  youtubeFollowing?: number;
  slug?: string;
  wallsEmail?: string;
  category?: string;
  primaryNiche?: string;
  _dupKey?: string; // For infinite scroll duplication
}

interface PlatformData {
  platform: string;
  url: string;
  followers: number | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  avgViews?: number | null;
  engagementRate?: number | null;
  followerGrowth?: number | null;
  likeGrowth?: number | null;
  commentGrowth?: number | null;
  viewGrowth?: number | null;
  engagementGrowth?: number | null;
}

export default function TalentPage() {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [filters, setFilters] = useState<{[key: string]: string}>({});
  const [filteredRoster, setFilteredRoster] = useState<RosterMember[]>([]);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [analyticsData, setAnalyticsData] = useState<{[key: string]: any}>({});
  const [hoveredCardKey, setHoveredCardKey] = useState<string | null>(null);
  const [isHoveringLogo, setIsHoveringLogo] = useState(false);
  
  const { ref, inView } = useInView({
    threshold: 0,
    initialInView: true,
  });

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch all active talent, including joined profile data
      const { data: talentData, error: talentError } = await supabase
        .from('talent')
        .select(`
          id,
          walls_email,
          city,
          country,
          avatar_url,
          profile_id,
          contract_type,
          slug,
          profile:profiles!talent_profile_id_fkey(
            id,
            name,
            category_id,
            profile_categories!profiles_category_id_fkey(name)
          )
        `)
        .eq('status', 'Active')
        .order('id', { ascending: true });

      if (talentError) {
        console.error("Error fetching talent data:", talentError);
        setLoading(false);
        return;
      }

      if (!talentData || talentData.length === 0) {
        setRoster([]);
        setLoading(false);
        return;
      }

      // Get profile IDs for social accounts query
      const profileIds = talentData
        .map(t => t.profile_id)
        .filter(Boolean) as string[];

      // Fetch social accounts for all profiles
      const { data: socialAccounts, error: socialError } = await supabase
        .from('social_accounts')
        .select('profile_id, platform, url, followers')
        .in('profile_id', profileIds);

      if (socialError) {
        console.error("Error fetching social accounts:", socialError);
      }

      // Only show exclusive representation talent on this page
      // (default to 'exclusive' when contract_type is unset, matching other rosters;
      // also normalize the legacy 'exlcusive' typo)
      const exclusiveTalent = talentData.filter(talent => {
        const contractType = (talent.contract_type || 'exclusive').toLowerCase();
        return contractType === 'exclusive' || contractType === 'exlcusive';
      });

      // Build roster data
      const rosterData: RosterMember[] = exclusiveTalent.map(talent => {
        // Profile data is already joined via Supabase
        const profile = Array.isArray(talent.profile) ? talent.profile[0] : talent.profile;
        const profileId = talent.profile_id;
        const accounts = socialAccounts?.filter(sa => sa.profile_id === profileId) || [];

        // Map social accounts to URLs and follower counts
        const instagramAccount = accounts.find(a => a.platform?.toLowerCase() === 'instagram');
        const tiktokAccount = accounts.find(a => a.platform?.toLowerCase() === 'tiktok');
        const youtubeAccount = accounts.find(a => a.platform?.toLowerCase() === 'youtube');

        return {
          id: talent.id, // Use talent.id from Supabase
          profilePictureUrl: talent.avatar_url || '', // avatar_url is in talent table
          creatorAlias: profile?.name || '',
          manager: '', // Not in schema, set to empty
          tikTokURL: tiktokAccount?.url || '',
          instagramURL: instagramAccount?.url || '',
          youtubeURL: youtubeAccount?.url || '',
          country: talent.country || undefined,
          city: talent.city || undefined,
          primaryNiche: (profile?.profile_categories as any)?.name || undefined,
          slug: (talent as any).slug || undefined,
          wallsEmail: talent.walls_email || undefined,
          category: (profile?.profile_categories as any)?.name || undefined,
          instagramFollowing: instagramAccount?.followers || undefined,
          tiktokFollowing: tiktokAccount?.followers || undefined,
          youtubeFollowing: youtubeAccount?.followers || undefined,
        };
      });

      rosterData.sort((a, b) =>
        (a.creatorAlias || "").localeCompare(b.creatorAlias || "", undefined, { sensitivity: "base" })
      );

      setRoster(rosterData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching roster:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  // Debug roster data
  useEffect(() => {
    console.log('Roster:', roster);
    console.log(roster.map(r => ({ country: r.country, category: r.category })));
  }, [roster]);

  // Filter roster based on selected filters - guaranteed to re-run on every change
  useEffect(() => {
    console.log("🔵 Filtering triggered:", filters);

    // Defensive guard
    if (!roster || roster.length === 0) {
      setFilteredRoster([]);
      return;
    }

    let filtered = roster;

    // Country - handle multiple selections
    if (filters.country && filters.country !== "") {
      const selectedCountries = filters.country.split(',').map(c => c.trim().toLowerCase());
      filtered = filtered.filter(
        t => selectedCountries.includes((t.country || "").toLowerCase())
      );
    }

    // Category - handle multiple selections
    if (filters.category && filters.category !== "") {
      const selectedCategories = filters.category.split(',').map(c => c.trim().toLowerCase());
      filtered = filtered.filter(
        t => selectedCategories.includes((t.category || "").toLowerCase())
      );
    }

    // Following range - handle multiple ranges
    if (filters.following && filters.following !== "") {
      const followingRanges = filters.following.split('|').map(range => {
        const [min, max] = range.split(',').map(f => parseInt(f.trim()));
        return { min, max };
      });
      
      filtered = filtered.filter(t => {
        const totalFollowing = (t.instagramFollowing || 0) + (t.tiktokFollowing || 0) + (t.youtubeFollowing || 0);
        return followingRanges.some(range => 
          totalFollowing >= range.min && totalFollowing <= range.max
        );
      });
    }

    console.log("✅ Filter result:", filtered.length, "of", roster.length);
    setFilteredRoster(filtered);
  }, [filters, roster]);

  // Initialize filtered roster when roster data loads - only if no filters are applied
  useEffect(() => {
    if (roster.length > 0 && Object.keys(filters).length === 0) {
      setFilteredRoster(roster);
    }
  }, [roster, filters]);

  // Handle infinite scroll loop
  useEffect(() => {
    const container = document.getElementById('talent-scroll-container');
    if (!container || roster.length === 0) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const singleSetWidth = (scrollWidth / 3); // Since we have 3 copies

      // If scrolled past the first set, reset to beginning of second set
      if (scrollLeft >= singleSetWidth) {
        container.scrollLeft = scrollLeft - singleSetWidth;
      }
      // If scrolled before the second set, jump to end of second set
      else if (scrollLeft < 0) {
        container.scrollLeft = singleSetWidth + scrollLeft;
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [roster]);

  const scrollLeft = () => {
    const container = document.getElementById('talent-scroll-container');
    if (container) {
      // Scroll by 4 cards: 4 * (512px width + 24px gap) = 2144px
      container.scrollBy({ left: -2144, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = document.getElementById('talent-scroll-container');
    if (container) {
      container.scrollBy({ left: 2144, behavior: 'smooth' });
    }
  };

  const fetchTalentAnalytics = async (talentId: string, wallsEmail: string) => {
    if (analyticsData[talentId]) return; // Already fetched
    
    try {
      const supabase = createClient();
      const { data: talentData, error: talentError } = await supabase
        .from('talent')
        .select('profile_id, bio_short')
        .eq('walls_email', wallsEmail)
        .limit(1);

      if (talentError || !talentData || talentData.length === 0) {
        console.error("Error fetching talent data for analytics:", talentError);
        setAnalyticsData(prev => ({
          ...prev,
          [talentId]: { error: true, platforms: [] }
        }));
        return;
      }

      const profileId = talentData[0].profile_id;
      const bioShort = talentData[0].bio_short || null;

      // Fetch social accounts for this profile
      const { data: socialData, error: socialError } = await supabase
        .from('social_accounts')
        .select('id, platform, url, followers, avg_likes, avg_comments, avg_views, engagement_rate')
        .eq('profile_id', profileId);

      if (socialError || !socialData || socialData.length === 0) {
        console.error("Error fetching social accounts:", socialError);
        // Set error state - no social accounts found
        setAnalyticsData(prev => ({
          ...prev,
          [talentId]: { error: true, platforms: [] }
        }));
        return;
      }

      // Fetch growth data from materialized view
      const accountIds = socialData.map(account => account.id);
      const { data: growthData, error: growthError } = await supabase
        .from('social_account_growth')
        .select('social_account_id, follower_growth_weekly, like_growth_weekly, comment_growth_weekly, view_growth_weekly, engagement_growth_weekly')
        .in('social_account_id', accountIds)
        .order('snapshot_date', { ascending: false });

      if (growthError) {
        console.error("Error fetching growth data:", growthError);
      }

      // Process analytics data
      const analytics = {
        about: bioShort,
        platforms: socialData.map(account => {
          const growth = growthData?.find(g => g.social_account_id === account.id);
          return {
            platform: account.platform,
            url: account.url,
            followers: account.followers,
            avgLikes: account.avg_likes,
            avgComments: account.avg_comments,
            avgViews: account.avg_views,
            engagementRate: account.engagement_rate,
            followerGrowth: growth?.follower_growth_weekly,
            likeGrowth: growth?.like_growth_weekly,
            commentGrowth: growth?.comment_growth_weekly,
            viewGrowth: growth?.view_growth_weekly,
            engagementGrowth: growth?.engagement_growth_weekly
          };
        })
      };

      setAnalyticsData(prev => ({
        ...prev,
        [talentId]: analytics
      }));
    } catch (error) {
      console.error("Error fetching talent analytics:", error);
      // Set error state
      setAnalyticsData(prev => ({
        ...prev,
        [talentId]: { error: true, platforms: [] }
      }));
    }
  };

  const toggleCardFlip = (talentId: string, wallsEmail: string) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(talentId)) {
        newSet.delete(talentId);
      } else {
        newSet.add(talentId);
        // Fetch analytics when flipping to back
        fetchTalentAnalytics(talentId, wallsEmail);
      }
      return newSet;
    });
  };


  const formatNumber = (num: number): string => {
    if (!num) return "0";
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };


  // Create infinite loop by duplicating the filtered roster - with unique keys for proper re-renders
  const infiniteRoster = useMemo(() => {
    // Don't duplicate when filtering - just show the filtered results
    if (Object.keys(filters).length > 0) {
      console.log('infiniteRoster (filtered):', {
        filteredRosterLength: filteredRoster.length,
        sample: filteredRoster.slice(0, 2).map(t => ({ name: t.creatorAlias, category: t.category }))
      });
      return filteredRoster;
    }
    
    // Duplicate for infinite scroll when no filters are active
    const duplicated = [...filteredRoster, ...filteredRoster, ...filteredRoster].map(
      (talent, i) => ({ ...talent, _dupKey: `${talent.id}-${i}` })
    );
    
    console.log('infiniteRoster (duplicated):', {
      filteredRosterLength: filteredRoster.length,
      infiniteRosterLength: duplicated.length,
      sample: duplicated.slice(0, 2).map(t => ({ name: t.creatorAlias, category: t.category }))
    });
    
    return duplicated;
  }, [filteredRoster, filters]);

  // Debug log before rendering
  console.log("Filters in parent:", filters);

  return (
    <div className="relative h-screen w-full bg-gray-50 overflow-hidden">
      <div ref={ref} className="absolute top-0 h-1 w-full" />

      <div className="h-screen overflow-hidden flex flex-col">
        {/* Header with WALLS icon and Navigation */}
        <div className="flex-shrink-0 pt-3 pb-0">
          <div className={cn(
            "w-full bg-transparent h-10 pt-0 pb-0 flex items-center justify-between transition-all duration-300 px-5"
          )}>
            <Link
              href="/"
              className="relative flex items-center"
              aria-label="Back to home"
              onMouseEnter={() => setIsHoveringLogo(true)}
              onMouseLeave={() => setIsHoveringLogo(false)}
            >
              <div className="relative w-[35px] h-[35px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!isHoveringLogo ? (
                    <motion.div
                      key="logo"
                      initial={{ opacity: 1, x: 0 }}
                      exit={{
                        opacity: 0,
                        x: -10,
                        transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
                      }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Image
                        src="/images/WBlack.svg"
                        alt="WALLS Entertainment"
                        width={35}
                        height={35}
                        className="object-contain"
                        priority
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="arrow"
                      initial={{ opacity: 0, x: -10, scale: 0.8 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        scale: 1,
                        transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                      }}
                      exit={{
                        opacity: 0,
                        x: -10,
                        scale: 0.8,
                        transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
                      }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <ChevronLeft className="w-5 h-5 text-black" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {isHoveringLogo && (
                  <motion.span
                    initial={{ opacity: 0, x: -10, scale: 0.8 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: 1,
                      transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                    }}
                    exit={{
                      opacity: 0,
                      x: -10,
                      scale: 0.8,
                      transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
                    }}
                    className="absolute left-full ml-2 whitespace-nowrap text-sm text-gray-700 pointer-events-none"
                  >
                    Back to home
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={scrollLeft}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5 text-black" />
              </button>
              <button 
                onClick={scrollRight}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5 text-black" />
              </button>
              <MotionLink
                href="/contact"
                className="relative inline-block shrink-0 pl-1 pb-0.5 text-sm font-light leading-none text-[var(--walls-sky)] sm:text-base"
                variants={{ rest: {}, hover: {} }}
                initial="rest"
                whileHover="hover"
              >
                <span className="relative z-10">Request full roster</span>
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-0 h-[1.5px] w-full origin-left rounded-full bg-[var(--walls-sky)]"
                  variants={{
                    rest: { scaleX: 0, opacity: 0 },
                    hover: { scaleX: 1, opacity: 1 },
                  }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              </MotionLink>
            </div>
          </div>
        </div>

        {/* Cards Container - Takes remaining height, cards scale to fit viewport */}
        <section className="relative w-full flex-1 flex items-center overflow-hidden min-h-0">
          <div className="w-full h-full flex items-center overflow-hidden min-h-0 py-4">
            {loading ? (
              <div 
                className="flex overflow-x-auto gap-4 md:gap-6 pointer-events-auto [&::-webkit-scrollbar]:hidden px-5 h-full items-center" 
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none'
                }}
              >
                {[...Array(6)].map((_, index) => (
                  <div 
                    key={index}
                    className="relative overflow-hidden aspect-[1/2] w-[min(32rem,calc((100vh-5rem)/2))] flex-shrink-0 rounded-2xl bg-gray-200 animate-pulse"
                  >
                    <div className="absolute inset-0 bg-gray-300 rounded-2xl" />
                    
                    <div className="absolute top-4 left-4 right-4 flex justify-start items-center z-10">
                      <div className="h-4 w-16 bg-gray-400 rounded" />
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 p-6 z-10 flex flex-col justify-end">
                      <div className="h-4 w-28 bg-gray-400 rounded mb-1" />
                      <div className="h-9 w-40 bg-gray-400 rounded mb-1" />
                      <div className="h-4 w-32 bg-gray-400 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div 
                  id="talent-scroll-container"
                  className="flex overflow-x-auto overflow-y-hidden gap-4 md:gap-6 pointer-events-auto [&::-webkit-scrollbar]:hidden px-5 h-full items-center" 
                  style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none'
                  }}
                >
                  {filteredRoster.length === 0 ? (
                    <div className="flex items-center justify-center w-full h-64 text-center">
                      <div>
                        <p className="text-gray-500 text-lg font-medium mb-2">No talent found</p>
                        <p className="text-gray-400 text-sm">Try adjusting your filters</p>
                      </div>
                    </div>
                  ) : (
                    infiniteRoster.map((talent, index) => {
                      const isFlipped = flippedCards.has(talent.id);
                      const talentAnalytics = analyticsData[talent.id];
                      const talentCardKey = talent._dupKey || talent.id;
                      const showFrontSocials =
                        hoveredCardKey === talentCardKey &&
                        !isFlipped &&
                        !!(talent.instagramURL || talent.youtubeURL || talent.tikTokURL);
                      
                      return (
                        <motion.div
                          key={talent._dupKey || talent.id}
                          className="relative aspect-[1/2] w-[min(32rem,calc((100vh-5rem)/2))] flex-shrink-0 overflow-hidden"
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ 
                            duration: 0.5, 
                            delay: index * 0.05,
                            ease: [0.4, 0, 0.2, 1]
                          }}
                          onMouseEnter={() => setHoveredCardKey(talentCardKey)}
                          onMouseLeave={() => setHoveredCardKey(null)}
                          onClick={(e) => {
                            // Only toggle if not clicking on interactive elements
                            const target = e.target as HTMLElement;
                            const isInteractiveElement = target.closest('a, button, [role="button"]');
                            
                            if (!isInteractiveElement && talent.wallsEmail) {
                              toggleCardFlip(talent.id, talent.wallsEmail);
                            }
                          }}
                        >
                          {/* Front card - always visible */}
                          <Card className="relative overflow-hidden rounded-2xl transition-all duration-300 group aspect-[1/2] w-full h-full flex-shrink-0 cursor-pointer">
                            {/* Full-bleed background image */}
                            <div className="absolute inset-0 overflow-hidden">
                              <motion.div
                                className="absolute inset-0 origin-center"
                                initial={{ scale: 1 }}
                                whileHover={!isFlipped ? { scale: 1.05 } : undefined}
                                transition={{
                                  duration: 2.5,
                                  ease: [0.25, 0.46, 0.45, 0.94],
                                }}
                              >
                                <Image
                                  src={talent.profilePictureUrl}
                                  alt={talent.creatorAlias}
                                  fill
                                  sizes="(max-width: 768px) 45vw, 512px"
                                  className={cn(
                                    "object-cover pointer-events-none transition-all duration-500",
                                    isFlipped
                                      ? "grayscale-0 contrast-100 brightness-100 saturate-100"
                                      : "grayscale contrast-110 brightness-75 saturate-0 group-hover:grayscale-0 group-hover:contrast-100 group-hover:brightness-100 group-hover:saturate-100"
                                  )}
                                />
                              </motion.div>
                            </div>
                            
                            {/* Top header */}
                            <div className="absolute top-4 left-4 right-4 z-10">
                              <span className="text-walls-yellow font-bold text-sm">ROSTER.</span>
                            </div>
                            
                            <LayoutGroup id={`representation-bottom-${talentCardKey}`}>
                            {/* Bottom content: flush bottom; icon row on hover (same as agent-roster) */}
                            <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col justify-end items-start p-6">
                              <motion.div
                                layout="position"
                                transition={rosterBottomLayoutTransition}
                                className="flex w-full flex-col items-start"
                              >
                                <div className="text-white text-base font-normal mb-0.5 leading-tight">
                                  {talent.country ? (countryCodeToName[talent.country] || talent.country).toUpperCase() : 'LOCATION NOT AVAILABLE'}
                                </div>

                                <h3 className="text-walls-yellow font-bold text-3xl leading-none mb-1">
                                  {talent.creatorAlias.toUpperCase()}
                                </h3>

                                <div className="text-white text-base font-light leading-tight">
                                  {talent.category || talent.primaryNiche || 'Category not available'}
                                </div>
                              </motion.div>

                              {(talent.instagramURL || talent.youtubeURL || talent.tikTokURL) && (
                                <motion.div
                                  layout
                                  transition={rosterBottomLayoutTransition}
                                  className="mt-1.5 flex w-full shrink-0 items-center justify-start gap-3 overflow-hidden"
                                  initial={false}
                                  animate={showFrontSocials ? "visible" : "hidden"}
                                  variants={rosterSocialContainerVariants}
                                >
                                  {talent.instagramURL && (
                                    <motion.a
                                      href={talent.instagramURL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-50 hover:text-walls-yellow transition-colors duration-200 drop-shadow-sm"
                                      onClick={(e) => e.stopPropagation()}
                                      variants={rosterSocialItemVariants}
                                    >
                                      <FaInstagram className="w-7 h-7" />
                                    </motion.a>
                                  )}
                                  {talent.youtubeURL && (
                                    <motion.a
                                      href={talent.youtubeURL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-50 hover:text-walls-yellow transition-colors duration-200 drop-shadow-sm"
                                      onClick={(e) => e.stopPropagation()}
                                      variants={rosterSocialItemVariants}
                                    >
                                      <FaYoutube className="w-7 h-7" />
                                    </motion.a>
                                  )}
                                  {talent.tikTokURL && (
                                    <motion.a
                                      href={talent.tikTokURL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-50 hover:text-walls-yellow transition-colors duration-200 drop-shadow-sm"
                                      onClick={(e) => e.stopPropagation()}
                                      variants={rosterSocialItemVariants}
                                    >
                                      <FaTiktok className="w-7 h-7" />
                                    </motion.a>
                                  )}
                                </motion.div>
                              )}
                            </div>
                            </LayoutGroup>
                          </Card>

                          {/* Slide-up details panel */}
                          <AnimatePresence>
                            {isFlipped && (
                              <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ 
                                  duration: 0.4, 
                                  ease: [0.4, 0, 0.2, 1] 
                                }}
                                className="absolute inset-0 z-20 bg-neutral-900/70 rounded-2xl overflow-hidden backdrop-blur-md border border-neutral-700/50"
                                onClick={() => {
                                  if (talent.wallsEmail) {
                                    toggleCardFlip(talent.id, talent.wallsEmail);
                                  }
                                }}
                              >
                                <div 
                                  className="absolute inset-0 p-6 flex flex-col overflow-y-auto pointer-events-none"
                                >
                                  <div 
                                    className="flex-1 flex flex-col pointer-events-auto"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Header */}
                                    <div className="flex justify-between items-center mb-4">
                                      <span className="text-walls-yellow font-bold text-sm">{talent.creatorAlias.toUpperCase()}.</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (talent.wallsEmail) {
                                            toggleCardFlip(talent.id, talent.wallsEmail);
                                          }
                                        }}
                                        className="text-white transition-colors duration-200 p-1 rounded-full hover:bg-neutral-800"
                                        aria-label="Close"
                                      >
                                        <X className="w-5 h-5" />
                                      </button>
                                    </div>
                                    
                                    {/* Analytics content - Centered with proper spacing */}
                                    <div className="flex-1 flex flex-col justify-center overflow-hidden">
                                    {talentAnalytics ? (
                                      (() => {
                                        // Always show all 3 platforms, with ghost containers for missing ones
                                        const platforms = (talentAnalytics.platforms || []) as PlatformData[];
                                        const platformMap = new Map<string, PlatformData>(
                                          platforms.map((p) => [p.platform, p])
                                        );
                                        
                                        const allPlatforms = [
                                          { platform: 'instagram', icon: FaInstagram },
                                          { platform: 'tiktok', icon: FaTiktok },
                                          { platform: 'youtube', icon: FaYoutube }
                                        ];
                                        
                                        return (
                                          <div className="space-y-2.5">
                                            {/* Social platform containers - always show all 3 */}
                                            {allPlatforms.map(({ platform, icon: Icon }, index) => {
                                              const platformData = platformMap.get(platform);
                                              const hasData = platformData && platformData.url;
                                              
                                              if (hasData) {
                                                return (
                                                  <motion.a
                                                    key={platform}
                                                    href={platformData.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-white/5 backdrop-blur-xl shadow-lg border border-white/10 rounded-xl p-3 hover:bg-white/10 hover:border-white/20 hover:shadow-xl transition-all duration-300 ring-1 ring-white/5 block cursor-pointer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    whileHover="hover"
                                                    initial="initial"
                                                  >
                                                    <div className="flex items-center justify-between h-full">
                                                      <div className="flex items-center">
                                                        <motion.div
                                                          variants={{
                                                            initial: { rotate: 0 },
                                                            hover: {
                                                              rotate: [0, -8, 8, -8, 8, 0],
                                                              transition: {
                                                                duration: 0.5,
                                                                ease: "easeInOut"
                                                              }
                                                            }
                                                          }}
                                                        >
                                                          <Icon className="w-6 h-6 text-white" />
                                                        </motion.div>
                                                      </div>
                                                      
                                                      <div className="text-right">
                                                        <div className="text-white font-bold text-lg">
                                                          {formatNumber(platformData.followers || 0)}
                                                        </div>
                                                        <div className="text-gray-300 text-xs">
                                                          Following
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </motion.a>
                                                );
                                              } else {
                                                // Ghost container for missing platform
                                                return (
                                                  <div 
                                                    key={platform} 
                                                    className="bg-white/5 backdrop-blur-xl shadow-lg border border-white/10 rounded-xl p-3 ring-1 ring-white/5 opacity-40"
                                                  >
                                                    <div className="flex items-center justify-between h-full">
                                                      <div className="flex items-center">
                                                        <Icon className="w-6 h-6 text-white/50" />
                                                      </div>
                                                      
                                                      <div className="text-right">
                                                        <div className="text-white/50 font-bold text-lg">
                                                          —
                                                        </div>
                                                        <div className="text-gray-300/50 text-xs">
                                                          Following
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              }
                                            })}
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      (() => {
                                        // Show ghost containers while loading
                                        const allPlatforms = [
                                          { platform: 'instagram', icon: FaInstagram },
                                          { platform: 'tiktok', icon: FaTiktok },
                                          { platform: 'youtube', icon: FaYoutube }
                                        ];
                                        
                                        return (
                                          <div className="space-y-2.5">
                                            {allPlatforms.map(({ platform, icon: Icon }) => (
                                              <div 
                                                key={platform} 
                                                className="bg-white/5 backdrop-blur-xl shadow-lg border border-white/10 rounded-xl p-3 ring-1 ring-white/5 opacity-40"
                                              >
                                                <div className="flex items-center justify-between h-full">
                                                  <div className="flex items-center">
                                                    <Icon className="w-6 h-6 text-white/50" />
                                                  </div>
                                                  
                                                  <div className="text-right">
                                                    <div className="text-white/50 font-bold text-lg">
                                                      —
                                                    </div>
                                                    <div className="text-gray-300/50 text-xs">
                                                      Following
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()
                                    )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
