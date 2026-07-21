import { NextResponse } from "next/server";

import {
  createCheckoutSession,
  getConfiguredKenooPlans,
  listKenooPlans,
} from "@walls/billing";

import { KENOO_PORTAL_URL } from "@/lib/urls";

type CheckoutBody = {
  plan?: string;
  priceId?: string;
  email?: string;
  quantity?: number;
  successUrl?: string;
  cancelUrl?: string;
  /** Optional account id when starting checkout from marketing with a known org */
  accountId?: string;
};

function absoluteUrl(request: Request, path: string): string {
  return new URL(path, new URL(request.url).origin).toString();
}

/**
 * Marketing / public checkout entry.
 * Creates a Stripe Checkout Session and returns `{ url }` to redirect the browser.
 *
 * Prefer authenticated checkout via Admin (`POST /api/billing/checkout`) when
 * the buyer already has a Kenoo account — that path attaches `account_id` metadata
 * and reuses the Stripe customer.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CheckoutBody;
  const planOrPriceId = (body.priceId || body.plan || "starter").trim();

  const successUrl =
    body.successUrl?.trim() ||
    `${KENOO_PORTAL_URL}/login?billing=success`;
  const cancelUrl =
    body.cancelUrl?.trim() || absoluteUrl(request, "/pricing?checkout=canceled");

  const metadata: Record<string, string> = {
    source: "public-site",
    plan: planOrPriceId,
  };
  if (body.accountId?.trim()) {
    metadata.account_id = body.accountId.trim();
  }

  try {
    const session = await createCheckoutSession({
      planOrPriceId,
      customerEmail: body.email?.trim() || null,
      quantity: body.quantity,
      successUrl,
      cancelUrl,
      metadata,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("[public-site] billing checkout:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start checkout",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    plans: listKenooPlans(),
    configuredPlans: getConfiguredKenooPlans(),
  });
}
