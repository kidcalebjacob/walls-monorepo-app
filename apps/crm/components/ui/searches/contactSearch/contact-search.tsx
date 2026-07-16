"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactSearchApolloEnrich } from "./contact-search-apollo-enrich";
import { FallbackEmailAvatar } from "@/components/agentMail/ui/fallback-email-avatar";

const SKELETON_ROW_WIDTHS = ["w-[88%]", "w-[72%]", "w-[80%]", "w-[64%]", "w-[76%]", "w-[70%]"] as const;

function ContactListSkeleton() {
  return (
    <>
      {SKELETON_ROW_WIDTHS.map((w, i) => (
        <div key={i} className="flex items-center rounded-none px-4 py-2 pr-16">
          <div className="flex min-w-0 w-full items-center space-x-3">
            <Skeleton
              className="h-6 w-6 shrink-0 rounded-full bg-neutral-200/70"
              style={{ animationDelay: `${i * 75}ms` }}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton
                className={cn("h-3.5 max-w-full rounded-[3px] bg-neutral-200/65", w)}
                style={{ animationDelay: `${i * 75 + 40}ms` }}
              />
              <Skeleton
                className="h-2.5 w-[55%] max-w-full rounded-[3px] bg-neutral-200/50"
                style={{ animationDelay: `${i * 75 + 80}ms` }}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

interface PersonRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  photo_url: string | null;
}

export type ContactSearchSelectPayload = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  photoUrl?: string | null;
};

export interface ContactSearchProps {
  value: string;
  onChange: (value: string, personId?: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  triggerIcon?: "none" | "chevron" | "plus";
  hideChevron?: boolean;
  onSelectContact?: (contact: ContactSearchSelectPayload) => void;
  onRemoveContact?: (contact: { id: string; fullName: string }) => void;
  autoOpen?: boolean;
  onClose?: () => void;
  contentAlign?: "start" | "center" | "end";
  /** Dropdown width: default expands past a narrow trigger; `match-trigger` keeps Radix trigger width only. */
  contentWidth?: "adaptive" | "match-trigger";
  /** Extra classes merged onto `SelectContent`. */
  contentClassName?: string;
  stayOpenOnSelect?: boolean;
  selectedIds?: string[];
  /**
   * Hides the select trigger row (label / placeholder) so only the portaled dropdown is visible.
   * Use when the control is already anchored in a popover (e.g. company avatar picker).
   */
  hideTrigger?: boolean;
}

const SEARCH_DEBOUNCE_MS = 280;
/** Rows shown per page; we request one extra row to detect whether another page exists. */
const PAGE_SIZE = 20;
const CONTACT_PERSON_TYPE = "contact";

function personFullName(row: PersonRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
}

function personDisplayName(row: PersonRow): string {
  return personFullName(row) || row.email || "—";
}

function normalizePersonRows(
  rows: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    photo_url: string | null;
  }[]
): PersonRow[] {
  return rows
    .map((row) => ({
      id: row.id,
      firstName: row.first_name?.trim() || "",
      lastName: row.last_name?.trim() || "",
      email: row.email?.trim() || null,
      photo_url: row.photo_url ?? null,
    }))
    .filter((row) => row.firstName || row.lastName || row.email);
}

async function fetchContactPersonRowById(personId: string): Promise<PersonRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, email, photo_url")
    .eq("id", personId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("Error fetching enriched contact:", error);
    return null;
  }

  const rows = normalizePersonRows([
    data as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      photo_url: string | null;
    },
  ]);
  return rows[0] ?? null;
}

function resolvedTriggerSuffix(
  triggerIcon: ContactSearchProps["triggerIcon"],
  hideChevron: boolean | undefined
): "none" | "chevron" | "plus" {
  if (triggerIcon) return triggerIcon;
  if (hideChevron === false) return "chevron";
  return "none";
}

function ContactPersonAvatar({
  name,
  photoUrl,
  size = "list",
  hasImageError,
  onImageError,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "list" | "trigger";
  hasImageError?: boolean;
  onImageError?: () => void;
}) {
  const showPhoto = Boolean(photoUrl?.trim()) && !hasImageError;
  const isTrigger = size === "trigger";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        isTrigger ? "h-5 w-5" : "h-6 w-6"
      )}
    >
      {showPhoto ? (
        <Image
          src={photoUrl!}
          alt=""
          width={isTrigger ? 20 : 24}
          height={isTrigger ? 20 : 24}
          className="h-full w-full object-cover"
          sizes={isTrigger ? "20px" : "24px"}
          onError={onImageError}
        />
      ) : (
        <FallbackEmailAvatar
          name={name}
          className={isTrigger ? "text-[9px]" : "text-[10px]"}
        />
      )}
    </div>
  );
}

