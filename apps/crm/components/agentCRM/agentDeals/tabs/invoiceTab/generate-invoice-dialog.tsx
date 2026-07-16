"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, CalendarClock, FilePlus, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { suggestedInvoiceDatesIso } from "./invoice-helpers";
import { labelClass } from "./invoice-tab-styles";

const dialogFooterButtonClass =
  "group inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out border border-transparent bg-transparent hover:bg-gray-50 hover:border hover:border-neutral-200 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] hover:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

const deliverableDotTransition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function deliverableRowKey(d: any, index: number): string {
  if (d?.id != null && String(d.id).trim() !== "") return String(d.id);
  return `idx-${index}`;
}

/**
 * For each deliverable id on an invoice line for this deal + vendor, the first invoice number we see
 * (stable label for "Inc: …" in the UI).
 */
async function fetchDeliverableIdToInvoiceNumberMap(
  dealId: string,
  companyId: string
): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  const { data: invs, error: invErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("deal_id", dealId)
    .eq("company_id", companyId);
  if (invErr || !invs?.length) return new Map();
  const invoiceIds = (invs as { id: string }[]).map((r) => r.id);
  const { data: lines, error: liErr } = await supabase
    .from("invoice_line_items")
    .select("deal_deliverable_id, invoice_id")
    .in("invoice_id", invoiceIds)
    .not("deal_deliverable_id", "is", null);
  if (liErr || !lines?.length) return new Map();

  const lineRows = lines as { deal_deliverable_id: string; invoice_id: string }[];
  const uniqueInvoiceIds = Array.from(new Set(lineRows.map((l) => l.invoice_id)));
  const { data: invRows, error: inv2Err } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .in("id", uniqueInvoiceIds);
  const numByInvId = new Map<string, string>();
  if (!inv2Err && invRows?.length) {
    for (const r of invRows as { id: string; invoice_number?: string | null }[]) {
      const n = (r.invoice_number ?? "").trim();
      numByInvId.set(r.id, n || "Invoice");
    }
  }
  const map = new Map<string, string>();
  for (const l of lineRows) {
    const did = String(l.deal_deliverable_id);
    if (map.has(did)) continue;
    map.set(did, numByInvId.get(l.invoice_id) ?? "Invoice");
  }
  return map;
}

export type GenerateInvoiceConfirmPayload = {
  issueDateIso: string;
  dueDateIso: string;
  selectedDeliverables: any[];
};

export type GenerateInvoiceDialogVariant = "first" | "additional";

const DIALOG_COPY: Record<
  GenerateInvoiceDialogVariant,
  { title: string; description: string; confirm: string; submitting: string }
> = {
  first: {
    title: "Generate invoice",
    description:
      "Choose which deliverables to include, confirm dates, then we will create your draft invoice.",
    confirm: "Create invoice",
    submitting: "Generating…",
  },
  additional: {
    title: "New invoice",
    description:
      "Choose deliverables and dates for another draft invoice on this deal. Deliverables already on another invoice start unchecked.",
    confirm: "Create invoice",
    submitting: "Creating…",
  },
};

