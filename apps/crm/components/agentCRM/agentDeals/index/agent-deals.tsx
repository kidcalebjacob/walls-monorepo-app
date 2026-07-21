"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { CRMPagination } from "@/components/agentCRM/ui/crm-pagination";
import { DealsFilter } from "@/components/agent-filters/deals-filter";
import { CRMSkeleton } from "@/components/agentCRM/agentPeople/custom-ui/crm-skeleton";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { MobileFAB } from "@/components/ui/mobile-fab";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import UserProfileButton from "@/components/user-profile-button";
import EditAgentCompanies from "@/components/agentCRM/agentCompanies/view/view-agent-companies";
import EditAgentDeals from "@/components/agentCRM/agentDeals/view/view-agent-deals";
import CreateAgentDeals from "@/components/agentCRM/agentDeals/create/create-agent-deals";
import { DealsTableToolbar, DealsView } from "./table/deals-table-toolbar";
import { DealsTableHeader } from "./table/deals-table-header";
import { DealsTableRow } from "./table/deals-table-row";
import { DealsKanban } from "./kanban/deals-kanban";
import { Deal, Filters, ImageStates } from "./types";
import { buildDealsQuery, mapRawDealsToDeals, DealsSortState } from "./deals-data";
import { fetchCompanySocialUrls } from "@/lib/company-social";

const ITEMS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

interface AgentDealsProps {
  analyticsData: any;
}

