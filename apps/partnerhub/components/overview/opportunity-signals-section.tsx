"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Search,
} from "lucide-react";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { cn } from "@/lib/utils";

export interface OpportunitySignal {
  id: string;
  created_at: string;
  published_at: string | null;
  signal_type: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string;
  image_url: string | null;
  companies: JsonEntity[];
  creators: JsonEntity[];
  tags: string[];
  confidence_score: number | null;
  opportunity_score: number | null;
}

type JsonEntity = string | { name?: string; id?: string; logo_url?: string };

function parseJsonArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function signalMatchesSearch(signal: OpportunitySignal, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (signal.title.toLowerCase().includes(q)) return true;
  if (signal.summary?.toLowerCase().includes(q)) return true;
  if (signal.signal_type.toLowerCase().includes(q)) return true;
  if (signal.source_name?.toLowerCase().includes(q)) return true;
  if (signal.tags.some((tag) => tag.toLowerCase().includes(q))) return true;

  return false;
}

type SlideDirection = "left" | "right";

const AUTO_SCROLL_INTERVAL_MS = 8000;
const TRANSITION_EASE = [0.22, 1, 0.36, 1] as const;

const cardVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0, pointerEvents: "none" as const },
};

function SignalSlide({
  signal,
  direction,
}: {
  signal: OpportunitySignal;
  direction: SlideDirection;
}) {
  const timeLabel = formatRelativeTime(signal.published_at || signal.created_at);
  const contentOffset = direction === "left" ? 18 : -18;

  return (
    <motion.a
      href={signal.source_url}
      target="_blank"
      rel="noopener noreferrer"
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.75, ease: TRANSITION_EASE }}
      className="absolute inset-0 block overflow-hidden rounded-3xl bg-neutral-900"
    >
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.2, ease: TRANSITION_EASE }}
      >
        {signal.image_url ? (
          <img
            src={signal.image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/25" />
      </motion.div>

      <motion.div
        className="relative z-10 flex h-full min-h-[360px] md:min-h-[400px] flex-col justify-between p-6 md:p-8"
        initial={{ opacity: 0, y: contentOffset }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: TRANSITION_EASE, delay: 0.1 }}
      >
        {timeLabel && (
          <span className="self-end text-[10px] font-medium uppercase tracking-wider text-white/70">
            {timeLabel}
          </span>
        )}

        <div className="space-y-3">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-black leading-[1.1] tracking-tight text-white line-clamp-3">
            {signal.title}
          </h3>
          {signal.summary && (
            <p className="w-full text-xs md:text-sm !font-light leading-relaxed text-white/75 line-clamp-4">
              {signal.summary}
            </p>
          )}
        </div>
      </motion.div>
    </motion.a>
  );
}

const UPCOMING_THUMBNAIL_COUNT = 8;

