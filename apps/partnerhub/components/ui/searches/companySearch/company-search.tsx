"use client";

import * as React from "react";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
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
import { CompanySearchApolloEnrich } from "./company-search-apollo-enrich";

const FALLBACK_LOGO = FALLBACK_ICON_URL;

const SKELETON_ROW_WIDTHS = ["w-[88%]", "w-[72%]", "w-[80%]", "w-[64%]", "w-[76%]", "w-[70%]"] as const;

function CompanyListSkeleton() {
  return (
    <>
      {SKELETON_ROW_WIDTHS.map((w, i) => (
        <div key={i} className="flex items-center rounded-none px-4 py-2 pr-16">
          <div className="flex min-w-0 w-full items-center space-x-3">
            <Skeleton
              className="h-6 w-6 shrink-0 rounded-full bg-neutral-200/70"
              style={{ animationDelay: `${i * 75}ms` }}
            />
            <div className="min-w-0 flex-1">
              <Skeleton
                className={cn("h-3.5 max-w-full rounded-[3px] bg-neutral-200/65", w)}
                style={{ animationDelay: `${i * 75 + 40}ms` }}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

interface Company {
  id: string;
  name: string;
  logo_url?: string | null;
}

export interface CompanySearchProps {
  value: string;
  onChange: (value: string, companyId?: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Icon after label. Default hides Radix chevron only. */
  triggerIcon?: "none" | "chevron" | "plus";
  /**
   * When false, shows ChevronDown (same as triggerIcon `"chevron"`).
   * Prefer `triggerIcon`.
   */
  hideChevron?: boolean;
  onSelectCompany?: (company: { id: string; name: string; logo_url?: string | null }) => void;
  /** With `selectedIds`, called when user clicks **Remove** on an already-selected row (e.g. drop a brand preference). */
  onRemoveCompany?: (company: { id: string; name: string }) => void;
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

function normalizeCompanyRows(
  rows: { id: string; name: string | null; logo_url: string | null }[]
): Company[] {
  return rows
    .filter((c) => c.name)
    .map((c) => ({
      id: c.id,
      name: c.name as string,
      logo_url: c.logo_url || null,
    }));
}

function resolvedTriggerSuffix(
  triggerIcon: CompanySearchProps["triggerIcon"],
  hideChevron: boolean | undefined
): "none" | "chevron" | "plus" {
  if (triggerIcon) return triggerIcon;
  if (hideChevron === false) return "chevron";
  return "none";
}

export function CompanySearch({
  value,
  onChange,
  className,
  disabled,
  placeholder = "Select company...",
  triggerIcon,
  hideChevron = true,
  onSelectCompany,
  autoOpen,
  onClose,
  contentAlign = "start",
  contentWidth = "adaptive",
  contentClassName,
  stayOpenOnSelect,
  selectedIds,
  onRemoveCompany,
  hideTrigger = false,
}: CompanySearchProps) {
  const router = useRouter();
  const suffix = resolvedTriggerSuffix(triggerIcon, hideChevron);

  const [open, setOpen] = React.useState(!!autoOpen);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [imageErrors, setImageErrors] = React.useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedFromValue, setSelectedFromValue] = React.useState<Company | null>(null);
  const [listLoading, setListLoading] = React.useState(() => !!(autoOpen && open));
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [showEnrichPanel, setShowEnrichPanel] = React.useState(false);
  const [listRefreshKey, setListRefreshKey] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listScrollRef = React.useRef<HTMLDivElement>(null);
  const fetchGenRef = React.useRef(0);
  const loadingMoreInFlightRef = React.useRef(false);

  const debouncePending = open && searchTerm.trim() !== debouncedSearch;
  const showListSkeleton = listLoading || (debouncePending && companies.length === 0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  /** First page: same filter as infinite scroll, capped payload for faster queries. */
  React.useEffect(() => {
    if (!open) {
      fetchGenRef.current += 1;
      setCompanies([]);
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
          .from("companies")
          .select("id, name, logo_url")
          .order("name", { ascending: true })
          .range(0, PAGE_SIZE);

        if (debouncedSearch) {
          query = query.ilike("name", `%${debouncedSearch}%`);
        }

        const { data, error } = await query;

        if (gen !== fetchGenRef.current) return;

        if (error) {
          console.error("Error fetching companies:", error);
          setCompanies([]);
          setHasMore(false);
          return;
        }

        const raw = (data || []) as { id: string; name: string | null; logo_url: string | null }[];
        const hasExtra = raw.length > PAGE_SIZE;
        const slice = hasExtra ? raw.slice(0, PAGE_SIZE) : raw;
        const companiesList = normalizeCompanyRows(slice);

        setCompanies(companiesList);
        setHasMore(hasExtra);
      } catch (err) {
        console.error("Error fetching companies:", err);
        if (gen === fetchGenRef.current) {
          setCompanies([]);
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
    const offset = companies.length;

    loadingMoreInFlightRef.current = true;
    setLoadingMore(true);
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("companies")
        .select("id, name, logo_url")
        .order("name", { ascending: true })
        .range(offset, offset + PAGE_SIZE);

      if (debouncedSearch) {
        query = query.ilike("name", `%${debouncedSearch}%`);
      }

      const { data, error } = await query;

      if (listGen !== fetchGenRef.current) return;

      if (error) {
        console.error("Error loading more companies:", error);
        setHasMore(false);
        return;
      }

      const raw = (data || []) as { id: string; name: string | null; logo_url: string | null }[];
      const hasExtra = raw.length > PAGE_SIZE;
      const slice = hasExtra ? raw.slice(0, PAGE_SIZE) : raw;
      const batch = normalizeCompanyRows(slice);

      if (batch.length === 0) {
        setHasMore(false);
        return;
      }

      setCompanies((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        const merged = [...prev];
        for (const c of batch) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            merged.push(c);
          }
        }
        return merged;
      });
      setHasMore(hasExtra);
    } catch (err) {
      console.error("Error loading more companies:", err);
    } finally {
      loadingMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [open, listLoading, hasMore, debouncedSearch, companies.length]);

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
    if (!el || companies.length === 0) return;
    if (el.scrollHeight <= el.clientHeight + 2) {
      void fetchNextPage();
    }
  }, [open, listLoading, hasMore, companies.length, fetchNextPage, showListSkeleton]);

  React.useEffect(() => {
    if (!open) setShowEnrichPanel(false);
  }, [open]);

  React.useEffect(() => {
    const loadSelected = async () => {
      const trimmed = value.trim();
      const isUnset = trimmed === "" || trimmed === "—";
      if (isUnset) {
        setSelectedFromValue(null);
        return;
      }
      const inList = companies.some((c) => c.name === value);
      if (inList) {
        setSelectedFromValue(null);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.from("companies").select("id, name, logo_url").eq("name", value).maybeSingle();
        if (error || !data?.name) {
          setSelectedFromValue(null);
          return;
        }
        setSelectedFromValue({
          id: data.id,
          name: data.name,
          logo_url: data.logo_url ?? null,
        });
      } catch {
        setSelectedFromValue(null);
      }
    };
    loadSelected();
  }, [value, companies]);

  React.useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);

  const selectedCompany = React.useMemo(() => {
    return companies.find((c) => c.name === value) ?? selectedFromValue;
  }, [companies, value, selectedFromValue]);

  /** Puts the current selection at the top when the dropdown opens / list refreshes. */
  const displayCompanies = React.useMemo((): Company[] => {
    const list = [...companies];
    const v = value.trim();

    let merged =
      selectedFromValue && v && v !== "—" && !list.some((c) => c.id === selectedFromValue.id)
        ? [selectedFromValue, ...list]
        : list;

    const hasSelectedIds = selectedIds != null && selectedIds.length > 0;
    if (hasSelectedIds && selectedIds) {
      const idSet = new Set(selectedIds);
      const head = merged.filter((c) => idSet.has(c.id));
      const tail = merged.filter((c) => !idSet.has(c.id));
      return [...head, ...tail];
    }

    if (!v || v === "—") return merged;

    const i = merged.findIndex((c) => c.name === value);
    if (i <= 0) return merged;

    const picked = merged[i]!;
    return [picked, ...merged.slice(0, i), ...merged.slice(i + 1)];
  }, [companies, value, selectedIds, selectedFromValue]);

  React.useEffect(() => {
    if (!open) {
      setSearchTerm("");
    } else {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
    companyId: string
  ) => {
    const target = e.target as HTMLImageElement;
    if (target.src !== FALLBACK_LOGO) {
      target.src = FALLBACK_LOGO;
      setImageErrors((prev) => ({ ...prev, [companyId]: true }));
    }
  };

  const displayLabel =
    value && value.trim() !== "" && value.trim() !== "—" ? value : placeholder;

  const handleSelectCompany = (company: Company) => {
    onChange(company.name, company.id);
    onSelectCompany?.({
      id: company.id,
      name: company.name,
      logo_url: company.logo_url ?? null,
    });
    if (stayOpenOnSelect) {
      setSearchTerm("");
    } else {
      setOpen(false);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent, company: Company) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedIds && onRemoveCompany) {
      onRemoveCompany({ id: company.id, name: company.name });
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
          {selectedCompany && !(value.trim() === "" || value.trim() === "—") ? (
            <Image
              src={
                !imageErrors[selectedCompany.id] && selectedCompany.logo_url
                  ? selectedCompany.logo_url
                  : FALLBACK_LOGO
              }
              alt=""
              width={20}
              height={20}
              className={
                imageErrors[selectedCompany.id] || !selectedCompany.logo_url
                  ? "h-5 w-5 flex-shrink-0 rounded-full border border-neutral-200 object-cover"
                  : "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white object-contain"
              }
              onError={(e) => {
                if (selectedCompany?.id) handleImageError(e, selectedCompany.id);
              }}
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
              <CompanySearchApolloEnrich
                onClose={() => {
                  setShowEnrichPanel(false);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                onSuccess={({ companyName }) => {
                  setListRefreshKey((k) => k + 1);
                  if (companyName?.trim()) setSearchTerm(companyName.trim());
                  else setSearchTerm("");
                  setShowEnrichPanel(false);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
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
                placeholder="Search companies…"
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
            <CompanyListSkeleton />
          ) : companies.length === 0 && !searchTerm.trim() ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-4">
              <p className="text-sm font-light text-gray-500">No company found.</p>
              <Button
                variant="outline"
                size="sm"
                className="font-light"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  router.push("/agents/create-companies");
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Company
              </Button>
            </div>
          ) : companies.length === 0 ? (
            <div className="px-4 py-2 text-sm font-light text-gray-500">No companies found</div>
          ) : (
            <>
              {displayCompanies.map((company) => {
                const isSelected = selectedIds
                  ? selectedIds.includes(company.id)
                  : value === company.name;
                return (
                  <div
                    key={company.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectCompany(company);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="relative flex cursor-pointer items-center rounded-none px-4 py-2 pr-16 hover:bg-neutral-100/60 focus:bg-neutral-100/60"
                  >
                    <div className="flex min-w-0 w-full items-center space-x-3">
                      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
                        {company.logo_url ? (
                          <Image
                            src={
                              !imageErrors[company.id] && company.logo_url ? company.logo_url : FALLBACK_LOGO
                            }
                            alt=""
                            fill
                            className="object-cover"
                            sizes="24px"
                            onError={(e) => handleImageError(e, company.id)}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-neutral-100">
                            <span className="text-xs font-light text-neutral-600">
                              {company.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-light">{company.name}</span>
                      </div>
                    </div>
                    {isSelected && (!selectedIds || onRemoveCompany) ? (
                      <button
                        type="button"
                        className="absolute right-5 top-1/2 z-10 -translate-y-1/2 text-[10px] font-light lowercase leading-none tracking-wide text-[var(--kenoo-sky)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kenoo-sky)] focus-visible:ring-offset-1"
                        onClick={(e) => handleRemoveClick(e, company)}
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
