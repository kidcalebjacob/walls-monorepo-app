import { NextResponse } from "next/server";

import {
  createCheckoutSession,
  ensureStripeCustomerId,
  getStripe,
} from "@walls/billing";
import { createAdminClient } from "@walls/supabase/admin";

import {
  getAccountMembership,
  getCurrentUserId,
} from "@/lib/account-context";
import { getAdminDataScope } from "@/lib/admin-scope";

type CheckoutBody = {
  plan?: string;
  priceId?: string;
  accountId?: string;
  quantity?: number;
  successUrl?: string;
  cancelUrl?: string;
};

function absoluteUrl(request: Request, path: string): string {
  const origin = new URL(request.url).origin;
  return new URL(path, origin).toString();
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CheckoutBody;
  const planOrPriceId = (body.priceId || body.plan || "starter").trim();

  const scope = await getAdminDataScope();
  const accountId = body.accountId?.trim() || scope?.accountId || null;

  if (!accountId) {
    return NextResponse.json(
      { error: "No account selected for checkout" },
      { status: 400 },
    );
  }

  const membership = await getAccountMembership(userId, accountId);
  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this account" },
      { status: 403 },
    );
  }

  if (!["owner", "admin"].includes(membership.role.toLowerCase())) {
    return NextResponse.json(
      { error: "Only account owners and admins can manage billing" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("id, name, email")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const stripe = getStripe();
    const stripeCustomerId = await ensureStripeCustomerId({
      admin,
      stripe,
      accountId,
      email: account.email,
      name: account.name,
    });

    const successUrl =
      body.successUrl?.trim() ||
      absoluteUrl(request, "/billing?checkout=success");
    const cancelUrl =
      body.cancelUrl?.trim() ||
      absoluteUrl(request, "/billing?checkout=canceled");

    const session = await createCheckoutSession({
      planOrPriceId,
      stripeCustomerId,
      quantity: body.quantity,
      successUrl:
        successUrl.includes("{CHECKOUT_SESSION_ID}")
          ? successUrl
          : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl,
      metadata: {
        account_id: accountId,
        user_id: userId,
        plan: planOrPriceId,
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("[admin] billing checkout:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start checkout",
      },
      { status: 500 },
    );
  }
}
