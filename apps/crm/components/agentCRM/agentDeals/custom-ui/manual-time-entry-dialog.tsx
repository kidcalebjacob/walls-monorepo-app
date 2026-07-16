"use client";

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { Loader2, CalendarClock, Save } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SequenceSwitch } from "@/components/agentCRM/agentSequences/ui/sequence-switch";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MiniCalendar } from "@/components/ui/mini-calendar";

export interface TimeEntry {
  id: string;
  user_id: string;
  deal_id: string | null;
  description: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  is_billable: boolean;
  hourly_rate_cents: number | null;
  currency?: string | null;
  created_at: string;
}

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

type ManualMode = "range" | "duration";

function todayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function currentTimeString(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

export interface ManualTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  onSaved: (entry: TimeEntry) => void;
  initialEntry?: TimeEntry | null;
}

export function ManualTimeEntryDialog({
  open,
  onOpenChange,
  dealId,
  onSaved,
  initialEntry = null,
}: ManualTimeEntryDialogProps) {
  const { user } = useAuth();
  const [manualMode, setManualMode] = useState<ManualMode>("range");
  const [manualDate, setManualDate] = useState(todayDateString);
  const [manualStartTime, setManualStartTime] = useState(currentTimeString);
  const [manualEndTime, setManualEndTime] = useState("");
  const [manualDurHours, setManualDurHours] = useState("");
  const [manualDurMins, setManualDurMins] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualIsBillable, setManualIsBillable] = useState(true);
  const [manualHourlyRate, setManualHourlyRate] = useState("");
  const [manualCurrency, setManualCurrency] = useState("USD");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const modeTabsRef = useRef<HTMLDivElement>(null);
  const rangeTabRef = useRef<HTMLButtonElement>(null);
  const durationTabRef = useRef<HTMLButtonElement>(null);
  const [modeSlider, setModeSlider] = useState({ left: 0, width: 0 });

  const updateModeSlider = useCallback(() => {
    const container = modeTabsRef.current;
    const active =
      manualMode === "range" ? rangeTabRef.current : durationTabRef.current;
    if (!container || !active) return;
    const c = container.getBoundingClientRect();
    const b = active.getBoundingClientRect();
    setModeSlider({ left: b.left - c.left, width: b.width });
  }, [manualMode]);

  useLayoutEffect(() => {
    if (!open) return;
    updateModeSlider();
    const id = requestAnimationFrame(() => updateModeSlider());
    return () => cancelAnimationFrame(id);
  }, [open, manualMode, updateModeSlider]);

  useEffect(() => {
    if (!open) return;
    const el = modeTabsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateModeSlider());
    ro.observe(el);
    window.addEventListener("resize", updateModeSlider);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateModeSlider);
    };
  }, [open, updateModeSlider]);

  useEffect(() => {
    if (!open) {
      setDatePopoverOpen(false);
      return;
    }
    if (initialEntry) {
      const startDate = new Date(initialEntry.start_time);
      const endDate = initialEntry.end_time ? new Date(initialEntry.end_time) : null;
      const duration = Math.max(0, initialEntry.duration_seconds ?? 0);
      const hours = Math.floor(duration / 3600);
      const mins = Math.floor((duration % 3600) / 60);
      setManualMode("range");
      setManualDate(format(startDate, "yyyy-MM-dd"));
      setManualStartTime(format(startDate, "HH:mm"));
      setManualEndTime(endDate ? format(endDate, "HH:mm") : "");
      setManualDurHours(String(hours));
      setManualDurMins(String(mins));
      setManualDescription(initialEntry.description ?? "");
      setManualIsBillable(initialEntry.is_billable ?? true);
      setManualHourlyRate(
        typeof initialEntry.hourly_rate_cents === "number"
          ? (initialEntry.hourly_rate_cents / 100).toFixed(2)
          : ""
      );
      setManualCurrency(String(initialEntry.currency || "USD").toUpperCase());
    } else {
      setManualMode("range");
      setManualDate(todayDateString());
      setManualStartTime(currentTimeString());
      setManualEndTime("");
      setManualDurHours("");
      setManualDurMins("");
      setManualDescription("");
      setManualIsBillable(true);
      setManualHourlyRate("");
      setManualCurrency("USD");
    }
    setManualError(null);
  }, [open, initialEntry]);

  const handleSubmitManual = async () => {
    if (!user?.id) return;
    setManualError(null);

    if (!manualDate || !manualStartTime) {
      setManualError("Date and start time are required.");
      return;
    }

    const startDateTime = new Date(`${manualDate}T${manualStartTime}`);
    if (Number.isNaN(startDateTime.getTime())) {
      setManualError("Invalid start date or time.");
      return;
    }

    let endDateTime: Date | null = null;
    let durationSeconds: number | null = null;

    if (manualMode === "range") {
      if (!manualEndTime) {
        setManualError("End time is required for the time range mode.");
        return;
      }
      endDateTime = new Date(`${manualDate}T${manualEndTime}`);
      if (Number.isNaN(endDateTime.getTime())) {
        setManualError("Invalid end time.");
        return;
      }
      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
      durationSeconds = Math.floor((endDateTime.getTime() - startDateTime.getTime()) / 1000);
      if (durationSeconds <= 0) {
        setManualError("End time must be after start time.");
        return;
      }
    } else {
      const hours = Number.parseInt(manualDurHours || "0", 10);
      const mins = Number.parseInt(manualDurMins || "0", 10);
      if (Number.isNaN(hours) || Number.isNaN(mins) || (hours === 0 && mins === 0)) {
        setManualError("Please enter a duration greater than zero.");
        return;
      }
      durationSeconds = hours * 3600 + mins * 60;
      endDateTime = new Date(startDateTime.getTime() + durationSeconds * 1000);
    }

    const manualHourlyRateCents =
      manualIsBillable && manualHourlyRate.trim() !== ""
        ? Math.round(Number.parseFloat(manualHourlyRate) * 100)
        : null;

    setIsSubmittingManual(true);
    try {
      const supabase = getSupabaseClient();
      const basePayload = {
        user_id: user.id,
        deal_id: dealId,
        description: manualDescription.trim() || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime!.toISOString(),
        duration_seconds: durationSeconds,
        is_billable: manualIsBillable,
        hourly_rate_cents:
          manualHourlyRateCents != null && Number.isFinite(manualHourlyRateCents)
            ? manualHourlyRateCents
            : null,
      };

      const payloadWithCurrency = {
        ...basePayload,
        billable_currency: (manualCurrency || "USD").toUpperCase(),
      };

      let data: any = null;
      let error: any = null;

      if (initialEntry?.id) {
        const result = await supabase
          .from("time_entries")
          .update(payloadWithCurrency)
          .eq("id", initialEntry.id)
          .eq("user_id", user.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from("time_entries")
          .insert(payloadWithCurrency)
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      // Compatibility fallback for DBs that do not yet have `time_entries.currency`.
      if (error && isMissingCurrencyColumnError(error)) {
        const retry = initialEntry?.id
          ? await supabase
              .from("time_entries")
              .update(basePayload)
              .eq("id", initialEntry.id)
              .eq("user_id", user.id)
              .select()
              .single()
          : await supabase
              .from("time_entries")
              .insert(basePayload)
              .select()
              .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        setManualError("Failed to save entry. Please try again.");
        return;
      }

      if (data) {
        const normalized = {
          ...(data as Record<string, unknown>),
          currency: String(
            (data as any).currency ??
            (data as any).billable_currency ??
            manualCurrency ??
            "USD"
          ).toUpperCase(),
        } as TimeEntry;
        onSaved(normalized);
        onOpenChange(false);
      }
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const parsedManualDate = manualDate ? parseISO(manualDate) : null;
  const selectedManualDate =
    parsedManualDate && isValid(parsedManualDate) ? parsedManualDate : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader />

        <div className="grid grid-cols-[2fr,1fr] divide-x divide-gray-200 gap-6 py-4">
          <div className="space-y-4 pr-6">
            <input
              type="text"
              placeholder="What did you work on?"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              className="w-full border-0 border-b-2 rounded-none bg-transparent focus:ring-0 focus-visible:ring-0 outline-none px-0 pb-2 text-sm text-neutral-700 border-b-neutral-200 focus:border-b-[var(--kenoo-sky)] placeholder:text-neutral-300 transition-colors"
            />

            <div className="space-y-3 pt-1">
              <p className="text-xs text-neutral-400 uppercase tracking-wider font-light">Time</p>

              <div
                ref={modeTabsRef}
                role="tablist"
                aria-label="Time entry mode"
                className="relative inline-flex w-fit max-w-full items-center gap-0.5 rounded-full border border-neutral-200/80 bg-neutral-100/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
              >
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-0 z-0 rounded-full bg-kenoo-sky shadow-sm ring-1 ring-kenoo-sky/70"
                  initial={false}
                  animate={{
                    left: modeSlider.left,
                    width: modeSlider.width,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 32,
                    mass: 0.65,
                  }}
                />
                <button
                  ref={rangeTabRef}
                  type="button"
                  role="tab"
                  aria-selected={manualMode === "range"}
                  onClick={() => setManualMode("range")}
                  className={cn(
                    "relative z-10 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-normal transition-colors duration-200",
                    manualMode === "range" ? "text-white" : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Time range
                </button>
                <button
                  ref={durationTabRef}
                  type="button"
                  role="tab"
                  aria-selected={manualMode === "duration"}
                  onClick={() => setManualMode("duration")}
                  className={cn(
                    "relative z-10 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-normal transition-colors duration-200",
                    manualMode === "duration" ? "text-white" : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Duration
                </button>
              </div>

              {manualMode === "range" ? (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <Label className="text-xs text-neutral-400">Start</Label>
                    <input
                      type="time"
                      value={manualStartTime}
                      onChange={(e) => setManualStartTime(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700 outline-none focus:border-neutral-400 transition-colors w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <Label className="text-xs text-neutral-400">End</Label>
                    <input
                      type="time"
                      value={manualEndTime}
                      onChange={(e) => setManualEndTime(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700 outline-none focus:border-neutral-400 transition-colors w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <Label className="text-xs text-neutral-400">Start</Label>
                    <input
                      type="time"
                      value={manualStartTime}
                      onChange={(e) => setManualStartTime(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700 outline-none focus:border-neutral-400 transition-colors w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-16">
                    <Label className="text-xs text-neutral-400">Hours</Label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      placeholder="0"
                      value={manualDurHours}
                      onChange={(e) => setManualDurHours(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700 outline-none focus:border-neutral-400 transition-colors w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-16">
                    <Label className="text-xs text-neutral-400">Mins</Label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={manualDurMins}
                      onChange={(e) => setManualDurMins(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700 outline-none focus:border-neutral-400 transition-colors w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 pl-6">
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full h-10 flex items-center gap-2 rounded-full px-4 hover:bg-gray-100 focus:outline-none text-left"
                >
                  <CalendarClock className="h-4 w-4 text-gray-500 shrink-0" />
                  <span className="text-gray-500 text-sm shrink-0">Date:</span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm text-left",
                      selectedManualDate ? "text-foreground" : "text-gray-500"
                    )}
                  >
                    {selectedManualDate ? format(selectedManualDate, "MMM d, yyyy") : "Select date"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                align="start"
              >
                <MiniCalendar
                  selected={selectedManualDate ?? undefined}
                  onSelect={(date) => {
                    if (!date) return;
                    setManualDate(format(date, "yyyy-MM-dd"));
                    setDatePopoverOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="w-full h-10 flex items-center gap-2 rounded-full px-4 hover:bg-gray-100">
              <SequenceSwitch checked={manualIsBillable} onCheckedChange={setManualIsBillable} />
              <span className="text-sm text-gray-500 select-none">
                {manualIsBillable ? "Billable" : "Non-billable"}
              </span>
            </div>

            {manualIsBillable && (
              <div className="w-full h-10 flex items-center gap-3 rounded-full px-4 hover:bg-gray-100">
                <div className="relative w-[180px]">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">
                    {getCurrencySymbol(manualCurrency)}
                  </span>
                  <CurrencyInput
                    value={manualHourlyRate}
                    onChange={(v) => setManualHourlyRate(v)}
                    placeholder="Hourly rate"
                    showSymbol={false}
                    className={cn(
                      "w-full h-8 pl-4 pr-0 py-1 text-sm font-light placeholder:text-neutral-300 bg-transparent border-0 border-b rounded-none shadow-none",
                      "focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 transition-colors",
                      manualHourlyRate ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                      "focus:border-b-[var(--kenoo-sky)]"
                    )}
                  />
                </div>
                <Select value={manualCurrency} onValueChange={setManualCurrency}>
                  <SelectTrigger className="h-8 w-[48px] rounded-none border-0 bg-transparent px-0 pr-0 text-xs font-light tracking-wider text-neutral-700 shadow-none focus:ring-0 focus-visible:ring-0">
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
              </div>
            )}
          </div>
        </div>

        {manualError && <p className="text-xs text-red-500 -mt-2">{manualError}</p>}

        <DialogFooter>
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={handleSubmitManual}
              disabled={isSubmittingManual}
              className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95">
                {isSubmittingManual ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin text-neutral-500" />
                ) : (
                  <Save className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                )}
              </div>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
