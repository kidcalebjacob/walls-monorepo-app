"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import * as React from "react";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from "next/image";
import { ChevronDown, CheckCircle, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/auth/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const FALLBACK_AVATAR = FALLBACK_ICON_URL;

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  country?: string | null;
  photoUrl?: string | null;
  is_internal?: boolean;
  internal_id?: string | null;
}

interface CompanyPeopleSearchProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  companyId?: string | null;
  apolloOrganizationId?: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
  onSelectContact?: (contact: Contact) => void;
}

export function CompanyPeopleSearch({
  value,
  onChange,
  className,
  companyId,
  apolloOrganizationId,
  companyName,
  companyWebsite,
  onSelectContact,
}: CompanyPeopleSearchProps) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [apolloContacts, setApolloContacts] = React.useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [showSearchAll, setShowSearchAll] = React.useState(false);
  const [enrichingIds, setEnrichingIds] = React.useState<Set<string>>(new Set());
  const [enrichedIds, setEnrichedIds] = React.useState<Set<string>>(new Set());
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Fetch existing database contacts for the company
  React.useEffect(() => {
    const fetchContacts = async () => {
      if (!companyId) {
        setContacts([]);
        return;
      }

      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("people")
          .select("id, first_name, last_name, email, title, photo_url, country")
          .eq("company_id", companyId)
          .not("email", "is", null)
          .order("first_name", { ascending: true });

        if (error) {
          console.error("Error fetching contacts:", error);
          setContacts([]);
          return;
        }

        const contactsList = (data || []).map((row) => ({
          id: row.id,
          firstName: row.first_name || "",
          lastName: row.last_name || "",
          email: row.email || "",
          title: row.title || undefined,
          country: row.country || null,
          photoUrl: row.photo_url,
          is_internal: true,
          internal_id: row.id,
        }));

        setContacts(contactsList);
      } catch (err) {
        console.error("Error fetching contacts:", err);
        setContacts([]);
      }
    };

    fetchContacts();
  }, [companyId]);

  const filteredContacts = React.useMemo(() => {
    const allContacts = [...contacts, ...apolloContacts];
    if (!searchTerm.trim()) return allContacts;
    const q = searchTerm.toLowerCase();
    return allContacts.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.title && c.title.toLowerCase().includes(q))
    );
  }, [contacts, apolloContacts, searchTerm]);

  const handleSearch = async (searchAll: boolean = false) => {
    if (!apolloOrganizationId) {
      console.error("No Apollo organization ID available");
      return;
    }

    setIsSearching(true);
    setShowSearchAll(false);

    try {
      const response = await fetch("/api/apollo/custom/smart-search/company-people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apollo_organization_id: apolloOrganizationId,
          search_all: searchAll,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch search results");
      }

      const data = await response.json();
      const rawContacts = (data?.contacts ?? data?.people ?? []) as any[];

      const normalizedContacts: Contact[] = rawContacts.map((c: any) => ({
        id: c.id || "",
        firstName: c.firstName ?? c.first_name ?? "",
        lastName: c.lastName ?? c.last_name ?? c.last_name_obfuscated ?? "",
        email: c.email ?? "",
        title: c.title ?? "",
        country: c.country ?? null,
        photoUrl: c.photo ?? c.photo_url ?? "",
        is_internal: c.is_internal ?? false,
        internal_id: c.internal_id ?? null,
      }));

      if (normalizedContacts.length === 0 && !searchAll) {
        setShowSearchAll(true);
      } else {
        setShowSearchAll(false);
      }

      setApolloContacts(normalizedContacts);
      setHasSearched(true);
    } catch (error) {
      console.error("Error searching contacts:", error);
      if (!searchAll) {
        setShowSearchAll(true);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (contact: Contact) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.trim();
    onChange(fullName);
    onSelectContact?.(contact);
    setOpen(false);
  };

  const handleEnrich = async (contact: Contact, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user?.id) {
      wallsToast.error('Enrichment failed', 'You must be signed in to enrich.');
      return;
    }

    // Skip if already enriched (is_internal means it's in our database)
    if (contact.is_internal) {
      wallsToast.success('Already enriched', 'This contact is already in your database.');
      return;
    }

    // Need Apollo person ID to enrich
    if (!contact.id) {
      wallsToast.error('Enrichment failed', 'Contact ID is missing.');
      return;
    }

    setEnrichingIds(prev => new Set(prev).add(contact.id));
    try {
      const res = await fetch('/api/apollo/custom/apollo-person-id-supabase-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: contact.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        wallsToast.error('Enrichment failed', data.error || data.details || 'Failed to sync person.');
        return;
      }
      if (data.success) {
        setEnrichedIds(prev => new Set(prev).add(contact.id));
        // Refresh contacts list to show the newly enriched contact
        if (companyId) {
          const supabase = getSupabaseClient();
          const { data: refreshedData } = await supabase
            .from("people")
            .select("id, first_name, last_name, email, title, photo_url, country")
            .eq("company_id", companyId)
            .not("email", "is", null)
            .order("first_name", { ascending: true });
          
          if (refreshedData) {
            const refreshedContacts = refreshedData.map((row) => ({
              id: row.id,
              firstName: row.first_name || "",
              lastName: row.last_name || "",
              email: row.email || "",
              title: row.title || undefined,
              country: row.country || null,
              photoUrl: row.photo_url,
              is_internal: true,
              internal_id: row.id,
            }));
            setContacts(refreshedContacts);
          }
        }
        wallsToast.success(
          'Contact synced',
          data.message ||
            [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
            'Contact synced successfully'
        );
      } else {
        wallsToast.error('Enrichment failed', data.error || data.details || 'Failed to sync person.');
      }
    } catch (e) {
      wallsToast.error('Enrichment failed', e instanceof Error ? e.message : 'Network error');
    } finally {
      setEnrichingIds(prev => { 
        const s = new Set(prev); 
        s.delete(contact.id); 
        return s; 
      });
    }
  };

  const selectedContact = React.useMemo(() => {
    const allContacts = [...contacts, ...apolloContacts];
    return allContacts.find(
      (c) => `${c.firstName} ${c.lastName}`.trim() === value
    );
  }, [contacts, apolloContacts, value]);

  return (
    <div className="w-full">
      <Select
        value=""
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setSearchTerm("");
          } else {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        onValueChange={() => {}}
      >
        <SelectTrigger
          className={cn(
            "relative group px-3 py-2 h-10 w-full flex items-center justify-between border-0 shadow-none bg-transparent focus:ring-0 focus:ring-offset-0 [&>:last-child]:hidden",
            className
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedContact?.photoUrl && (
              <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                <Image
                  src={selectedContact.photoUrl}
                  alt={`${selectedContact.firstName} ${selectedContact.lastName}`}
                  fill
                  className="object-cover"
                  sizes="24px"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = FALLBACK_AVATAR;
                  }}
                />
              </div>
            )}
            <span className="font-normal truncate">
              {value || "Select contact..."}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          align="start"
          sideOffset={8}
          className="p-0 bg-white/80 backdrop-blur-xl shadow-2xl !z-[9999] w-full min-w-[350px] max-h-[500px] overflow-hidden flex flex-col [&>div]:!p-0 rounded-lg"
        >
          {/* Search Input - Sticky */}
          <div className="p-2 border-b border-gray-900/10 flex-shrink-0 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
            <div className="rounded-lg bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-2 py-2">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  e.stopPropagation();
                  setSearchTerm(e.target.value);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") setSearchTerm("");
                }}
                placeholder="Search contacts..."
                className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full text-sm focus:outline-none placeholder:text-neutral-400"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Search Button */}
          {!hasSearched && apolloOrganizationId && (
            <div className="p-2 border-b border-gray-900/10 flex-shrink-0 bg-white/80 backdrop-blur-xl">
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSearch(false);
                }}
                disabled={isSearching}
                className="w-full bg-kenoo-yellow hover:bg-kenoo-yellow/90 text-gray-800 font-medium text-sm py-2 h-auto"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search for more contacts
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Search All Button */}
          {showSearchAll && apolloOrganizationId && (
            <div className="p-2 border-b border-gray-900/10 flex-shrink-0 bg-white/80 backdrop-blur-xl">
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSearch(true);
                }}
                disabled={isSearching}
                className="w-full bg-neutral-200 hover:bg-neutral-300 text-gray-800 font-medium text-sm py-2 h-auto"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search all contacts
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Contact List - Scrollable */}
          <TooltipProvider>
            <div className="overflow-y-auto flex-1 bg-neutral-300/20 backdrop-blur-xl">
              {filteredContacts.length === 0 ? (
                <div className="py-4 px-4 text-sm text-gray-500">
                  {hasSearched
                    ? "No contacts found"
                    : contacts.length === 0
                    ? "No contacts in database. Click 'Search for more contacts' to find contacts."
                    : "No contacts match your search"}
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
                  const isSelected = value === fullName;
                  const isEnriched = contact.is_internal || enrichedIds.has(contact.id);
                  const isEnriching = enrichingIds.has(contact.id);
                  return (
                    <div
                      key={contact.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(contact);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className={cn(
                        "flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10",
                        isSelected && "bg-kenoo-yellow/40"
                      )}
                    >
                      <div className="flex items-center space-x-3 w-full min-w-0">
                        <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                          {contact.photoUrl ? (
                            <Image
                              src={contact.photoUrl}
                              alt={fullName}
                              fill
                              className="object-cover"
                              sizes="24px"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = FALLBACK_AVATAR;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-600">
                                {contact.firstName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-normal text-sm block truncate">
                              {fullName}
                            </span>
                            {contact.email && (
                              <span className="text-xs text-muted-foreground block truncate">
                                {contact.email}
                              </span>
                            )}
                            {(contact.title || contact.country) && (
                              <span className="text-xs text-muted-foreground block truncate">
                                {[contact.title, contact.country].filter(Boolean).join(" • ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isEnriched && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!isEnriched && !isEnriching) {
                                      handleEnrich(contact, e);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!isEnriched && !isEnriching) {
                                        handleEnrich(contact, e as any);
                                      }
                                    }
                                  }}
                                  className={cn(
                                    "flex flex-col items-center gap-[2px] w-6 p-4 rounded-full transition-all duration-200 cursor-pointer",
                                    !isEnriched && !isEnriching && "hover:bg-gray-500/30",
                                    isEnriching && "animate-pulse"
                                  )}
                                >
                                  {isEnriched ? (
                                    <>
                                      <div className="w-5 h-[3px] rounded-sm bg-kenoo-sky/60" />
                                      <div className="w-4 h-[3px] rounded-sm bg-kenoo-sky/60" />
                                      <div className="w-3 h-[3px] rounded-sm bg-kenoo-sky/60" />
                                    </>
                                  ) : isEnriching ? (
                                    <>
                                      <div className="w-5 h-[3px] rounded-sm bg-blue-500" />
                                      <div className="w-4 h-[3px] rounded-sm bg-blue-400 delay-100" />
                                      <div className="w-3 h-[3px] rounded-sm bg-blue-300 delay-200" />
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-5 h-[3px] rounded-sm bg-gray-300 opacity-30" />
                                      <div className="w-4 h-[3px] rounded-sm bg-gray-300 opacity-30" />
                                      <div className="w-3 h-[3px] rounded-sm bg-gray-300 opacity-30" />
                                    </>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="font-light" side="left" sideOffset={5}>
                                {isEnriching ? 'Enriching...' : isEnriched ? 'Enriched!' : 'Add to database'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {isSelected && (
                            <CheckCircle className="h-4 w-4 text-black flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TooltipProvider>
        </SelectContent>
      </Select>
    </div>
  );
}
