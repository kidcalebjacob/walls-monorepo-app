"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { Loader2, Play, Clock, Plus, ChevronDown, MoreVertical } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SequenceSwitch } from "@/components/agentCRM/agentSequences/ui/sequence-switch";
import {
  ManualTimeEntryDialog,
  type TimeEntry,
} from "@/components/agentCRM/agentDeals/custom-ui/manual-time-entry-dialog";

interface TimeEntriesProps {
  dealId: string;
}

const STORAGE_KEY_PREFIX = "dealTimer_";
const CURRENCY_OPTIONS = ["USD", "AUD", "GBP", "CAD", "EUR"];

function isMissingCurrencyColumnError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return msg.includes("currency") && (msg.includes("column") || msg.includes("schema cache"));
}

function getCurrencySymbol(currency: string): string {
  const cur = String(currency || "USD").toUpperCase();
  if (cur === "USD" || cur === "AUD" || cur === "CAD") return "$";
  try {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
    return formatted.replace(/[\d,\s.]/g, "").trim() || "$";
  } catch {
    return "$";
  }
}

function normalizeTimeEntryCurrency<T extends Record<string, any>>(entry: T): T {
  const mappedCurrency =
    (entry.currency as string | undefined) ??
    (entry.billable_currency as string | undefined) ??
    "USD";
  return { ...entry, currency: String(mappedCurrency).toUpperCase() };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getDurationParts(seconds: number): { hours: string; minutes: string; seconds: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return {
    hours: h.toString().padStart(2, "0"),
    minutes: m.toString().padStart(2, "0"),
    seconds: s.toString().padStart(2, "0"),
  };
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function totalBillableSeconds(entries: TimeEntry[]): number {
  return entries
    .filter((e) => e.is_billable && e.duration_seconds != null)
    .reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);
}

function totalBillableCostCents(entries: TimeEntry[]): Record<string, number> {
  return entries
    .filter((e) => e.is_billable && e.duration_seconds != null && typeof e.hourly_rate_cents === "number")
    .reduce((sum, e) => {
      const seconds = e.duration_seconds ?? 0;
      const hourlyRateCents = e.hourly_rate_cents as number;
      const currency = (e.currency || "USD").toUpperCase();
      if (!Number.isFinite(seconds) || !Number.isFinite(hourlyRateCents)) return sum;
      sum[currency] = (sum[currency] ?? 0) + (seconds / 3600) * hourlyRateCents;
      return sum;
    }, {} as Record<string, number>);
}

type TimePeriod = "today" | "week" | "month" | "lastMonth" | "all";

const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  lastMonth: "Last month",
  all: "All time",
};