function UpcomingThumbnails({
  signals,
  onSelect,
}: {
  signals: OpportunitySignal[];
  onSelect: (signalId: string) => void;
}) {
  if (signals.length === 0) return null;

  return (
    <div className="hidden md:grid h-[400px] min-h-[360px] w-[200px] shrink-0 grid-cols-2 grid-rows-4 gap-2">
      {signals.map((signal) => (
        <button
          key={signal.id}
          type="button"
          onClick={() => onSelect(signal.id)}
          className="group relative min-h-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 transition-colors hover:border-neutral-300"
          aria-label={signal.title}
        >
          {signal.image_url ? (
            <img
              src={signal.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300">
              <Newspaper className="h-4 w-4 text-neutral-400" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

export function OpportunitySignalsSection() {
  const { user } = useAuth();
  const [signals, setSignals] = useState<OpportunitySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>("right");
  const autoScrollPauseRef = useRef({ hover: false, search: false });

  const isAutoScrollPaused = useCallback(
    () => autoScrollPauseRef.current.hover || autoScrollPauseRef.current.search,
    []
  );

  const setArticleHovered = useCallback((hovered: boolean) => {
    autoScrollPauseRef.current.hover = hovered;
  }, []);

  const setSearchFocused = useCallback((focused: boolean) => {
    autoScrollPauseRef.current.search = focused;
  }, []);

  const fetchSignals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("opportunity_signals")
        .select(
          "id, created_at, published_at, signal_type, title, summary, source_name, source_url, image_url, companies, creators, tags, confidence_score, opportunity_score"
        )
        .order("opportunity_score", { ascending: false, nullsFirst: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(48);

      if (error) throw error;

      setSignals(
        (data || []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          created_at: row.created_at as string,
          published_at: (row.published_at as string | null) ?? null,
          signal_type: row.signal_type as string,
          title: row.title as string,
          summary: (row.summary as string | null) ?? null,
          source_name: (row.source_name as string | null) ?? null,
          source_url: row.source_url as string,
          image_url: (row.image_url as string | null) ?? null,
          companies: parseJsonArray<JsonEntity>(row.companies),
          creators: parseJsonArray<JsonEntity>(row.creators),
          tags: parseJsonArray<string>(row.tags),
          confidence_score: (row.confidence_score as number | null) ?? null,
          opportunity_score: (row.opportunity_score as number | null) ?? null,
        }))
      );
    } catch (err) {
      console.error("Opportunity signals fetch error:", err);
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchSignals();
  }, [user, fetchSignals]);

  const filteredSignals = useMemo(
    () => signals.filter((s) => signalMatchesSearch(s, search)),
    [signals, search]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filteredSignals.length - 1)));
  }, [filteredSignals.length]);

  const activeSignal = filteredSignals[activeIndex] ?? null;
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < filteredSignals.length - 1;

  const goPrev = () => {
    setSlideDirection("right");
    setActiveIndex((i) => Math.max(0, i - 1));
  };

  const goNext = () => {
    setSlideDirection("left");
    setActiveIndex((i) => Math.min(filteredSignals.length - 1, i + 1));
  };

  const upcomingSignals = useMemo(() => {
    const count = filteredSignals.length;
    if (count <= 1) return [];

    const take = Math.min(UPCOMING_THUMBNAIL_COUNT, count - 1);
    return Array.from(
      { length: take },
      (_, i) => filteredSignals[(activeIndex + 1 + i) % count]
    );
  }, [filteredSignals, activeIndex]);

  const goToSignal = (signalId: string) => {
    const index = filteredSignals.findIndex((s) => s.id === signalId);
    if (index === -1) return;

    setSlideDirection("left");
    setActiveIndex(index);
  };

  useEffect(() => {
    if (filteredSignals.length <= 1) return;

    const timer = setInterval(() => {
      if (isAutoScrollPaused()) return;
      setSlideDirection("left");
      setActiveIndex((i) => (i + 1) % filteredSignals.length);
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [filteredSignals.length, search, isAutoScrollPaused]);

  if (loading) {
    return (
      <div className="pt-6 pb-2 mb-8 w-full pr-2">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
          News
        </p>
        <div className="flex gap-3 md:gap-4">
          <div className="h-[400px] flex-1 rounded-3xl bg-neutral-100 animate-pulse" />
          <div className="hidden md:grid h-[400px] w-[200px] shrink-0 grid-cols-2 grid-rows-4 gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="pt-6 pb-2 mb-8 w-full pr-2">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
          News
        </p>
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 text-center">
          <Newspaper className="mb-3 h-6 w-6 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-600">No signals yet</p>
          <p className="mt-1 max-w-sm text-xs font-light text-neutral-400">
            Partnership and brand opportunities will appear here as they&apos;re detected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 pb-2 mb-8 w-full pr-2">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest shrink-0">
          News
        </p>

        <div className="flex items-center gap-2 w-full sm:max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by topic, brand, creator…"
              className={cn(
                "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                search ? "border-b-[var(--walls-sky)]" : "border-neutral-200",
                "focus:border-b-[var(--walls-sky)]"
              )}
            />
          </div>

          {filteredSignals.length > 1 && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={goPrev}
                disabled={!canGoPrev}
                className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label="Previous signal"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-light text-neutral-400 tabular-nums min-w-[3rem] text-center">
                {activeIndex + 1} / {filteredSignals.length}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label="Next signal"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {activeSignal ? (
        <div
          className="flex gap-3 md:gap-4"
          onMouseEnter={() => setArticleHovered(true)}
          onMouseLeave={() => setArticleHovered(false)}
        >
          <div className="relative min-h-[360px] md:min-h-[400px] flex-1 min-w-0 overflow-hidden rounded-3xl border border-neutral-200">
            <AnimatePresence initial={false}>
              <SignalSlide
                key={activeSignal.id}
                signal={activeSignal}
                direction={slideDirection}
              />
            </AnimatePresence>
          </div>
          <UpcomingThumbnails
            signals={upcomingSignals}
            onSelect={goToSignal}
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex min-h-[200px] flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 text-center"
          )}
        >
          <p className="text-sm font-medium text-neutral-600">No matches</p>
          <p className="mt-1 text-xs font-light text-neutral-400">
            Try a different search term.
          </p>
        </div>
      )}
    </div>
  );
}
