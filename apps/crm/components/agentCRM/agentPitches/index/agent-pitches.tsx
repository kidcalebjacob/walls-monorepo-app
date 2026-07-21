"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { CRMPagination } from "@/components/agentCRM/ui/crm-pagination";
import { PitchesFilter } from "@/components/agent-filters/pitches-filter";
import { CRMSkeleton } from "@/components/agentCRM/agentPeople/custom-ui/crm-skeleton";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { MobileFAB } from "@/components/ui/mobile-fab";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import UserProfileButton from "@/components/user-profile-button";
import { PitchesTableToolbar } from "./table/pitches-table-toolbar";
import { PitchesTableHeader } from "./table/pitches-table-header";
import { PitchesTableRow } from "./table/pitches-table-row";
import { Pitch, PitchFilters, ImageStates, ColumnWidths } from "./types";
import ViewAgentPitches from "../view/view-agent-pitches";
import { CreatePitchPopup, type CreatePitchAnchorRect } from "../create/popup/create-pitch";

const ITEMS_PER_PAGE = 50;
const PITCHES_CACHE_KEY = 'walls-pitches-v2-cache';
const PITCHES_CACHE_TIMESTAMP_KEY = 'walls-pitches-v2-cache-timestamp';

interface AgentPitchesProps {
  analyticsData: any;
}

