"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { cn } from "@/lib/utils";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { formatDealTypeLabel } from "@/components/ui/searches/deals-type-search";
import { wallsToast } from "@/components/ui/walls-toast";
import { Deal, Filters } from "../types";
import { buildDealsQuery, mapRawDealsToDeals, DealsSortState } from "../deals-data";

const FALLBACK_IMAGE_URL = FALLBACK_ICON_URL;
const CARD_GLASS_CLASS = "bg-white/90 backdrop-blur-md";
const CARD_HOVER_OVERLAY_CLASS = "bg-neutral-100";
/** Kanban shows the full matching set (no pagination); this is a safety cap, not a page size. */
const KANBAN_FETCH_LIMIT = 1000;

interface DealStage {
  id: string;
  name: string;
  is_won: boolean;
  is_lost: boolean;
  order_index: number;
}

interface DealsKanbanProps {
  filters: Filters;
  debouncedSearchTerm: string;
  currentUserId: string | null;
  refreshTrigger: number;
  onDealClick: (dealId: string, e: React.MouseEvent) => void;
}

function stageAccent(stage: DealStage): string {
  if (stage.is_won) return "rgb(16 185 129)";
  if (stage.is_lost) return "rgb(239 68 68)";
  return "var(--kenoo-sky)";
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function dealTimestamp(deal: Deal): number {
  if (!deal.createdAt) return 0;
  if (deal.createdAt instanceof Date) return deal.createdAt.getTime();
  if (typeof deal.createdAt === "string" || typeof deal.createdAt === "number") {
    const t = new Date(deal.createdAt).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/* ─── Deal card (draggable via hover grip) ───────────────────────────────── */
function DealCard({
  deal,
  onDealClick,
  isDragOverlay = false,
}: {
  deal: Deal;
  onDealClick: (dealId: string, e: React.MouseEvent) => void;
  isDragOverlay?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style =
    !isDragOverlay && transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const avatarList = deal.talent && deal.talent.length > 0 ? deal.talent : deal.contacts;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={cn(
        "rounded-2xl px-4 py-3.5 flex flex-col gap-2.5 group cursor-pointer select-none relative overflow-hidden flex-shrink-0",
        CARD_GLASS_CLASS,
        "shadow-[0_3px_12px_rgba(15,23,42,0.07)]",
        !isDragOverlay && isHovered && "shadow-[0_10px_24px_rgba(15,23,42,0.11)]",
        isDragOverlay && "rotate-[1deg] scale-[1.02] ring-2 ring-white/40",
        !isDragOverlay && isDragging && "opacity-35",
        !isDragOverlay && "transition-[box-shadow,background-color] duration-200"
      )}
      onMouseEnter={() => !isDragOverlay && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (isDragOverlay || isDragging) return;
        onDealClick(deal.id, e);
      }}
    >
      {!isDragOverlay && (
        <motion.div
          className={cn("absolute inset-0 rounded-2xl pointer-events-none", CARD_HOVER_OVERLAY_CLASS)}
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          aria-hidden
        />
      )}

      <div className="relative z-10 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Image
            src={deal.companyLogo || FALLBACK_IMAGE_URL}
            alt={deal.company || ""}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full object-cover bg-neutral-100 flex-shrink-0"
            unoptimized={!deal.companyLogo}
          />
          <span className="text-xs font-light text-neutral-400 truncate">
            {deal.company || "No company"}
          </span>
        </div>

        <div className="h-px bg-neutral-200/70" />

        <div className="flex items-start min-w-0">
          {!isDragOverlay && (
            <motion.div
              className="mt-0.5 flex-shrink-0 overflow-hidden"
              animate={{
                width: isHovered ? 18 : 0,
                marginRight: isHovered ? 8 : 0,
                opacity: isHovered ? 1 : 0,
              }}
              initial={false}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              style={{ pointerEvents: isHovered ? "auto" : "none" }}
            >
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4 text-neutral-300" />
              </div>
            </motion.div>
          )}

          <p className="text-sm font-light text-neutral-700 leading-snug line-clamp-2 flex-1 min-w-0">
            {deal.dealName}
          </p>
        </div>

        {deal.pipeline && (
          <span className="text-[10px] font-light uppercase tracking-wider text-neutral-400">
            {formatDealTypeLabel(deal.pipeline)}
          </span>
        )}

        <div className="h-px bg-neutral-200/70" />

        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-sm font-light text-neutral-700 truncate">
            {deal.amountDisplay ?? formatAmount(deal.amount)}
          </span>
          {avatarList && avatarList.length > 0 && (
            <div className="flex items-center -space-x-1.5 flex-shrink-0">
              {avatarList.slice(0, 3).map((person) => (
                <Image
                  key={person.id}
                  src={person.avatar_url || FALLBACK_IMAGE_URL}
                  alt={person.name}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full object-cover ring-2 ring-white"
                  unoptimized={!person.avatar_url}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Kanban column (droppable) ──────────────────────────────────────────── */
function DealsKanbanColumn({
  stage,
  deals,
  onDealClick,
}: {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (dealId: string, e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalValue = deals.reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <div className="flex flex-col min-w-[300px] max-w-[340px] flex-shrink-0 h-full min-h-0">
      <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: stageAccent(stage) }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 truncate">
            {stage.name}
          </span>
          <span className="text-xs text-neutral-400 font-light tabular-nums flex-shrink-0">
            {deals.length}
          </span>
        </div>
        {totalValue > 0 && (
          <span className="text-xs text-neutral-400 font-light tabular-nums flex-shrink-0">
            {formatAmount(totalValue)}
          </span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-0 rounded-2xl p-3 flex flex-col gap-2.5 overflow-y-auto transition-colors",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          isOver && "ring-2 ring-offset-1"
        )}
        style={isOver ? { outline: `2px solid ${stageAccent(stage)}`, outlineOffset: 2 } : undefined}
      >
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onDealClick={onDealClick} />
        ))}
        {deals.length === 0 && (
          <div className="flex flex-1 min-h-[120px] items-center justify-center">
            <span className="text-xs font-light text-neutral-300">No deals</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main kanban view ───────────────────────────────────────────────────── */
export function DealsKanban({
  filters,
  debouncedSearchTerm,
  currentUserId,
  refreshTrigger,
  onDealClick,
}: DealsKanbanProps) {
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data: stageRows, error: stagesError } = await supabase
        .from("deal_stages")
        .select("id, name, slug, is_won, is_lost, order_index, probability")
        .order("order_index", { ascending: true });
      if (stagesError) throw stagesError;

      const loadedStages: DealStage[] = (stageRows || []).map((s: any) => ({
        id: s.id,
        name: s.name || "",
        is_won: s.is_won || false,
        is_lost: s.is_lost || false,
        order_index: s.order_index ?? 999,
      }));
      setStages(loadedStages);

      const sort: DealsSortState = {
        sortDirection: "desc",
        isSortingByRecency: true,
        isSortingByName: false,
        isSortingByStage: false,
      };
      const query = buildDealsQuery(supabase, {
        filters,
        currentUserId,
        debouncedSearchTerm,
        sort,
        withCount: false,
        forKanban: true,
      });
      const { data: dealsDataRaw, error } = await query.limit(KANBAN_FETCH_LIMIT);
      if (error) throw error;

      let dealsData = await mapRawDealsToDeals(supabase, dealsDataRaw);

      const useAmountFilter = Boolean(filters.amountRange && filters.amountRange !== "10000+");
      if (useAmountFilter) {
        const [min, max] = filters.amountRange.split("-").map(Number);
        if (!isNaN(min) && !isNaN(max)) {
          dealsData = dealsData.filter((d) => d.amount >= min && d.amount <= max);
        }
      }

      setDeals(dealsData);
    } catch (error) {
      console.error("Error loading deals kanban:", error);
      wallsToast.error("Error loading deals", error instanceof Error ? error.message : "Failed to load deals.");
      setDeals([]);
      setStages([]);
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearchTerm, currentUserId]);

  useEffect(() => {
    const fetchKey = [
      filters.owner,
      filters.amountRange,
      debouncedSearchTerm,
      currentUserId,
      refreshTrigger,
    ].join("|");
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    loadData();
  }, [
    filters.owner,
    filters.amountRange,
    debouncedSearchTerm,
    currentUserId,
    refreshTrigger,
    loadData,
  ]);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const d of deals) {
      const key = d.dealStageId || "unassigned";
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    }
    map.forEach((list) => list.sort((a, b) => dealTimestamp(b) - dealTimestamp(a)));
    return map;
  }, [deals]);

  const activeDeal = activeDealId ? deals.find((d) => d.id === activeDealId) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDealId(null);
    if (!over) return;

    const dealId = active.id as string;
    const targetStageId = over.id as string;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.dealStageId === targetStageId) return;
    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    const previousStageId = deal.dealStageId;
    const previousStageName = deal.stage;
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, dealStageId: targetStageId, stage: targetStage.name } : d
      )
    );

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("deals")
        .update({ deal_stage_id: targetStageId })
        .eq("id", dealId);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating deal stage:", error);
      wallsToast.error("Error", "Failed to move deal to new stage.");
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId ? { ...d, dealStageId: previousStageId, stage: previousStageName } : d
        )
      );
    }
  };

  return (
    <div className="flex-1 min-h-0 pl-8 pr-4 overflow-x-auto overflow-y-hidden overscroll-contain flex flex-col">
      {loading ? (
        <div className="flex flex-1 min-h-0 gap-6 pb-0 min-w-max">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="min-w-[300px] rounded-2xl border border-neutral-200/50 h-full animate-pulse"
            />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground font-light">No deal stages configured.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 min-h-0 gap-6 pb-0 min-w-max">
            {stages.map((stage) => (
              <DealsKanbanColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) || []}
                onDealClick={onDealClick}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal && (
              <div style={{ width: 272 }}>
                <DealCard deal={activeDeal} isDragOverlay onDealClick={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