export function ContactSearch({
  value,
  onChange,
  className,
  disabled,
  placeholder = "Select contact...",
  triggerIcon,
  hideChevron = true,
  onSelectContact,
  autoOpen,
  onClose,
  contentAlign = "start",
  contentWidth = "adaptive",
  contentClassName,
  stayOpenOnSelect,
  selectedIds,
  onRemoveContact,
  hideTrigger = false,
}: ContactSearchProps) {
  const router = useRouter();
  const suffix = resolvedTriggerSuffix(triggerIcon, hideChevron);

  const [open, setOpen] = React.useState(!!autoOpen);
  const [people, setPeople] = React.useState<PersonRow[]>([]);
  const [imageErrors, setImageErrors] = React.useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedFromValue, setSelectedFromValue] = React.useState<PersonRow | null>(null);
  const [listLoading, setListLoading] = React.useState(() => !!(autoOpen && open));
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [showEnrichPanel, setShowEnrichPanel] = React.useState(false);
  const [listRefreshKey, setListRefreshKey] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listScrollRef = React.useRef<HTMLDivElement>(null);
  const fetchGenRef = React.useRef(0);
  const loadingMoreInFlightRef = React.useRef(false);
  /** Keeps a just-enriched contact visible when the paginated refetch omits them. */
  const pinnedEnrichIdRef = React.useRef<string | null>(null);

  const debouncePending = open && searchTerm.trim() !== debouncedSearch;
  const showListSkeleton = listLoading || (debouncePending && people.length === 0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  /** First page: same filter as infinite scroll, capped payload for faster queries. */
  React.useEffect(() => {
    if (!open) {
      fetchGenRef.current += 1;
      setPeople([]);
      setHasMore(true);
      setLoadingMore(false);
      loadingMoreInFlightRef.current = false;
      return;
    }

    const gen = ++fetchGenRef.current;

    const run = async () => {
      setListLoading(true);
      setLoadingMore(false);
      loadingMoreInFlightRef.current = false;
      try {
        const supabase = getSupabaseClient();
        let query = supabase
          .from("people")
          .select("id, first_name, last_name, email, photo_url")
          .eq("person_type", CONTACT_PERSON_TYPE)
          .order("first_name", { ascending: true })
          .range(0, PAGE_SIZE);

        if (debouncedSearch) {
          const q = `%${debouncedSearch}%`;
          query = query.or(
            `first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`
          );
        }

        const { data, error } = await query;

        if (gen !== fetchGenRef.current) return;

        if (error) {
          console.error("Error fetching people:", error);
          setPeople([]);
          setHasMore(false);
          return;
        }

        const raw = (data || []) as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          photo_url: string | null;
        }[];
        const hasExtra = raw.length > PAGE_SIZE;
        const slice = hasExtra ? raw.slice(0, PAGE_SIZE) : raw;

        const next = normalizePersonRows(slice);
        const pinnedId = pinnedEnrichIdRef.current;
        if (pinnedId && !next.some((p) => p.id === pinnedId)) {
          setPeople((prev) => {
            const pinned = prev.find((p) => p.id === pinnedId);
            return pinned ? [pinned, ...next] : next;
          });
        } else {
          setPeople(next);
        }
        setHasMore(hasExtra);
      } catch (err) {
        console.error("Error fetching people:", err);
        if (gen === fetchGenRef.current) {
          setPeople([]);
          setHasMore(false);
        }
      } finally {
        if (gen === fetchGenRef.current) {
          setListLoading(false);
        }
      }
    };

    void run();
  }, [open, debouncedSearch, listRefreshKey]);

  React.useEffect(() => {
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
    }
  }, [debouncedSearch]);

  const fetchNextPage = React.useCallback(async () => {
    if (!open || listLoading || loadingMoreInFlightRef.current || !hasMore) return;

    const listGen = fetchGenRef.current;
    const offset = people.length;

    loadingMoreInFlightRef.current = true;
    setLoadingMore(true);
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("people")
        .select("id, first_name, last_name, email, photo_url")
        .eq("person_type", CONTACT_PERSON_TYPE)
        .order("first_name", { ascending: true })
        .range(offset, offset + PAGE_SIZE);

      if (debouncedSearch) {
        const q = `%${debouncedSearch}%`;
        query = query.or(
          `first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`
        );
      }

      const { data, error } = await query;

      if (listGen !== fetchGenRef.current) return;

      if (error) {
        console.error("Error loading more people:", error);
        setHasMore(false);
        return;
      }

      const raw = (data || []) as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        photo_url: string | null;
      }[];
      const hasExtra = raw.length > PAGE_SIZE;
      const slice = hasExtra ? raw.slice(0, PAGE_SIZE) : raw;
      const batch = normalizePersonRows(slice);

      if (batch.length === 0) {
        setHasMore(false);
        return;
      }

      setPeople((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const p of batch) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        }
        return merged;
      });
      setHasMore(hasExtra);
    } catch (err) {
      console.error("Error loading more people:", err);
    } finally {
      loadingMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [open, listLoading, hasMore, debouncedSearch, people.length]);

  const handleListScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (!hasMore || listLoading || loadingMoreInFlightRef.current) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (nearBottom) {
        void fetchNextPage();
      }
    },
    [hasMore, listLoading, fetchNextPage],
  );

  /** If the first page does not overflow, nothing fires `scroll` — prefetch until the list scrolls or ends. */
  React.useLayoutEffect(() => {
    const el = listScrollRef.current;
    if (!open || listLoading || !hasMore || loadingMoreInFlightRef.current || showListSkeleton) return;
    if (!el || people.length === 0) return;
    if (el.scrollHeight <= el.clientHeight + 2) {
      void fetchNextPage();
    }
  }, [open, listLoading, hasMore, people.length, fetchNextPage, showListSkeleton]);

  React.useEffect(() => {
    if (!open) {
      setShowEnrichPanel(false);
      pinnedEnrichIdRef.current = null;
    }
  }, [open]);

  const handleEnrichSuccess = React.useCallback(
    async ({ personName, personId }: { personName?: string; personId?: string }) => {
      const searchLabel = personName?.trim() || "";
      setSearchTerm(searchLabel);
      setDebouncedSearch(searchLabel);

      let inserted = false;
      if (personId) {
        pinnedEnrichIdRef.current = personId;
        const row = await fetchContactPersonRowById(personId);
        if (row) {
          inserted = true;
          setPeople((prev) => [row, ...prev.filter((p) => p.id !== row.id)]);
          setListLoading(false);
        }
      }

      if (!inserted) {
        setListRefreshKey((k) => k + 1);
      }

      setShowEnrichPanel(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    []
  );

  React.useEffect(() => {
    const loadSelected = async () => {
      const trimmed = value.trim();
      const isUnset = trimmed === "" || trimmed === "—";
      if (isUnset) {
        setSelectedFromValue(null);
        return;
      }
      const inList = people.some((p) => personFullName(p) === trimmed);
      if (inList) {
        setSelectedFromValue(null);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const parts = trimmed.split(/\s+/);
        const first = parts[0] ?? "";
        const last = parts.slice(1).join(" ");
        let query = supabase
          .from("people")
          .select("id, first_name, last_name, email, photo_url")
          .eq("person_type", CONTACT_PERSON_TYPE)
          .ilike("first_name", first);
        if (last) {
          query = query.ilike("last_name", last);
        }
        const { data, error } = await query.limit(1).maybeSingle();
        if (error || !data) {
          setSelectedFromValue(null);
          return;
        }
        const normalized = normalizePersonRows([data]);
        setSelectedFromValue(normalized[0] ?? null);
      } catch {
        setSelectedFromValue(null);
      }
    };
    void loadSelected();
  }, [value, people]);

  React.useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);

  const selectedPerson = React.useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "—") return null;
    return people.find((p) => personFullName(p) === trimmed) ?? selectedFromValue;
  }, [people, value, selectedFromValue]);

  const displayPeople = React.useMemo((): PersonRow[] => {
    const list = [...people];
    const trimmed = value.trim();

    let merged =
      selectedFromValue && trimmed && trimmed !== "—" && !list.some((p) => p.id === selectedFromValue.id)
        ? [selectedFromValue, ...list]
        : list;

    const hasSelectedIds = selectedIds != null && selectedIds.length > 0;
    if (hasSelectedIds && selectedIds) {
      const idSet = new Set(selectedIds);
      const head = merged.filter((p) => idSet.has(p.id));
      const tail = merged.filter((p) => !idSet.has(p.id));
      return [...head, ...tail];
    }

    if (!trimmed || trimmed === "—") return merged;

    const i = merged.findIndex((p) => personFullName(p) === trimmed);
    if (i <= 0) return merged;

    const picked = merged[i]!;
    return [picked, ...merged.slice(0, i), ...merged.slice(i + 1)];
  }, [people, value, selectedIds, selectedFromValue]);

  React.useEffect(() => {
    if (!open) {
      setSearchTerm("");
    } else {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const markImageError = (personId: string) => {
    setImageErrors((prev) => ({ ...prev, [personId]: true }));
  };

  const displayLabel =
    value && value.trim() !== "" && value.trim() !== "—" ? value : placeholder;

  const handleSelectPerson = (person: PersonRow) => {
    const fullName = personFullName(person);
    onChange(fullName, person.id);
    onSelectContact?.({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      fullName,
      email: person.email ?? undefined,
      photoUrl: person.photo_url ?? null,
    });
    if (stayOpenOnSelect) {
      setSearchTerm("");
    } else {
      setOpen(false);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent, person: PersonRow) => {
    e.preventDefault();
    e.stopPropagation();
    const fullName = personFullName(person);
    if (selectedIds && onRemoveContact) {
      onRemoveContact({ id: person.id, fullName });
    } else if (!selectedIds) {
      onChange("", undefined);
    }
    if (!stayOpenOnSelect) setOpen(false);
  };

  return (
    <div className={cn(hideTrigger && "relative w-full")}>
    <Select
      value=""
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setSearchTerm("");
          setListLoading(false);
          onClose?.();
        } else {
          setListLoading(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }}
      onValueChange={() => {}}
    >
      <SelectTrigger
        disabled={disabled}
        aria-hidden={hideTrigger ? true : undefined}
        tabIndex={hideTrigger ? -1 : undefined}
        className={cn(
          "group relative flex h-auto min-h-0 w-full max-w-full flex-1 cursor-pointer items-center justify-between border-0 bg-transparent p-0 shadow-none disabled:cursor-not-allowed [&>:last-child]:hidden",
          "hover:bg-transparent focus:ring-0 focus:ring-offset-0 focus-visible:outline-none",
          hideTrigger &&
            "pointer-events-none absolute left-0 top-0 z-[-1] m-0 h-px min-h-px w-full max-w-full overflow-hidden border-0 p-0 opacity-0 shadow-none ring-0 ring-offset-0 focus:ring-0 data-[state=open]:opacity-0",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selectedPerson && !(value.trim() === "" || value.trim() === "—") ? (
            <ContactPersonAvatar
              name={personFullName(selectedPerson)}
              photoUrl={selectedPerson.photo_url}
              size="trigger"
              hasImageError={imageErrors[selectedPerson.id]}
              onImageError={() => markImageError(selectedPerson.id)}
            />
          ) : null}
          <span
            className={cn(
              "min-w-0 truncate text-sm font-light",
              value && value.trim() !== "" && value.trim() !== "—"
                ? "text-neutral-900"
                : "text-neutral-400"
            )}
          >
            {displayLabel}
          </span>
        </div>
        {suffix === "chevron" ? (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        ) : suffix === "plus" ? (
          <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        ) : null}
      </SelectTrigger>

      <SelectContent
        position="popper"
        side="bottom"
        align={contentAlign}
        sideOffset={8}
        collisionPadding={16}
        className={cn(
          "!z-[9999] flex max-h-[min(500px,var(--radix-select-content-available-height))] flex-col overflow-hidden rounded-lg bg-white/80 p-0 shadow-2xl backdrop-blur-xl",
          "[&>div]:!p-0",
          // Radix viewport uses trigger height; when trigger is collapsed, keep dropdown usable.
          hideTrigger &&
            "[&>div]:!h-auto [&>div]:!max-h-[min(492px,var(--radix-select-content-available-height))]",
          // Narrow triggers stay readable; wide filters keep full trigger width — both capped to viewport.
          contentWidth === "adaptive"
            ? "max-w-[calc(100vw-2rem)] w-[max(var(--radix-select-trigger-width),min(21rem,calc(100vw-2rem)))]"
            : "max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]",
          contentClassName
        )}
      >
        <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
          {showEnrichPanel ? (
            <div onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <ContactSearchApolloEnrich
                onClose={() => {
                  setShowEnrichPanel(false);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                onSuccess={handleEnrichSuccess}
              />
            </div>
          ) : (
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
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
                placeholder="Search contacts…"
                className={cn(
                  "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-16 text-sm font-light transition-colors placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none",
                  searchTerm.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200"
                )}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer px-1 text-[10px] font-light lowercase leading-none tracking-wide text-neutral-400 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowEnrichPanel(true);
                }}
              >
                + add
              </button>
            </div>
          )}
        </div>

        <div
          ref={listScrollRef}
          className="flex-1 overflow-y-auto bg-white/80 backdrop-blur-xl"
          onWheel={(e) => e.stopPropagation()}
          onScroll={handleListScroll}
        >
          {showListSkeleton ? (
            <ContactListSkeleton />
          ) : people.length === 0 && !searchTerm.trim() ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-4">
              <p className="text-sm font-light text-gray-500">No contact found.</p>
              <Button
                variant="outline"
                size="sm"
                className="font-light"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  router.push("/agents/crm/people/create");
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Person
              </Button>
            </div>
          ) : people.length === 0 ? (
            <div className="px-4 py-2 text-sm font-light text-gray-500">No contacts found</div>
          ) : (
            <>
              {displayPeople.map((person) => {
                const fullName = personDisplayName(person);
                const isSelected = selectedIds
                  ? selectedIds.includes(person.id)
                  : value === fullName || value === personFullName(person);
                return (
                  <div
                    key={person.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectPerson(person);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="relative flex cursor-pointer items-center rounded-none px-4 py-2 pr-16 hover:bg-neutral-100/60 focus:bg-neutral-100/60"
                  >
                    <div className="flex min-w-0 w-full items-center space-x-3">
                      <ContactPersonAvatar
                        name={fullName}
                        photoUrl={person.photo_url}
                        hasImageError={imageErrors[person.id]}
                        onImageError={() => markImageError(person.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-light">{fullName}</span>
                        {person.email ? (
                          <span className="block truncate text-xs font-light text-neutral-400">
                            {person.email}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {isSelected && (!selectedIds || onRemoveContact) ? (
                      <button
                        type="button"
                        className="absolute right-5 top-1/2 z-10 -translate-y-1/2 text-[10px] font-light lowercase leading-none tracking-wide text-[var(--kenoo-sky)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kenoo-sky)] focus-visible:ring-offset-1"
                        onClick={(e) => handleRemoveClick(e, person)}
                      >
                        remove
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {loadingMore ? (
                <div className="border-t border-neutral-200/40 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-light text-neutral-400">
                    <Skeleton className="h-4 w-4 shrink-0 rounded-full bg-neutral-200/70" />
                    <Skeleton className="h-3 flex-1 max-w-[55%] rounded-[3px] bg-neutral-200/65" />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </SelectContent>
    </Select>
    </div>
  );
}
