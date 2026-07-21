"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useRef, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import Image from "next/image";
import Link from "next/link";
import { Plus, Mail, SendHorizontal, ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useAuth } from "@/app/auth/AuthContext";
import React from "react";
import { animate, motion, AnimatePresence, useMotionValue } from "framer-motion";
import { NoContactsToast } from "./ui/no-contacts-toast";
import { AnimatedEnrichToast } from "./ui/animated-enrich-toast";
import { SmartSearchPopup, getCountryNameFromCode, type SmartSearchFilters } from "./ui/smart-search-popup";

const ITEMS_PER_PAGE = 10;

const tableHeaderClass =
  "text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-kenoo-white";

function getTotalPages(totalCount: number) {
  return Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
}

function TableToolbar({
  searchTerm,
  setSearchTerm,
  currentPage,
  setCurrentPage,
  totalCount,
  placeholder,
}: {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  totalCount: number;
  placeholder: string;
}) {
  const totalPages = getTotalPages(totalCount);
  const safePage = Math.min(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5 flex-shrink-0">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="relative flex-1 max-w-sm min-w-0">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={cn(
              "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
              searchTerm ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
              "focus:border-b-[var(--kenoo-sky)]"
            )}
          />
        </div>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-neutral-400 font-light whitespace-nowrap tabular-nums min-w-[7.5rem] text-center">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Next page"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyTableState({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center text-neutral-400 font-light">
        <div className="flex flex-col items-center justify-center gap-2">
          <FileText className="h-7 w-7 text-neutral-300" />
          <span>{message}</span>
        </div>
      </td>
    </tr>
  );
}

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  leadName: string;
  email: string;
  phone: string;
  company: string;
  companyWebsite?: string;
  companyLogo?: string;
  title: string;
  department: string;
  photoURL?: string;
  linkedin?: string;
  region?: string;
  country?: string;
  source?: string;
  status?: string;
  createdAt?: string | null;
  lastContacted?: string | null;
  lastEnriched?: string | null;
  apolloPersonId?: string | null;
}

interface DepartmentHeadcountProps {
  formData: any;
  handleInputChange: (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  companyId: string;
  apolloOrganizationId?: string;
  companyWebsite?: string;
  apolloAccountId?: string;
  companyName?: string;
  onEmailClick?: (email: string, e: React.MouseEvent) => void;
  onAddToSequence?: (personId: string, e: React.MouseEvent) => void;
}

const DynamicTooltip = ({
  children,
  content
}: {
  children: React.ReactElement;
  content: string;
}) => {
  const [side, setSide] = React.useState<"top" | "bottom">("top");

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const topSpace = rect.top;
    const bottomSpace = window.innerHeight - rect.bottom;

    setSide(topSpace < 120 && bottomSpace > topSpace ? "bottom" : "top");
  };

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        {React.cloneElement(children, {
          onMouseEnter: (e: React.MouseEvent) => {
            handleMouseEnter(e);
            if (children.props.onMouseEnter) {
              children.props.onMouseEnter(e);
            }
          }
        })}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          avoidCollisions={true}
          collisionPadding={{
            top: 80,
            bottom: 24,
            left: 16,
            right: 16
          }}
          className="z-[10000] rounded-[25px] bg-neutral-100 backdrop-blur-sm px-3 py-1.5 text-xs text-neutral-700 shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};

interface SmartSearchContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  seniority: string;
  emailStatus: string;
  linkedinUrl: string;
  photo: string;
  phone?: string;
  lastContacted?: string | null;
  lastEnriched?: string | null;
  is_internal?: boolean;
  internal_id?: string | null;
  isTopCandidate?: boolean;
}

// Function to determine enrichment status
const getEnrichmentStatus = (lastEnriched?: string | null) => {
  if (!lastEnriched) return 'none';

  const enrichedDate = new Date(lastEnriched);
  if (isNaN(enrichedDate.getTime())) return 'none';

  const now = new Date();
  const monthsDiff = (now.getFullYear() - enrichedDate.getFullYear()) * 12 + now.getMonth() - enrichedDate.getMonth();

  if (monthsDiff <= 4) return 'fresh';
  if (monthsDiff <= 12) return 'moderate';
  return 'stale';
};