function AgentPitchesContent({ analyticsData }: AgentPitchesProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<PitchFilters>({
    searchTerm: "",
    channel: "",
    pitchedBy: "",
    pitchedTo: "",
    company: "",
    creator: "",
  });
  const [imageStates, setImageStates] = useState<ImageStates>({});
  const scrollableRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const hasInitialFetchRef = useRef(false);
  const [selectedPitchId, setSelectedPitchId] = useState<string | null>(null);
  const [selectedPitchData, setSelectedPitchData] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loadingPitchData, setLoadingPitchData] = useState(false);
  const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
  const [createPitchAnchorRect, setCreatePitchAnchorRect] = useState<CreatePitchAnchorRect>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    company: 280,
    pitchedTo: 200,
    sentBy: 180,
    channel: 130,
    creators: 200,
    date: 150,
    created: 140,
  });

  const fetchPitches = async (pageNumber: number = 1) => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    if (!hasInitialFetchRef.current) {
      try {
        const cachedData = localStorage.getItem(PITCHES_CACHE_KEY);
        const cachedTimestamp = localStorage.getItem(PITCHES_CACHE_TIMESTAMP_KEY);
        if (cachedData && cachedTimestamp) {
          const cacheAge = Date.now() - parseInt(cachedTimestamp, 10);
          if (cacheAge < 5000) {
            setPitches(JSON.parse(cachedData) as Pitch[]);
            setLoading(false);
            hasInitialFetchRef.current = true;
            return;
          }
        }
      } catch {}
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        wallsToast.error("Authentication Error", "Please log in to view pitches");
        setLoading(false);
        return;
      }

      let query = supabase
        .from('pitches')
        .select(`
          id,
          timestamp,
          created_at,
          company_website,
          company_id,
          person_id,
          agent_id,
          channel,
          message,
          companies (
            id,
            name,
            website,
            logo_url
          ),
          people (
            id,
            email,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10000);

      if (filters.channel) {
        query = query.eq('channel', filters.channel);
      }

      const { data: pitchesData, error: pitchesError } = await query;

      if (pitchesError) {
        console.error("Error fetching pitches:", pitchesError);
        wallsToast.error("Error", "Failed to fetch pitches");
        setLoading(false);
        return;
      }

      if (!pitchesData || pitchesData.length === 0) {
        setPitches([]);
        setTotalPages(1);
        setTotalItems(0);
        setLoading(false);
        return;
      }

      // Fetch team data
      const agentIds = Array.from(new Set(pitchesData.map((p: any) => p.agent_id).filter(Boolean)));
      const teamMap = new Map<string, { email: string; first_name: string; last_name: string }>();
      if (agentIds.length > 0) {
        const { data: teamData } = await supabase
          .from('team')
          .select('id, email, users!team_user_id_fkey(first_name, last_name)')
          .in('id', agentIds);
        if (teamData) {
          teamData.forEach((t: any) => {
            const u = t.users;
            const userRow = Array.isArray(u) ? u[0] : u;
            teamMap.set(t.id, {
              email: t.email || '',
              first_name: userRow?.first_name || '',
              last_name: userRow?.last_name || '',
            });
          });
        }
      }

      // Fetch pitches_creators
      const pitchIds = pitchesData.map((p: any) => p.id);
      const { data: pitchesCreatorsData } = await supabase
        .from('pitches_creators')
        .select(`
          pitch_id,
          talent_id,
          talent!inner (
            id,
            first_name,
            last_name,
            walls_email,
            profile_id
          )
        `)
        .in('pitch_id', pitchIds);

      // Fetch profiles for creator names
      const profileIds = new Set<string>();
      const talentToProfileMap = new Map<string, string>();
      if (pitchesCreatorsData) {
        pitchesCreatorsData.forEach((pc: any) => {
          if (pc.talent?.profile_id) {
            profileIds.add(pc.talent.profile_id);
            talentToProfileMap.set(pc.talent.id, pc.talent.profile_id);
          }
        });
      }

      let profilesMap = new Map<string, string>();
      if (profileIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', Array.from(profileIds));
        if (profilesData) {
          profilesData.forEach((p: any) => { if (p.name) profilesMap.set(p.id, p.name); });
        }
      }

      const creatorsMap = new Map<string, string[]>();
      const profileNamesMap = new Map<string, string[]>();
      if (pitchesCreatorsData) {
        pitchesCreatorsData.forEach((pc: any) => {
          if (!creatorsMap.has(pc.pitch_id)) {
            creatorsMap.set(pc.pitch_id, []);
            profileNamesMap.set(pc.pitch_id, []);
          }
          const talent = pc.talent;
          if (talent) {
            const name = talent.first_name && talent.last_name
              ? `${talent.first_name} ${talent.last_name}`
              : talent.walls_email || 'Unknown';
            creatorsMap.get(pc.pitch_id)!.push(name);
            const profileId = talent.profile_id;
            if (profileId && profilesMap.has(profileId)) {
              profileNamesMap.get(pc.pitch_id)!.push(profilesMap.get(profileId)!);
            }
          }
        });
      }

      let allPitchesData: Pitch[] = pitchesData.map((pitch: any) => {
        const company = pitch.companies;
        const person = pitch.people;
        const teamMember = pitch.agent_id ? teamMap.get(pitch.agent_id) : null;
        const creatorNames = creatorsMap.get(pitch.id) || [];
        const creatorProfileNames = profileNamesMap.get(pitch.id) || [];

        let pitchedTo = '';
        if (person) {
          pitchedTo = person.first_name && person.last_name
            ? `${person.first_name} ${person.last_name}`
            : person.email || '';
        }

        let sentBy = '';
        if (teamMember) {
          sentBy = teamMember.first_name && teamMember.last_name
            ? `${teamMember.first_name} ${teamMember.last_name}`
            : teamMember.email || '';
        }

        return {
          id: pitch.id,
          companyId: company?.id || pitch.company_id || null,
          companyName: company?.name || '',
          companyWebsite: company?.website || pitch.company_website || '',
          companyLogoUrl: company?.logo_url || null,
          pitchedTo,
          personId: pitch.person_id || null,
          sentBy,
          agentId: pitch.agent_id || null,
          channel: pitch.channel || 'email',
          message: pitch.message || null,
          timestamp: pitch.timestamp || null,
          createdAt: pitch.created_at || null,
          creatorsCount: creatorNames.length,
          creatorNames,
          creatorProfileNames,
        };
      });

      // Apply search filter
      if (filters.searchTerm) {
        const terms = filters.searchTerm.toLowerCase().split(' ');
        allPitchesData = allPitchesData.filter(p =>
          terms.every(term =>
            p.companyName?.toLowerCase().includes(term) ||
            p.companyWebsite?.toLowerCase().includes(term) ||
            p.pitchedTo?.toLowerCase().includes(term) ||
            p.sentBy?.toLowerCase().includes(term) ||
            p.creatorNames.some(c => c.toLowerCase().includes(term))
          )
        );
      }

      if (filters.pitchedBy) {
        allPitchesData = allPitchesData.filter(p =>
          p.sentBy.toLowerCase().includes(filters.pitchedBy.toLowerCase())
        );
      }

      if (filters.pitchedTo) {
        allPitchesData = allPitchesData.filter(p =>
          p.pitchedTo.toLowerCase().includes(filters.pitchedTo.toLowerCase())
        );
      }

      if (filters.company) {
        allPitchesData = allPitchesData.filter(p =>
          p.companyName.toLowerCase().includes(filters.company.toLowerCase()) ||
          p.companyWebsite.toLowerCase().includes(filters.company.toLowerCase())
        );
      }

      if (filters.creator) {
        allPitchesData = allPitchesData.filter(p =>
          p.creatorNames.some(c => c.toLowerCase().includes(filters.creator.toLowerCase()))
        );
      }

      const filteredTotal = allPitchesData.length;
      const pages = Math.ceil(filteredTotal / ITEMS_PER_PAGE);
      setTotalPages(pages);
      setTotalItems(filteredTotal);

      const startIndex = (pageNumber - 1) * ITEMS_PER_PAGE;
      const pageData = allPitchesData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
      setPitches(pageData);
      setCurrentPage(pageNumber);
      hasInitialFetchRef.current = true;

      try {
        localStorage.setItem(PITCHES_CACHE_KEY, JSON.stringify(pageData));
        localStorage.setItem(PITCHES_CACHE_TIMESTAMP_KEY, Date.now().toString());
      } catch {}
    } catch (error) {
      console.error("Error fetching pitches:", error);
      wallsToast.error("Error", "Failed to load pitches data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) { setLoading(true); return; }
    if (user) {
      hasInitialFetchRef.current = true;
      fetchPitches(1);
    }
  }, [authLoading, user, filters]);

  useLayoutEffect(() => {
    const syncScrollPositions = () => {
      const headerScrollLeft = headerScrollRef.current?.scrollLeft ?? 0;
      scrollableRefs.current.forEach((ref) => {
        if (ref) ref.scrollLeft = headerScrollLeft;
      });
    };

    const raf = requestAnimationFrame(syncScrollPositions);
    return () => cancelAnimationFrame(raf);
  }, [pitches, columnWidths]);

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
    fetchPitches(page);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleImageError = (pitchId: string) => {
    setImageStates(prev => ({
      ...prev,
      [pitchId]: { ...prev[pitchId] || { logoFailed: false }, logoFailed: true }
    }));
  };

  const handlePitchClick = async (pitchId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPitchId(pitchId);
    setLoadingPitchData(true);
    setIsSheetOpen(true);

    try {
      const supabase = getSupabaseClient();
      const { data: pitch, error } = await supabase
        .from('pitches')
        .select(`
          id,
          timestamp,
          created_at,
          company_website,
          company_id,
          person_id,
          agent_id,
          channel,
          message,
          companies (id, name, website, logo_url),
          people (id, email, first_name, last_name)
        `)
        .eq('id', pitchId)
        .single();

      if (error || !pitch) {
        wallsToast.error("Error", "Failed to load pitch data");
        setIsSheetOpen(false);
        return;
      }

      // Fetch team member
      let agentData: any = null;
      if (pitch.agent_id) {
        const { data } = await supabase
          .from('team')
          .select('id, email, users!team_user_id_fkey(first_name, last_name)')
          .eq('id', pitch.agent_id)
          .single();
        if (data) {
          const u = data.users;
          const userRow = Array.isArray(u) ? u[0] : u;
          agentData = {
            id: data.id,
            email: data.email,
            first_name: userRow?.first_name ?? '',
            last_name: userRow?.last_name ?? '',
          };
        }
      }

      // Fetch creators
      const { data: creatorsData } = await supabase
        .from('pitches_creators')
        .select(`pitch_id, talent_id, talent!inner (id, first_name, last_name, walls_email, profile_id)`)
        .eq('pitch_id', pitchId);

      setSelectedPitchData({
        id: pitch.id,
        company: pitch.companies || null,
        person: pitch.people || null,
        agent: agentData,
        channel: pitch.channel || 'email',
        message: pitch.message || '',
        timestamp: pitch.timestamp || '',
        createdAt: pitch.created_at || '',
        companyWebsite: pitch.company_website || '',
        creators: creatorsData || [],
      });
    } catch (error) {
      console.error("Error fetching pitch data:", error);
      wallsToast.error("Error", "Failed to load pitch data");
      setIsSheetOpen(false);
    } finally {
      setLoadingPitchData(false);
    }
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedPitchId(null);
    setSelectedPitchData(null);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterKey]: value }));
    setCurrentPage(1);
  };

  const handlePitchSaved = () => {
    handleCloseSheet();
    hasInitialFetchRef.current = false;
    fetchPitches(currentPage);
  };

  return (
    <>
      {/* Top Right Profile Button */}
      <div className="w-full absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="w-full text-right bg-transparent h-20 py-4 px-5 flex items-center">
          {user !== null && (
            <div className="flex items-center gap-4 ml-auto pointer-events-auto">
              <UserProfileButton />
            </div>
          )}
        </div>
      </div>

      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 w-full flex flex-col">
          <PitchesTableToolbar
            filters={filters}
            onFilterChange={handleFilterChange}
            onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
            createButtonRef={createButtonRef}
            onCreateClick={(e) => {
              if (isCreatePopupOpen && createPitchAnchorRect) {
                setIsCreatePopupOpen(false);
                setCreatePitchAnchorRect(null);
              } else {
                const rect = e.currentTarget.getBoundingClientRect();
                setCreatePitchAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
                setIsCreatePopupOpen(true);
              }
            }}
          />

          <div className="app-sidebar-pad flex-1 overflow-y-auto overscroll-none pr-0">
            <TooltipPrimitive.Provider delayDuration={200}>
              <div ref={tableWrapperRef} className="flex flex-col gap-0 min-h-full">
                <PitchesTableHeader
                  headerScrollRef={headerScrollRef}
                  columnWidths={columnWidths}
                  setColumnWidths={setColumnWidths}
                />

                <div className="flex-1 bg-kenoo-white flex flex-col">
                  {loading ? (
                    <CRMSkeleton count={12} />
                  ) : (
                    <>
                      {pitches.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-muted-foreground font-light">No pitches found matching your criteria.</p>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col">
                          {pitches.map((pitch, index) => (
                            <div key={pitch.id}>
                              <PitchesTableRow
                                pitch={pitch}
                                index={index}
                                imageStates={imageStates}
                                scrollableRefs={scrollableRefs}
                                onImageError={handleImageError}
                                onPitchClick={handlePitchClick}
                                formatDate={formatDate}
                                columnWidths={columnWidths}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <CRMPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  buttonVariant="scouter"
                  className="bg-kenoo-white shadow-none backdrop-blur-none border-t-0"
                />
              </div>
            </TooltipPrimitive.Provider>
          </div>
        </div>
      </div>

      {/* Pitch Detail Sheet */}
      {selectedPitchId && selectedPitchData && (
        <ViewAgentPitches
          pitchId={selectedPitchId}
          initialData={selectedPitchData}
          isOpen={isSheetOpen}
          onClose={handleCloseSheet}
          onSaved={handlePitchSaved}
        />
      )}

      {/* Create Pitch Popup */}
      <CreatePitchPopup
        isOpen={isCreatePopupOpen}
        onClose={() => {
          setIsCreatePopupOpen(false);
          setCreatePitchAnchorRect(null);
        }}
        anchorRect={createPitchAnchorRect}
        triggerRef={createButtonRef}
        onCreated={() => {
          setIsCreatePopupOpen(false);
          setCreatePitchAnchorRect(null);
          hasInitialFetchRef.current = false;
          fetchPitches(1);
        }}
      />

      {/* Mobile FAB */}
      <MobileFAB
        onClick={() => {
          setCreatePitchAnchorRect(null);
          setIsCreatePopupOpen(true);
        }}
      />

      {/* Filter Sidebar */}
      <PitchesFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
    </>
  );
}

export default function AgentPitches(props: AgentPitchesProps) {
  return <AgentPitchesContent {...props} />;
}
