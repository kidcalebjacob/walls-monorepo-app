import { NextResponse } from "next/server";

import {
  createBillingPortalSession,
  getAccountSubscription,
} from "@walls/billing";
import { createAdminClient } from "@walls/supabase/admin";

import {
  getAccountMembership,
  getCurrentUserId,
} from "@/lib/account-context";
import { getAdminDataScope } from "@/lib/admin-scope";

type PortalBody = {
  accountId?: string;
  returnUrl?: string;
};

function absoluteUrl(request: Request, path: string): string {
  return new URL(path, new URL(request.url).origin).toString();
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PortalBody;
  const scope = await getAdminDataScope();
  const accountId = body.accountId?.trim() || scope?.accountId || null;

  if (!accountId) {
    return NextResponse.json(
      { error: "No account selected" },
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
  const subscription = await getAccountSubscription(admin, accountId);

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer for this account yet. Start a checkout first." },
      { status: 400 },
    );
  }

  try {
    const portal = await createBillingPortalSession({
      stripeCustomerId: subscription.stripeCustomerId,
      returnUrl:
        body.returnUrl?.trim() || absoluteUrl(request, "/billing"),
    });
    return NextResponse.json(portal);
  } catch (error) {
    console.error("[admin] billing portal:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to open billing portal",
      },
      { status: 500 },
    );
  }
}
