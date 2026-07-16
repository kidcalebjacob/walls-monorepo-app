"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { RefObject, useEffect, useRef, useState } from "react";
import { Calendar, CalendarClock, Check, ChevronDown, FileDown, FilePlus, Loader2, MoreVertical, Plus, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import InvoicePreview, { type InvoicePreviewHandle, type InvoicePreviewLine } from "./invoice-preview";
import type { InvoiceLineItemForm, InvoicePaymentForm } from "./invoice-types";
import type { VendorBillingInfo } from "./invoice-vendor-shared";
import { WiseTransactionSearch } from "../../custom-ui/wise-transaction-search";
import { TAX_DROPDOWN_OPTIONS } from "./canadian-tax-options";
import { lineItemTotalWithTaxCents } from "./invoice-helpers";
import type { InvoiceTaxRecommendation } from "@/lib/invoice/recommend-invoice-tax";
import {
  invoiceCurrencyOptions,
  invoiceGhostActionButtonClass,
  invoiceGhostActionButtonInnerClass,
  invoiceStatusOptions,
  labelClass,
  WISE_VERIFIED_LOGO_URL,
} from "./invoice-tab-styles";

const invoiceFieldWrapperClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-0 bg-transparent";
const invoiceInputInnerClass =
  "border-0 bg-transparent px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] w-full min-w-0 placeholder:text-neutral-300";
const invoiceSelectTriggerClass =
  "w-full border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light bg-transparent justify-between shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] hover:bg-transparent [&_[data-placeholder]]:text-neutral-300";
const invoiceDateButtonClass =
  "w-full border-0 border-b border-neutral-200 rounded-none px-0 py-2 bg-transparent text-left transition-colors hover:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0";
const lineItemHeaderClass =
  "text-left pb-3 pr-4 text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 whitespace-nowrap";

function lineItemDeliverableLabel(
  deliverables: any[],
  deliverableId: string | null | undefined
): string {
  if (!deliverableId) return "No linked deliverable";
  const linked = deliverables.find((d: any) => d?.id === deliverableId);
  return linked?.name || "Linked deliverable";
}

export type InvoiceSummary = {
  id: string;
  invoice_number: string;
  public_token?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  total_amount_cents?: number | null;
  currency?: string | null;
  status?: string | null;
  /** Count of `invoice_payments` rows with a Wise `transaction_id` (DB snapshot when summaries were built). */
  linked_wise_transaction_count?: number;
};

/** Tailwind bg class for the status dot in invoice lists (matches DB `invoices.status`). */
export function invoiceStatusDotClass(status: string | null | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  switch (s) {
    case "paid":
      return "bg-emerald-500";
    case "overdue":
      return "bg-red-500";
    case "draft":
      return "bg-neutral-400";
    case "issued":
      return "bg-sky-500";
    case "sent":
      return "bg-violet-500";
    case "void":
      return "bg-stone-400";
    default:
      return "bg-neutral-300";
  }
}

function invoiceStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  switch (s) {
    case "draft":
      return "Drafted";
    case "issued":
      return "Issued";
    case "sent":
      return "Sent";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "void":
      return "Voided";
    default:
      return "Drafted";
  }
}

function formatSummaryAmount(cents: number | null | undefined, currency: string | null | undefined): string {
  const c = Number(cents);
  const safe = Number.isFinite(c) ? c : 0;
  const cur = (currency && String(currency).trim()) || "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe / 100);
}

function summaryCurrencyCode(currency: string | null | undefined): string {
  const c = (currency && String(currency).trim().toUpperCase()) || "USD";
  return c.slice(0, 3);
}

