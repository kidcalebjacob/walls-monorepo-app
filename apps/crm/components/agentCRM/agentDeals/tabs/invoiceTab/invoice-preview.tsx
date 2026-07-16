"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import Image from "next/image";
import { forwardRef, useCallback, useImperativeHandle, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { emptyVendorInfo } from "./invoice-vendor-shared";
import "./invoice-preview.css";
import { getPaymentInstructionsForCurrency } from "./invoice-payment-instructions";
import {
  formatIsoDate,
  formatMoney,
  INVOICE_PRINT_LOGO_URL,
  lineTotalCents,
  taxTotalsLabelFromPrintLines,
  totalTaxCentsFromPrintLines,
  type NormalizedInvoicePrintLine as NormalizedPreviewLine,
} from "./invoice-print-document-html";

export type InvoicePreviewHandle = {
  downloadPdf: () => Promise<void>;
};

interface DeliverableRow {
  name: string;
  description?: string | null;
  quantity: number;
  unit_price_cents: number;
  currency: string;
}

/** Matches `invoice_line_items` / form draft rows used in the preview table. */
export type InvoicePreviewLine = {
  title: string;
  description?: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  tax_rate_bps?: number;
  tax_name?: string | null;
};

/** Matches `invoices` header fields (or form draft of the same shape). */
export type InvoicePreviewInvoice = {
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  net_term?: number;
  currency?: string;
  total_amount_cents?: number;
  company_id?: string | null;
};

interface InvoicePreviewProps {
  /** Vendor (Bill To) address block — from `companies_vendor_information` for the selected company. */
  vendorInfo?: {
    legal_name: string;
    city: string;
    state: string;
    country: string;
    address: string;
    post_code: string;
    vendor_email?: string | null;
  };
  /** `invoices.company_id` — used to load `companies.name` for Bill To heading. */
  invoice?: InvoicePreviewInvoice | null;
  /** `invoice_line_items` (or form draft). When empty, `deliverables` are shown for UX only. */
  invoiceLineItems?: InvoicePreviewLine[];
  /** Fallback line presentation from deal deliverables before invoice rows exist. */
  deliverables?: DeliverableRow[];
  dealName?: string;
  /** Legacy fallbacks when `invoice` omits display-ready strings */
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  netTerm?: string;
  /** When true, blends into parent card (no outer ring; flush bottom radius). */
  embedded?: boolean;
  /** Hide built-in toolbar (e.g. when parent renders Download). */
  hideToolbar?: boolean;
  /** Public page: warm paper stock with texture; shadow comes from parent wrapper. */
  appearance?: "default" | "paper";
}

const InvoicePreview = forwardRef<InvoicePreviewHandle, InvoicePreviewProps>(function InvoicePreview(
  {
    vendorInfo = emptyVendorInfo,
    invoice = null,
    invoiceLineItems = [],
    deliverables = [],
    dealName = "",
    invoiceNumber = "—",
    issueDate = "—",
    dueDate = "—",
    netTerm,
    embedded = false,
    hideToolbar = false,
    appearance = "default",
  },
  ref
) {
  const isPaper = appearance === "paper";
  const previewLines = useMemo((): NormalizedPreviewLine[] => {
    const invCurrency = invoice?.currency?.trim() || "USD";
    const rows = invoiceLineItems ?? [];
    if (rows.length > 0) {
      return rows.map((r) => ({
        title: (r.title ?? "").trim() || "—",
        description: r.description ?? null,
        quantity: Number(r.quantity) || 0,
        unit_price_cents: Number(r.unit_price_cents) || 0,
        total_cents:
          r.total_cents != null && !Number.isNaN(Number(r.total_cents))
            ? Number(r.total_cents)
            : lineTotalCents(Number(r.quantity) || 0, Number(r.unit_price_cents) || 0),
        currency: invCurrency,
        tax_rate_bps: Math.max(0, Math.round(Number(r.tax_rate_bps) || 0)),
        tax_name: r.tax_name != null && String(r.tax_name).trim() ? String(r.tax_name).trim() : null,
      }));
    }
    return (deliverables ?? []).map((d) => {
      const qty = Number(d.quantity) || 0;
      const unit = Number(d.unit_price_cents) || 0;
      return {
        title: (d.name ?? "").trim() || "—",
        description: d.description ?? null,
        quantity: qty,
        unit_price_cents: unit,
        total_cents: lineTotalCents(qty, unit),
        currency: d.currency || invCurrency,
      };
    });
  }, [invoiceLineItems, deliverables, invoice?.currency]);

  const currency = invoice?.currency?.trim() || previewLines[0]?.currency || "USD";

  const paymentInstructions = useMemo(() => getPaymentInstructionsForCurrency(currency), [currency]);

  const subtotalCents = useMemo(() => {
    if (previewLines.length > 0) {
      return previewLines.reduce((sum, row) => {
        const t =
          row.total_cents != null && !Number.isNaN(Number(row.total_cents))
            ? Number(row.total_cents)
            : lineTotalCents(row.quantity, row.unit_price_cents);
        return sum + t;
      }, 0);
    }
    const t = invoice?.total_amount_cents;
    if (t != null && !Number.isNaN(Number(t))) return Math.round(Number(t));
    return 0;
  }, [previewLines, invoice?.total_amount_cents]);

  const taxCents = useMemo(() => totalTaxCentsFromPrintLines(previewLines), [previewLines]);
  const taxTotalsLabel = useMemo(() => taxTotalsLabelFromPrintLines(previewLines), [previewLines]);
  const grandTotalCents = subtotalCents + taxCents;

  const invNumber =
    (invoice?.invoice_number && String(invoice.invoice_number).trim()) ||
    (invoiceNumber && invoiceNumber !== "—" ? String(invoiceNumber).trim() : "") ||
    "—";

  const issueDisplay =
    formatIsoDate(invoice?.issue_date) ?? (issueDate && issueDate !== "—" ? issueDate : "—");
  const dueDisplay = formatIsoDate(invoice?.due_date) ?? (dueDate && dueDate !== "—" ? dueDate : "—");

  const netTermStr =
    invoice?.net_term != null && !Number.isNaN(Number(invoice.net_term))
      ? `Net ${invoice.net_term}`
      : netTerm ?? "—";

  const billToLines = useMemo(() => {
    const lines: string[] = [];
    const legal = vendorInfo.legal_name?.trim();
    if (legal) lines.push(legal);
    if (vendorInfo.address?.trim()) lines.push(vendorInfo.address.trim());
    const cityLine = [vendorInfo.city, vendorInfo.state, vendorInfo.post_code]
      .filter(Boolean)
      .map((s) => String(s).trim())
      .join(", ");
    if (cityLine) lines.push(cityLine);
    if (vendorInfo.country?.trim()) lines.push(vendorInfo.country.trim());
    return lines.length ? lines : ["—"];
  }, [vendorInfo]);

  const handleDownloadPdf = useCallback(async () => {
    const invoiceNumberForApi =
      (invoice?.invoice_number && String(invoice.invoice_number).trim()) ||
      (invoiceNumber && invoiceNumber !== "—" ? String(invoiceNumber).trim() : "") ||
      undefined;
    const issueDateForApi =
      (invoice?.issue_date && String(invoice.issue_date).trim()) ||
      (issueDate && issueDate !== "—" ? String(issueDate).trim() : undefined);
    const dueDateForApi =
      (invoice?.due_date && String(invoice.due_date).trim()) ||
      (dueDate && dueDate !== "—" ? String(dueDate).trim() : undefined);
    const netTermForApi =
      invoice?.net_term != null && !Number.isNaN(Number(invoice.net_term))
        ? Number(invoice.net_term)
        : (() => {
            const s = netTerm?.trim();
            if (!s) return undefined;
            const m = s.match(/(\d+)/);
            return m ? Number(m[1]) : undefined;
          })();

    const lineItems = (invoiceLineItems ?? []).map((row) => ({
      title: row.title,
      description: row.description ?? null,
      quantity: Number(row.quantity) || 0,
      unit_price_cents: Number(row.unit_price_cents) || 0,
      total_cents: Number(row.total_cents) || 0,
      tax_rate_bps: Math.max(0, Math.round(Number(row.tax_rate_bps) || 0)),
      tax_name: row.tax_name != null && String(row.tax_name).trim() ? String(row.tax_name).trim() : null,
    }));

    const deliverablesPayload = (deliverables ?? []).map((d) => ({
      name: d.name,
      description: d.description ?? null,
      quantity: Number(d.quantity) || 0,
      unit_price_cents: Number(d.unit_price_cents) || 0,
      currency: d.currency,
    }));

    const totalAmountCents =
      invoice?.total_amount_cents != null && !Number.isNaN(Number(invoice.total_amount_cents))
        ? Math.round(Number(invoice.total_amount_cents))
        : subtotalCents + taxCents;

    try {
      const pdfResponse = await fetch("/api/invoice/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealName,
          invoiceNumber: invoiceNumberForApi,
          issueDate: issueDateForApi,
          dueDate: dueDateForApi,
          netTerm: netTermForApi,
          currency,
          totalAmountCents,
          vendor: vendorInfo,
          lineItems,
          deliverables: deliverablesPayload,
        }),
      });
      const pdfJson = (await pdfResponse.json().catch(() => ({}))) as {
        name?: string;
        type?: string;
        data?: number[];
        error?: string;
        details?: string;
      };
      if (!pdfResponse.ok || !Array.isArray(pdfJson?.data)) {
        throw new Error(pdfJson?.error || pdfJson?.details || "Could not generate invoice PDF.");
      }
      const bytes = new Uint8Array(pdfJson.data);
      const blob = new Blob([bytes], { type: typeof pdfJson.type === "string" ? pdfJson.type : "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = typeof pdfJson.name === "string" ? pdfJson.name : "invoice.pdf";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Please try again.";
      wallsToast.error("Download failed", message);
    }
  }, [
    dealName,
    invoice?.invoice_number,
    invoice?.issue_date,
    invoice?.due_date,
    invoice?.net_term,
    invoice?.total_amount_cents,
    invoiceNumber,
    issueDate,
    dueDate,
    netTerm,
    currency,
    subtotalCents,
    taxCents,
    vendorInfo,
    invoiceLineItems,
    deliverables,
  ]);

  useImperativeHandle(ref, () => ({ downloadPdf: handleDownloadPdf }), [handleDownloadPdf]);

  return (
    <div
      className={cn(
        "invoice-preview-root text-[#111] overflow-hidden",
        isPaper && "invoice-preview-paper",
        embedded
          ? "rounded-none rounded-b-[30px] border-0 border-t border-neutral-200/80 bg-white shadow-none -mx-6 -mb-6"
          : isPaper
            ? "rounded-[2px] border-0 bg-[#fdfcfa] shadow-none"
            : "bg-white rounded-[30px] border border-neutral-200 shadow-sm"
      )}
    >
      {!hideToolbar ? (
        <div className="ip-toolbar flex items-center justify-end gap-2 px-4 py-3 border-b border-neutral-200 bg-neutral-50/80">
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2">
            <FileDown className="h-4 w-4" />
            Download invoice
          </Button>
        </div>
      ) : null}
      <div className="ip-container">
        <div className="ip-header">
          <div className="ip-brand">
            <Image
              src={INVOICE_PRINT_LOGO_URL}
              alt="WALLS Logo"
              width={76}
              height={24}
              className="mb-3"
            />
            <small>Registered Office</small>
            <p>67 Walden Road SE</p>
            <p>Calgary, AB, T2X 0N6</p>
            <p>Canada</p>
            <p>
              <a href="mailto:ar@wallsentertainment.com" className="text-kenoo-sky hover:opacity-80 no-underline">
                ar@wallsentertainment.com
              </a>
            </p>
          </div>
          <div className="ip-meta">
            <h2>INVOICE</h2>
            <p>
              <strong>{invNumber}</strong>
            </p>
            <p>Issue Date: {issueDisplay}</p>
            <p>Due Date: {dueDisplay}</p>
            <p>NET Term: {netTermStr}</p>
          </div>
        </div>

        <div className="ip-billing">
          <div className="ip-block">
            <h3>Bill To</h3>
            {billToLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {vendorInfo?.vendor_email?.trim() ? (
              <p>
                <a
                  href={`mailto:${vendorInfo.vendor_email.trim()}`}
                  className="text-kenoo-sky no-underline hover:underline"
                >
                  {vendorInfo.vendor_email.trim()}
                </a>
              </p>
            ) : null}
          </div>
          <div className="ip-block">
            <h3>Project</h3>
            <p>{dealName || "—"}</p>
          </div>
        </div>

        <table className="ip-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="ip-right">Qty</th>
              <th className="ip-right">Unit Price</th>
              <th className="ip-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {previewLines.length === 0 ? (
              <tr>
                <td colSpan={4} className="ip-right text-[#777]">
                  No line items
                </td>
              </tr>
            ) : (
              previewLines.map((d, i) => {
                const qty = Number(d.quantity) || 0;
                const unitCents = Number(d.unit_price_cents) || 0;
                const amountCents =
                  d.total_cents != null && !Number.isNaN(Number(d.total_cents))
                    ? Number(d.total_cents)
                    : lineTotalCents(qty, unitCents);
                return (
                  <tr key={i}>
                    <td>
                      <div>{d.title || "—"}</div>
                      {d.description && String(d.description).trim() ? (
                        <div className="text-[10px] text-neutral-500 mt-0.5">{String(d.description).trim()}</div>
                      ) : null}
                    </td>
                    <td className="ip-right">{qty}</td>
                    <td className="ip-right">{formatMoney(unitCents, d.currency)}</td>
                    <td className="ip-right">{formatMoney(amountCents, d.currency)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="ip-totals">
          <div className="ip-totals-row">
            <span>Subtotal</span>
            <span>{formatMoney(subtotalCents, currency)}</span>
          </div>
          <div className="ip-totals-row">
            <span>{taxTotalsLabel}</span>
            <span>{formatMoney(taxCents, currency)}</span>
          </div>
          <div className="ip-totals-row ip-total">
            <span>Total</span>
            <span>
              {formatMoney(grandTotalCents, currency)} {currency}
            </span>
          </div>
        </div>

        <div id="payment-instructions" className="ip-payment scroll-mt-28">
          <h3>Payment Instructions ({currency})</h3>
          {paymentInstructions.rows.map((row, i) => (
            <div key={`pay-row-${i}`}>
              {row.label.trim() === "" ? (
                <p>{row.value}</p>
              ) : (
                <p>
                  <strong>{row.label}:</strong> {row.value}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="ip-footer">
          {taxCents > 0 ? <div>GST/HST Registration No.: 772171302RT0001</div> : null}
          <div>WALLS Entertainment Group Inc.</div>
        </div>
      </div>
    </div>
  );
});

export default InvoicePreview;