// Enrichment Status Component
const EnrichmentStatus = ({ status, website, userId, contact, person, companyId, apolloAccountId, onEnrichSuccess }: { status: 'fresh' | 'moderate' | 'stale' | 'none'; website: string; userId?: string; contact?: SmartSearchContact; person?: Person; companyId?: string; apolloAccountId?: string; onEnrichSuccess?: (contact?: SmartSearchContact, person?: Person) => void }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const loadingTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
    };
  }, []);

  const handleEnrich = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    setIsLoading(true);
    try {
      let enrichPayload: any = {
        userId: userId,
        companyId: companyId,
        apolloAccountId: apolloAccountId
      };

      if (contact) {
        enrichPayload.id = contact.id;
        enrichPayload.firstName = contact.firstName;
        enrichPayload.lastName = contact.lastName;
        enrichPayload.email = contact.email;
        enrichPayload.linkedin = contact.linkedinUrl;
      } else if (person) {
        if (person.apolloPersonId) {
          enrichPayload.id = person.apolloPersonId;
        } else if (person.email) {
          enrichPayload.email = person.email;
        } else {
          wallsToast.error("No Apollo person ID or email available for enrichment");
          setIsLoading(false);
          return;
        }

        enrichPayload.firstName = person.firstName;
        enrichPayload.lastName = person.lastName;
        if (person.linkedin) {
          enrichPayload.linkedin = person.linkedin;
        }
      } else {
        wallsToast.error("No person data available for enrichment");
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/apollo/custom/people-smart-enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrichPayload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to enrich person');
      }

      setIsLoading(false);
      setIsSuccess(true);
      const personName = contact
        ? `${contact.firstName} ${contact.lastName}`.trim()
        : person
        ? `${person.firstName} ${person.lastName}`.trim()
        : undefined;
      wallsToast.success("Person enriched", personName);
      onEnrichSuccess?.(contact, person);

    } catch (error) {
      console.error('Error enriching:', error);
      setIsLoading(false);

      if (error instanceof Error &&
          (error.message === 'No organization data found' ||
           error.message.includes('404'))) {
        wallsToast.error("No public data available");
      } else {
        wallsToast.error("Failed to enrich data");
      }
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={handleEnrich}
            className={`flex flex-col items-center gap-[2px] w-6 p-4 rounded-full hover:bg-gray-500/30 transition-all duration-200 cursor-pointer group ${isLoading ? 'animate-pulse' : ''}`}
          >
            {status === 'none' ? (
              <>
                <div className="w-5 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-1" />
                <div className="w-4 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-2" />
                <div className="w-3 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-3" />
              </>
            ) : (
              <>
                <div
                  className={`w-5 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-500' :
                    status === 'fresh' ? 'bg-kenoo-sky/60' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`w-4 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-400 delay-100' :
                    status === 'fresh' ? 'bg-kenoo-sky/60' :
                    status === 'moderate' ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`w-3 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-300 delay-200' :
                    status === 'fresh' ? 'bg-kenoo-sky/60' :
                    status === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          className="font-light"
          side="top"
          sideOffset={5}
        >
          {isLoading ? 'Enriching...' : isSuccess ? 'Enriched!' : status === 'none' ? 'Add to database' : 'Enrich'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default function DepartmentHeadcount({ formData, handleInputChange, companyId, apolloOrganizationId, companyWebsite, apolloAccountId, companyName, onEmailClick, onAddToSequence }: DepartmentHeadcountProps) {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageStates, setImageStates] = useState<Record<string, { profileFailed: boolean; companyFailed: boolean }>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [smartSearchLoading, setSmartSearchLoading] = useState(false);
  const [smartSearchResults, setSmartSearchResults] = useState<SmartSearchContact[] | null>(null);
  const [smartSearchImageStates, setSmartSearchImageStates] = useState<Record<string, boolean>>({});
  const [showSearchAll, setShowSearchAll] = useState(false);
  const [newlyAddedPersonIds, setNewlyAddedPersonIds] = useState<Set<string>>(new Set());
  const [smartSearchPopupOpen, setSmartSearchPopupOpen] = useState(false);

  // Hold-to-open-popup state for Smart Search button
  const holdFill = useMotionValue(0);
  const holdFillPlaybackRef = useRef<ReturnType<typeof animate> | null>(null);
  const holdTriggeredRef = useRef(false);
  const [isSmartSearchPressed, setIsSmartSearchPressed] = useState(false);

  const stopHoldFill = () => {
    holdFillPlaybackRef.current?.stop();
    holdFillPlaybackRef.current = null;
    holdFill.set(0);
  };

  useEffect(() => {
    return () => {
      holdFillPlaybackRef.current?.stop();
    };
  }, []);

  const startSmartSearchHold = () => {
    if (smartSearchLoading || !apolloOrganizationId) return;
    setIsSmartSearchPressed(true);
    holdTriggeredRef.current = false;
    stopHoldFill();

    holdFillPlaybackRef.current = animate(holdFill, 1, {
      duration: 1.2,
      ease: "linear",
      onComplete: () => {
        holdTriggeredRef.current = true;
        holdFill.set(0);
        setIsSmartSearchPressed(false);
        holdFillPlaybackRef.current = null;
        setSmartSearchPopupOpen(true);
      },
    });
  };

  const cancelSmartSearchHold = () => {
    stopHoldFill();
    setIsSmartSearchPressed(false);
  };

  useEffect(() => {
    const fetchPeople = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('people')
          .select(`
            *,
            company:companies!people_company_id_fkey(
              logo_url
            ),
            departments:people_departments!people_departments_person_id_fkey(
              name,
              apollo_name
            )
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching people:', error);
          return;
        }

        const peopleData: Person[] = (data || []).map((person: any) => {
          const leadName = person.first_name && person.last_name
            ? `${person.first_name} ${person.last_name}`
            : person.first_name || person.last_name || '';

          const departments = person.departments || [];
          let department = '';
          if (departments.length > 0) {
            const dept = departments[0];
            if (dept.name) {
              department = dept.name;
            } else if (dept.apollo_name) {
              department = dept.apollo_name
                .split('_')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            }
          }

          const country = person.country || '';
          const state = person.state || '';
          const location = state
            ? `${country}${country ? ', ' : ''}${state}`
            : country;

          return {
            id: person.id,
            firstName: person.first_name || '',
            lastName: person.last_name || '',
            leadName: leadName,
            email: person.email || '',
            phone: person.phone || '',
            company: person.company_name || '',
            companyWebsite: person.company_website || '',
            companyLogo: person.company?.logo_url || undefined,
            title: person.title || '',
            department: department,
            photoURL: person.photo_url || '',
            linkedin: person.linkedin_url || '',
            region: location,
            country: country,
            source: person.source || '',
            status: person.status || 'New',
            createdAt: person.created_at || null,
            lastContacted: person.last_contacted || null,
            lastEnriched: person.last_enriched || null,
            apolloPersonId: person.apollo_person_id || null,
          };
        });

        setPeople(peopleData);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error fetching people:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPeople();
  }, [companyId]);

  const filteredPeople = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return people;
    return people.filter((p) =>
      [p.leadName, p.title, p.email, p.department].join(" ").toLowerCase().includes(term)
    );
  }, [people, searchTerm]);

  const paginatedPeople = useMemo(() => {
    const totalPages = getTotalPages(filteredPeople.length);
    const safePage = Math.min(currentPage, totalPages);
    return filteredPeople.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  }, [filteredPeople, currentPage]);

  const handleImageError = (personId: string, type: 'profile' | 'company') => {
    setImageStates(prev => ({
      ...prev,
      [personId]: {
        ...prev[personId] || { profileFailed: false, companyFailed: false },
        [type === 'profile' ? 'profileFailed' : 'companyFailed']: true
      }
    }));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSmartSearch = async (searchAll: boolean = false, filters?: SmartSearchFilters) => {
    if (!apolloOrganizationId) {
      console.error('No Apollo organization ID available');
      return;
    }

    setSmartSearchLoading(true);
    setSmartSearchResults(null);

    try {
      const body: Record<string, unknown> = {
        apollo_organization_id: apolloOrganizationId,
        search_all: searchAll,
      };
      if (filters?.countryCode) {
        body.country = getCountryNameFromCode(filters.countryCode);
      }
      if (filters?.title) {
        body.custom_title = filters.title;
      }
      if (filters?.seniorities && filters.seniorities.length > 0) {
        body.seniorities = filters.seniorities;
      }
      if (filters?.emailStatuses && filters.emailStatuses.length > 0) {
        body.email_statuses = filters.emailStatuses;
      }

      const response = await fetch('/api/apollo/custom/smart-search/company-people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch smart search results');
      }

      const data = await response.json();
      const rawContacts = (data?.contacts ?? data?.people ?? []) as any[];

      const normalizedContacts: SmartSearchContact[] = rawContacts.map((c: any) => ({
        id: c.id || '',
        firstName: c.firstName ?? c.first_name ?? '',
        lastName: c.lastName ?? c.last_name ?? c.last_name_obfuscated ?? '',
        email: c.email ?? '',
        title: c.title ?? '',
        seniority: c.seniority ?? '',
        emailStatus: c.emailStatus ?? c.email_status ?? (c.has_email ? 'available' : ''),
        linkedinUrl: c.linkedinUrl ?? c.linkedin_url ?? '',
        photo: c.photo ?? c.photo_url ?? '',
        phone: c.phone ?? '',
        lastContacted: c.lastContacted ?? c.last_contacted ?? null,
        lastEnriched: c.lastEnriched ?? c.last_enriched ?? null,
        is_internal: c.is_internal ?? false,
        internal_id: c.internal_id ?? null,
        isTopCandidate: c.isTopCandidate ?? false,
      }));

      if ((data?.success || rawContacts.length > 0) && normalizedContacts.length > 0) {
        const sortedContacts = [...normalizedContacts].sort((a, b) => {
          if (a.isTopCandidate && !b.isTopCandidate) return -1;
          if (!a.isTopCandidate && b.isTopCandidate) return 1;
          return 0;
        });
        setSmartSearchResults(sortedContacts);
        setShowSearchAll(false);
      } else {
        if (!searchAll) {
          setShowSearchAll(true);
          wallsToast.warning("No ideal candidates", companyName);
        } else {
          setShowSearchAll(false);
          wallsToast.warning("No contacts found", companyName);
        }
      }
    } catch (error) {
      console.error('Error fetching smart search results:', error);
    } finally {
      setSmartSearchLoading(false);
    }
  };

  const handleEnrichSuccess = async (contact?: SmartSearchContact, person?: Person) => {
    const supabase = getSupabaseClient();

    if (contact) {
      const query = supabase
        .from('people')
        .select(`
          *,
          company:companies!people_company_id_fkey(logo_url),
          departments:people_departments!people_departments_person_id_fkey(name, apollo_name)
        `)
        .eq('company_id', companyId);

      const { data } = contact.is_internal && contact.internal_id
        ? await query.eq('id', contact.internal_id).maybeSingle()
        : await query.eq('apollo_person_id', contact.id).maybeSingle();

      if (data) {
        const leadName = data.first_name && data.last_name
          ? `${data.first_name} ${data.last_name}`
          : data.first_name || data.last_name || '';
        const departments = data.departments || [];
        let department = '';
        if (departments.length > 0) {
          const dept = departments[0];
          if (dept.name) {
            department = dept.name;
          } else if (dept.apollo_name) {
            department = dept.apollo_name
              .split('_')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }
        }
        const country = data.country || '';
        const state = data.state || '';
        const location = state ? `${country}${country ? ', ' : ''}${state}` : country;

        const newPerson: Person = {
          id: data.id,
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          leadName,
          email: data.email || '',
          phone: data.phone || '',
          company: data.company_name || '',
          companyWebsite: data.company_website || '',
          companyLogo: data.company?.logo_url || undefined,
          title: data.title || '',
          department,
          photoURL: data.photo_url || '',
          linkedin: data.linkedin_url || '',
          region: location,
          country,
          source: data.source || '',
          status: data.status || 'New',
          createdAt: data.created_at || null,
          lastContacted: data.last_contacted || null,
          lastEnriched: data.last_enriched || null,
          apolloPersonId: data.apollo_person_id || null,
        };

        setPeople(prev => {
          const filtered = prev.filter(p => p.id !== newPerson.id);
          return [newPerson, ...filtered];
        });
        setCurrentPage(1);
        setSmartSearchResults(prev => prev ? prev.filter(c => c.id !== contact.id) : prev);

        setNewlyAddedPersonIds((prev) => {
          const next = new Set(prev);
          next.add(newPerson.id);
          return next;
        });
        setTimeout(() => {
          setNewlyAddedPersonIds(prev => {
            const next = new Set(prev);
            next.delete(newPerson.id);
            return next;
          });
        }, 2500);
      }
    } else if (person) {
      setPeople(prev =>
        prev.map(p => p.id === person.id ? { ...p, lastEnriched: new Date().toISOString() } : p)
      );
    }
  };

  const handleEmailClickInternal = (email: string, e: React.MouseEvent) => {
    if (onEmailClick) {
      onEmailClick(email, e);
    } else {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `mailto:${email}`;
    }
  };

  const FALLBACK_IMAGE_URL = FALLBACK_ICON_URL;

  return (
    <TooltipProvider>
      <div className="space-y-10 px-4 sm:px-6">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-sm font-light text-muted-foreground">Loading people...</p>
          </div>
        ) : (
          <div>
            {/* Section header */}
            <div className="flex items-center gap-4 mb-5">
              <h2 className="text-black font-black text-4xl shrink-0">PEOPLE</h2>
              <div className="flex-1 border-t border-black h-[1px]" />
              <div className="shrink-0 rounded-full bg-transparent px-4 py-2">
                <button
                  onClick={() => {
                    if (holdTriggeredRef.current) {
                      holdTriggeredRef.current = false;
                      return;
                    }
                    handleSmartSearch(showSearchAll);
                  }}
                  onMouseDown={startSmartSearchHold}
                  onMouseUp={cancelSmartSearchHold}
                  onMouseLeave={cancelSmartSearchHold}
                  onTouchStart={startSmartSearchHold}
                  onTouchEnd={cancelSmartSearchHold}
                  onTouchCancel={cancelSmartSearchHold}
                  disabled={smartSearchLoading || !apolloOrganizationId}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-1.5 rounded-md bg-kenoo-white transition-all duration-300 ease-in-out cursor-pointer text-xs font-light text-foreground disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden",
                    isSmartSearchPressed
                      ? "scale-[0.98] shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]"
                      : "hover:scale-[0.98] hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]"
                  )}
                >
                  {/* Hold-to-fill overlay */}
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0 rounded-md bg-kenoo-yellow"
                    style={{ scaleY: holdFill, transformOrigin: "50% 100%" }}
                  />
                  <div className="relative z-10 flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={showSearchAll ? 'search-all' : 'smart-search'}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.3 }}
                      >
                        {showSearchAll ? 'Search all contacts' : 'Smart search'}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </button>
              </div>
            </div>

            <div className="px-2 sm:px-4">
              <TableToolbar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalCount={filteredPeople.length}
                placeholder="Search people..."
              />
              <div className="overflow-x-auto pb-8">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-kenoo-white">
                    <tr>
                      <th className={tableHeaderClass}>Name</th>
                      <th className={tableHeaderClass}>Actions</th>
                      <th className={tableHeaderClass}>Title</th>
                      <th className={tableHeaderClass}>Last Contact</th>
                      <th className={tableHeaderClass}>Enrichment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPeople.length === 0 ? (
                      <EmptyTableState colSpan={5} message="No people added yet." />
                    ) : (
                      <AnimatePresence initial={false}>
                        {paginatedPeople.map((person) => (
                          <motion.tr
                            key={person.id}
                            initial={newlyAddedPersonIds.has(person.id) ? { opacity: 0, y: -10 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                            className={cn(
                              "border-b border-neutral-50",
                              "transition-colors duration-700",
                              newlyAddedPersonIds.has(person.id) ? "bg-kenoo-yellow/15 hover:bg-kenoo-yellow/35" : "hover:bg-neutral-50/80"
                            )}
                          >
                            <td className="py-4 pr-4 min-w-0 overflow-hidden">
                              <Link href={`/agents/crm/edit-leads/${person.id}`} className="flex items-center gap-2 hover:opacity-80 min-w-0">
                                <Image
                                  src={
                                    !imageStates[person.id]?.profileFailed && person.photoURL && !person.photoURL.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")
                                      ? person.photoURL
                                      : FALLBACK_IMAGE_URL
                                  }
                                  alt={`${person.leadName} profile`}
                                  width={24}
                                  height={24}
                                  className={
                                    imageStates[person.id]?.profileFailed || (!person.photoURL || person.photoURL.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2"))
                                      ? "rounded-full object-cover aspect-square border border-neutral-200 w-6 h-6 shrink-0"
                                      : "rounded-full object-cover aspect-square w-6 h-6 shrink-0"
                                  }
                                  onError={() => {
                                    if (!imageStates[person.id]?.profileFailed && person.photoURL && !person.photoURL.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")) {
                                      handleImageError(person.id, 'profile');
                                    }
                                  }}
                                />
                                <span className="text-neutral-700 font-light text-xs truncate block min-w-0">{person.leadName}</span>
                              </Link>
                            </td>
                            <td className="py-4 pr-4 overflow-hidden">
                              {person.email ? (
                                <div className="flex items-center gap-2">
                                  <DynamicTooltip content="Send email">
                                    <button
                                      onClick={(e) => handleEmailClickInternal(person.email, e)}
                                      className="flex items-center justify-center w-8 h-8 rounded-md bg-neutral-100/50 border border-neutral-200/50 hover:bg-neutral-200 hover:border-neutral-300/50 transition-colors cursor-pointer"
                                    >
                                      <Mail className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                                    </button>
                                  </DynamicTooltip>
                                  {onAddToSequence && (
                                    <DynamicTooltip content="Add to Sequence">
                                      <button
                                        onClick={(e) => onAddToSequence(person.id, e)}
                                        className="flex items-center justify-center w-8 h-8 rounded-md bg-neutral-100/50 border border-neutral-200/50 hover:bg-neutral-200 hover:border-neutral-300/50 transition-colors cursor-pointer"
                                      >
                                        <SendHorizontal className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                                      </button>
                                    </DynamicTooltip>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className="py-4 pr-4 text-neutral-400 text-xs font-light overflow-hidden">
                              {person.title ? (
                                <DynamicTooltip content={person.title}>
                                  <span className="block max-w-[220px] truncate cursor-default">
                                    {person.title}
                                  </span>
                                </DynamicTooltip>
                              ) : (
                                <span className="block max-w-[220px] truncate">—</span>
                              )}
                            </td>
                            <td className="py-4 pr-4 text-neutral-400 text-xs font-light overflow-hidden">
                              <span className="truncate block">{person.lastContacted ? formatDate(person.lastContacted) : "—"}</span>
                            </td>
                            <td className="py-4 pr-4 overflow-hidden">
                              <div className="flex items-center justify-center">
                                <EnrichmentStatus
                                  status={getEnrichmentStatus(person.lastEnriched)}
                                  website={companyWebsite || ''}
                                  userId={user?.id}
                                  person={person}
                                  companyId={companyId}
                                  apolloAccountId={apolloAccountId}
                                  onEnrichSuccess={handleEnrichSuccess}
                                />
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Smart search results */}
            {(smartSearchLoading || (smartSearchResults && smartSearchResults.length > 0)) && (
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <h2 className="text-black font-black text-4xl shrink-0">SUGGESTED</h2>
                  <div className="flex-1 border-t border-black h-[1px]" />
                </div>
                <div className="px-2 sm:px-4">
                  <div className="overflow-x-auto pb-8">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-kenoo-white">
                        <tr>
                          <th className={tableHeaderClass}>Name</th>
                          <th className={tableHeaderClass}>Actions</th>
                          <th className={tableHeaderClass}>Title</th>
                          <th className={tableHeaderClass}>Last Contact</th>
                          <th className={tableHeaderClass}>Enrichment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {smartSearchLoading ? (
                          [...Array(3)].map((_, index) => (
                            <tr key={`skeleton-${index}`} className="border-b border-neutral-50">
                              <td className="py-4 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-neutral-200 animate-pulse shrink-0" />
                                  <div className="h-4 w-24 bg-neutral-200 animate-pulse rounded" />
                                </div>
                              </td>
                              <td className="py-4 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 bg-neutral-200 animate-pulse rounded-md" />
                                  <div className="h-8 w-8 bg-neutral-200 animate-pulse rounded-md" />
                                </div>
                              </td>
                              <td className="py-4 pr-4">
                                <div className="h-4 w-20 bg-neutral-200 animate-pulse rounded" />
                              </td>
                              <td className="py-4 pr-4">
                                <div className="h-4 w-16 bg-neutral-200 animate-pulse rounded" />
                              </td>
                              <td className="py-4 pr-4">
                                <div className="h-4 w-12 bg-neutral-200 animate-pulse rounded mx-auto" />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <AnimatePresence>
                            {smartSearchResults!.map((contact) => (
                              <motion.tr
                                key={contact.id}
                                layout
                                initial={{ opacity: 1 }}
                                exit={{
                                  opacity: 0,
                                  y: -8,
                                  scale: 0.97,
                                  backgroundColor: "rgba(134, 239, 172, 0.3)"
                                }}
                                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                                className="border-b border-neutral-50 hover:bg-neutral-50/80"
                              >
                                <td className="py-4 pr-4 min-w-0 overflow-hidden">
                                  {contact.linkedinUrl && !contact.is_internal ? (
                                    <a
                                      href={contact.linkedinUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(contact.linkedinUrl, '_blank');
                                      }}
                                      className="flex items-center gap-2 min-w-0 hover:opacity-80"
                                    >
                                      <Image
                                        src={
                                          !smartSearchImageStates[contact.id] && contact.photo && !contact.photo.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")
                                            ? contact.photo
                                            : FALLBACK_IMAGE_URL
                                        }
                                        alt={`${contact.firstName} ${contact.lastName} profile`}
                                        width={24}
                                        height={24}
                                        className={
                                          smartSearchImageStates[contact.id] || (!contact.photo || contact.photo.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2"))
                                            ? "rounded-full object-cover aspect-square border border-neutral-200 w-6 h-6 shrink-0"
                                            : "rounded-full object-cover aspect-square w-6 h-6 shrink-0"
                                        }
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          if (!smartSearchImageStates[contact.id] && contact.photo && !contact.photo.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")) {
                                            setSmartSearchImageStates(prev => ({ ...prev, [contact.id]: true }));
                                            if (target.src !== FALLBACK_IMAGE_URL) target.src = FALLBACK_IMAGE_URL;
                                          } else if (target.src !== FALLBACK_IMAGE_URL) {
                                            target.src = FALLBACK_IMAGE_URL;
                                          }
                                        }}
                                      />
                                      <div className="flex flex-col min-w-0 overflow-hidden">
                                        <span className={cn(
                                          "text-neutral-700 font-light text-xs truncate",
                                          contact.isTopCandidate ? "text-black bg-kenoo-yellow/70 px-2 py-1 rounded inline-block" : ""
                                        )}>
                                          {contact.firstName} {contact.lastName}
                                        </span>
                                        {contact.isTopCandidate && (
                                          <span className="text-xs text-muted-foreground font-light mt-0.5 truncate">Top Candidate</span>
                                        )}
                                      </div>
                                    </a>
                                  ) : (
                                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                      <Image
                                        src={
                                          !smartSearchImageStates[contact.id] && contact.photo && !contact.photo.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")
                                            ? contact.photo
                                            : FALLBACK_IMAGE_URL
                                        }
                                        alt={`${contact.firstName} ${contact.lastName} profile`}
                                        width={24}
                                        height={24}
                                        className={
                                          smartSearchImageStates[contact.id] || (!contact.photo || contact.photo.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2"))
                                            ? "rounded-full object-cover aspect-square border border-neutral-200 w-6 h-6 shrink-0"
                                            : "rounded-full object-cover aspect-square w-6 h-6 shrink-0"
                                        }
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          if (!smartSearchImageStates[contact.id] && contact.photo && !contact.photo.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")) {
                                            setSmartSearchImageStates(prev => ({ ...prev, [contact.id]: true }));
                                            if (target.src !== FALLBACK_IMAGE_URL) target.src = FALLBACK_IMAGE_URL;
                                          } else if (target.src !== FALLBACK_IMAGE_URL) {
                                            target.src = FALLBACK_IMAGE_URL;
                                          }
                                        }}
                                      />
                                      <div className="flex flex-col min-w-0 overflow-hidden">
                                        <span className={cn(
                                          "text-neutral-700 font-light text-xs truncate",
                                          contact.isTopCandidate ? "text-black bg-kenoo-yellow/70 px-2 py-1 rounded inline-block" : ""
                                        )}>
                                          {contact.firstName} {contact.lastName}
                                        </span>
                                        {contact.isTopCandidate && (
                                          <span className="text-xs text-muted-foreground font-light mt-0.5 truncate">Top Candidate</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-neutral-300">—</td>
                                <td className="py-4 pr-4 text-neutral-400 text-xs font-light overflow-hidden">
                                  {contact.title ? (
                                    <DynamicTooltip content={contact.title}>
                                      <span className="block max-w-[220px] truncate cursor-default">
                                        {contact.title}
                                      </span>
                                    </DynamicTooltip>
                                  ) : (
                                    <span className="block max-w-[220px] truncate">—</span>
                                  )}
                                </td>
                                <td className="py-4 pr-4 text-neutral-400 text-xs font-light overflow-hidden">
                                  <span className="truncate block">{contact.lastContacted ? formatDate(contact.lastContacted) : "—"}</span>
                                </td>
                                <td className="py-4 pr-4 overflow-hidden">
                                  <div className="flex items-center justify-center">
                                    <EnrichmentStatus
                                      status={contact.is_internal ? getEnrichmentStatus(contact.lastEnriched) : 'none'}
                                      website={companyWebsite || ''}
                                      userId={user?.id}
                                      contact={contact}
                                      companyId={companyId}
                                      apolloAccountId={apolloAccountId}
                                      onEnrichSuccess={handleEnrichSuccess}
                                    />
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <SmartSearchPopup
        open={smartSearchPopupOpen}
        onOpenChange={setSmartSearchPopupOpen}
        companyName={companyName}
        onSearch={(filters) => handleSmartSearch(false, filters)}
      />
    </TooltipProvider>
  );
}
