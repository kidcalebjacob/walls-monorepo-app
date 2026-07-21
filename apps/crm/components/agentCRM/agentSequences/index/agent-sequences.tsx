"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { CRMPagination } from "@/components/agentCRM/ui/crm-pagination";
import { SequenceFilter } from "@/components/agent-filters/sequence-filter";
import { CRMSkeleton } from "@/components/agentCRM/agentPeople/custom-ui/crm-skeleton";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { MobileFAB } from "@/components/ui/mobile-fab";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import UserProfileButton from "@/components/user-profile-button";
import EditAgentSequences from "../view/view-agent-sequences";
import CreateAgentSequences from "../create/create-agent-sequences";
import { Button } from "@/components/ui/button";
import { SequencesTableToolbar } from "./table/sequences-table-toolbar";
import { SequencesTableHeader } from "./table/sequences-table-header";
import { SequencesTableRow } from "./table/sequences-table-row";
import { EmailSequence, Filters } from "./types";
import { AnimatedSequenceToast } from "./ui/animated-sequence-toast";
import { MissingTemplatesPopup } from "../ui/missing-templates-popup";

const ITEMS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

function escapeIlike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

interface AgentSequencesProps {
  analyticsData: any;
}

function AgentSequencesContent({ analyticsData }: AgentSequencesProps) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get("page") || "1", 10));
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    status: searchParams.get("status") || "",
    is_campaign: searchParams.get("is_campaign") || "",
    searchTerm: searchParams.get("searchTerm") || "",
    talent: searchParams.get("talent") || "",
    owner: searchParams.get("owner") || "",
    use_case: searchParams.get("use_case") || "",
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Column width state - single source of truth
  const [columnWidths, setColumnWidths] = useState({
    name: 301,
    createdBy: 120,
    pitching: 150,
    contacts: 120,
    active: 120,
    paused: 120,
    complete: 120,
    replied: 120,
  });
  const scrollableRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [selectedSequenceData, setSelectedSequenceData] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loadingSequenceData, setLoadingSequenceData] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [showMissingTemplatesDialog, setShowMissingTemplatesDialog] = useState(false);
  const [missingTemplatesSequenceId, setMissingTemplatesSequenceId] = useState<string | null>(null);
  const [missingTemplatesSequenceName, setMissingTemplatesSequenceName] = useState<string | null>(null);

  // Helper function to build clean URLs - only include meaningful parameters
  const buildCleanUrl = (filterParams: Filters, page: number = 1) => {
    const query = new URLSearchParams();
    
    // Only add page if it's not 1
    if (page !== 1) {
      query.set("page", page.toString());
    }
    
    // Only add filters if they have values
    Object.entries(filterParams).forEach(([key, value]) => {
      if (value && value !== "") {
        query.set(key, value);
      }
    });
    
    // Return clean URL or with parameters
    return query.toString() ? `?${query.toString()}` : "";
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchTerm((prev) => {
        const next = filters.searchTerm.trim();
        return next !== prev ? next : prev;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters.searchTerm]);

  const fetchSequences = useCallback(
    async (pageNumber: number) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          wallsToast.error("Authentication Error", "Please log in to view sequences");
          setLoading(false);
          return;
        }

        const searchTerm = debouncedSearchTerm.trim().toLowerCase();
        const searchTerms = searchTerm ? searchTerm.split(/\s+/).filter(Boolean) : [];

        let query = supabase
          .from("sequences")
          .select(
            `
            *,
            owner:users!email_sequences_sequence_owner_fkey(
              avatar_url
            )
          `,
            { count: "exact" }
          );

        if (filters.status) query = query.eq("status", filters.status);
        // Default to campaigns only; "all" means no filter
        const effectiveIsCampaign = filters.is_campaign === "" ? "true" : filters.is_campaign === "all" ? null : filters.is_campaign;
        if (effectiveIsCampaign !== null) {
          query = query.eq("is_campaign", effectiveIsCampaign === "true");
        }
        // Default to current user; "all" means no filter
        const effectiveOwner = filters.owner === "" ? currentUserId : filters.owner === "all" ? null : filters.owner;
        if (effectiveOwner) query = query.eq("sequence_owner", effectiveOwner);

        if (filters.use_case) query = query.eq("use_case", filters.use_case);

        if (filters.talent) {
          const talentIds = filters.talent.split(",").map((id) => id.trim()).filter(Boolean);
          if (talentIds.length > 0) {
            const { data: seqTalent } = await supabase
              .from("sequence_talent")
              .select("sequence_id")
              .in("talent_id", talentIds);
            const sequenceIdsForTalent = Array.from(new Set((seqTalent || []).map((r) => r.sequence_id)));
            if (sequenceIdsForTalent.length === 0) {
              setSequences([]);
              setTotalItems(0);
              setTotalPages(1);
              setCurrentPage(pageNumber);
              setLoading(false);
              return;
            }
            query = query.in("id", sequenceIdsForTalent);
          }
        }

        for (const term of searchTerms) {
          const pattern = `%${escapeIlike(term)}%`;
          query = query.or(`name.ilike.${pattern},description.ilike.${pattern},status.ilike.${pattern}`);
        }

        query = query.order("created_at", { ascending: false });

        const from = (pageNumber - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        const { data, error, count } = await query.range(from, to);

        if (error) {
          console.error("Supabase query error:", error);
          throw error;
        }

        const sequenceIds = (data || []).map((seq: any) => seq.id);
      
      // Fetch contact counts for all sequences by status and replied status
      let contactCountsMap = new Map<string, number>();
      let activeCountsMap = new Map<string, number>();
      let pausedCountsMap = new Map<string, number>();
      let completeCountsMap = new Map<string, number>();
      let repliedCountsMap = new Map<string, number>();
      
      if (sequenceIds.length > 0) {
        try {
          // Fetch all contacts with their status and is_replied
          const { data: contactCounts, error: contactError } = await supabase
            .from('sequence_people')
            .select('sequence_id, status, is_replied')
            .in('sequence_id', sequenceIds);

          if (contactError) {
            console.error('Error fetching contact counts:', contactError);
          } else {
            // Count contacts per sequence and by status
            (contactCounts || []).forEach((contact: any) => {
              const seqId = contact.sequence_id;
              const status = contact.status?.toLowerCase() || '';
              
              // Total count
              contactCountsMap.set(seqId, (contactCountsMap.get(seqId) || 0) + 1);
              
              // Status-specific counts
              if (status === 'active') {
                activeCountsMap.set(seqId, (activeCountsMap.get(seqId) || 0) + 1);
              } else if (status === 'paused') {
                pausedCountsMap.set(seqId, (pausedCountsMap.get(seqId) || 0) + 1);
              } else if (status === 'completed') {
                completeCountsMap.set(seqId, (completeCountsMap.get(seqId) || 0) + 1);
              }
              
              // Count replied contacts
              if (contact.is_replied === true) {
                repliedCountsMap.set(seqId, (repliedCountsMap.get(seqId) || 0) + 1);
              }
            });
          }
        } catch (error) {
          console.error('Error fetching contact counts:', error);
        }
      }

      // Fetch talent data for all sequences
      let talentMap = new Map<string, Array<{ id: string; avatar_url: string | null }>>();
      
      if (sequenceIds.length > 0) {
        try {
          const { data: sequenceTalentData, error: talentError } = await supabase
            .from('sequence_talent')
            .select(`
              sequence_id,
              talent_id,
              talent:talent!sequence_talent_talent_id_fkey(
                id,
                avatar_url
              )
            `)
            .in('sequence_id', sequenceIds);

          if (talentError) {
            console.error('Error fetching sequence talent:', talentError);
          } else if (sequenceTalentData) {
            // Group talent by sequence_id
            sequenceTalentData.forEach((item: any) => {
              const seqId = item.sequence_id;
              const talent = Array.isArray(item.talent) ? item.talent[0] : item.talent;
              
              if (!talentMap.has(seqId)) {
                talentMap.set(seqId, []);
              }
              
              if (talent) {
                talentMap.get(seqId)!.push({
                  id: talent.id,
                  avatar_url: talent.avatar_url || null
                });
              }
            });
          }
        } catch (error) {
          console.error('Error fetching sequence talent:', error);
        }
      }

      const sequencesData: EmailSequence[] = (data || []).map((sequence: any) => ({
        id: sequence.id,
        name: sequence.name || "—",
        description: sequence.description || null,
        status: sequence.status || "draft",
        use_case: sequence.use_case || "general",
        sequence_owner: sequence.sequence_owner || "",
        owner_avatar_url: sequence.owner?.avatar_url || null,
        contact_count: contactCountsMap.get(sequence.id) || 0,
        active_count: activeCountsMap.get(sequence.id) || 0,
        paused_count: pausedCountsMap.get(sequence.id) || 0,
        complete_count: completeCountsMap.get(sequence.id) || 0,
        replied_count: repliedCountsMap.get(sequence.id) || 0,
        created_at: sequence.created_at || null,
        talent: talentMap.get(sequence.id) || [],
      }));

      const total = count ?? 0;
      setSequences(sequencesData);
      setTotalItems(total);
      setTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)));
      setCurrentPage(pageNumber);
    } catch (error) {
      console.error("Error fetching sequences:", error);
      wallsToast.error("Error", "Failed to load sequences data");
      setSequences([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  },
  [user, debouncedSearchTerm, filters.status, filters.is_campaign, filters.owner, filters.talent, filters.use_case, currentUserId]
  );

  // Fetch the current user's app ID once so we can apply default owner filter implicitly
  useEffect(() => {
    if (!user) return;
    const fetchCurrentUserId = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser?.email) return;
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', authUser.email)
          .single();
        if (userData?.id) setCurrentUserId(userData.id as string);
      } catch (error) {
        console.error("Error fetching current user ID:", error);
      }
    };
    fetchCurrentUserId();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSequences([]);
      setTotalItems(0);
      setTotalPages(1);
      setLoading(false);
      lastFetchKeyRef.current = null;
      return;
    }
    // Wait for current user ID before fetching when using default owner filter
    if (filters.owner === "" && currentUserId === null) {
      setLoading(true);
      return;
    }
    const fetchKey = [
      currentPage,
      debouncedSearchTerm,
      filters.status,
      filters.is_campaign,
      filters.owner,
      filters.talent,
      filters.use_case,
      currentUserId,
    ].join("|");
    if (lastFetchKeyRef.current === fetchKey && sequences.length > 0) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;
    fetchSequences(currentPage);
  }, [user, currentPage, debouncedSearchTerm, filters.status, filters.is_campaign, filters.owner, filters.talent, filters.use_case, fetchSequences, sequences.length, refreshTrigger, currentUserId]);

  useLayoutEffect(() => {
    const syncScrollPositions = () => {
      const headerScrollLeft = headerScrollRef.current?.scrollLeft ?? 0;
      scrollableRefs.current.forEach((ref) => {
        if (ref) ref.scrollLeft = headerScrollLeft;
      });
    };

    const raf = requestAnimationFrame(syncScrollPositions);
    return () => cancelAnimationFrame(raf);
  }, [sequences, columnWidths]);

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
    setCurrentPage(page);
    const cleanUrl = buildCleanUrl(filters, page);
    router.replace(`/agents/crm/sequences${cleanUrl}`);
  };

  const refreshSequencesList = useCallback(() => {
    const key = [1, debouncedSearchTerm, filters.status, filters.is_campaign, filters.owner, filters.talent].join("|");
    lastFetchKeyRef.current = null;
    setCurrentPage(1);
    setRefreshTrigger((t) => t + 1);
    fetchSequences(1);
    lastFetchKeyRef.current = key;
    const cleanUrl = buildCleanUrl(filters, 1);
    router.replace(`/agents/crm/sequences${cleanUrl}`);
  }, [fetchSequences, debouncedSearchTerm, filters, router]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleFilterChange = (filterKey: string, value: string | string[]) => {
    const updatedFilters = {
      ...filters,
      [filterKey]: Array.isArray(value) ? value.join(',') : value,
    };

    setFilters(updatedFilters);
    setCurrentPage(1);

    // Update URL with new filters
    const cleanUrl = buildCleanUrl(updatedFilters, 1);
    router.replace(`/agents/crm/sequences${cleanUrl}`);
  };

  const handleReset = () => {
    const resetFilters: Filters = { status: "", is_campaign: "", searchTerm: "", talent: "", owner: "", use_case: "" };
    setFilters(resetFilters);
    setCurrentPage(1);
    lastFetchKeyRef.current = null;
    router.replace(`/agents/crm/sequences`);
  };

  const handleStatusToggle = async (sequenceId: string, currentStatus: string, checked: boolean) => {
    try {
      const supabase = getSupabaseClient();
      const newStatus = checked ? 'active' : 'paused';
      
      // Get sequence name for toast
      const sequence = sequences.find(seq => seq.id === sequenceId);
      const sequenceName = sequence?.name;
      
      // If activating, check that all email steps have message templates
      if (checked && newStatus === 'active') {
        // Fetch all step joins for this sequence
        const { data: sequenceStepsJoin, error: stepsJoinError } = await supabase
          .from('sequence_steps_join')
          .select('id, step_id')
          .eq('sequence_id', sequenceId)
          .eq('is_archived', false);

        if (stepsJoinError) {
          console.error('Error fetching sequence steps join:', stepsJoinError);
          wallsToast.error("Failed to validate sequence steps");
          return;
        }

        if (!sequenceStepsJoin || sequenceStepsJoin.length === 0) {
          // No steps in sequence, allow activation
        } else {
          // Get unique step_ids
          const stepIdArray = sequenceStepsJoin.map((s: any) => s.step_id).filter(Boolean);
          const stepIds = stepIdArray.filter((id, index) => stepIdArray.indexOf(id) === index);
          
          if (stepIds.length > 0) {
            // Fetch the step definitions to get channel information
            const { data: stepDefinitions, error: stepsError } = await supabase
              .from('sequence_steps')
              .select('id, channel')
              .in('id', stepIds);

            if (stepsError) {
              console.error('Error fetching step definitions:', stepsError);
              wallsToast.error("Failed to validate sequence steps");
              return;
            }

            // Create a map of step_id to channel
            const stepChannelMap = new Map(
              (stepDefinitions || []).map((step: any) => [step.id, step.channel])
            );

            // Filter to only email steps
            const emailSteps = sequenceStepsJoin.filter(
              (stepJoin: any) => stepChannelMap.get(stepJoin.step_id) === 'email'
            );

            if (emailSteps.length > 0) {
              // Check which email steps have message templates
              const stepJoinIds = emailSteps.map((step: any) => step.id);
              
              const { data: templates, error: templatesError } = await supabase
                .from('sequence_message_templates')
                .select('step_id')
                .in('step_id', stepJoinIds);

              if (templatesError) {
                console.error('Error fetching message templates:', templatesError);
                wallsToast.error("Failed to validate message templates");
                return;
              }

              const stepsWithTemplates = new Set((templates || []).map((t: any) => t.step_id));
              const stepsWithoutTemplates = emailSteps.filter(
                (step: any) => !stepsWithTemplates.has(step.id)
              );

              // If any email steps are missing templates, show dialog and prevent activation
              if (stepsWithoutTemplates.length > 0) {
                setMissingTemplatesSequenceId(sequenceId);
                setMissingTemplatesSequenceName(sequenceName || 'this sequence');
                setShowMissingTemplatesDialog(true);
                return;
              }
            }
          }
        }
      }
      
      // Proceed with status update
      const { error } = await supabase
        .from('sequences')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', sequenceId);

      if (error) {
        console.error('Error updating sequence status:', error);
        wallsToast.error("Failed to update sequence status");
        return;
      }

      // Update local state
      setSequences(prev => prev.map(seq => 
        seq.id === sequenceId 
          ? { ...seq, status: newStatus, updated_at: new Date().toISOString() }
          : seq
      ));

      // Show toast
      if (checked) {
        wallsToast.success("Sequence activated", sequenceName);
      } else {
        wallsToast.negative("Sequence paused", sequenceName);
      }
    } catch (error) {
      console.error("Error updating sequence status:", error);
      wallsToast.error("Failed to update sequence status");
    }
  };

  const handleSequenceClick = async (sequenceId: string) => {
    setSelectedSequenceId(sequenceId);
    setLoadingSequenceData(true);
    setIsSheetOpen(true);

    try {
      const supabase = getSupabaseClient();
      const { data: sequence, error } = await supabase
        .from('sequences')
        .select(`
          *,
          owner:users!email_sequences_sequence_owner_fkey(
            avatar_url
          )
        `)
        .eq('id', sequenceId)
        .single();

      if (error) {
        console.error("Error fetching sequence:", error);
        wallsToast.error("Error", "Failed to load sequence data");
        setIsSheetOpen(false);
        return;
      }

      if (sequence) {
        // Get contact counts
        const { data: contactCounts } = await supabase
          .from('sequence_people')
          .select('status, is_replied')
          .eq('sequence_id', sequenceId);

        let contact_count = 0;
        let active_count = 0;
        let paused_count = 0;
        let complete_count = 0;
        let replied_count = 0;

        if (contactCounts) {
          contact_count = contactCounts.length;
          contactCounts.forEach((contact: any) => {
            const status = contact.status?.toLowerCase() || '';
            if (status === 'active') active_count++;
            else if (status === 'paused') paused_count++;
            else if (status === 'completed') complete_count++;
            if (contact.is_replied === true) replied_count++;
          });
        }

        setSelectedSequenceData({
          id: sequence.id,
          name: sequence.name || '',
          description: sequence.description || null,
          status: sequence.status || 'draft',
          stop_on_reply: sequence.stop_on_reply ?? true,
          daily_limit: sequence.daily_limit || null,
          is_campaign: sequence.is_campaign || false,
          created_at: sequence.created_at || null,
          updated_at: sequence.updated_at || null,
          sequence_owner: sequence.sequence_owner || '',
          owner_avatar_url: sequence.owner?.avatar_url || null,
          contact_count,
          active_count,
          paused_count,
          complete_count,
          replied_count,
          use_case: sequence.use_case || 'general',
        });
      }
    } catch (error) {
      console.error("Error fetching sequence data:", error);
      wallsToast.error("Error", "Failed to load sequence data");
      setIsSheetOpen(false);
    } finally {
      setLoadingSequenceData(false);
    }
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedSequenceId(null);
    setSelectedSequenceData(null);
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
        <SequencesTableToolbar
          filters={filters}
          onFilterChange={handleFilterChange}
          onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
          onCreateClick={() => setIsCreateSheetOpen(true)}
        />

        <div className="app-sidebar-pad flex-1 overflow-y-auto overscroll-none pr-0">
          <TooltipPrimitive.Provider delayDuration={200}>
          <div ref={tableWrapperRef} className="flex flex-col gap-0 min-h-full">
            {/* Header Row - Always visible */}
            <SequencesTableHeader
              headerScrollRef={headerScrollRef}
              columnWidths={columnWidths}
              setColumnWidths={setColumnWidths}
            />

            {/* Content Area - Loading or Data */}
            <div className="flex-1 bg-kenoo-white flex flex-col">
            {loading ? (
              <CRMSkeleton count={12} />
            ) : (
              <>
                {sequences.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Button
                      onClick={() => {
                        setIsCreateSheetOpen(true);
                      }}
                      variant="ghost"
                      className="relative group hover:bg-transparent"
                    >
                      <div className="relative z-10 p-3 bg-neutral-100/80 backdrop-blur-md rounded-full shadow-inner border border-neutral-200/50 transition-all duration-300 ease-in-out group-hover:bg-neutral-100 group-hover:shadow-inner group-hover:border-neutral-200 group-hover:shadow-[inset_0_6px_12px_rgba(0,0,0,0.25)] group-hover:scale-[0.98] px-6">
                        <span className="font-light text-slate-600">+ Add sequence</span>
                      </div>
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {sequences.map((sequence, index) => (
                      <div key={sequence.id}>
                        <SequencesTableRow
                          sequence={sequence}
                          index={index}
                          scrollableRefs={scrollableRefs}
                          onSequenceClick={handleSequenceClick}
                          onStatusToggle={handleStatusToggle}
                          columnWidths={columnWidths}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            </div>

            {/* Pagination - Always visible */}
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

      <SequenceFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Mobile Floating Action Button */}
      <MobileFAB 
        onClick={() => {
          setIsCreateSheetOpen(true);
        }}
      />

      {/* Sequence Detail Sheet */}
      {selectedSequenceId && selectedSequenceData && (
        <EditAgentSequences
          analyticsData={analyticsData}
          sequenceId={selectedSequenceId}
          initialData={selectedSequenceData}
          isOpen={isSheetOpen}
          onClose={handleCloseSheet}
          onDelete={refreshSequencesList}
        />
      )}

      {/* Create Sequence Sheet */}
      <CreateAgentSequences
        isOpen={isCreateSheetOpen}
        onClose={() => {
          setIsCreateSheetOpen(false);
          refreshSequencesList();
        }}
        onSuccess={refreshSequencesList}
      />

      {/* Missing Templates Dialog */}
      <MissingTemplatesPopup
        isOpen={showMissingTemplatesDialog}
        onClose={() => {
          setShowMissingTemplatesDialog(false);
          setMissingTemplatesSequenceId(null);
          setMissingTemplatesSequenceName(null);
        }}
        onEditSequence={() => {
          if (missingTemplatesSequenceId) {
            setShowMissingTemplatesDialog(false);
            handleSequenceClick(missingTemplatesSequenceId);
            setMissingTemplatesSequenceId(null);
            setMissingTemplatesSequenceName(null);
          }
        }}
        sequenceName={missingTemplatesSequenceName}
      />
    </>
  );
}

export default function AgentSequences(props: AgentSequencesProps) {
  return <AgentSequencesContent {...props} />;
}