function formatSummaryDate(iso: string | null | undefined): string {
  const s = iso != null ? String(iso).trim() : "";
  if (!s) return "—";
  const d = new Date(s.includes("T") ? s : `${s.split("T")[0]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatWisePaymentMeta(p: InvoicePaymentForm): string {
  const parts: string[] = [];
  if (p.amount != null && Number.isFinite(Number(p.amount)) && p.currency) {
    const cur = String(p.currency).trim().slice(0, 3).toUpperCase() || "USD";
    parts.push(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(p.amount))
    );
  }
  if (p.type) parts.push(String(p.type));
  if (p.wise_created_at) parts.push(formatSummaryDate(p.wise_created_at));
  if (p.merchant_name) parts.push(String(p.merchant_name));
  return parts.length ? parts.join(" · ") : "";
}

export type InvoiceDetailsPanelMode = "hidden" | "preview" | "details";

export type InvoiceDetailsCardProps = {
  formData: Record<string, any>;
  vendorInfo: VendorBillingInfo;
  dealName: string;
  selectedCompanyId: string | null;
  dealId: string | null | undefined;
  invoiceSummaries: InvoiceSummary[];
  invoiceSyncLoading: boolean;
  invoiceDetailsPanelMode: InvoiceDetailsPanelMode;
  onSelectInvoicePanel: (which: "preview" | "details") => void;
  onInvoiceSwitch: (nextId: string) => void;
  onCreateNewInvoice: () => void;
  onGenerateInvoice: () => void;
  onDeleteCurrentInvoice: () => void;
  onPersistInvoice: () => void;
  onDownloadPdf: () => Promise<void> | void;
  invoiceDetails: {
    invoice_number: string;
    issue_date: string;
    due_date: string;
    status: string;
    net_term: number;
    currency: string;
    total_amount_cents: number;
  };
  displayTotalCents: number;
  deliverables: any[];
  derivedDates: { issueDate: string; netTerm: string; dueDate: string };
  invoicePreviewRef: RefObject<InvoicePreviewHandle | null>;
  onUpdateInvoiceField: (field: string, value: string | number) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (index: number) => void;
  onUpdateLineItem: (index: number, patch: Partial<InvoiceLineItemForm>) => void;
  onApplyDeliverableToLine: (index: number, deliverableId: string) => void;
  onApplyTaxToAllLineItems: (value: string) => void;
  taxRecommendation?: InvoiceTaxRecommendation;
  onApplyRecommendedTax?: () => void;
  onAddInvoicePayment: () => void;
  onUpdateInvoicePayment: (index: number, patch: Partial<InvoicePaymentForm>) => void;
  onRemoveInvoicePayment: (index: number) => void;
  /** When true, signed-in user has `users.is_admin` — Wise payment linking and Send invoice (sensitive). */
  canManageInvoiceWisePayments?: boolean;
  /** After a successful Gmail send; `dbStatusUpdated` is true when `invoices.status` was set to `sent` in the API. */
  onInvoiceEmailSent?: (info: { dbStatusUpdated: boolean }) => void;
};

export function InvoiceDetailsCard({
  formData,
  vendorInfo,
  dealName,
  selectedCompanyId,
  dealId,
  invoiceSummaries,
  invoiceSyncLoading,
  invoiceDetailsPanelMode,
  onSelectInvoicePanel,
  onInvoiceSwitch,
  onCreateNewInvoice,
  onGenerateInvoice,
  onDeleteCurrentInvoice,
  onPersistInvoice,
  onDownloadPdf,
  invoiceDetails,
  displayTotalCents,
  deliverables,
  derivedDates,
  invoicePreviewRef,
  onUpdateInvoiceField,
  onAddLineItem,
  onRemoveLineItem,
  onUpdateLineItem,
  onApplyDeliverableToLine,
  onApplyTaxToAllLineItems,
  taxRecommendation,
  onApplyRecommendedTax,
  onAddInvoicePayment,
  onUpdateInvoicePayment,
  onRemoveInvoicePayment,
  canManageInvoiceWisePayments = false,
  onInvoiceEmailSent,
}: InvoiceDetailsCardProps) {
  const hasPersistedInvoices = invoiceSummaries.length > 0;
  const [invoiceDropdownOpen, setInvoiceDropdownOpen] = useState(false);
  const [issuePopoverOpen, setIssuePopoverOpen] = useState(false);
  const [duePopoverOpen, setDuePopoverOpen] = useState(false);
  const [invoiceSendLoading, setInvoiceSendLoading] = useState(false);
  const [invoiceSendSuccess, setInvoiceSendSuccess] = useState(false);
  const [invoiceDownloadLoading, setInvoiceDownloadLoading] = useState(false);
  const invoiceSendSuccessTimeoutRef = useRef<number | null>(null);
  const [holdSendButtonVisible, setHoldSendButtonVisible] = useState(false);
  const invoiceDropdownRef = useRef<HTMLDivElement>(null);

  const activeInvoiceId =
    invoiceSummaries.length > 0
      ? (((formData as any)._invoiceId as string | undefined) ?? invoiceSummaries[0]?.id ?? "")
      : "";
  const activeIndex = invoiceSummaries.findIndex((s) => s.id === activeInvoiceId);
  const activeSummary =
    activeIndex >= 0 ? invoiceSummaries[activeIndex] : (invoiceSummaries[0] ?? null);
  const activePublicToken = (activeSummary?.public_token ?? "").trim();

  const headlineInvoiceLabel =
    invoiceSummaries.length === 0
      ? "INVOICE DETAILS"
      : (() => {
          const fromForm = (invoiceDetails.invoice_number || "").trim();
          if (fromForm) return fromForm;
          const sn = (activeSummary?.invoice_number || "").trim();
          if (sn) return sn;
          return `Invoice ${activeIndex >= 0 ? activeIndex + 1 : 1}`;
        })();

  const normalizedInvoiceStatus = (invoiceDetails.status ?? "").trim().toLowerCase();
  const shouldRenderSendInvoiceButton =
    canManageInvoiceWisePayments &&
    hasPersistedInvoices &&
    (["draft", "issued"].includes(normalizedInvoiceStatus) || holdSendButtonVisible);
  const lineItems = (formData.invoiceLineItems ?? []) as InvoiceLineItemForm[];
  const invoiceCurrencyCode = (invoiceDetails.currency || "USD").trim().toUpperCase();
  const currencyMatchedDeliverables = deliverables.filter((d: any) => {
    if (!d?.id) return false;
    const cur = (d?.currency || "USD").trim().toUpperCase();
    return cur === invoiceCurrencyCode;
  });
  const taxSelectionValue = (() => {
    if (lineItems.length === 0) return "out_of_scope";
    const first = lineItems[0];
    const firstValue =
      first.tax_status === "taxable" && first.tax_name && Number(first.tax_rate_bps) > 0
        ? TAX_DROPDOWN_OPTIONS.find(
            (o) =>
              o.taxStatus === "taxable" &&
              o.taxName === first.tax_name &&
              Number(o.taxRateBps) === Number(first.tax_rate_bps)
          )?.value
        : first.tax_status;
    if (!firstValue) return "out_of_scope";
    const same = lineItems.every((row) => {
      const rowValue =
        row.tax_status === "taxable" && row.tax_name && Number(row.tax_rate_bps) > 0
          ? TAX_DROPDOWN_OPTIONS.find(
              (o) =>
                o.taxStatus === "taxable" &&
                o.taxName === row.tax_name &&
                Number(o.taxRateBps) === Number(row.tax_rate_bps)
            )?.value
          : row.tax_status;
      return rowValue === firstValue;
    });
    return same ? firstValue : "__mixed__";
  })();

  async function handleSendInvoice() {
    if (!shouldRenderSendInvoiceButton) return;
    const vendorEmail = (vendorInfo.vendor_email ?? "").trim();
    if (!vendorEmail) {
      wallsToast.error("Missing vendor email", "Add a Vendor email in Vendor details before sending the invoice.");
      return;
    }

    try {
      setInvoiceSendLoading(true);
      const lineItems = ((formData.invoiceLineItems ?? []) as InvoiceLineItemForm[]).map((row) => ({
        title: row.title,
        description: row.description ?? null,
        quantity: Number(row.quantity) || 0,
        unit_price_cents: Number(row.unit_price_cents) || 0,
        total_cents: Number(row.total_cents) || 0,
        tax_rate_bps: Math.max(0, Math.round(Number(row.tax_rate_bps) || 0)),
        tax_name: row.tax_name != null && String(row.tax_name).trim() ? String(row.tax_name).trim() : null,
      }));
      const pdfResponse = await fetch("/api/invoice/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealName,
          invoiceNumber: invoiceDetails.invoice_number,
          issueDate: invoiceDetails.issue_date,
          dueDate: invoiceDetails.due_date,
          netTerm: invoiceDetails.net_term,
          currency: invoiceDetails.currency,
          totalAmountCents: displayTotalCents,
          vendor: vendorInfo,
          lineItems,
          deliverables: formData.deliverables ?? [],
        }),
      });
      const pdfJson = await pdfResponse.json().catch(() => ({}));
      if (!pdfResponse.ok || !Array.isArray(pdfJson?.data)) {
        throw new Error(pdfJson?.error || pdfJson?.details || "Could not generate invoice PDF attachment.");
      }

      const invoiceAttachment = {
        name: typeof pdfJson.name === "string" ? pdfJson.name : "invoice.pdf",
        type: typeof pdfJson.type === "string" ? pdfJson.type : "application/pdf",
        data: pdfJson.data as number[],
      };

      const response = await fetch("/api/gmail/send/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorEmail,
          invoiceNumber: invoiceDetails.invoice_number,
          dueDate: invoiceDetails.due_date,
          amount: displayTotalCents / 100,
          currency: invoiceDetails.currency,
          companyName: vendorInfo.legal_name || dealName,
          attachments: [invoiceAttachment],
          invoiceId: activeInvoiceId || undefined,
          dealId: dealId ?? undefined,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
        invoiceStatusUpdated?: boolean;
      };
      if (!response.ok) {
        throw new Error(json?.error || json?.details || "Failed to send invoice");
      }

      onInvoiceEmailSent?.({ dbStatusUpdated: json.invoiceStatusUpdated === true });

      wallsToast.success("Invoice sent", `Sent invoice email to ${vendorEmail}.`);
      setInvoiceSendSuccess(true);
      setHoldSendButtonVisible(true);
      if (invoiceSendSuccessTimeoutRef.current != null) {
        window.clearTimeout(invoiceSendSuccessTimeoutRef.current);
      }
      invoiceSendSuccessTimeoutRef.current = window.setTimeout(() => {
        setInvoiceSendSuccess(false);
        setHoldSendButtonVisible(false);
      }, 2100);
    } catch (error: any) {
      wallsToast.error("Failed to send invoice", error?.message || "Please try again.");
    } finally {
      setInvoiceSendLoading(false);
    }
  }

  async function handleDownloadPdf() {
    if (invoiceDownloadLoading) return;
    setInvoiceDownloadLoading(true);
    try {
      await onDownloadPdf();
    } finally {
      setInvoiceDownloadLoading(false);
    }
  }

  async function handleCopyShareLink() {
    if (!activePublicToken) {
      wallsToast.error("No share link yet", "This invoice does not have a public token yet.");
      return;
    }
    const origin = window.location.origin;
    const shareUrl = `${origin}/invoice/${activePublicToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      wallsToast.success("Share link copied", shareUrl);
    } catch {
      wallsToast.error("Could not copy link", "Please copy the URL manually from your browser.");
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (invoiceDropdownRef.current && !invoiceDropdownRef.current.contains(e.target as Node)) {
        setInvoiceDropdownOpen(false);
      }
    }
    if (invoiceDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [invoiceDropdownOpen]);

  useEffect(() => {
    setInvoiceDropdownOpen(false);
  }, [activeInvoiceId, invoiceSummaries.length]);

  useEffect(() => {
    return () => {
      if (invoiceSendSuccessTimeoutRef.current != null) {
        window.clearTimeout(invoiceSendSuccessTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-gray-50 rounded-[30px] p-6 overflow-visible">
      <div
        className={`flex flex-wrap items-center gap-2 sm:gap-3 ${invoiceDetailsPanelMode !== "hidden" ? "mb-6" : "mb-0"}`}
      >
        {invoiceSummaries.length === 0 ? (
          <h2 className="text-black font-black text-4xl shrink-0">INVOICE DETAILS</h2>
        ) : invoiceSummaries.length === 1 ? (
          <h2 className="text-black font-black text-4xl shrink-0 min-w-0 truncate">{headlineInvoiceLabel}</h2>
        ) : (
          <div className="relative z-20 min-w-0 shrink" ref={invoiceDropdownRef}>
            <button
              type="button"
              onClick={() => setInvoiceDropdownOpen((o) => !o)}
              disabled={invoiceSyncLoading}
              className={cn(
                "inline-flex items-center gap-1.5 min-w-0 max-w-full rounded-none border-0 bg-transparent p-0 shadow-none",
                "text-black font-black text-4xl text-left",
                "hover:text-neutral-800 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                invoiceSyncLoading && "pointer-events-none opacity-60"
              )}
              aria-expanded={invoiceDropdownOpen}
              aria-haspopup="listbox"
              aria-label="Select invoice"
            >
              <span className="truncate">{headlineInvoiceLabel}</span>
              <ChevronDown
                className={cn(
                  "h-6 w-6 shrink-0 text-neutral-600 transition-transform duration-200",
                  invoiceDropdownOpen && "rotate-180"
                )}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
            {invoiceDropdownOpen && (
              <div
                className="absolute top-full left-0 z-[60] mt-1.5 max-h-[min(60vh,20rem)] min-w-[min(100%,12rem)] max-w-[min(calc(100vw-2rem),22rem)] overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
                role="listbox"
              >
                {invoiceSummaries.map((inv, i) => {
                  const label = inv.invoice_number?.trim() ? inv.invoice_number : `Invoice ${i + 1}`;
                  const selected = inv.id === activeInvoiceId;
                  const issue = formatSummaryDate(
                    selected ? invoiceDetails.issue_date || inv.issue_date : inv.issue_date
                  );
                  const due = formatSummaryDate(
                    selected ? invoiceDetails.due_date || inv.due_date : inv.due_date
                  );
                  const cur = selected ? invoiceDetails.currency : inv.currency;
                  const amountStr = formatSummaryAmount(
                    selected ? displayTotalCents : inv.total_amount_cents,
                    cur
                  );
                  const currencyCode = summaryCurrencyCode(cur);
                  const rawStatus = (selected ? invoiceDetails.status : inv.status) ?? "";
                  const statusLabel = invoiceStatusLabel(rawStatus);
                  const statusDot = invoiceStatusDotClass(rawStatus);
                  const draftLinkCount = (formData.invoicePayments ?? []).filter(
                    (p: InvoicePaymentForm) => (p.transaction_id ?? "").trim() !== ""
                  ).length;
                  const linkCount = selected
                    ? draftLinkCount
                    : (inv.linked_wise_transaction_count ?? 0);
                  const showLinked = linkCount > 0;
                  const linkedLabel =
                    linkCount <= 1 ? "Linked" : `Linked (${linkCount})`;
                  return (
                    <button
                      type="button"
                      key={inv.id}
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        void onInvoiceSwitch(inv.id);
                        setInvoiceDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 text-left text-sm transition-colors",
                        selected ? "bg-neutral-100 text-neutral-900" : "text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5 text-xs font-light text-neutral-600">
                        <span
                          className={cn(
                            "size-1 shrink-0 rounded-full",
                            statusDot
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 shrink truncate">{statusLabel}</span>
                        {showLinked ? (
                          <>
                            <span className="shrink-0 text-neutral-500" aria-hidden>
                              {" · "}
                            </span>
                            <span
                              className="flex shrink-0 items-center gap-1"
                              title="Linked to a Wise ledger transaction"
                            >
                              <img
                                src={WISE_VERIFIED_LOGO_URL}
                                alt=""
                                className="h-2.5 w-auto shrink-0 object-contain opacity-90"
                                aria-hidden
                              />
                              {linkedLabel}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex w-full min-w-0 items-baseline gap-x-1">
                        <span className="min-w-0 shrink truncate font-light">{label}</span>
                        <span className="shrink-0 whitespace-nowrap font-light tabular-nums text-neutral-600">
                          · {amountStr} {currencyCode}
                        </span>
                      </div>
                      <span className="mt-0.5 block truncate text-xs font-light text-neutral-500">
                        Issued: {issue} · Due: {due}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="hidden min-[520px]:block flex-1 border-t border-black h-[1px] mx-1 min-w-[24px]" />
        {invoiceSummaries.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className={`${invoiceGhostActionButtonClass} order-2 min-[520px]:order-none`}
            onClick={() => {
              void onCreateNewInvoice();
            }}
            disabled={invoiceSyncLoading || !dealId || !selectedCompanyId}
          >
            <div className="relative">
              <div className={invoiceGhostActionButtonInnerClass}>
                <Plus className="h-[18px] w-[18px] shrink-0 stroke-[1.5] text-neutral-600" />
                <span>New invoice</span>
              </div>
            </div>
          </Button>
        ) : null}
        <AnimatePresence initial={false}>
          {shouldRenderSendInvoiceButton ? (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <Button
                type="button"
                variant="ghost"
                className={`${invoiceGhostActionButtonClass} order-2 min-[520px]:order-none`}
                onClick={() => {
                  void handleSendInvoice();
                }}
                disabled={invoiceSendLoading || invoiceSyncLoading}
              >
                <div className="relative">
                  <div className={invoiceGhostActionButtonInnerClass}>
                    <AnimatePresence mode="wait" initial={false}>
                      {invoiceSendLoading ? (
                        <motion.span
                          key="sending"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ duration: 0.16 }}
                          className="inline-flex"
                        >
                          <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin stroke-[1.5] text-neutral-500" />
                        </motion.span>
                      ) : invoiceSendSuccess ? (
                        <motion.span
                          key="sent-success"
                          initial={{ opacity: 0, scale: 0.82, y: 1 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -1 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="inline-flex"
                        >
                          <Check className="h-[18px] w-[18px] shrink-0 stroke-[2] text-emerald-600" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="send-default"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ duration: 0.16 }}
                          className="inline-flex"
                        >
                          <Send className="h-[18px] w-[18px] shrink-0 stroke-[1.5] text-neutral-600" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span>Send invoice</span>
                  </div>
                </div>
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {hasPersistedInvoices ? (
          <Button
            type="button"
            variant="ghost"
            className={`${invoiceGhostActionButtonClass} order-2 min-[520px]:order-none`}
            onClick={() => {
              void handleDownloadPdf();
            }}
            disabled={invoiceDownloadLoading || invoiceSyncLoading}
          >
            <div className="relative">
              <div className={invoiceGhostActionButtonInnerClass}>
                {invoiceDownloadLoading ? (
                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin stroke-[1.5] text-neutral-500" />
                ) : (
                  <FileDown className="h-[18px] w-[18px] shrink-0 stroke-[1.5] text-neutral-600" />
                )}
                <span>Download invoice</span>
              </div>
            </div>
          </Button>
        ) : null}
        {invoiceSummaries.length === 0 ? (
          <Button
            type="button"
            variant="ghost"
            className={`${invoiceGhostActionButtonClass} ml-auto sm:ml-0`}
            onClick={() => {
              void onGenerateInvoice();
            }}
            disabled={invoiceSyncLoading || !dealId || !selectedCompanyId}
          >
            <div className="relative">
              <div className={invoiceGhostActionButtonInnerClass}>
                {invoiceSyncLoading ? (
                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin stroke-[1.5] text-neutral-500" />
                ) : (
                  <FilePlus className="h-[18px] w-[18px] shrink-0 stroke-[1.5] text-neutral-600" />
                )}
                <span>{invoiceSyncLoading ? "Generating…" : "Generate invoice"}</span>
              </div>
            </div>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                disabled={invoiceSyncLoading}
                className={`${invoiceGhostActionButtonClass} ml-auto sm:ml-0`}
                aria-label="Invoice options"
              >
                <div className="relative">
                  <div
                    className={cn(
                      invoiceGhostActionButtonInnerClass,
                      "size-9 shrink-0 items-center justify-center gap-0 p-0"
                    )}
                  >
                    {invoiceSyncLoading ? (
                      <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin stroke-[1.5] text-neutral-500" />
                    ) : (
                      <MoreVertical className="h-[18px] w-[18px] shrink-0 stroke-[1.5] text-neutral-600" />
                    )}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[10rem] rounded-2xl border-neutral-200/80 p-1.5 shadow-lg"
            >
              <DropdownMenuItem
                className="rounded-lg text-sm font-light"
                onSelect={() => onSelectInvoicePanel("preview")}
              >
                {invoiceDetailsPanelMode === "preview"
                  ? "Hide invoice preview"
                  : "View invoice preview"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-lg text-sm font-light"
                onSelect={() => onSelectInvoicePanel("details")}
              >
                {invoiceDetailsPanelMode === "details"
                  ? "Hide invoice details"
                  : "View invoice details"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-lg text-sm font-light"
                onSelect={() => {
                  void handleCopyShareLink();
                }}
              >
                Copy share link
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-lg text-sm font-light text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={() => {
                  onDeleteCurrentInvoice();
                }}
              >
                Delete invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AnimatePresence initial={false}>
        {invoiceDetailsPanelMode === "details" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div>
                  <label className={labelClass}>Status</label>
                  <Select value={invoiceDetails.status} onValueChange={(value) => onUpdateInvoiceField("status", value)}>
                    <SelectTrigger className={invoiceSelectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {invoiceStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {invoiceStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={labelClass}>Tax (all line items)</label>
                  <Select
                    value={taxSelectionValue}
                    onValueChange={onApplyTaxToAllLineItems}
                    disabled={lineItems.length === 0}
                  >
                    <SelectTrigger className={invoiceSelectTriggerClass}>
                      <SelectValue placeholder="Select tax treatment" />
                    </SelectTrigger>
                    <SelectContent>
                      {taxSelectionValue === "__mixed__" ? (
                        <SelectItem value="__mixed__" disabled>
                          Mixed tax values (select one to unify)
                        </SelectItem>
                      ) : null}
                      {TAX_DROPDOWN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {taxRecommendation &&
                  lineItems.length > 0 &&
                  taxSelectionValue !== taxRecommendation.dropdownValue ? (
                    <div className="mt-2 space-y-1">
                      <p
                        className={cn(
                          "text-xs leading-snug",
                          taxRecommendation.applies ? "text-neutral-600" : "text-neutral-400"
                        )}
                      >
                        <span className="font-medium text-neutral-700">Recommended:</span>{" "}
                        {taxRecommendation.applies
                          ? `${taxRecommendation.label}. ${taxRecommendation.reason}`
                          : taxRecommendation.reason}
                      </p>
                      {taxRecommendation.applies &&
                      taxSelectionValue !== "__mixed__" &&
                      onApplyRecommendedTax ? (
                        <button
                          type="button"
                          onClick={onApplyRecommendedTax}
                          className="text-xs font-medium text-[var(--kenoo-sky)] hover:underline"
                        >
                          Apply recommended tax
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <div className={cn(invoiceFieldWrapperClass, "flex min-h-10 items-end gap-0 pr-2")}>
                    <Select
                      value={invoiceDetails.currency}
                      onValueChange={(value) => onUpdateInvoiceField("currency", value)}
                    >
                      <SelectTrigger className="border-0 bg-transparent shadow-none h-10 w-[4rem] shrink-0 px-0 mr-2 focus:ring-0 focus-visible:ring-0 text-[15px] font-light text-foreground hover:bg-transparent [&>span]:text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {invoiceCurrencyOptions.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="w-px h-5 bg-neutral-200 shrink-0 self-center" />
                    <div className="flex min-w-0 flex-1 items-end pl-2">
                      <BorderlessInput
                        value={(displayTotalCents / 100).toFixed(2)}
                        readOnly
                        aria-readonly="true"
                        tabIndex={-1}
                        className={cn(
                          invoiceInputInnerClass,
                          "cursor-not-allowed select-none text-neutral-400 placeholder:text-neutral-300"
                        )}
                      />
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                        Total from line items
                      </span>
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                  <div>
                    <label className={labelClass}>Issue date</label>
                    <Popover open={issuePopoverOpen} onOpenChange={setIssuePopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(invoiceDateButtonClass, "h-10")}
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
                            <span className="text-gray-500 text-sm shrink-0">Issue:</span>
                            <span
                              className={cn(
                                "text-[15px] font-light truncate min-w-0",
                                invoiceDetails.issue_date ? "text-foreground" : "text-gray-500"
                              )}
                            >
                              {invoiceDetails.issue_date
                                ? format(parseDateValue(invoiceDetails.issue_date) ?? new Date(), "MMM d, yyyy")
                                : "Select date"}
                            </span>
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                        align="start"
                      >
                        <MiniCalendar
                          selected={parseDateValue(invoiceDetails.issue_date)}
                          onSelect={(date) => {
                            if (!date) return;
                            onUpdateInvoiceField("issue_date", format(date, "yyyy-MM-dd"));
                            setIssuePopoverOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className={labelClass}>Due date</label>
                    <Popover open={duePopoverOpen} onOpenChange={setDuePopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(invoiceDateButtonClass, "h-10")}
                        >
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-gray-500 shrink-0" />
                            <span className="text-gray-500 text-sm shrink-0">Due:</span>
                            <span
                              className={cn(
                                "text-[15px] font-light truncate min-w-0",
                                invoiceDetails.due_date ? "text-foreground" : "text-gray-500"
                              )}
                            >
                              {invoiceDetails.due_date
                                ? format(parseDateValue(invoiceDetails.due_date) ?? new Date(), "MMM d, yyyy")
                                : "Select date"}
                            </span>
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                        align="start"
                      >
                        <MiniCalendar
                          selected={parseDateValue(invoiceDetails.due_date)}
                          onSelect={(date) => {
                            if (!date) return;
                            onUpdateInvoiceField("due_date", format(date, "yyyy-MM-dd"));
                            setDuePopoverOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className={labelClass}>Net term (days)</label>
                    <div className={cn(invoiceFieldWrapperClass, "flex min-h-10 items-end")}>
                      <BorderlessInput
                        type="number"
                        min={0}
                        value={String(invoiceDetails.net_term)}
                        onChange={(e) => onUpdateInvoiceField("net_term", Number(e.target.value || 0))}
                        className={invoiceInputInnerClass}
                      />
                    </div>
                  </div>
                </div>
                {canManageInvoiceWisePayments ? (
                  <div className="sm:col-span-3 mt-6 border-t border-neutral-200 pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
                          Wise payments
                        </p>
                        <p className="mt-1 text-xs font-light text-neutral-500">
                          Search synced Wise ledger transactions and link them to this invoice. Save to database to
                          persist.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={onAddInvoicePayment}
                        disabled={invoiceSyncLoading || !(formData as any)._invoiceId}
                        className={invoiceGhostActionButtonClass}
                      >
                        <div className="relative">
                          <div className={invoiceGhostActionButtonInnerClass}>
                            <Plus className="h-[18px] w-[18px] shrink-0 stroke-[1.5] text-neutral-600" />
                            <span>Add payment</span>
                          </div>
                        </div>
                      </Button>
                    </div>
                    {(formData.invoicePayments ?? []).length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {(formData.invoicePayments ?? []).map((pay: InvoicePaymentForm, payIndex: number) => {
                          const meta = formatWisePaymentMeta(pay);
                          return (
                            <div
                              key={`inv-pay-${payIndex}-${pay.id ?? "new"}`}
                              className="rounded-2xl border border-neutral-200/60 bg-neutral-50/50 p-4"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-light text-neutral-500">Wise transaction</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onRemoveInvoicePayment(payIndex)}
                                  className="h-8 w-8 shrink-0 text-neutral-500 hover:text-destructive"
                                  aria-label="Remove payment link"
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                </Button>
                              </div>
                              <label className={labelClass}>Search transaction</label>
                              <WiseTransactionSearch
                                value={pay.transaction_id ?? ""}
                                disabled={invoiceSyncLoading || !(formData as any)._invoiceId}
                                excludeWiseRowIds={(formData.invoicePayments ?? [])
                                  .map((p: InvoicePaymentForm, i: number) =>
                                    i !== payIndex && (p.transaction_id ?? "").trim()
                                      ? String(p.transaction_id).trim()
                                      : null
                                  )
                                  .filter((x): x is string => Boolean(x))}
                                onSelect={(row) =>
                                  onUpdateInvoicePayment(payIndex, {
                                    transaction_id: row.id,
                                    wise_transaction_id: row.wise_transaction_id,
                                    amount: row.amount,
                                    currency: row.currency,
                                    wise_created_at: row.wise_created_at,
                                    type: row.type,
                                    merchant_name: row.merchant_name,
                                  })
                                }
                              />
                              {meta ? (
                                <p className="mt-2 text-xs font-light text-neutral-600">{meta}</p>
                              ) : (
                                <p className="mt-2 text-xs font-light text-neutral-400">
                                  Use search above to pick a synced transaction (amount and date fill in automatically).
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="sm:col-span-3 mt-6 border-t border-neutral-200 pt-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">Line items</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void onPersistInvoice();
                        }}
                        disabled={invoiceSyncLoading || !(formData as any)._invoiceId}
                        className="h-9 shrink-0 rounded-xl border-neutral-200/70 bg-transparent text-xs font-light"
                      >
                        Save to database
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onAddLineItem}
                        className="h-9 shrink-0 rounded-xl border-neutral-200/70 bg-transparent text-xs font-light"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                        Add line
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    {(formData.invoiceLineItems ?? []).length > 0 ? (
                      <table className="w-full table-fixed text-sm">
                        <colgroup>
                          <col className="w-[7%]" />
                          <col className="w-[22%]" />
                          <col className="w-[37%]" />
                          <col className="w-[5%]" />
                          <col className="w-[11%]" />
                          <col className="w-[14%]" />
                          <col className="w-[4%]" />
                        </colgroup>
                        <thead className="border-b border-neutral-200">
                          <tr>
                            <th className={lineItemHeaderClass}>Link</th>
                            <th className={lineItemHeaderClass}>Title</th>
                            <th className={lineItemHeaderClass}>Description</th>
                            <th className={lineItemHeaderClass}>Qty</th>
                            <th className={lineItemHeaderClass}>Unit Price</th>
                            <th className={lineItemHeaderClass}>Total</th>
                            <th className="w-10 pb-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {(formData.invoiceLineItems ?? []).map((row: InvoiceLineItemForm, index: number) => (
                            <tr
                              key={`invoice-line-${index}-${row.deal_deliverable_id ?? "custom"}`}
                              className="border-b border-neutral-100"
                            >
                              <td className="py-4 pr-2">
                                <Select
                                  value={row.deal_deliverable_id ?? "__none__"}
                                  onValueChange={(v) => onApplyDeliverableToLine(index, v)}
                                >
                                  <SelectTrigger className="w-auto min-w-0 h-auto border-0 bg-transparent shadow-none px-0 py-0 hover:bg-transparent focus:ring-0 focus-visible:ring-0 [&>svg]:hidden">
                                    <SelectValue asChild>
                                      <span
                                        className={cn(
                                          "text-xs font-light underline underline-offset-4 decoration-dotted cursor-pointer",
                                          row.deal_deliverable_id
                                            ? "text-[var(--kenoo-sky)]"
                                            : "text-neutral-400"
                                        )}
                                        title={lineItemDeliverableLabel(deliverables, row.deal_deliverable_id)}
                                      >
                                        {row.deal_deliverable_id ? "Linked" : "Unlinked"}
                                      </span>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Unlinked</SelectItem>
                                    {currencyMatchedDeliverables
                                      .map((d: any) => (
                                        <SelectItem key={d.id} value={d.id}>
                                          {d.name || "Deliverable"}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-4 pr-3">
                                <div className={invoiceFieldWrapperClass}>
                                  <BorderlessInput
                                    value={row.title}
                                    onChange={(e) => onUpdateLineItem(index, { title: e.target.value })}
                                    className={invoiceInputInnerClass}
                                    placeholder="Line title"
                                  />
                                </div>
                              </td>
                              <td className="py-4 pr-4">
                                <div className={invoiceFieldWrapperClass}>
                                  <BorderlessInput
                                    value={row.description ?? ""}
                                    onChange={(e) =>
                                      onUpdateLineItem(index, { description: e.target.value || null })
                                    }
                                    className={invoiceInputInnerClass}
                                    placeholder="Optional description"
                                  />
                                </div>
                              </td>
                              <td className="py-4 pr-3">
                                <div className={invoiceFieldWrapperClass}>
                                  <BorderlessInput
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={String(row.quantity)}
                                    onChange={(e) =>
                                      onUpdateLineItem(index, {
                                        quantity: Number(e.target.value) || 0,
                                      })
                                    }
                                    className={invoiceInputInnerClass}
                                  />
                                </div>
                              </td>
                              <td className="py-4 pr-4">
                                <div className={invoiceFieldWrapperClass}>
                                  <BorderlessInput
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={String((Number(row.unit_price_cents) || 0) / 100)}
                                    onChange={(e) =>
                                      onUpdateLineItem(index, {
                                        unit_price_cents: Math.round(
                                          (Number.parseFloat(e.target.value) || 0) * 100
                                        ),
                                      })
                                    }
                                    className={invoiceInputInnerClass}
                                    placeholder="0.00"
                                  />
                                </div>
                              </td>
                              <td className="py-4 pr-4">
                                <div className={invoiceFieldWrapperClass}>
                                  <BorderlessInput
                                    value={`${(lineItemTotalWithTaxCents(row) / 100).toFixed(2)} ${invoiceDetails.currency}`}
                                    readOnly
                                    aria-readonly="true"
                                    tabIndex={-1}
                                    className={cn(
                                      invoiceInputInnerClass,
                                      "cursor-not-allowed select-none text-neutral-400"
                                    )}
                                  />
                                </div>
                              </td>
                              <td className="py-4 pr-1 w-10">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0 text-neutral-500 hover:text-neutral-700 hover:bg-transparent"
                                      aria-label="Line item actions"
                                    >
                                      <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="min-w-[140px]">
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                      onClick={() => onRemoveLineItem(index)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                  </div>
                  {(formData.invoiceLineItems ?? []).length === 0 && (
                    <p className="mt-3 text-sm font-light text-muted-foreground">
                      No line items yet. They will populate from deal deliverables when available, or use Add line.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {hasPersistedInvoices ? (
        <div className={cn("mt-6", invoiceDetailsPanelMode !== "preview" && "hidden")}>
          <InvoicePreview
            ref={invoicePreviewRef}
            embedded
            hideToolbar
            vendorInfo={vendorInfo}
            dealName={dealName}
            invoice={{
              invoice_number: invoiceDetails.invoice_number,
              issue_date: invoiceDetails.issue_date,
              due_date: invoiceDetails.due_date,
              net_term: invoiceDetails.net_term,
              currency: invoiceDetails.currency,
              total_amount_cents: invoiceDetails.total_amount_cents,
              company_id:
                (formData.invoiceDetails as { company_id?: string } | undefined)?.company_id ??
                selectedCompanyId ??
                null,
            }}
            invoiceLineItems={(formData.invoiceLineItems ?? []) as InvoicePreviewLine[]}
            deliverables={
              (formData.deliverables ?? []) as {
                name: string;
                description?: string | null;
                quantity: number;
                unit_price_cents: number;
                currency: string;
              }[]
            }
            {...derivedDates}
          />
        </div>
      ) : null}
    </div>
  );
}