function FlipDigit({
  value,
  isRunning,
}: {
  value: string;
  isRunning: boolean;
}) {
  return (
    <div
      className={cn(
        "relative w-12 h-16 md:w-16 md:h-20 overflow-hidden rounded-xl border flex items-center justify-center",
        "font-mono text-3xl md:text-5xl font-bold tabular-nums",
        isRunning
          ? "bg-gray-50/85 text-neutral-900 border-[var(--kenoo-sky)]/45 shadow-[inset_0_4px_8px_rgba(0,0,0,0.14),0_0_0_1px_rgba(82,175,236,0.18)]"
          : "bg-gray-50/70 text-neutral-500 border-neutral-200/80 shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)]"
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 28, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function filterEntriesByPeriod(entries: TimeEntry[], period: TimePeriod): TimeEntry[] {
  if (period === "all") return entries;
  const now = new Date();
  return entries.filter((e) => {
    const start = new Date(e.start_time);
    if (period === "today") {
      return (
        start.getFullYear() === now.getFullYear() &&
        start.getMonth() === now.getMonth() &&
        start.getDate() === now.getDate()
      );
    }
    if (period === "week") {
      const day = now.getDay(); // 0 = Sunday
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - day);
      weekStart.setHours(0, 0, 0, 0);
      return start >= weekStart;
    }
    if (period === "month") {
      return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
    }
    if (period === "lastMonth") {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return (
        start.getFullYear() === lastMonthDate.getFullYear() &&
        start.getMonth() === lastMonthDate.getMonth()
      );
    }
    return true;
  });
}

export default function TimeEntries({ dealId }: TimeEntriesProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [description, setDescription] = useState("");
  const [isBillable, setIsBillable] = useState(true);
  const [hourlyRateDollars, setHourlyRateDollars] = useState(""); // store dollars as string for input
  const [currency, setCurrency] = useState("USD");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const timePeriodDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isTimePeriodDropdownOpen, setIsTimePeriodDropdownOpen] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [openEntryMenuId, setOpenEntryMenuId] = useState<string | null>(null);

  const storageKey = user?.id ? `${STORAGE_KEY_PREFIX}${dealId}_${user.id}` : null;

  // Load entries and restore any active timer
  useEffect(() => {
    if (!user?.id) return;

    const fetchEntries = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("time_entries")
        .select("*, currency:billable_currency")
        .eq("deal_id", dealId)
        .order("start_time", { ascending: false });

      setEntries((data as TimeEntry[]) ?? []);
      setIsLoading(false);
    };

    fetchEntries();

    // Restore active timer from localStorage
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const { startTimeStr, description: desc, isBillable: billable, hourlyRateDollars: rate, currency: savedCurrency } =
            JSON.parse(stored);
          const savedStart = new Date(startTimeStr);
          startTimeRef.current = savedStart;
          setIsRunning(true);
          setDescription(desc ?? "");
          setIsBillable(billable ?? true);
          setHourlyRateDollars(rate ?? "");
          setCurrency((savedCurrency || "USD").toUpperCase());
          const secondsElapsed = Math.floor((Date.now() - savedStart.getTime()) / 1000);
          setElapsed(secondsElapsed);
        }
      } catch {
        if (storageKey) localStorage.removeItem(storageKey);
      }
    }
  }, [dealId, user?.id, storageKey]);

  // Tick the running timer
  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTimeRef.current!.getTime()) / 1000);
        setElapsed(seconds);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isTimePeriodDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        timePeriodDropdownRef.current &&
        !timePeriodDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTimePeriodDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTimePeriodDropdownOpen]);

  useEffect(() => {
    if (!openEntryMenuId) return;

    const handleClickOutside = () => {
      setOpenEntryMenuId(null);
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openEntryMenuId]);

  const hourlyRateCents =
    isBillable && hourlyRateDollars.trim() !== ""
      ? Math.round(Number.parseFloat(hourlyRateDollars) * 100)
      : null;

  const handleStart = () => {
    if (!user?.id || !storageKey) return;
    const now = new Date();
    startTimeRef.current = now;
    setIsRunning(true);
    setElapsed(0);
    localStorage.setItem(
      storageKey,
      JSON.stringify({ startTimeStr: now.toISOString(), description, isBillable, hourlyRateDollars, currency })
    );
  };

  const handleStop = async () => {
    if (!user?.id || !startTimeRef.current || !storageKey) return;

    const endTime = new Date();
    const startTime = startTimeRef.current;
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setElapsed(0);
    startTimeRef.current = null;
    localStorage.removeItem(storageKey);

    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      const basePayload = {
        user_id: user.id,
        deal_id: dealId,
        description: description.trim() || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_seconds: durationSeconds,
        is_billable: isBillable,
        hourly_rate_cents: hourlyRateCents != null && Number.isFinite(hourlyRateCents) ? hourlyRateCents : null,
      };

      let { data, error } = await supabase
        .from("time_entries")
        .insert({ ...basePayload, billable_currency: (currency || "USD").toUpperCase() })
        .select()
        .single();

      // Compatibility fallback for DBs that do not yet have billable currency column.
      if (error && isMissingCurrencyColumnError(error)) {
        console.warn("time_entries billable currency column missing; saving entry without currency.");
        const retry = await supabase
          .from("time_entries")
          .insert(basePayload)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("Failed to save time entry:", error);
      } else if (data) {
        const normalized = normalizeTimeEntryCurrency(data as Record<string, any>) as TimeEntry;
        setEntries((prev) => [normalized, ...prev]);
      }
    } finally {
      setIsSaving(false);
      setDescription("");
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setOpenEntryMenuId(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (!error) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
    setDeletingId(null);
  };

  const handleEdit = (entry: TimeEntry) => {
    setOpenEntryMenuId(null);
    setEditingEntry(entry);
    setShowManualForm(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 text-neutral-400 animate-spin" />
      </div>
    );
  }

  const filteredEntries = filterEntriesByPeriod(entries, timePeriod);
  const totalBillable = totalBillableSeconds(filteredEntries);
  const totalAll = filteredEntries.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);
  const elapsedParts = getDurationParts(elapsed);
  const totalBillableCentsByCurrency = totalBillableCostCents(filteredEntries);
  const totalBillableCostLabels = Object.entries(totalBillableCentsByCurrency)
    .filter(([, cents]) => cents > 0)
    .map(([cur, cents]) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur || "USD",
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100)
    );

  return (
    <div className="flex flex-col gap-6">
      {/* Timer card */}
      <div className="rounded-[36px] border border-neutral-200/70 bg-gradient-to-br from-neutral-50 to-white shadow-[0_6px_26px_-16px_rgba(0,0,0,0.25)] overflow-hidden transition-all duration-300 ease-in-out">
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-neutral-200/80">
          {/* Left panel: entry details */}
          <div className="px-5 py-5 md:px-6 md:py-6 flex flex-col gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-2">Entry Details</p>
              <input
                type="text"
                placeholder="What are you working on?"
                value={description}
                disabled={isRunning}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 outline-none border-b border-neutral-200 pb-2 disabled:opacity-60 focus:border-[var(--kenoo-sky)] transition-colors"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 mr-1">
                  <SequenceSwitch checked={isBillable} disabled={isRunning} onCheckedChange={setIsBillable} />
                  <span className={cn("text-xs select-none", isRunning ? "text-neutral-400" : "text-neutral-500")}>
                    {isBillable ? "Billable" : "Non-billable"}
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {isBillable && (
                    <motion.div
                      key="billable-rate-controls"
                      initial={{ opacity: 0, width: 0, x: -8 }}
                      animate={{ opacity: 1, width: "auto", x: 0 }}
                      exit={{ opacity: 0, width: 0, x: -8 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="flex items-center gap-3 overflow-hidden"
                    >
                      <div className="relative w-[180px]">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">
                          {getCurrencySymbol(currency)}
                        </span>
                        <CurrencyInput
                          value={hourlyRateDollars}
                          onChange={(v) => setHourlyRateDollars(v)}
                          placeholder="Hourly rate"
                          disabled={isRunning}
                          showSymbol={false}
                          className={cn(
                            "w-full h-8 pl-4 pr-0 py-1 text-sm font-light placeholder:text-neutral-300 bg-transparent border-0 border-b rounded-none shadow-none",
                            "focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 transition-colors",
                            hourlyRateDollars ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                            "focus:border-b-[var(--kenoo-sky)]"
                          )}
                        />
                      </div>
                      <Select value={currency} onValueChange={setCurrency} disabled={isRunning}>
                        <SelectTrigger className="h-8 w-[88px] rounded-none border-0 bg-transparent px-0 text-xs font-light tracking-wider text-neutral-700 shadow-none focus:ring-0 focus-visible:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-[18px]">
                          {CURRENCY_OPTIONS.map((cur) => (
                            <SelectItem key={cur} value={cur} className="text-xs">
                              {cur}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-auto pt-1" />
          </div>

          {/* Right panel: timer */}
          <div className="px-5 py-5 md:px-6 md:py-6 flex flex-col justify-center">
            <div className="rounded-2xl bg-transparent px-3 md:px-4 py-4">
              <div className="flex items-start justify-center gap-2 md:gap-3">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    {elapsedParts.hours.split("").map((digit, i) => (
                      <FlipDigit key={`h-${i}-${digit}`} value={digit} isRunning={isRunning} />
                    ))}
                  </div>
                  <span className="text-[10px] md:text-xs uppercase tracking-[0.18em] text-neutral-500">Hours</span>
                </div>
                <span className={cn("text-3xl md:text-5xl font-bold px-1 mt-3", isRunning ? "text-[var(--kenoo-sky)]" : "text-neutral-400")}>:</span>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    {elapsedParts.minutes.split("").map((digit, i) => (
                      <FlipDigit key={`m-${i}-${digit}`} value={digit} isRunning={isRunning} />
                    ))}
                  </div>
                  <span className="text-[10px] md:text-xs uppercase tracking-[0.18em] text-neutral-500">Minutes</span>
                </div>
                <span className={cn("text-3xl md:text-5xl font-bold px-1 mt-3", isRunning ? "text-[var(--kenoo-sky)]" : "text-neutral-400")}>:</span>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    {elapsedParts.seconds.split("").map((digit, i) => (
                      <FlipDigit key={`s-${i}-${digit}`} value={digit} isRunning={isRunning} />
                    ))}
                  </div>
                  <span className="text-[10px] md:text-xs uppercase tracking-[0.18em] text-neutral-500">Seconds</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              {!isRunning ? (
                <button
                  type="button"
                  onClick={handleStart}
                  aria-label="Start timer"
                  className="h-16 w-16 md:h-20 md:w-20 rounded-full border border-[rgba(110,173,192,0.5)] bg-gray-50/80 backdrop-blur-sm backdrop-saturate-150 text-neutral-900 flex items-center justify-center transition-all duration-300 ease-in-out shadow-[0_6px_18px_-8px_rgba(0,0,0,0.16),0_0_0_1px_rgba(110,173,192,0.36),0_0_10px_rgba(110,173,192,0.32)] hover:scale-[0.98]"
                >
                  <Play className="h-8 w-8 fill-[var(--kenoo-sky)] stroke-[0] opacity-60" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStop}
                  disabled={isSaving}
                  aria-label="Pause timer"
                  className="h-16 w-16 md:h-20 md:w-20 rounded-full border border-neutral-300/40 bg-kenoo-sky/40 text-neutral-900 flex items-center justify-center transition-all duration-200 shadow-[inset_0_4px_8px_rgba(0,0,0,0.16)] hover:scale-[0.98] disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <span className="inline-flex items-center gap-1.5" aria-hidden>
                      <span className="h-6 w-1.5 rounded-sm bg-white" />
                      <span className="h-6 w-1.5 rounded-sm bg-white" />
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ManualTimeEntryDialog
        open={showManualForm}
        onOpenChange={(open) => {
          setShowManualForm(open);
          if (!open) setEditingEntry(null);
        }}
        dealId={dealId}
        initialEntry={editingEntry}
        onSaved={(entry) =>
          setEntries((prev) =>
            [entry, ...prev.filter((existing) => existing.id !== entry.id)].sort(
              (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
            )
          )
        }
      />

      {/* Controls + summary row */}
      <div className="flex flex-col gap-2 px-1">
        <div className="flex items-center gap-6 pb-2">
          <button
            type="button"
            onClick={() => setShowManualForm(true)}
            className={cn(
              "inline-flex items-center gap-1 min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none",
              "text-xs font-light uppercase tracking-wider text-neutral-700",
              "hover:text-neutral-900 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add manual entry</span>
          </button>

          <span className="text-xs font-light text-neutral-400 select-none" aria-hidden>
            /
          </span>

          {/* Period filter */}
          <div className="relative" ref={timePeriodDropdownRef}>
            <button
              type="button"
              onClick={() => setIsTimePeriodDropdownOpen((open) => !open)}
              className={cn(
                "inline-flex items-center gap-1 min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none",
                "text-xs font-light uppercase tracking-wider text-neutral-700",
                "hover:text-neutral-900 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              )}
            >
              <span>{TIME_PERIOD_LABELS[timePeriod]}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                  isTimePeriodDropdownOpen && "rotate-180"
                )}
                strokeWidth={1.8}
              />
            </button>

            {isTimePeriodDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 min-w-[140px] bg-white border border-neutral-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                {(Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      setTimePeriod(period);
                      setIsTimePeriodDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs transition-colors",
                      timePeriod === period
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-700 hover:bg-neutral-50"
                    )}
                  >
                    {TIME_PERIOD_LABELS[period]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {entries.length > 0 && (
          <div className="pt-2 pb-1 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
            <div className="flex flex-1 flex-col items-center justify-center min-w-0">
              <p className="text-3xl md:text-4xl font-black tabular-nums text-neutral-900 tracking-tight font-mono">
                {formatDuration(totalAll)}
              </p>
              <span className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-xs text-center">
                Total Time
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center min-w-0">
              <p className="text-3xl md:text-4xl font-black text-neutral-900 tracking-tight tabular-nums font-mono text-center">
                {totalBillableCostLabels.length > 0 ? totalBillableCostLabels.join(" + ") : "—"}
              </p>
              <span className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-xs text-center">
                Billable Amount
              </span>
              <span className="font-light text-neutral-400 uppercase tracking-wider text-[10px]">
                {Object.keys(totalBillableCentsByCurrency).length === 1 ? Object.keys(totalBillableCentsByCurrency)[0] : "MULTI"}
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center min-w-0">
              <p className="text-3xl md:text-4xl font-black tabular-nums text-neutral-900 tracking-tight font-mono">
                {formatDuration(totalBillable)}
              </p>
              <span className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-xs text-center">
                Billable Hours
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Entries list */}
      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Clock className="h-10 w-10 text-neutral-300 mb-3" />
          <p className="text-neutral-500 text-sm">
            {entries.length === 0 ? "No time entries yet" : `No time entries for ${TIME_PERIOD_LABELS[timePeriod].toLowerCase()}`}
          </p>
          <p className="text-neutral-400 text-xs mt-1">
            {entries.length === 0
              ? "Start the timer above or add an entry manually"
              : "Try a different time period to view more entries"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200/70 px-2 md:px-3">
          {filteredEntries.map((entry) => {
            const dur = entry.duration_seconds != null ? formatDuration(entry.duration_seconds) : "—";
            return (
              <div
                key={entry.id}
                className="group py-3.5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs uppercase tracking-[0.18em] text-neutral-700 truncate">
                      {entry.description ?? <span className="italic font-normal text-neutral-400">No description</span>}
                    </span>
                    <span className="text-sm text-neutral-400 mt-0.5">
                      {formatDateShort(entry.start_time)} · {formatTimeShort(entry.start_time)}
                      {entry.end_time ? ` – ${formatTimeShort(entry.end_time)}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-7 md:gap-10 flex-shrink-0">
                    {entry.is_billable && (
                      <div className="flex items-center gap-4 md:gap-5">
                        <span className="text-xs text-[var(--kenoo-sky)] uppercase tracking-wide">
                          Billable
                        </span>
                        {typeof entry.hourly_rate_cents === "number" && (
                          <span className="text-sm text-neutral-600 font-mono">
                            {(entry.currency || "USD").toUpperCase()} {(entry.hourly_rate_cents / 100).toFixed(2)}/hr
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 md:gap-2.5">
                      <span className="text-sm text-neutral-600 font-mono">
                        {dur}
                      </span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenEntryMenuId((current) => (current === entry.id ? null : entry.id));
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-neutral-700"
                          aria-label="Open entry actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openEntryMenuId === entry.id && (
                          <div
                            className="absolute right-0 top-full mt-1 min-w-[120px] rounded-xl border border-neutral-200 bg-white shadow-lg z-20 py-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleEdit(entry)}
                              className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId === entry.id}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === entry.id ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Deleting...
                                </span>
                              ) : (
                                "Delete"
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
