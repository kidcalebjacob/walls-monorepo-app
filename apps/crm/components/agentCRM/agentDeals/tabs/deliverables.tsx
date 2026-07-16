"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, ChevronDown, ChevronUp, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Same pattern as view-agent-deals sheet header expand/close: no chrome at rest; inset hover on inner. */
const deliverableSheetIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent active:bg-transparent focus-visible:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50";
const deliverableSheetIconInnerClass = cn(
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
  "group-hover:bg-gray-100 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
);

export type BillingType = "one_off" | "recurring" | "time_based";
export type BillingInterval = string;

export interface DeliverableRow {
  id?: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price_cents: number;
  currency: string;
  billing_type: BillingType;
  /** billing_interval required when billing_type is recurring */
  billing_interval?: string | null;
  starts_at?: string | null;
  recurrence_count?: number | null;
  /** Net payout days (number of days after net_payout_start to calculate payout date) */
  net_payout?: number | null;
}

const BILLING_TYPE_OPTIONS: BillingType[] = ["one_off", "recurring", "time_based"];

const CURRENCY_OPTIONS = [
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "MXN", "BRL", "INR", "SGD", "NZD",
];

function getCurrencySymbol(currency: string): string {
  try {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
    return formatted.replace(/[\d,\s.]/g, "").trim();
  } catch {
    return "$";
  }
}

/** Format billing interval enum value for display (e.g. "monthly" → "Monthly") */
function formatBillingIntervalLabel(value: string): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format billing type enum value for display (e.g. "time_based" -> "Time Based"). */
function formatBillingTypeLabel(value: string): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** When billing is recurring and there is no recurrence count, return MRR/ARR/WRR/BWRR/QRR suffix for the value display (with leading space) */
function billingIntervalToValueLabel(interval: string | null | undefined): string {
  if (!interval) return " MRR";
  const i = String(interval).toLowerCase().replace(/-/g, "_");
  if (i === "yearly" || i === "annual") return " ARR";
  if (i === "monthly") return " MRR";
  if (i === "weekly") return " WRR";
  if (i === "bi_weekly" || i === "biweekly") return " BWRR";
  if (i === "quarterly") return " QRR";
  return " MRR";
}

/** Same as above but label only (no leading space) for header "X MRR + Y ARR" display */
function billingIntervalToShortLabel(interval: string | null | undefined): string {
  const withSpace = billingIntervalToValueLabel(interval);
  return withSpace.trim();
}

function getValueLabel(d: DeliverableRow): string | undefined {
  if (d.billing_type !== "recurring") return undefined;
  const recur = d.recurrence_count != null ? Number(d.recurrence_count) || 0 : 0;
  if (recur > 0) return undefined;
  return billingIntervalToValueLabel(d.billing_interval);
}

const fieldWrapperClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-0 bg-transparent transition-colors focus-within:border-b-[var(--kenoo-sky)]";
const inputInnerClass =
  "border-0 rounded-none px-0 py-2 font-light bg-transparent flex-1 w-full min-w-0 placeholder:text-neutral-300 h-10 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0";
const numberInputClass = `${inputInnerClass} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`;
/** Select trigger when wrapped in fieldWrapperClass - no own border/bg so wrapper dictates underline */
const selectTriggerClass =
  "w-full border-0 rounded-none px-0 py-2 font-light bg-transparent shadow-none min-h-10 h-10 flex items-center justify-between focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 hover:bg-transparent";
const labelClass = "text-xs font-normal text-neutral-400 tracking-wide block mb-1";

interface DeliverablesProps {
  formData: { deliverables?: DeliverableRow[]; [key: string]: any };
  setFormData: (arg: any) => void;
}