export type GenerateInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Used with `suggestedInvoiceDatesIso` when the dialog opens. */
  formData: Record<string, any>;
  deliverables: any[];
  isSubmitting: boolean;
  onConfirm: (payload: GenerateInvoiceConfirmPayload) => void | Promise<void>;
  /** `first` = first invoice on the deal; `additional` = new invoice alongside existing ones. */
  variant?: GenerateInvoiceDialogVariant;
  /** Required for `additional` variant: used to exclude deliverables already on invoice lines. */
  dealId?: string | null;
  vendorCompanyId?: string | null;
};

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  formData,
  deliverables,
  isSubmitting,
  onConfirm,
  variant = "first",
  dealId = null,
  vendorCompanyId = null,
}: GenerateInvoiceDialogProps) {
  const copy = DIALOG_COPY[variant];
  const [issueDateIso, setIssueDateIso] = useState("");
  const [dueDateIso, setDueDateIso] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [issuePopoverOpen, setIssuePopoverOpen] = useState(false);
  const [duePopoverOpen, setDuePopoverOpen] = useState(false);
  const [deliverableOccupancyReady, setDeliverableOccupancyReady] = useState(true);
  /** Deliverable id → invoice number (for "Inc: …" on additional-invoice rows). */
  const [deliverableIncInvoiceLabel, setDeliverableIncInvoiceLabel] = useState<Record<string, string>>({});
  const wasOpenRef = useRef(false);

  const rows = useMemo(() => (deliverables ?? []).map((d, i) => ({ d, i, key: deliverableRowKey(d, i) })), [deliverables]);

  const deliverableSelectionLocked =
    variant === "additional" && !deliverableOccupancyReady;

  useEffect(() => {
    let cancelled = false;
    if (open) {
      if (!wasOpenRef.current) {
        const { issueDateIso: issue, dueDateIso: due } = suggestedInvoiceDatesIso(formData);
        setIssueDateIso(issue);
        setDueDateIso(due);
        setSelectionError(null);

        const effectiveDealId = dealId && String(dealId).trim() ? String(dealId).trim() : "";
        const effectiveCompanyId =
          vendorCompanyId && String(vendorCompanyId).trim() ? String(vendorCompanyId).trim() : "";

        if (
          variant === "additional" &&
          effectiveDealId &&
          effectiveCompanyId
        ) {
          const rowsSnapshot = rows;
          setDeliverableOccupancyReady(false);
          setDeliverableIncInvoiceLabel({});
          setSelectedKeys(new Set());
          void fetchDeliverableIdToInvoiceNumberMap(effectiveDealId, effectiveCompanyId)
            .then((deliverableToInvoice) => {
              if (cancelled) return;
              const occupied = new Set(deliverableToInvoice.keys());
              const labelRecord: Record<string, string> = {};
              deliverableToInvoice.forEach((invoiceNumber, deliverableId) => {
                labelRecord[deliverableId] = invoiceNumber;
              });
              setDeliverableIncInvoiceLabel(labelRecord);
              setSelectedKeys(
                new Set(
                  rowsSnapshot
                    .filter((r) => {
                      const id = r.d?.id;
                      if (id == null || String(id).trim() === "") return true;
                      return !occupied.has(String(id));
                    })
                    .map((r) => r.key)
                )
              );
              setDeliverableOccupancyReady(true);
            })
            .catch(() => {
              if (cancelled) return;
              setDeliverableIncInvoiceLabel({});
              setSelectedKeys(new Set(rowsSnapshot.map((r) => r.key)));
              setDeliverableOccupancyReady(true);
            });
        } else {
          setDeliverableIncInvoiceLabel({});
          setDeliverableOccupancyReady(true);
          setSelectedKeys(new Set(rows.map((r) => r.key)));
        }
      }
      wasOpenRef.current = true;
    } else {
      wasOpenRef.current = false;
      setIssuePopoverOpen(false);
      setDuePopoverOpen(false);
      setDeliverableOccupancyReady(true);
      setDeliverableIncInvoiceLabel({});
    }
    return () => {
      cancelled = true;
    };
  }, [open, formData, rows, variant, dealId, vendorCompanyId]);

  const toggleKey = useCallback((key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    setSelectionError(null);
  }, []);

  const handleSubmit = async () => {
    if (rows.length > 0 && selectedKeys.size === 0) {
      setSelectionError("Select at least one deliverable to include, or cancel.");
      return;
    }
    const selectedDeliverables = rows.filter((r) => selectedKeys.has(r.key)).map((r) => r.d);
    await onConfirm({
      issueDateIso,
      dueDateIso,
      selectedDeliverables,
    });
  };

  const handleClose = () => {
    if (!isSubmitting) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex w-[calc(100%-1.5rem)] max-w-[min(520px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-neutral-200/60 bg-gradient-to-br from-white via-neutral-50 to-neutral-100 p-0 gap-0 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:max-w-[520px]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_100%_35%,rgba(0,0,0,0.06),transparent_55%)]" />

        <div className="relative flex max-h-[min(85vh,640px)] flex-col">
          <div className="space-y-5 px-6 pt-7 pb-2 md:px-8 md:pt-8">
            <div>
              <h3 className="text-2xl font-black tracking-tight text-foreground">{copy.title}</h3>
              <p className="mt-2 text-xs font-light leading-relaxed text-neutral-500">{copy.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className={labelClass}>Issue date</Label>
                <Popover open={issuePopoverOpen} onOpenChange={setIssuePopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={isSubmitting || deliverableSelectionLocked}
                      className="mt-1 w-full h-10 flex items-center gap-2 rounded-full px-4 hover:bg-gray-100 focus:outline-none text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
                      <span className="text-gray-500 text-sm shrink-0">Issue:</span>
                      <span
                        className={cn(
                          "text-sm truncate min-w-0",
                          issueDateIso ? "text-foreground" : "text-gray-500"
                        )}
                      >
                        {issueDateIso
                          ? format(parseDateValue(issueDateIso) ?? new Date(), "MMM d, yyyy")
                          : "Select date"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                    align="start"
                  >
                    <MiniCalendar
                      selected={parseDateValue(issueDateIso)}
                      onSelect={(date) => {
                        if (!date) return;
                        setIssueDateIso(format(date, "yyyy-MM-dd"));
                        setIssuePopoverOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="mt-1 text-[11px] font-light text-neutral-400">Defaults to today</p>
              </div>
              <div>
                <Label className={labelClass}>Due date</Label>
                <Popover open={duePopoverOpen} onOpenChange={setDuePopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={isSubmitting || deliverableSelectionLocked}
                      className="mt-1 w-full h-10 flex items-center gap-2 rounded-full px-4 hover:bg-gray-100 focus:outline-none text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CalendarClock className="h-4 w-4 text-gray-500 shrink-0" />
                      <span className="text-gray-500 text-sm shrink-0">Due:</span>
                      <span
                        className={cn(
                          "text-sm truncate min-w-0",
                          dueDateIso ? "text-foreground" : "text-gray-500"
                        )}
                      >
                        {dueDateIso
                          ? format(parseDateValue(dueDateIso) ?? new Date(), "MMM d, yyyy")
                          : "Select date"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                    align="start"
                  >
                    <MiniCalendar
                      selected={parseDateValue(dueDateIso)}
                      onSelect={(date) => {
                        if (!date) return;
                        setDueDateIso(format(date, "yyyy-MM-dd"));
                        setDuePopoverOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="mt-1 text-[11px] font-light text-neutral-400">Suggested from net terms when available</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">Deliverables</p>
              {rows.length === 0 ? (
                <p className="mt-2 rounded-xl border border-neutral-200/60 bg-white/60 px-3 py-3 text-sm font-light text-neutral-600">
                  No deliverables on this deal yet. We will add one empty line you can edit after the invoice is created.
                </p>
              ) : (
                <ul
                  className={cn(
                    "mt-2 max-h-[min(40vh,220px)] space-y-1 overflow-y-auto rounded-xl border border-neutral-200/60 bg-white/70 p-2 shadow-inner",
                    deliverableSelectionLocked && "pointer-events-none opacity-60"
                  )}
                >
                  {rows.map(({ d, key }, listIndex) => {
                    const label = (d?.name ?? "").trim() || "Untitled deliverable";
                    const checked = selectedKeys.has(key);
                    const deliverableId =
                      d?.id != null && String(d.id).trim() !== "" ? String(d.id) : null;
                    const incInvoiceNumber =
                      variant === "additional" && deliverableId
                        ? deliverableIncInvoiceLabel[deliverableId]
                        : undefined;
                    const incBadge =
                      incInvoiceNumber != null && incInvoiceNumber !== ""
                        ? `Inc: ${incInvoiceNumber}`
                        : null;
                    return (
                      <motion.li
                        key={key}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: listIndex * 0.04, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          "relative flex items-center gap-3 rounded-lg py-2 pl-2 transition-colors hover:bg-neutral-50/80",
                          incBadge ? "pr-[min(11rem,42%)]" : "pr-2"
                        )}
                      >
                        <button
                          type="button"
                          id={`gen-del-${key}`}
                          role="checkbox"
                          aria-checked={checked}
                          disabled={isSubmitting || deliverableSelectionLocked}
                          onClick={() => toggleKey(key, !checked)}
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-300/90 bg-white transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kenoo-sky/35 focus-visible:ring-offset-2",
                            (isSubmitting || deliverableSelectionLocked) && "cursor-not-allowed opacity-50"
                          )}
                          aria-label={`Include ${label}`}
                        >
                          <AnimatePresence initial={false}>
                            {checked ? (
                              <motion.span
                                key="dot"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={deliverableDotTransition}
                                className="block h-3 w-3 rounded-full bg-kenoo-sky"
                                aria-hidden
                              />
                            ) : null}
                          </AnimatePresence>
                        </button>
                        <label
                          htmlFor={`gen-del-${key}`}
                          className={cn(
                            "min-w-0 flex-1 text-sm font-light leading-snug text-neutral-800",
                            deliverableSelectionLocked ? "cursor-default" : "cursor-pointer"
                          )}
                        >
                          <span className="block truncate">{label}</span>
                        </label>
                        {incBadge ? (
                          <span
                            className="absolute right-2 top-1/2 max-w-[min(10.5rem,40%)] -translate-y-1/2 truncate text-right text-[11px] font-medium text-neutral-500"
                            title={incBadge}
                          >
                            {incBadge}
                          </span>
                        ) : null}
                      </motion.li>
                    );
                  })}
                </ul>
              )}
              {selectionError ? (
                <p className="mt-2 text-sm font-light text-red-600" role="alert">
                  {selectionError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-end gap-2 border-t border-neutral-200/40 px-6 py-4 md:px-8">
            <button type="button" onClick={handleClose} disabled={isSubmitting} className={dialogFooterButtonClass}>
              <X className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-red-600/60" />
              <span className="text-sm font-normal text-neutral-800 transition-colors group-hover:text-red-600/60">
                Cancel
              </span>
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || deliverableSelectionLocked}
              className={dialogFooterButtonClass}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
                  <span className="text-sm font-normal text-neutral-800">{copy.submitting}</span>
                </>
              ) : (
                <>
                  <FilePlus className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-green-600/60" />
                  <span className="text-sm font-normal text-neutral-800">{copy.confirm}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
