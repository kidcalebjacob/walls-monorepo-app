"use client";

import * as React from "react";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { Loader2, Plus, Minus, Search } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { wallsToast } from "@/components/ui/walls-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const FALLBACK_LOGO = FALLBACK_ICON_URL;

interface Deal {
  id: string;
  dealName: string;
  company: string;
  creator: string;
  amount: number;
  dealOwnerId?: string | null;
  nextStep?: string;
  liveDueDate?: string;
  creatorProfilePicture?: string;
  companyLogoUrl?: string;
  companyFallbackLogoUrl?: string;
}

interface DealSearchProps {
  /** Gmail provider_thread_id */
  threadId: string;
  /** Supabase users.id - required for email_thread lookup */
  userId: string;
  /** Currently linked deal_id (deals.id), if any */
  linkedDealId?: string | null;
  /** Callback when deal is linked/unlinked */
  onDealLinked?: (dealId: string | null) => void;
  onClose: () => void;
}

export function DealSearch({
  threadId,
  userId,
  linkedDealId,
  onDealLinked,
  onClose,
}: DealSearchProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(
    linkedDealId ?? null
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedMyDeals, setExpandedMyDeals] = useState(true);
  const [expandedAllDeals, setExpandedAllDeals] = useState(false);

  useEffect(() => {
    setSelectedDealId(linkedDealId ?? null);
  }, [linkedDealId]);

  useEffect(() => {
    const fetchDeals = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data: dealsDataRaw, error } = await supabase
          .from("deals")
          .select(
            `
            id,
            deal_name,
            created_at,
            deal_owner,
            deal_stages!inner ( id, name, order_index, is_won, is_lost ),
            users!deals_deal_owner_fkey ( id, first_name, last_name, avatar_url )
          `
          )
          .eq("deal_stages.is_won", false)
          .eq("deal_stages.is_lost", false)
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) {
          console.error("Error fetching deals:", error);
          wallsToast.error("Failed to load deals");
          setDeals([]);
          return;
        }

        const dealIds = (dealsDataRaw || []).map((d: any) => d.id).filter(Boolean);
        if (dealIds.length === 0) {
          setDeals([]);
          setIsLoading(false);
          return;
        }

        // Fetch deal_companies with companies (client company per deal)
        const { data: dealCompaniesData } = await supabase
          .from("deal_companies")
          .select(
            `
            deal_id,
            company_id,
            role,
            companies (
              id,
              name,
              logo_url
            )
          `
          )
          .in("deal_id", dealIds);

        const companyByDealId = new Map<string, any>();
        const byDeal = new Map<string, any[]>();
        (dealCompaniesData || []).forEach((dc: any) => {
          const company = Array.isArray(dc.companies) ? dc.companies[0] : dc.companies;
          if (company) {
            const list = byDeal.get(dc.deal_id) || [];
            list.push({ ...company, role: dc.role });
            byDeal.set(dc.deal_id, list);
          }
        });
        byDeal.forEach((list, dealId) => {
          const client = list.find((c: any) => c.role === "client");
          companyByDealId.set(dealId, client || list[0]);
        });

        // Fetch deal_deliverables for amount
        const amountByDealId = new Map<string, number>();
        const { data: deliverablesData } = await supabase
          .from("deal_deliverables")
          .select("deal_id, quantity, unit_price_cents, billing_type, recurrence_count")
          .in("deal_id", dealIds);

        (deliverablesData || []).forEach((d: any) => {
          const current = amountByDealId.get(d.deal_id) || 0;
          const q = Number(d.quantity) || 0;
          const c = Number(d.unit_price_cents) || 0;
          let lineTotal = (q * c) / 100;
          const isRecurring = d.billing_type === "recurring";
          const recur = d.recurrence_count != null ? Number(d.recurrence_count) || 0 : 0;
          if (isRecurring && recur > 0) lineTotal *= recur;
          amountByDealId.set(d.deal_id, current + lineTotal);
        });

        // Fetch deal_events for go_live_date (optional)
        const liveDueByDealId = new Map<string, string>();
        const { data: eventsData } = await supabase
          .from("deal_events")
          .select("deal_id, event_type, due_at")
          .in("deal_id", dealIds);
        (eventsData || []).forEach((e: any) => {
          if (e.event_type === "go_live_date" && e.due_at && !liveDueByDealId.has(e.deal_id)) {
            liveDueByDealId.set(e.deal_id, e.due_at);
          }
        });

        const dealsList: Deal[] = (dealsDataRaw || []).map((p: Record<string, unknown>) => {
          const company = companyByDealId.get(p.id as string);
          const owner = Array.isArray(p.users) ? (p.users[0] as any) : (p.users as any);
          const creatorName = owner
            ? `${(owner.first_name as string) || ""} ${(owner.last_name as string) || ""}`.trim()
            : "";

          return {
            id: p.id as string,
            dealName: (p.deal_name as string) || "Unnamed Deal",
            company: (company?.name as string) || "",
            creator: creatorName || "Unknown",
            amount: amountByDealId.get(p.id as string) ?? 0,
            dealOwnerId: p.deal_owner as string | null | undefined,
            liveDueDate: liveDueByDealId.get(p.id as string) || "",
            creatorProfilePicture: owner?.avatar_url as string | undefined,
            companyLogoUrl: company?.logo_url as string | undefined,
            companyFallbackLogoUrl: undefined,
            nextStep: "",
          };
        });

        setDeals(dealsList);
      } catch (err) {
        console.error("Error fetching deals:", err);
        wallsToast.error("Failed to load deals");
        setDeals([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeals();
  }, [userId]);

  const handleDealSelect = async (deal: Deal) => {
    if (!userId || isUpdating) return;
    const isSelecting = selectedDealId !== deal.id;
    const newDealId = isSelecting ? deal.id : null;

    setIsUpdating(true);
    try {
      const supabase = getSupabaseClient();

      const { data: threadRow, error: findError } = await supabase
        .from("email_threads")
        .select("id")
        .eq("user_id", userId)
        .eq("provider_thread_id", threadId)
        .maybeSingle();

      if (findError) {
        wallsToast.error("Failed to find email thread");
        return;
      }
      if (!threadRow) {
        wallsToast.error("Email thread not found");
        return;
      }

      const { error: updateError } = await supabase
        .from("email_threads")
        .update({ deal_id: newDealId })
        .eq("id", threadRow.id);

      if (updateError) {
        wallsToast.error("Failed to link deal to email");
        return;
      }

      setSelectedDealId(newDealId);
      onDealLinked?.(newDealId);
      if (isSelecting) {
        wallsToast.success("Deal linked", deal.dealName);
      } else {
        wallsToast.negative("Deal unlinked", deal.dealName);
      }
    } catch (err) {
      console.error("Error updating deal link:", err);
      wallsToast.error("Failed to update");
    } finally {
      setIsUpdating(false);
    }
  };

  // Split into My Deals (deal_owner === userId) and All Deals
  const { myDeals, allDeals } = React.useMemo(() => {
    const my = deals.filter((d) => d.dealOwnerId === userId);
    const all = deals;
    return { myDeals: my, allDeals: all };
  }, [deals, userId]);

  const filterBySearch = React.useCallback(
    (list: Deal[]) => {
      if (!searchTerm.trim()) return list;
      const q = searchTerm.toLowerCase();
      return list.filter(
        (d) =>
          d.dealName?.toLowerCase().includes(q) ||
          d.company?.toLowerCase().includes(q) ||
          d.creator?.toLowerCase().includes(q)
      );
    },
    [searchTerm]
  );

  const displayMyDeals = filterBySearch(myDeals);
  const displayAllDeals = filterBySearch(allDeals);

  const getCompanyLogoSrc = (deal: Deal) => {
    return (
      deal.companyLogoUrl ||
      deal.companyFallbackLogoUrl ||
      FALLBACK_LOGO
    );
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const renderDealItem = (deal: Deal) => {
    const isSelected = selectedDealId === deal.id;
    const displayName = deal.dealName || deal.company || "Unnamed Deal";
    const logoSrc = getCompanyLogoSrc(deal);

    return (
      <div
        key={deal.id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isUpdating) handleDealSelect(deal);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          "relative flex items-center px-4 py-2 pr-16 cursor-pointer rounded-none hover:bg-neutral-100/60",
          isUpdating && "opacity-60 pointer-events-none"
        )}
      >
        <div className="flex items-center space-x-3 w-full min-w-0">
          <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
            {logoSrc ? (
              <Image
                src={logoSrc}
                alt={`${deal.company || deal.dealName} logo`}
                fill
                className="object-cover"
                sizes="24px"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.dataset.logoFallback === "1") return;
                  target.dataset.logoFallback = "1";
                  target.src = FALLBACK_LOGO;
                }}
              />
            ) : (
              <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                <span className="text-xs font-light text-neutral-600">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="block truncate text-sm font-light">{displayName}</span>
            {(deal.company || deal.creator) && (
              <span className="block truncate text-xs font-light text-neutral-500">
                {[deal.company, deal.creator !== "Unknown" ? deal.creator : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </div>
        </div>
        {isSelected && (
          <button
            type="button"
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-[10px] font-light lowercase leading-none tracking-wide text-[var(--kenoo-sky)] hover:underline focus:outline-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isUpdating) handleDealSelect(deal);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            remove
          </button>
        )}
      </div>
    );
  };

  const sectionHeaderClass =
    "flex items-center w-full px-4 py-2 border-b border-neutral-200/60 cursor-pointer bg-white/80 backdrop-blur-xl hover:bg-neutral-100/60 transition-colors";

  return (
    <div
      className="flex flex-col w-full max-h-[500px] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Search Input - Sticky */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
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
            placeholder="Search deals…"
            className={cn(
              "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-4 text-sm font-light transition-colors placeholder:text-neutral-300 focus:outline-none focus-visible:outline-none",
              searchTerm.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {/* Deal List - Scrollable */}
      <div className="overflow-y-auto flex-1 bg-white/80 backdrop-blur-xl">
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <>
            {/* My Deals Section */}
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExpandedMyDeals(!expandedMyDeals);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={sectionHeaderClass}
              >
                <span className="text-sm font-light text-gray-700">My Deals</span>
                <div className="flex-1" />
                {expandedMyDeals ? (
                  <Minus className="h-4 w-4 text-neutral-600" />
                ) : (
                  <Plus className="h-4 w-4 text-neutral-600" />
                )}
              </button>
              <AnimatePresence>
                {expandedMyDeals && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {displayMyDeals.length === 0 ? (
                      <div className="py-2 px-4 text-sm font-light text-gray-500">
                        No deals found
                      </div>
                    ) : (
                      displayMyDeals.map((deal) => renderDealItem(deal))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* All Deals Section */}
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExpandedAllDeals(!expandedAllDeals);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={sectionHeaderClass}
              >
                <span className="text-sm font-light text-gray-700">All</span>
                <div className="flex-1" />
                {expandedAllDeals ? (
                  <Minus className="h-4 w-4 text-neutral-600" />
                ) : (
                  <Plus className="h-4 w-4 text-neutral-600" />
                )}
              </button>
              <AnimatePresence>
                {expandedAllDeals && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {displayAllDeals.length === 0 ? (
                      <div className="py-2 px-4 text-sm font-light text-gray-500">
                        No deals found
                      </div>
                    ) : (
                      displayAllDeals.map((deal) => renderDealItem(deal))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
