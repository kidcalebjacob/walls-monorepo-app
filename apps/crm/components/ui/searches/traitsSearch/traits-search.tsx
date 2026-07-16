"use client";

import * as React from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROW_WIDTHS = ["w-[88%]", "w-[72%]", "w-[80%]", "w-[64%]", "w-[76%]", "w-[70%]"] as const;
const SEARCH_DEBOUNCE_MS = 280;
const PAGE_SIZE = 20;

export interface TraitOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

function TraitListSkeleton() {
  return (
    <>
      {SKELETON_ROW_WIDTHS.map((w, i) => (
        <div key={i} className="flex items-center rounded-none px-4 py-2">
          <div className="min-w-0 flex-1">
            <Skeleton
              className={cn("h-3.5 max-w-full rounded-[3px] bg-neutral-200/65", w)}
              style={{ animationDelay: `${i * 75 + 40}ms` }}
            />
          </div>
        </div>
      ))}
    </>
  );
}

function slugifyTraitKey(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "trait";
}

async function generateTraitDescription(name: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("/api/walli/trait-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, key }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { description?: string };
    const description = data.description?.trim();
    return description || null;
  } catch {
    return null;
  }
}

export interface TraitsSearchProps {
  value: string;
  onChange: (value: string, traitId?: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  triggerIcon?: "none" | "chevron" | "plus";
  onSelectTrait?: (trait: TraitOption) => void;
  excludeIds?: string[];
}

export function TraitsSearch({
  value,
  onChange,
  className,
  disabled,
  placeholder = "Select trait…",
  triggerIcon = "none",
  onSelectTrait,
  excludeIds = [],
}: TraitsSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [traits, setTraits] = React.useState<TraitOption[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedFromValue, setSelectedFromValue] = React.useState<TraitOption | null>(null);
  const [listLoading, setListLoading] = React.useState(false);
  const [showAddPanel, setShowAddPanel] = React.useState(false);
  const [addName, setAddName] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const addNameRef = React.useRef<HTMLInputElement>(null);
  const fetchGenRef = React.useRef(0);

  const excludeSet = React.useMemo(() => new Set(excludeIds), [excludeIds]);
  const debouncePending = open && searchTerm.trim() !== debouncedSearch;
  const showListSkeleton = listLoading || (debouncePending && traits.length === 0);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  React.useEffect(() => {
    if (!open) {
      fetchGenRef.current += 1;
      setTraits([]);
      return;
    }

    const gen = ++fetchGenRef.current;

    const run = async () => {
      setListLoading(true);
      try {
        const supabase = getSupabaseClient();
        let query = supabase
          .from("traits")
          .select("id, key, name, description")
          .order("name", { ascending: true })
          .range(0, PAGE_SIZE);

        if (debouncedSearch) {
          query = query.or(
            `name.ilike.%${debouncedSearch}%,key.ilike.%${debouncedSearch}%`,
          );
        }

        const { data, error } = await query;
        if (gen !== fetchGenRef.current) return;

        if (error) {
          console.error("Error fetching traits:", error);
          setTraits([]);
          return;
        }

        const rows = (data || []) as TraitOption[];
        setTraits(rows.filter((t) => t.name));
      } catch (err) {
        console.error("Error fetching traits:", err);
        if (gen === fetchGenRef.current) setTraits([]);
      } finally {
        if (gen === fetchGenRef.current) setListLoading(false);
      }
    };

    void run();
  }, [open, debouncedSearch, listRefreshKey]);

  React.useEffect(() => {
    if (!open) setShowAddPanel(false);
  }, [open]);

  React.useEffect(() => {
    const loadSelected = async () => {
      if (!value.trim()) {
        setSelectedFromValue(null);
        return;
      }
      if (traits.some((t) => t.id === value)) {
        setSelectedFromValue(null);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("traits")
          .select("id, key, name, description")
          .eq("id", value)
          .maybeSingle();
        if (error || !data?.name) {
          setSelectedFromValue(null);
          return;
        }
        setSelectedFromValue(data as TraitOption);
      } catch {
        setSelectedFromValue(null);
      }
    };
    void loadSelected();
  }, [value, traits]);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearchTerm("");
    }
  }, [open]);

  React.useEffect(() => {
    if (showAddPanel) {
      setAddName(searchTerm.trim());
      setTimeout(() => addNameRef.current?.focus(), 0);
    }
  }, [showAddPanel, searchTerm]);

  const selectedTrait = React.useMemo(() => {
    return traits.find((t) => t.id === value) ?? selectedFromValue;
  }, [traits, value, selectedFromValue]);

  const displayTraits = React.useMemo(() => {
    return traits.filter((t) => !excludeSet.has(t.id));
  }, [traits, excludeSet]);

  const displayLabel = selectedTrait?.name ?? placeholder;

  const handleSelectTrait = (trait: TraitOption) => {
    onChange(trait.id, trait.id);
    onSelectTrait?.(trait);
    setOpen(false);
  };

  const handleCreateTrait = async () => {
    const name = addName.trim();
    if (!name) {
      setAddError("Name is required.");
      return;
    }

    setAdding(true);
    setAddError(null);

    try {
      const supabase = getSupabaseClient();
      let key = slugifyTraitKey(name);
      const description = (await generateTraitDescription(name, key)) ?? null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const tryKey = attempt === 0 ? key : `${key}_${attempt + 1}`;
        const { data, error } = await supabase
          .from("traits")
          .insert({ key: tryKey, name, description })
          .select("id, key, name, description")
          .single();

        if (!error && data) {
          setListRefreshKey((k) => k + 1);
          setShowAddPanel(false);
          setAddName("");
          handleSelectTrait(data as TraitOption);
          return;
        }

        if (error?.code !== "23505") throw error;
        key = tryKey;
      }

      throw new Error("Could not create trait — try a different name.");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create trait.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Select
      value=""
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setSearchTerm("");
          setListLoading(false);
          setShowAddPanel(false);
          setAddError(null);
        } else {
          setListLoading(true);
        }
      }}
      onValueChange={() => {}}
    >
      <SelectTrigger
        disabled={disabled}
        className={cn(
          "group relative flex h-auto min-h-0 w-full max-w-full flex-1 cursor-pointer items-center justify-between border-0 bg-transparent p-0 shadow-none disabled:cursor-not-allowed [&>:last-child]:hidden",
          "hover:bg-transparent focus:ring-0 focus:ring-offset-0 focus-visible:outline-none",
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate text-sm font-light",
            selectedTrait ? "text-neutral-900" : "text-neutral-400",
          )}
        >
          {displayLabel}
        </span>
        {triggerIcon === "chevron" ? (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        ) : triggerIcon === "plus" ? (
          <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        ) : null}
      </SelectTrigger>

      <SelectContent
        position="popper"
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className={cn(
          "!z-[9999] flex max-h-[min(420px,var(--radix-select-content-available-height))] flex-col overflow-hidden rounded-lg bg-white/80 p-0 shadow-2xl backdrop-blur-xl",
          "[&>div]:!p-0",
          "max-w-[calc(100vw-2rem)] w-[max(var(--radix-select-trigger-width),min(21rem,calc(100vw-2rem)))]",
        )}
      >
        <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
          {showAddPanel ? (
            <div
              className="space-y-2"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                ref={addNameRef}
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Trait name"
                disabled={adding}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleCreateTrait();
                  }
                }}
                className="w-full rounded-none border-0 border-b border-neutral-200 bg-transparent py-2 text-sm font-light placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none"
              />
              {addError && <p className="text-xs font-light text-red-500">{addError}</p>}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  className="text-[10px] font-light lowercase tracking-wide text-neutral-400 hover:text-neutral-600"
                  disabled={adding}
                  onClick={() => {
                    setShowAddPanel(false);
                    setAddError(null);
                  }}
                >
                  cancel
                </button>
                <button
                  type="button"
                  className="text-[10px] font-light lowercase tracking-wide text-[var(--kenoo-sky)] hover:underline disabled:opacity-50"
                  disabled={adding}
                  onClick={() => void handleCreateTrait()}
                >
                  {adding ? "generating…" : "save"}
                </button>
              </div>
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
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search traits…"
                className={cn(
                  "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-16 text-sm font-light transition-colors placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none",
                  searchTerm.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                )}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer px-1 text-[10px] font-light lowercase leading-none tracking-wide text-neutral-400 hover:text-neutral-600 focus:outline-none"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddPanel(true);
                }}
              >
                + add
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-white/80 backdrop-blur-xl" onWheel={(e) => e.stopPropagation()}>
          {showListSkeleton ? (
            <TraitListSkeleton />
          ) : displayTraits.length === 0 ? (
            <div className="px-4 py-3 text-sm font-light text-neutral-500">
              {searchTerm.trim() ? "No traits found" : "No traits yet"}
            </div>
          ) : (
            displayTraits.map((trait) => (
              <div
                key={trait.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectTrait(trait);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="cursor-pointer rounded-none px-4 py-2 hover:bg-neutral-100/60"
              >
                <span className="block truncate text-sm font-light text-neutral-900">{trait.name}</span>
                {trait.description ? (
                  <span className="mt-0.5 block truncate text-xs font-light text-neutral-400">
                    {trait.description}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
