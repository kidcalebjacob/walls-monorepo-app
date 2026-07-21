"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { CRMPagination } from "@/components/agentCRM/ui/crm-pagination";
import { CompanyFilter } from "@/components/agent-filters/company-filter";
import { CRMSkeleton } from "@/components/agentCRM/agentPeople/custom-ui/crm-skeleton";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { MobileFAB } from "@/components/ui/mobile-fab";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import UserProfileButton from "@/components/user-profile-button";
import EditAgentCompanies from "../view/view-agent-companies";
import CreateAgentCompanies from "../create/create-agent-companies";
import { createClient } from '@supabase/supabase-js';
import EmailComposer from "@/components/agentCRM/emailComposer/email-composer";
import { CreateCompanyPopup, type CreateCompanyAnchorRect } from "../create/popup/create-company";
import AddToSequencePopup from "@/components/agentCRM/ui/add-to-sequence-popup";
import { AnimatedSuccessToast } from "./ui/animated-success-toast";
import { CompaniesTableToolbar } from "./table/companies-table-toolbar";
import { CompaniesTableHeader } from "./table/companies-table-header";
import { CompaniesTableRow } from "./table/companies-table-row";
import { Company, Filters, ImageStates, SequencePopupCompanyData } from "./types";
import { fetchCompanySocialUrls } from "@/lib/company-social";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ITEMS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

function escapeIlike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

interface AgentCompaniesProps {
  analyticsData: any;
}

const ensureHttps = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

function mapSupabaseCompany(company: any): Company {
  const tags = (company.companies_tags || []).map((tagRow: any) => ({
    tag: tagRow.tag || '',
    type: tagRow.type || '',
  }));

  return {
    id: company.id,
    name: company.name || '—',
    industry: company.industry || '—',
    website: company.website || '',
    domain: company.domain || '',
    phone: company.phone || '—',
    employeeCount: company.employee_count ?? null,
    annualRevenue: company.annual_revenue ?? null,
    country: company.country || '—',
    city: company.city || '—',
    foundingYear: company.founding_year ?? null,
    createdAt: company.created_at ?? null,
    logoUrl: company.logo_url ?? null,
    lastEnriched: company.last_enriched ?? null,
    tags,
  };
}