export default function AgentDeals({ analyticsData }: AgentDealsProps) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get("page") || "1", 10));
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [view, setView] = useState<DealsView>(
    searchParams.get("view") === "kanban" ? "kanban" : "table"
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isSortingByRecency, setIsSortingByRecency] = useState(true);
  const [isSortingByName, setIsSortingByName] = useState(false);
  const [isSortingByStage, setIsSortingByStage] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    status: searchParams.get("status") || "",
    stage: searchParams.get("stage") || "",
    owner: searchParams.get("owner") || "",
    searchTerm: searchParams.get("searchTerm") || "",
    amountRange: searchParams.get("amountRange") || "",
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [imageStates, setImageStates] = useState<ImageStates>({});

  const [columnWidths, setColumnWidths] = useState({
    name: 301,
    company: 200,
    talent: 150,
    dealOwner: 150,
    creator: 150,
    amount: 150,
    stage: 150,
    recurrence: 150,
    created: 120,
  });
  const scrollableRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyData, setSelectedCompanyData] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loadingCompanyData, setLoadingCompanyData] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedDealData, setSelectedDealData] = useState<any>(null);
  const [isDealSheetOpen, setIsDealSheetOpen] = useState(false);
  const [loadingDealData, setLoadingDealData] = useState(false);

  useLayoutEffect(() => {
    const syncScrollPositions = () => {
      const headerScrollLeft = headerScrollRef.current?.scrollLeft ?? 0;
      scrollableRefs.current.forEach((ref) => {
        if (ref) ref.scrollLeft = headerScrollLeft;
      });
    };

    const raf = requestAnimationFrame(syncScrollPositions);
    return () => cancelAnimationFrame(raf);
  }, [deals, columnWidths]);

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

  const buildCleanUrl = (filterParams: Filters, page: number = 1, viewParam: DealsView = view) => {
    const query = new URLSearchParams();
    if (page !== 1) query.set("page", page.toString());
    if (viewParam === "kanban") query.set("view", "kanban");
    Object.entries(filterParams).forEach(([key, value]) => {
      if (value && value !== "") query.set(key, value);
    });
    return query.toString() ? `?${query.toString()}` : "";
  };

  const handleViewChange = (nextView: DealsView) => {
    setView(nextView);
    router.replace(`/agents/crm/deals${buildCleanUrl(filters, currentPage, nextView)}`);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    const updatedFilters = { ...filters, [filterKey]: value };
    setFilters(updatedFilters);
    setCurrentPage(1);
    router.replace(`/agents/crm/deals${buildCleanUrl(updatedFilters, 1)}`);
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

  const fetchDeals = useCallback(
    async (pageNumber: number) => {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const useAmountFilter = Boolean(filters.amountRange && filters.amountRange !== "10000+");
        const limitForAmountFilter = 500;
        const sort: DealsSortState = { sortDirection, isSortingByRecency, isSortingByName, isSortingByStage };

        const query = buildDealsQuery(supabase, {
          filters,
          currentUserId,
          debouncedSearchTerm,
          sort,
          withCount: !useAmountFilter,
        });

        let dealsDataRaw: any[] | null;
        let totalCount: number;

        if (useAmountFilter) {
          const { data, error } = await query.limit(limitForAmountFilter);
          if (error) throw error;
          dealsDataRaw = data;
          totalCount = (data || []).length;
        } else {
          const from = (pageNumber - 1) * ITEMS_PER_PAGE;
          const to = from + ITEMS_PER_PAGE - 1;
          const { data, error, count } = await query.range(from, to);
          if (error) throw error;
          dealsDataRaw = data;
          totalCount = count ?? 0;
        }

        if ((dealsDataRaw || []).length === 0) {
          setDeals([]);
          setTotalPages(1);
          setTotalItems(0);
          setCurrentPage(pageNumber);
          setLoading(false);
          return;
        }

        let dealsData: Deal[] = await mapRawDealsToDeals(supabase, dealsDataRaw);

        // When amount filter is set we fetched up to limitForAmountFilter; filter by amount and paginate in memory
        if (useAmountFilter && filters.amountRange && filters.amountRange !== "10000+") {
          const [min, max] = filters.amountRange.split("-").map(Number);
          if (!isNaN(min) && !isNaN(max)) {
            dealsData = dealsData.filter((d) => d.amount >= min && d.amount <= max);
          }
          totalCount = dealsData.length;
        }
        if (useAmountFilter) {
          const startIndex = (pageNumber - 1) * ITEMS_PER_PAGE;
          const endIndex = startIndex + ITEMS_PER_PAGE;
          dealsData = dealsData.slice(startIndex, endIndex);
        }

        setDeals(dealsData);
        setTotalItems(totalCount);
        setTotalPages(Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE)));
        setCurrentPage(pageNumber);
      } catch (error) {
        console.error("Error fetching deals:", error);
        wallsToast.error("Error loading deals", error instanceof Error ? error.message : "Failed to load deals.");
        setDeals([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [
      authLoading,
      user,
      debouncedSearchTerm,
      filters.status,
      filters.stage,
      filters.owner,
      filters.amountRange,
      sortDirection,
      isSortingByRecency,
      isSortingByName,
      isSortingByStage,
      currentUserId,
    ]
  );

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  };
  const toggleSortByRecency = () => {
    if (!isSortingByRecency) {
      setIsSortingByRecency(true);
      setIsSortingByName(false);
      setIsSortingByStage(false);
    }
  };
  const toggleSortByName = () => {
    if (!isSortingByName) {
      setIsSortingByName(true);
      setIsSortingByRecency(false);
      setIsSortingByStage(false);
    }
  };
  const toggleSortByStage = () => {
    if (!isSortingByStage) {
      setIsSortingByStage(true);
      setIsSortingByName(false);
      setIsSortingByRecency(false);
    }
  };

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
    // Kanban view fetches its own data; skip the table's paginated fetch while it's active.
    if (view !== "table") return;
    if (authLoading) { setLoading(true); return; }
    if (!user) {
      setDeals([]);
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
      filters.stage,
      filters.owner,
      filters.amountRange,
      sortDirection,
      isSortingByRecency,
      isSortingByName,
      isSortingByStage,
      currentUserId,
    ].join("|");
    if (lastFetchKeyRef.current === fetchKey && deals.length > 0) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;
    fetchDeals(currentPage);
  }, [view, authLoading, user, currentPage, debouncedSearchTerm, filters.status, filters.stage, filters.owner, filters.amountRange, sortDirection, isSortingByRecency, isSortingByName, isSortingByStage, currentUserId, fetchDeals, deals.length, refreshTrigger]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    router.replace(`/agents/crm/deals${buildCleanUrl(filters, page)}`);
  };

  const refreshDealsList = useCallback(() => {
    const key = [1, debouncedSearchTerm, filters.status, filters.stage, filters.owner, filters.amountRange, sortDirection, isSortingByRecency, isSortingByName, isSortingByStage].join("|");
    lastFetchKeyRef.current = null;
    setCurrentPage(1);
    setRefreshTrigger((t) => t + 1);
    fetchDeals(1);
    lastFetchKeyRef.current = key;
    router.replace(`/agents/crm/deals${buildCleanUrl(filters, 1)}`);
  }, [fetchDeals, debouncedSearchTerm, filters, sortDirection, isSortingByRecency, isSortingByName, isSortingByStage, router]);


  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleImageError = (dealId: string) => {
    setImageStates(prev => ({
      ...prev,
      [dealId]: {
        ...prev[dealId] || { companyFailed: false },
        companyFailed: true
      }
    }));
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

  const handleDealClick = async (dealId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dealId) return;
    setSelectedDealId(dealId);
    setLoadingDealData(true);
    setIsDealSheetOpen(true);

    try {
      const supabase = getSupabaseClient();
      const { data: deal, error } = await supabase
        .from('deals')
        .select(`
          id,
          deal_name,
          source,
          deal_type,
          deal_stage_id,
          deal_owner,
          vendor_company_id,
          created_at,
          updated_at,
          deal_stages (id, name, slug, is_won, is_lost, order_index, probability),
          users!deals_deal_owner_fkey (id, first_name, last_name, avatar_url)
        `)
        .eq('id', dealId)
        .single();

      if (error || !deal) {
        console.error("Error fetching deal:", error);
        wallsToast.error("Error", "Failed to load deal data");
        setIsDealSheetOpen(false);
        return;
      }

      const [dealCompaniesRes, deliverablesRes, eventsRes, dealTalentRes] = await Promise.all([
        supabase.from('deal_companies').select('company_id, role, companies(id, name, website, logo_url)').eq('deal_id', dealId),
        supabase.from('deal_deliverables').select('id, name, quantity, unit_price_cents, billing_type, recurrence_count').eq('deal_id', dealId),
        supabase.from('deal_events').select('id, name, description, event_type, due_at, related_deliverable_id').eq('deal_id', dealId).order('due_at', { ascending: true }),
        supabase.from('deal_talent').select('id, talent_id, role, revenue_share_bps, talent(id, first_name, last_name, avatar_url)').eq('deal_id', dealId),
      ]);

      const companyRow = (dealCompaniesRes.data || []).find((dc: any) => dc.role === 'client') || dealCompaniesRes.data?.[0];
      const company = companyRow?.companies ? (Array.isArray(companyRow.companies) ? companyRow.companies[0] : companyRow.companies) : null;
      const amount = (deliverablesRes.data || []).reduce((sum: number, d: any) => {
        const q = Number(d.quantity) || 0;
        const c = Number(d.unit_price_cents) || 0;
        let lineTotal = (q * c) / 100;
        const isRecurring = d.billing_type === 'recurring';
        const recur = d.recurrence_count != null ? Number(d.recurrence_count) || 0 : 0;
        if (isRecurring && recur > 0) lineTotal *= recur;
        return sum + lineTotal;
      }, 0);
      const firstEvent = (eventsRes.data || [])[0];
      const stage = Array.isArray(deal.deal_stages) ? deal.deal_stages[0] : deal.deal_stages;
      const owner = Array.isArray(deal.users) ? deal.users[0] : deal.users;
      const creatorName = owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() : 'Unknown';

      const eventsList = (eventsRes.data || []).map((e: any) => ({
        id: e.id,
        name: e.name || '',
        description: e.description ?? null,
        event_type: e.event_type || 'custom',
        due_at: e.due_at || '',
        related_deliverable_id: e.related_deliverable_id ?? null,
      }));
      const deliverablesList = (deliverablesRes.data || []).map((d: any) => ({
        type: d.name || '',
        quantity: Number(d.quantity) || 0,
        price_per: Number(d.unit_price_cents) / 100 || 0,
      }));
      const _dealDeliverables = (deliverablesRes.data || []).map((d: any) => ({ id: d.id, name: d.name || '' }));
      const conceptSubmissionDate = eventsList.find((e: any) => e.event_type === 'proposal_due')?.due_at || '';
      const submissionDueDate = eventsList.find((e: any) => e.event_type === 'deliverable_due')?.due_at || '';
      const liveDueDate = eventsList.find((e: any) => e.event_type === 'go_live_date')?.due_at || '';
      const payoutDate = eventsList.find((e: any) => e.event_type === 'net_payout_start')?.due_at || '';

      const dealTalentList = (dealTalentRes.data || []).map((dt: any) => {
        const t = Array.isArray(dt.talent) ? dt.talent[0] : dt.talent;
        const name = t ? `${t.first_name || ''} ${t.last_name || ''}`.trim() : '';
        return { id: dt.id, talent_id: dt.talent_id, talent_name: name, avatar_url: t?.avatar_url ?? undefined, role: dt.role ?? undefined, revenue_share_bps: dt.revenue_share_bps ?? undefined };
      });
      const firstTalent = dealTalentList[0];
      const creatorFromTalent = firstTalent?.talent_name || creatorName;
      const avatarFromTalent = firstTalent?.avatar_url ?? owner?.avatar_url;

      setSelectedDealData({
        creator: creatorFromTalent,
        company: company?.name || '',
        dealName: deal.deal_name || 'Unnamed Deal',
        amount: amount.toString(),
        payoutNet: '',
        leadSource: deal.source || '',
        deliverables: deliverablesList,
        events: eventsList,
        _dealDeliverables,
        submissionDueDate,
        liveDueDate,
        stage: stage?.name || '',
        pointOfContact: '',
        ideationDueDate: '',
        split: '',
        dealOwner: deal.deal_owner || '',
        expectedNet: '',
        nextStep: '',
        expectedRevenue: '',
        payoutDate,
        probability: stage?.probability?.toString() || '',
        conceptSubmissionDate,
        pipeline: deal.deal_type || '',
        companyWebsite: company?.website || '',
        creatorProfilePicture: avatarFromTalent || '',
        contractFile: null,
        contractFileName: '',
        contractFileUrl: '',
        invoiceVendorCompanyId: (deal as any).vendor_company_id ?? null,
        _dealId: deal.id,
        _dealStageId: deal.deal_stage_id,
        _companyId: company?.id || (companyRow as any)?.company_id || null,
        dealTalent: dealTalentList,
        dealContacts: [],
        dealDocuments: [],
      });
    } catch (error) {
      console.error("Error fetching deal data:", error);
      wallsToast.error("Error", "Failed to load deal data");
      setIsDealSheetOpen(false);
    } finally {
      setLoadingDealData(false);
    }
  };

  const handleCloseDealSheet = () => {
    setIsDealSheetOpen(false);
    setSelectedDealId(null);
    setSelectedDealData(null);
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
      <div className="flex-1 w-full flex flex-col min-h-0">
        <DealsTableToolbar
          filters={filters}
          onFilterChange={handleFilterChange}
          onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
          onCreateClick={() => setIsCreateOpen(true)}
          view={view}
          onViewChange={handleViewChange}
        />

        {view === "kanban" ? (
          <DealsKanban
            filters={filters}
            debouncedSearchTerm={debouncedSearchTerm}
            currentUserId={currentUserId}
            refreshTrigger={refreshTrigger}
            onDealClick={handleDealClick}
          />
        ) : (
          <div className="app-sidebar-pad flex-1 overflow-y-auto overscroll-none pr-0">
            <TooltipPrimitive.Provider delayDuration={200}>
              <div ref={tableWrapperRef} className="flex flex-col gap-0 min-h-full">
              {/* Header Row - Always visible */}
              <DealsTableHeader
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
                  {deals.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-muted-foreground font-light">No deals found matching your criteria.</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col">
                      {deals.map((deal, index) => (
                        <div key={deal.id}>
                          <DealsTableRow
                            deal={deal}
                            index={index}
                            imageStates={imageStates}
                            scrollableRefs={scrollableRefs}
                            onImageError={handleImageError}
                            onCompanyClick={handleCompanyClick}
                            onDealClick={handleDealClick}
                            formatDate={formatDate}
                            formatAmount={formatAmount}
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
        )}
        </div>
      </div>
      <DealsFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Mobile Floating Action Button */}
      <MobileFAB
        onClick={() => setIsCreateOpen(true)}
      />
      
      {/* Company Detail Sheet */}
      {selectedCompanyId && selectedCompanyData && (
        <EditAgentCompanies
          analyticsData={null}
          companyId={selectedCompanyId}
          initialData={selectedCompanyData}
          isOpen={isSheetOpen}
          onClose={handleCloseSheet}
        />
      )}

      {/* Deal Detail Sheet */}
      {selectedDealId && selectedDealData && (
        <EditAgentDeals
          analyticsData={null}
          dealId={selectedDealId}
          initialData={selectedDealData}
          isOpen={isDealSheetOpen}
          onClose={handleCloseDealSheet}
          onSaved={refreshDealsList}
        />
      )}

      {/* Create Deal Sheet */}
      <CreateAgentDeals
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          refreshDealsList();
        }}
      />
    </>
  );
}