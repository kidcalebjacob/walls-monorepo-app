import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePdfJson, type InvoicePdfRequestPayload } from "@/lib/invoice/invoice-pdf-from-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await req.json()) as InvoicePdfRequestPayload;
    const pdfJson = await generateInvoicePdfJson(payload);
    return NextResponse.json(pdfJson);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Failed to build invoice PDF:", error);
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