function AgentCompaniesContent({ analyticsData }: AgentCompaniesProps) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    industry: "",
    status: "",
    country: "",
    employeeCount: "",
    revenueRange: "",
    searchTerm: "",
  });
  const [imageStates, setImageStates] = useState<ImageStates>({});
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
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [createCompanyAnchorRect, setCreateCompanyAnchorRect] = useState<CreateCompanyAnchorRect>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [isSequencePopupOpen, setIsSequencePopupOpen] = useState(false);
  const [sequencePopupCompanyId, setSequencePopupCompanyId] = useState<string | null>(null);
  const [sequencePopupCompanyData, setSequencePopupCompanyData] = useState<SequencePopupCompanyData | null>(null);
  
  // Column width state - single source of truth
  const [columnWidths, setColumnWidths] = useState({
    name: 301,
    industry: 150,
    website: 150,
    phone: 150,
    employees: 150,
    revenue: 150,
    country: 150,
    city: 150,
    founded: 120,
    created: 120,
    enrichment: 80,
  });

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchTerm((prev) => {
        const next = filters.searchTerm.trim();
        return next !== prev ? next : prev;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters.searchTerm]);

  const fetchCompanies = useCallback(
    async (pageNumber: number) => {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          wallsToast.error("Authentication Error", "Please log in to view companies");
          setLoading(false);
          return;
        }

        const searchTerm = debouncedSearchTerm.trim().toLowerCase();
        const searchTerms = searchTerm ? searchTerm.split(/\s+/).filter(Boolean) : [];

        let query = supabase
          .from('companies')
          .select('*, companies_tags(tag, type)', { count: 'exact' });

        if (filters.industry) query = query.eq('industry', filters.industry);
        if (filters.country) query = query.eq('country', filters.country);

        if (filters.employeeCount) {
          if (filters.employeeCount.includes('-')) {
            const [min, max] = filters.employeeCount.split('-').map(val => parseInt(val, 10));
            if (!isNaN(min)) query = query.gte('employee_count', min);
            if (!isNaN(max)) query = query.lte('employee_count', max);
          } else if (filters.employeeCount.endsWith('+')) {
            const min = parseInt(filters.employeeCount.replace('+', ''), 10);
            if (!isNaN(min)) query = query.gte('employee_count', min);
          } else {
            const n = parseInt(filters.employeeCount, 10);
            if (!isNaN(n)) query = query.eq('employee_count', n);
          }
        }

        if (filters.revenueRange) {
          const parts = filters.revenueRange.split('-').map(val => {
            const v = val.trim();
            if (v.endsWith('M')) return parseFloat(v) * 1000000;
            if (v.endsWith('+')) return Number.MAX_SAFE_INTEGER;
            return parseFloat(v) || 0;
          });
          const [min, max] = parts.length >= 2 ? [parts[0], parts[1]] : [parts[0], Number.MAX_SAFE_INTEGER];
          query = query.gte('annual_revenue', min);
          if (max !== Number.MAX_SAFE_INTEGER) query = query.lte('annual_revenue', max);
        }

        // Fetch tag-matched company IDs for all search terms in parallel
        const tagIdsByTerm: Record<string, string[]> = {};
        if (searchTerms.length > 0) {
          await Promise.all(
            searchTerms.map(async (term) => {
              const escaped = escapeIlike(term);
              const { data } = await supabase
                .from('companies_tags')
                .select('company_id')
                .ilike('tag', `%${escaped}%`);
              tagIdsByTerm[term] = Array.from(
                new Set((data ?? []).map((r: any) => r.company_id as string))
              );
            })
          );
        }

        for (const term of searchTerms) {
          const escaped = escapeIlike(term);
          const pattern = `%${escaped}%`;
          const tagIds = tagIdsByTerm[term] ?? [];
          const inClause = tagIds.length > 0 ? `,id.in.(${tagIds.join(',')})` : '';
          query = query.or(
            `name.ilike.${pattern},industry.ilike.${pattern},website.ilike.${pattern},domain.ilike.${pattern},country.ilike.${pattern},city.ilike.${pattern}${inClause}`
          );
        }

        query = query.order('created_at', { ascending: false });

        const from = (pageNumber - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        const { data, error, count } = await query.range(from, to);

        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }

        const companiesData: Company[] = (data || []).map(mapSupabaseCompany);

        const total = count ?? 0;
        setCompanies(companiesData);
        setTotalItems(total);
        setTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)));
        setCurrentPage(pageNumber);
      } catch (error) {
        console.error("Error fetching companies:", error);
        wallsToast.error("Error", "Failed to load companies data");
        setCompanies([]);
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
      filters.industry,
      filters.country,
      filters.employeeCount,
      filters.revenueRange,
    ]
  );

  const refreshCompanyInList = useCallback(async (companyId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*, companies_tags(tag, type)')
        .eq('id', companyId)
        .single();

      if (error || !data) return;

      const updated = mapSupabaseCompany(data);
      setCompanies((prev) => prev.map((company) => (company.id === companyId ? updated : company)));
    } catch (error) {
      console.error('Error refreshing enriched company:', error);
    }
  }, []);

  const handleCompanyEnriched = useCallback((companyId: string) => {
    const now = new Date().toISOString();
    setCompanies((prev) =>
      prev.map((company) =>
        company.id === companyId ? { ...company, lastEnriched: now } : company
      )
    );
    void refreshCompanyInList(companyId);
  }, [refreshCompanyInList]);

  useEffect(() => {
    if (authLoading) { setLoading(true); return; }
    if (!user) {
      setCompanies([]);
      setTotalItems(0);
      setTotalPages(1);
      setLoading(false);
      lastFetchKeyRef.current = null;
      return;
    }
    const fetchKey = [
      currentPage,
      debouncedSearchTerm,
      filters.industry,
      filters.country,
      filters.employeeCount,
      filters.revenueRange,
    ].join("|");
    if (lastFetchKeyRef.current === fetchKey && companies.length > 0) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;
    fetchCompanies(currentPage);
  }, [authLoading, user, currentPage, debouncedSearchTerm, filters.industry, filters.country, filters.employeeCount, filters.revenueRange, fetchCompanies, companies.length, refreshTrigger]);

  useLayoutEffect(() => {
    const syncScrollPositions = () => {
      const headerScrollLeft = headerScrollRef.current?.scrollLeft ?? 0;
      scrollableRefs.current.forEach((ref) => {
        if (ref) ref.scrollLeft = headerScrollLeft;
      });
    };

    const raf = requestAnimationFrame(syncScrollPositions);
    return () => cancelAnimationFrame(raf);
  }, [companies, columnWidths]);

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
  };

  const refreshCompaniesList = useCallback(() => {
    const key = [1, debouncedSearchTerm, filters.industry, filters.country, filters.employeeCount, filters.revenueRange].join("|");
    lastFetchKeyRef.current = null;
    setCurrentPage(1);
    setRefreshTrigger((t) => t + 1);
    fetchCompanies(1);
    lastFetchKeyRef.current = key;
  }, [fetchCompanies, debouncedSearchTerm, filters.industry, filters.country, filters.employeeCount, filters.revenueRange]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '—';
    }
    
    // For amounts less than 1 million, use regular formatting
    if (amount < 1000000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    
    // For billions (1B+)
    if (amount >= 1000000000) {
      const billions = amount / 1000000000;
      const hasDecimal = billions % 1 !== 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: hasDecimal ? 1 : 0,
        maximumFractionDigits: 1,
      }).format(billions) + 'B';
    }
    
    // For millions (1M+)
    const millions = amount / 1000000;
    const hasDecimal = millions % 1 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: hasDecimal ? 1 : 0,
      maximumFractionDigits: 1,
    }).format(millions) + 'M';
  };

  const formatNumber = (number: number | null | undefined): string => {
    if (number === null || number === undefined) return '—';
    return new Intl.NumberFormat('en-US').format(number);
  };

  const handleImageError = (companyId: string) => {
    setImageStates(prev => ({
      ...prev,
      [companyId]: {
        ...prev[companyId] || { logoFailed: false },
        logoFailed: true
      }
    }));
  };

  const handleCompanyClick = async (companyId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCompanyId(companyId);
    setLoadingCompanyData(true);
    setIsSheetOpen(true);

    try {
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
        // Fetch vendor information
        let vendorInfoId = "";
        let vendorCompanyName = "";
        let vendorCountry = "";
        let vendorState = "";
        let vendorCity = "";
        let vendorStreetAddress = "";
        let vendorZipCode = "";
        let vendorContact = "";

        try {
          const { data: vendorInfo } = await supabase
            .from('companies_vendor_information')
            .select('*')
            .eq('company_id', company.id)
            .maybeSingle();

          if (vendorInfo) {
            vendorInfoId = vendorInfo.id || "";
            vendorCompanyName = vendorInfo.legal_name || "";
            vendorCountry = vendorInfo.country || "";
            vendorState = vendorInfo.state || "";
            vendorCity = vendorInfo.city || "";
            vendorStreetAddress = vendorInfo.address || "";
            vendorZipCode = vendorInfo.post_code || "";
            vendorContact = vendorInfo.vendor_email || "";
          }
        } catch (vendorError) {
          console.error("Error fetching vendor information:", vendorError);
        }

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

        // Fetch headcount data from companies_headcount table
        let departmentalHeadCount: any = {};
        try {
          const { data: headcountData } = await supabase
            .from('companies_headcount')
            .select('department, headcount')
            .eq('company_id', company.id);

          if (headcountData) {
            // Transform array of {department, headcount} into object with department keys
            headcountData.forEach((item) => {
              departmentalHeadCount[item.department] = item.headcount;
            });
          }
        } catch (headcountError) {
          console.error("Error fetching headcount data:", headcountError);
        }

        // Fetch technologies from companies_technologies_join table
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
            // Transform the joined data into the expected format
            current_technologies = technologiesData
              .filter((item: any) => item.companies_technologies) // Filter out any null joins
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
          domain: company.domain || "",
          website: company.website || "",
          linkedinUrl: linkedinUrl,
          twitterUrl: twitterUrl,
          facebookUrl: facebookUrl,
          annualRevenue: company.annual_revenue?.toString() || "0",
          employeeCount: company.employee_count?.toString() || "",
          industry: company.industry || "",
          foundingYear: company.founding_year?.toString() || "",
          country: company.country || "",
          vendorInfoId: vendorInfoId,
          vendorCompanyName: vendorCompanyName,
          vendorCountry: vendorCountry,
          vendorState: vendorState,
          vendorCity: vendorCity,
          vendorStreetAddress: vendorStreetAddress,
          vendorZipCode: vendorZipCode,
          vendorContact: vendorContact,
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
          is_representative: company.is_representative || false,
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

  const handleEmailClick = (email: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedEmail(email);
    setIsEmailComposerOpen(true);
  };

  const handleCloseEmailComposer = () => {
    setIsEmailComposerOpen(false);
    setSelectedEmail(null);
  };

  const handleAddToSequence = async (companyId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Fetch company data from Supabase
      const supabase = getSupabaseClient();
      const { data: company, error } = await supabase
        .from('companies')
        .select('name, website')
        .eq('id', companyId)
        .single();

      if (error || !company) {
        console.error("Error fetching company:", error);
        wallsToast.error("Error", "Failed to load company data");
        return;
      }

      setSequencePopupCompanyId(companyId);
      setSequencePopupCompanyData({
        company: company.name || '',
        email: '', // Companies don't have emails directly
      });
      setIsSequencePopupOpen(true);
    } catch (error) {
      console.error("Error in handleAddToSequence:", error);
      wallsToast.error("Error", "Failed to load company data");
    }
  };

  const handleAddToSequenceSubmit = async (sequenceId: string, personId: string, sequenceName?: string) => {
    try {
      // Close the popup first
      setIsSequencePopupOpen(false);
      setSequencePopupCompanyId(null);
      setSequencePopupCompanyData(null);
      
      // Show toast
      wallsToast.success("Sequence activated", sequenceName);
    } catch (error) {
      console.error("Error in handleAddToSequenceSubmit:", error);
      // Error handling is done in the popup component
    }
  };

  const handleCloseSequencePopup = () => {
    setIsSequencePopupOpen(false);
    setSequencePopupCompanyId(null);
    setSequencePopupCompanyData(null);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [filterKey]: value,
    }));
    setCurrentPage(1);
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
        <CompaniesTableToolbar
          filters={filters}
          onFilterChange={handleFilterChange}
          onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
          createButtonRef={createButtonRef}
          onCreateClick={(e) => {
            if (isCreatePopupOpen && createCompanyAnchorRect) {
              setIsCreatePopupOpen(false);
              setCreateCompanyAnchorRect(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              setCreateCompanyAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
              setIsCreatePopupOpen(true);
            }
          }}
        />

        <div className="app-sidebar-pad flex-1 overflow-y-auto overscroll-none pr-0">
          <TooltipPrimitive.Provider delayDuration={200}>
            <div ref={tableWrapperRef} className="flex flex-col gap-0 min-h-full">
            {/* Header Row - Always visible */}
            <CompaniesTableHeader
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
                {companies.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground font-light">No companies found matching your criteria.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {companies.map((company, index) => (
                      <div key={company.id}>
                        <CompaniesTableRow
                          company={company}
                          index={index}
                          imageStates={imageStates}
                          scrollableRefs={scrollableRefs}
                          onImageError={handleImageError}
                          onCompanyClick={handleCompanyClick}
                          formatDate={formatDate}
                          formatCurrency={formatCurrency}
                          formatNumber={formatNumber}
                        ensureHttps={ensureHttps}
                        columnWidths={columnWidths}
                        userId={user?.id}
                        onEnrichSuccess={handleCompanyEnriched}
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
      <CompanyFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Mobile Floating Action Button */}
      <MobileFAB 
        onClick={() => {
          setCreateCompanyAnchorRect(null);
          setIsCreatePopupOpen(true);
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
          onSaved={refreshCompaniesList}
          onEmailClick={handleEmailClick}
          onAddToSequence={handleAddToSequence}
        />
      )}

      {/* Email Composer */}
      <EmailComposer
        isOpen={isEmailComposerOpen}
        onClose={handleCloseEmailComposer}
        replyTo={selectedEmail ? { to: selectedEmail } : undefined}
      />

      {/* Create Company Popup */}
      <CreateCompanyPopup
        isOpen={isCreatePopupOpen}
        onClose={() => {
          setIsCreatePopupOpen(false);
          setCreateCompanyAnchorRect(null);
        }}
        onManualAdd={() => setIsCreateSheetOpen(true)}
        onCompanyAdded={refreshCompaniesList}
        anchorRect={createCompanyAnchorRect}
        triggerRef={createButtonRef}
      />

      <CreateAgentCompanies
        analyticsData={analyticsData}
        isOpen={isCreateSheetOpen}
        onClose={() => {
          setIsCreateSheetOpen(false);
          refreshCompaniesList();
        }}
        onSuccess={refreshCompaniesList}
      />

      {/* Add to Sequence Popup */}
      {sequencePopupCompanyId && sequencePopupCompanyData && (
        <AddToSequencePopup
          isOpen={isSequencePopupOpen}
          onClose={handleCloseSequencePopup}
          personId={sequencePopupCompanyId}
          personData={sequencePopupCompanyData}
          onAddToSequence={handleAddToSequenceSubmit}
        />
      )}
    </>
  );
}

export default function AgentCompanies(props: AgentCompaniesProps) {
  return <AgentCompaniesContent {...props} />;
}
