"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { CRMPagination } from "@/components/agentCRM/ui/crm-pagination";
import { LeadsFilter } from "@/components/agent-filters/people-filter";
import { CRMSkeleton } from "@/components/agentCRM/agentPeople/custom-ui/crm-skeleton";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { MobileFAB } from "@/components/ui/mobile-fab";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import UserProfileButton from "@/components/user-profile-button";
import EditAgentCompanies from "@/components/agentCRM/agentCompanies/view/view-agent-companies";
import EditAgentPeople from "@/components/agentCRM/agentPeople/view/view-agent-people";
import { createClient } from '@supabase/supabase-js';
import { fetchCompanySocialUrls } from "@/lib/company-social";
import EmailComposer from "@/components/agentCRM/emailComposer/email-composer";
import AddToSequencePopup from "@/components/agentCRM/ui/add-to-sequence-popup";
import { CreatePersonPopup, type CreatePersonAnchorRect } from "@/components/agentCRM/agentPeople/create/popup/create-person";
import CreateAgentLeads from "@/components/agentCRM/agentPeople/create/create-agent-people";
import { AnimatedSuccessToast } from "./ui/animated-success-toast";
import { PeopleTableToolbar } from "./table/people-table-toolbar";
import { PeopleTableHeader } from "./table/people-table-header";
import { PeopleTableRow } from "./table/people-table-row";
import { Lead, Filters, ImageStates, SequencePopupPersonData } from "./types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ITEMS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

function escapeIlike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

interface AgentLeadsProps {
  analyticsData: any;
}