export default function Deliverables({ formData, setFormData }: DeliverablesProps) {
  const deliverables = formData.deliverables || [];
  const [billingIntervals, setBillingIntervals] = useState<string[]>([]);
  const [loadingIntervals, setLoadingIntervals] = useState(true);
  const [collapsedDetails, setCollapsedDetails] = useState<Set<number>>(new Set());
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);

  const toggleDetails = (index: number) => {
    setCollapsedDetails((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  useEffect(() => {
    const fetchBillingIntervals = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.rpc("get_billing_intervals");

        if (error) {
          console.warn("Failed to fetch billing intervals:", error.message);
          setBillingIntervals([]);
          return;
        }

        if (Array.isArray(data)) {
          setBillingIntervals(data);
        } else {
          setBillingIntervals([]);
        }
      } catch (e) {
        console.warn("Error fetching billing intervals:", e);
        setBillingIntervals([]);
      } finally {
        setLoadingIntervals(false);
      }
    };

    fetchBillingIntervals();
  }, []);

  const formatCurrency = (amount: number, currency: string = "USD") =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const formatCurrencyCompact = (dollars: number, currency: string = "USD") => {
    const abs = Math.abs(dollars);
    const sign = dollars < 0 ? "-" : "";
    const sym = getCurrencySymbol(currency || "USD");
    if (abs >= 1_000_000_000) {
      const v = abs / 1_000_000_000;
      return `${sign}${sym}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}B`;
    }
    if (abs >= 1_000_000) {
      const v = abs / 1_000_000;
      return `${sign}${sym}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      const v = abs / 1_000;
      return `${sign}${sym}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
    }
    return `${sign}${sym}${abs.toFixed(2)}`;
  };

  // Split totals for header: recurring (no count) by interval (MRR/ARR/WRR/BWRR/QRR); one-off or recurring with count = VALUE part
  // Grouped by currency so mixed-currency deals display correctly
  interface CurrencyGroup {
    recurringByInterval: Record<string, number>;
    valueDollars: number;
  }
  const currencyGroups: Record<string, CurrencyGroup> = {};
  deliverables.forEach((d) => {
    const cur = d.currency || "USD";
    if (!currencyGroups[cur]) currencyGroups[cur] = { recurringByInterval: {}, valueDollars: 0 };
    const group = currencyGroups[cur];
    const q = Number(d.quantity) || 0;
    const c = Number(d.unit_price_cents) || 0;
    const lineDollars = (q * c) / 100;
    const isRecurring = d.billing_type === "recurring";
    const recur = d.recurrence_count != null ? Number(d.recurrence_count) || 0 : 0;
    if (isRecurring && (d.recurrence_count == null || recur === 0)) {
      const raw = String(d.billing_interval ?? "monthly").toLowerCase().replace(/-/g, "_");
      const key = raw === "annual" ? "yearly" : raw === "biweekly" ? "bi_weekly" : raw;
      group.recurringByInterval[key] = (group.recurringByInterval[key] ?? 0) + lineDollars;
    } else {
      const multiplier = isRecurring && recur > 0 ? recur : 1;
      group.valueDollars += lineDollars * multiplier;
    }
  });

  const hasValueDollars = Object.values(currencyGroups).some((g) => g.valueDollars > 0);

  const totalValueDisplay = Object.entries(currencyGroups)
    .map(([cur, group]) => {
      const recurringParts = (["yearly", "quarterly", "monthly", "bi_weekly", "weekly"] as const)
        .filter((key) => (group.recurringByInterval[key] ?? 0) > 0)
        .map((key) => `${formatCurrency(group.recurringByInterval[key]!, cur)} ${billingIntervalToShortLabel(key)}`);
      const recurringDisplay = recurringParts.join(" + ");
      const totalDollars =
        Object.values(group.recurringByInterval).reduce((s, v) => s + v, 0) + group.valueDollars;
      if (recurringDisplay && group.valueDollars > 0) {
        return `${recurringDisplay} + ${formatCurrency(group.valueDollars, cur)}`;
      }
      if (recurringDisplay) return recurringDisplay;
      return formatCurrency(totalDollars, cur);
    })
    .join(" + ") || formatCurrency(0);

  const lineTotalDollars = (d: DeliverableRow) => {
    const q = Number(d.quantity) || 0;
    const c = Number(d.unit_price_cents) || 0;
    const isRecurring = d.billing_type === "recurring";
    const recur = d.recurrence_count != null ? Number(d.recurrence_count) || 0 : 0;
    const multiplier = isRecurring && recur > 0 ? recur : 1;
    return (q * c * multiplier) / 100;
  };

  const addRow = () => {
    setFormData((prev: any) => ({
      ...prev,
      deliverables: [
        {
          name: "",
          description: null,
          quantity: 1,
          unit_price_cents: 0,
          currency: "USD",
          billing_type: "one_off" as BillingType,
          billing_interval: null,
          starts_at: null,
          recurrence_count: null,
          net_payout: null,
        },
        ...(prev.deliverables || []),
      ],
    }));
    setCollapsedDetails((prev) => new Set(Array.from(prev, (index) => index + 1)));
  };

  const removeRow = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      deliverables: (prev.deliverables || []).filter((_: any, i: number) => i !== index),
    }));
    setCollapsedDetails((prev) => {
      const next = new Set<number>();
      prev.forEach((k) => {
        if (k < index) next.add(k);
        if (k > index) next.add(k - 1);
      });
      return next;
    });
  };

  const updateRow = (index: number, field: keyof DeliverableRow, value: string | number | null | undefined) => {
    setFormData((prev: any) => {
      const next = [...(prev.deliverables || [])];
      const row = next[index];
      if (!row) return prev;
      if (field === "unit_price_cents" && typeof value === "number") {
        next[index] = { ...row, unit_price_cents: value };
      } else if (field === "quantity") {
        next[index] = { ...row, quantity: typeof value === "number" ? value : parseInt(String(value), 10) || 0 };
      } else if (field === "billing_type") {
        const billing_type = (value as BillingType) || "one_off";
        next[index] = {
          ...row,
          billing_type,
          billing_interval: billing_type === "recurring" ? (row.billing_interval || billingIntervals[0] || null) : null,
        };
      } else if (field === "recurrence_count") {
        const n = value === "" || value === null || value === undefined ? null : Number(value);
        next[index] = { ...row, recurrence_count: n };
      } else if (field === "net_payout") {
        const n = value === "" || value === null || value === undefined ? null : Number(value);
        next[index] = { ...row, net_payout: n };
      } else {
        next[index] = { ...row, [field]: value };
      }
      return { ...prev, deliverables: next };
    });
  };

  const setPriceFromDollars = (index: number, dollarStr: string) => {
    const dollars = parseFloat(dollarStr) || 0;
    updateRow(index, "unit_price_cents", Math.round(dollars * 100));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center flex-wrap gap-4">
        <h2 className="text-black font-black text-4xl">DELIVERABLES</h2>
        <div className="flex-1 min-w-0 border-t border-black h-[1px]" />
        <div className="flex items-center gap-2">
          <p className="text-black font-black text-4xl">{totalValueDisplay}</p>
          {hasValueDollars && <span className="text-black font-black text-4xl">VALUE</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={addRow}
          className={deliverableSheetIconButtonClass}
          aria-label="Add line"
        >
          <div className="relative">
            <div className={deliverableSheetIconInnerClass}>
              <Plus className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
            </div>
          </div>
        </Button>
      </div>

      {deliverables.length === 0 ? (
        <div className="flex items-center justify-center min-h-[400px] py-12">
          <Button
            type="button"
            onClick={addRow}
            variant="ghost"
            className="relative hover:bg-transparent p-0"
          >
            <motion.div
              className="relative z-10 p-3 bg-gray-50 backdrop-blur-md rounded-full border-0 px-6"
              whileHover={{
                backgroundColor: "rgb(249 250 251)",
                boxShadow: "inset 0 3px 6px rgba(0, 0, 0, 0.25)",
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              style={{
                boxShadow: "none",
                y: 0,
              }}
            >
              <span className="font-light text-slate-600">+ Add deliverable</span>
            </motion.div>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {deliverables.map((d, index) => {
            return (
            <div
              key={d.id ?? `row-${index}`}
              className={`bg-gray-50 rounded-[30px] p-6 shrink-0 ${collapsedDetails.has(index) ? "flex flex-col justify-center min-h-[5rem]" : ""}`}
            >
              <div className={`flex items-center flex-nowrap gap-4 min-w-0 ${collapsedDetails.has(index) ? "mb-0" : "mb-6"}`}>
                <div className="flex min-w-0 max-w-[min(100%,90%)] items-center gap-1.5">
                  <DropdownMenu
                    onOpenChange={(open) => setOpenDropdownIndex(open ? index : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-neutral-200"
                        aria-label="Open menu"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[140px]">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        onClick={() => removeRow(index)}
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <h2 className="min-w-0 flex-1 truncate text-black font-black text-4xl" title={(d.name ?? "").trim() || "Deliverable"}>
                    {(d.name ?? "").trim() || "Deliverable"}
                  </h2>
                </div>
                <div className="h-px min-h-px flex-1 min-w-6 self-center border-t border-black" />
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-black font-black text-4xl">{formatCurrencyCompact(lineTotalDollars(d), d.currency)}{getValueLabel(d) ?? ""}</p>
                  <button
                    type="button"
                    onClick={() => toggleDetails(index)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-200/50 transition-colors cursor-pointer whitespace-nowrap self-end min-w-[5.5rem] justify-center"
                    aria-label={collapsedDetails.has(index) ? "Show details" : "Hide details"}
                  >
                    <span className="text-xs font-light text-foreground">
                      {collapsedDetails.has(index) ? "See more" : "See less"}
                    </span>
                    {collapsedDetails.has(index) ? (
                      <ChevronDown className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                    ) : (
                      <ChevronUp className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                    )}
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {!collapsedDetails.has(index) && (
                  <motion.div
                    key="details"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
              <div className="space-y-4">
                {/* Row 1: Name (left) | Billing, Interval (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-end">
                  <div>
                    <label className={labelClass}>Name</label>
                    <div className={fieldWrapperClass}>
                      <BorderlessInput
                        value={d.name ?? ""}
                        onChange={(e) => updateRow(index, "name", e.target.value)}
                        placeholder="e.g. Instagram Reel"
                        className={inputInnerClass}
                      />
                    </div>
                  </div>
                  <div className={`grid gap-4 ${d.billing_type === "recurring" ? "grid-cols-3" : "grid-cols-2"}`}>
                    <div>
                      <label className={labelClass}>Billing</label>
                      <div className={fieldWrapperClass}>
                        <Select
                          value={d.billing_type ?? "one_off"}
                          onValueChange={(v) => updateRow(index, "billing_type", v as BillingType)}
                        >
                          <SelectTrigger className={selectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BILLING_TYPE_OPTIONS.map((billingType) => (
                              <SelectItem
                                key={billingType}
                                value={billingType}
                              >
                                {formatBillingTypeLabel(billingType)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {d.billing_type === "recurring" && (
                      <div>
                        <label className={labelClass}>Interval</label>
                        <div className={fieldWrapperClass}>
                          <Select
                            value={d.billing_interval ?? billingIntervals[0] ?? ""}
                            onValueChange={(v) => updateRow(index, "billing_interval", v)}
                          >
                            <SelectTrigger className={selectTriggerClass}>
                              <SelectValue placeholder={loadingIntervals ? "Loading…" : "Select interval"} />
                            </SelectTrigger>
                            <SelectContent>
                              {billingIntervals.map((interval) => (
                                <SelectItem
                                  key={interval}
                                  value={interval}
                                >
                                  {formatBillingIntervalLabel(interval)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className={labelClass}>NET (days)</label>
                      <div className={fieldWrapperClass}>
                        <BorderlessInput
                          type="number"
                          min={0}
                          value={d.net_payout ?? ""}
                          onChange={(e) => updateRow(index, "net_payout", e.target.value === "" ? null : e.target.value)}
                          placeholder="Days after trigger"
                          className={numberInputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Quantity, Unit price (left) | Starts at, Recurrence count (right) */}
                {d.billing_type !== "time_based" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-end">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Quantity</label>
                        <div className={fieldWrapperClass}>
                          <BorderlessInput
                            type="number"
                            min={1}
                            value={d.quantity ?? 1}
                            onChange={(e) => updateRow(index, "quantity", e.target.value)}
                            className={numberInputClass}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Unit price</label>
                        <div className={`${fieldWrapperClass} flex items-center gap-0`}>
                          <Select
                            value={d.currency || "USD"}
                            onValueChange={(v) => updateRow(index, "currency", v)}
                          >
                            <SelectTrigger className="border-0 bg-transparent shadow-none h-10 w-[4rem] shrink-0 px-0 focus:ring-0 focus-visible:ring-0 text-xs text-neutral-500 hover:bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCY_OPTIONS.map((cur) => (
                                <SelectItem
                                  key={cur}
                                  value={cur}
                                  className="text-xs"
                                >
                                  {cur}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="w-px h-5 bg-neutral-200 shrink-0" />
                          <CurrencyInput
                            value={((d.unit_price_cents ?? 0) / 100).toFixed(2)}
                            onChange={(value) => setPriceFromDollars(index, value)}
                            currency={d.currency || "USD"}
                            className={`${inputInnerClass} pl-2`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {d.billing_type === "recurring" && (
                        <div>
                          <label className={labelClass}>Starts at (date)</label>
                          <div className={fieldWrapperClass}>
                            <BorderlessInput
                              type="date"
                              value={d.starts_at ?? ""}
                              onChange={(e) => updateRow(index, "starts_at", e.target.value || null)}
                              className={inputInnerClass}
                            />
                          </div>
                        </div>
                      )}
                      {d.billing_type === "recurring" && (
                        <div>
                          <label className={labelClass}>Recurrence count (optional)</label>
                          <div className={fieldWrapperClass}>
                            <BorderlessInput
                              type="number"
                              min={0}
                              value={d.recurrence_count ?? ""}
                              onChange={(e) => updateRow(index, "recurrence_count", e.target.value === "" ? null : e.target.value)}
                              placeholder="Leave empty for indefinite"
                              className={numberInputClass}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 3: Description */}
                <div>
                  <label className={labelClass}>Description (optional)</label>
                  <div className={fieldWrapperClass}>
                    <BorderlessInput
                      value={d.description ?? ""}
                      onChange={(e) => updateRow(index, "description", e.target.value || null)}
                      placeholder="Short description"
                      className={`${inputInnerClass} text-sm`}
                    />
                  </div>
                </div>
              </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
