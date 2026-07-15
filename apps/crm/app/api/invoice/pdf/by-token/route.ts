import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInvoicePdfJson, type InvoicePdfRequestPayload } from "@/lib/invoice/invoice-pdf-from-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 10) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select(
        "id, status, invoice_number, issue_date, due_date, net_term, total_amount_cents, currency, company_id, deal_id, deal:deals!invoices_deal_id_fkey(deal_name)"
      )
      .eq("public_token", token)
      .maybeSingle();

    if (invErr || !invoice || invoice.status === "void") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: lineRows } = await supabase
      .from("invoice_line_items")
      .select("title, description, quantity, unit_price_cents, total_cents, tax_rate_bps, tax_name")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true });

    const { data: vendorInfo } = await supabase
      .from("companies_vendor_information")
      .select("legal_name, address, city, state, post_code, country, vendor_email")
      .eq("company_id", invoice.company_id)
      .maybeSingle();

    const rawDeal = (invoice as { deal?: { deal_name?: string | null } | { deal_name?: string | null }[] | null })
      .deal;
    const dealRow = Array.isArray(rawDeal) ? rawDeal[0] : rawDeal;
    const dealName = dealRow?.deal_name?.trim() ?? "";

    const lineItems = (lineRows ?? []).map((r: Record<string, unknown>) => ({
      title: r.title as string | undefined,
      description: (r.description as string | null) ?? null,
      quantity: Number(r.quantity) || 0,
      unit_price_cents: Number(r.unit_price_cents) || 0,
      total_cents: Number(r.total_cents) || 0,
      tax_rate_bps: Math.max(0, Math.round(Number(r.tax_rate_bps) || 0)),
      tax_name: r.tax_name != null && String(r.tax_name).trim() ? String(r.tax_name).trim() : null,
    }));

    const payload: InvoicePdfRequestPayload = {
      dealName,
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      netTerm: invoice.net_term,
      currency: invoice.currency,
      totalAmountCents:
        invoice.total_amount_cents != null && !Number.isNaN(Number(invoice.total_amount_cents))
          ? Math.round(Number(invoice.total_amount_cents))
          : undefined,
      vendor: vendorInfo
        ? {
            legal_name: vendorInfo.legal_name ?? undefined,
            address: vendorInfo.address ?? undefined,
            city: vendorInfo.city ?? undefined,
            state: vendorInfo.state ?? undefined,
            post_code: vendorInfo.post_code ?? undefined,
            country: vendorInfo.country ?? undefined,
            vendor_email: vendorInfo.vendor_email ?? undefined,
          }
        : undefined,
      lineItems,
    };

    const pdfJson = await generateInvoicePdfJson(payload);
    return NextResponse.json(pdfJson);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Public invoice PDF failed:", error);
    const hint =
      /browser|chromium|executable/i.test(String(err?.message ?? ""))
        ? " Run once from the project root: yarn playwright:install (or: yarn playwright install chromium)"
        : "";
    return NextResponse.json(
      {
        error: "Failed to build invoice PDF",
        details: `${err?.message ?? "Unknown error"}${hint}`,
      },
      { status: 500 }
    );
  }
}