function AgentLeadsContent({ analyticsData }: AgentLeadsProps) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get("page") || "1", 10));
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    status: searchParams.get("status") || "",
    source: searchParams.get("source") || "",
    createdBy: searchParams.get("createdBy") || "",
    searchTerm: searchParams.get("searchTerm") || "",
    country: searchParams.get("country") || "",
    companyId: searchParams.get("companyId") || "",
    verified: searchParams.get("verified") || "",
  });
  // Default sorting - by recency, descending (newest first)
  const [imageStates, setImageStates] = useState<ImageStates>({});
  const scrollableRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  /** Tracks last fetched params so we don't refetch when e.g. returning to the browser tab. */
  const lastFetchKeyRef = useRef<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyData, setSelectedCompanyData] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loadingCompanyData, setLoadingCompanyData] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedPersonData, setSelectedPersonData] = useState<any>(null);
  const [isPersonSheetOpen, setIsPersonSheetOpen] = useState(false);
  const [loadingPersonData, setLoadingPersonData] = useState(false);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [emailComposerPersonId, setEmailComposerPersonId] = useState<string | null>(null);
  const [isSequencePopupOpen, setIsSequencePopupOpen] = useState(false);
  const [sequencePopupPersonId, setSequencePopupPersonId] = useState<string | null>(null);
  const [sequencePopupPersonData, setSequencePopupPersonData] = useState<SequencePopupPersonData | null>(null);
  const [isCreatePersonPopupOpen, setIsCreatePersonPopupOpen] = useState(false);
  const [createPersonAnchorRect, setCreatePersonAnchorRect] = useState<CreatePersonAnchorRect>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  
  // Column width state - single source of truth
  const [columnWidths, setColumnWidths] = useState({
    name: 301,
    company: 200,
    actions: 200,
    location: 150,
    title: 150,
    phone: 150,
    department: 150,
    source: 150,
    status: 120,
    created: 120,
    lastContacted: 120,
    enrichment: 80,
  });

  // Debounce search input so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchTerm((prev) => {
        const next = filters.searchTerm.trim();
        return next !== prev ? next : prev;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters.searchTerm]);

  const fetchLeads = useCallback(
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
          wallsToast.error("Authentication Error", "Please log in to view people");
          setLoading(false);
          return;
        }

        const searchTerm = debouncedSearchTerm.trim().toLowerCase();
        const searchTerms = searchTerm ? searchTerm.split(/\s+/).filter(Boolean) : [];

        let query = supabase
          .from('people')
          .select(`
            *,
            company:companies!people_company_id_fkey(
              logo_url,
              id,
              name,
              apollo_account_id
            ),
            departments:people_departments!people_departments_person_id_fkey(
              name,
              apollo_name
            )
          `, { count: 'exact' })
          .eq('person_type', 'contact');

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.source) query = query.eq('source', filters.source);
        if (filters.country) query = query.eq('country', filters.country);
        if (filters.companyId) query = query.eq('company_id', filters.companyId);
        if (filters.verified) query = query.eq('is_verified', filters.verified === 'true');

        // Server-side search: each word must match at least one of these fields (AND of ORs)
        for (const term of searchTerms) {
          const escaped = escapeIlike(term);
          const pattern = `%${escaped}%`;
          query = query.or(
            `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},title.ilike.${pattern},source.ilike.${pattern},country.ilike.${pattern},state.ilike.${pattern},company_name.ilike.${pattern}`
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

        const leadsData: Lead[] = (data || []).map((person: any) => {
          const leadName = person.first_name && person.last_name
            ? `${person.first_name} ${person.last_name}`
            : person.first_name || person.last_name || '';
          const country = person.country || '';
          const state = person.state || '';
          const location = state ? `${country}${country ? ', ' : ''}${state}` : country;
          const companyLogo = person.company?.logo_url || null;
          const companyId = person.company?.id || person.company_id || null;
          const companyName = person.company?.name || person.company_name || '';
          const apolloAccountId = person.company?.apollo_account_id || null;
          const departments = person.departments || [];
          let department = '';
          if (departments.length > 0) {
            const dept = departments[0];
            department = dept.name
              ? dept.name
              : (dept.apollo_name || '')
                  .split('_')
                  .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(' ');
          }
          return {
            id: person.id,
            firstName: person.first_name || '',
            lastName: person.last_name || '',
            leadName,
            email: person.email || '',
            phone: person.phone || '',
            company: companyName,
            companyWebsite: person.company_website || '',
            companyLogo: companyLogo || undefined,
            companyId: companyId || undefined,
            source: person.source || '',
            status: person.status || 'New',
            region: location,
            operatingCountries: person.country ? [person.country] : [],
            title: person.title || '',
            department,
            reportingTo: '',
            estimatedValue: 0,
            createdAt: person.created_at || null,
            createdBy: person.created_by || '',
            linkedin: person.linkedin_url || '',
            lastContacted: person.last_contacted || null,
            lastEnriched: person.last_enriched || null,
            apolloPersonId: person.apollo_person_id || null,
            apolloAccountId: apolloAccountId || undefined,
            photoURL: person.photo_url || '',
            photo: person.photo_url || '',
            isVerified: person.is_verified || false,
          };
        });

        const total = count ?? 0;
        setLeads(leadsData);
        setTotalItems(total);
        setTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)));
        setCurrentPage(pageNumber);
      } catch (error) {
        console.error("Error fetching leads:", error);
        wallsToast.error("Error", "Failed to load people data");
        setLeads([]);
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
      filters.source,
      filters.country,
      filters.companyId,
      filters.verified,
    ]
  );

  // Fetch only when user is present and params changed (or initial load). Skip refetch when
  // returning to the tab so we don't reload unnecessarily; we can add explicit refresh later.
  useEffect(() => {
    if (authLoading) { setLoading(true); return; }
    if (!user) {
      setLeads([]);
      setTotalItems(0);
      setTotalPages(1);
      setLoading(false);
      lastFetchKeyRef.current = null;
      return;
    }
    const fetchKey = [
      currentPage,
      debouncedSearchTerm,
      filters.status,
      filters.source,
      filters.country,
      filters.companyId,
      filters.verified,
    ].join("|");
    if (lastFetchKeyRef.current === fetchKey && leads.length > 0) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;
    fetchLeads(currentPage);
  }, [authLoading, user, currentPage, debouncedSearchTerm, filters.status, filters.source, filters.country, filters.companyId, filters.verified, fetchLeads, leads.length, refreshTrigger]);

  useLayoutEffect(() => {
    const syncScrollPositions = () => {
      const headerScrollLeft = headerScrollRef.current?.scrollLeft ?? 0;
      scrollableRefs.current.forEach((ref) => {
        if (ref) ref.scrollLeft = headerScrollLeft;
      });
    };

    const raf = requestAnimationFrame(syncScrollPositions);
    return () => cancelAnimationFrame(raf);
  }, [leads, columnWidths]);

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

  const buildCleanUrl = (filterParams: Filters, page: number = 1) => {
    const query = new URLSearchParams();
    if (page !== 1) query.set("page", page.toString());
    Object.entries(filterParams).forEach(([key, value]) => {
      if (value && value !== "") query.set(key, value);
    });
    return query.toString() ? `?${query.toString()}` : "";
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    router.replace(`/agents/crm/people${buildCleanUrl(filters, page)}`);
  };

  /** Refresh the list (e.g. after adding a new person). Resets to page 1 and fetches so the new person appears at top. */
  const refreshPeopleList = useCallback(() => {
    const key = [1, debouncedSearchTerm, filters.status, filters.source, filters.country, filters.companyId, filters.verified].join("|");
    lastFetchKeyRef.current = null;
    setCurrentPage(1);
    setRefreshTrigger((t) => t + 1);
    fetchLeads(1);
    lastFetchKeyRef.current = key;
    router.replace(`/agents/crm/people${buildCleanUrl(filters, 1)}`);
  }, [fetchLeads, debouncedSearchTerm, filters, router]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleImageError = (leadId: string, type: 'profile' | 'company') => {
    setImageStates(prev => ({
      ...prev,
      [leadId]: {
        ...prev[leadId] || { profileFailed: false, companyFailed: false },
        [type === 'profile' ? 'profileFailed' : 'companyFailed']: true
      }
    }));
  };


  const handleFilterChange = (filterKey: string, value: string) => {
    const updatedFilters = { ...filters, [filterKey]: value };
    setFilters(updatedFilters);
    setCurrentPage(1);
    router.replace(`/agents/crm/people${buildCleanUrl(updatedFilters, 1)}`);
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

  const handlePersonCompanyUpdate = async (
    leadId: string,
    company: { id: string; name: string; logo_url?: string | null }
  ) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("people")
        .update({ company_id: company.id })
        .eq("id", leadId);

      if (error) {
        console.error("Error updating person company:", error);
        wallsToast.error("Error", "Failed to update company");
        return;
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                companyId: company.id,
                company: company.name,
                companyLogo: company.logo_url ?? lead.companyLogo,
              }
            : lead
        )
      );
    } catch (err) {
      console.error("Error updating person company:", err);
      wallsToast.error("Error", "Failed to update company");
    }
  };

  const handlePersonClick = async (personId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!personId) return;
    
    setSelectedPersonId(personId);
    setLoadingPersonData(true);
    setIsPersonSheetOpen(true);

    try {
      const supabase = getSupabaseClient();
      const { data: person, error } = await supabase
        .from('people')
        .select(`
          *,
          company:companies!people_company_id_fkey(
            logo_url,
            id,
            name
          )
        `)
        .eq('id', personId)
        .single();

      if (error) {
        console.error("Error fetching person:", error);
        wallsToast.error("Error", "Failed to load person data");
        setIsPersonSheetOpen(false);
        return;
      }

      if (person) {
        // Get logo_url from joined company, fallback to company_photo_url
        const companyLogo = person.company?.logo_url || person.company_photo_url || "";
        
        // Map Supabase fields to the expected format
        // Use company name from joined company table, fallback to company_name field
        const companyName = person.company?.name || person.company_name || "";
        
        setSelectedPersonData({
          first_name: person.first_name || "",
          last_name: person.last_name || "",
          email: person.email || "",
          phone: person.phone || "",
          title: person.title || "",
          headline: person.headline || "",
          company_name: companyName,
          company_website: person.company_website || "",
          company_photo_url: companyLogo,
          linkedin_url: person.linkedin_url || "",
          twitter_url: person.twitter_url || "",
          facebook_url: person.facebook_url || "",
          github_url: person.github_url || "",
          photo_url: person.photo_url || "",
          source: person.source || "",
          status: person.status || "New",
          country: person.country || "",
          city: person.city || "",
          state: person.state || "",
          seniority: person.seniority || "",
          time_zone: person.time_zone || "",
          is_contact: person.is_contact || false,
          is_verified: person.is_verified || false,
          contact_owner: person.contact_owner || null,
          apollo_contact_id: person.apollo_contact_id || "",
          apollo_person_id: person.apollo_person_id || "",
          apollo_organization_id: person.apollo_organization_id || "",
          createdAt: person.created_at || "",
          createdBy: person.created_by || "",
          updated_at: person.updated_at || "",
          last_contacted: person.last_contacted || "",
          last_enriched: person.last_enriched || "",
        });
      }
    } catch (error) {
      console.error("Error fetching person data:", error);
      wallsToast.error("Error", "Failed to load person data");
      setIsPersonSheetOpen(false);
    } finally {
      setLoadingPersonData(false);
    }
  };

  const handleClosePersonSheet = () => {
    setIsPersonSheetOpen(false);
    setSelectedPersonId(null);
    setSelectedPersonData(null);
  };

  const handleEmailClick = (email: string, personId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedEmail(email);
    setEmailComposerPersonId(personId);
    setIsEmailComposerOpen(true);
  };

  const handleCloseEmailComposer = () => {
    setIsEmailComposerOpen(false);
    setSelectedEmail(null);
    setEmailComposerPersonId(null);
  };

  const handleAddToSequence = (personId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the lead data for this person
    const lead = leads.find(l => l.id === personId);
    if (lead) {
      setSequencePopupPersonId(personId);
      setSequencePopupPersonData({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        company: lead.company,
      });
      setIsSequencePopupOpen(true);
    }
  };

  const handleAddToSequenceSubmit = async (sequenceId: string, personId: string, sequenceName?: string) => {
    try {
      // Close the popup first
      setIsSequencePopupOpen(false);
      setSequencePopupPersonId(null);
      setSequencePopupPersonData(null);
      
      // Show toast
      wallsToast.success("Sequence activated", sequenceName);
    } catch (error) {
      console.error("Error in handleAddToSequenceSubmit:", error);
      // Error handling is done in the popup component
    }
  };

  const handleCloseSequencePopup = () => {
    setIsSequencePopupOpen(false);
    setSequencePopupPersonId(null);
    setSequencePopupPersonData(null);
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
        <PeopleTableToolbar
          filters={filters}
          onFilterChange={handleFilterChange}
          onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
          createButtonRef={createButtonRef}
          onCreateClick={(e) => {
            if (isCreatePersonPopupOpen && createPersonAnchorRect) {
              setIsCreatePersonPopupOpen(false);
              setCreatePersonAnchorRect(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              setCreatePersonAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
              setIsCreatePersonPopupOpen(true);
            }
          }}
        />

        <div className="app-sidebar-pad flex-1 overflow-y-auto overscroll-none pr-0">
          <TooltipPrimitive.Provider delayDuration={200}>
            <div ref={tableWrapperRef} className="flex flex-col gap-0 min-h-full">
            {/* Header Row - Always visible */}
            <PeopleTableHeader
              headerScrollRef={headerScrollRef}
              columnWidths={columnWidths}
              setColumnWidths={setColumnWidths}
            />

            {/* Content Area - Loading or Data */}
            <div className="flex-1 bg-kenoo-white flex flex-col">
            {loading ? (
              <CRMSkeleton count={12} />
            ) : leads.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground font-light">No people found matching your criteria.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {leads.map((lead, index) => (
                  <PeopleTableRow
                    key={lead.id}
                    lead={lead}
                    index={index}
                    imageStates={imageStates}
                    scrollableRefs={scrollableRefs}
                    onImageError={handleImageError}
                    onPersonClick={handlePersonClick}
                    onCompanyClick={handleCompanyClick}
                    onCompanyUpdate={handlePersonCompanyUpdate}
                    onEmailClick={handleEmailClick}
                    onAddToSequence={handleAddToSequence}
                    formatDate={formatDate}
                    userId={user?.id}
                    columnWidths={columnWidths}
                  />
                ))}
              </div>
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
      <LeadsFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Mobile Floating Action Button */}
      <MobileFAB 
        onClick={() => {
          setCreatePersonAnchorRect(null);
          setIsCreatePersonPopupOpen(true);
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
        />
      )}

      {/* Person Detail Sheet */}
      {selectedPersonId && selectedPersonData && (
        <EditAgentPeople
          analyticsData={null}
          personId={selectedPersonId}
          initialData={selectedPersonData}
          isOpen={isPersonSheetOpen}
          onClose={handleClosePersonSheet}
          onSaved={refreshPeopleList}
        />
      )}

      {/* Email Composer */}
      <EmailComposer
        isOpen={isEmailComposerOpen}
        onClose={handleCloseEmailComposer}
        personId={emailComposerPersonId || undefined}
        replyTo={selectedEmail ? { to: selectedEmail } : undefined}
      />

      {/* Add to Sequence Popup */}
      {sequencePopupPersonId && sequencePopupPersonData && (
        <AddToSequencePopup
          isOpen={isSequencePopupOpen}
          onClose={handleCloseSequencePopup}
          personId={sequencePopupPersonId}
          personData={sequencePopupPersonData}
          onAddToSequence={handleAddToSequenceSubmit}
        />
      )}

      {/* Create Person Popup (dropdown under + when anchorRect set, else dialog) */}
      <CreatePersonPopup
        isOpen={isCreatePersonPopupOpen}
        onClose={() => {
          setIsCreatePersonPopupOpen(false);
          setCreatePersonAnchorRect(null);
        }}
        onManualAdd={() => setIsCreateFormOpen(true)}
        onPersonAdded={refreshPeopleList}
        anchorRect={createPersonAnchorRect}
        triggerRef={createButtonRef}
      />

      {/* Create Person Form Sheet */}
      <CreateAgentLeads
        analyticsData={analyticsData}
        isOpen={isCreateFormOpen}
        onClose={() => setIsCreateFormOpen(false)}
        onSuccess={refreshPeopleList}
      />
    </>
  );
}

export default function AgentLeads(props: AgentLeadsProps) {
  return <AgentLeadsContent {...props} />;
} 