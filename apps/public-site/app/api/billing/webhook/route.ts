import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  constructStripeWebhookEvent,
  dispatchKenooBillingWebhook,
  getStripe,
  markAccountSubscriptionCanceled,
  syncAccountSubscriptionFromStripe,
  upsertAccountSubscriptionFromCheckout,
} from "@walls/billing";
import { createAdminClient } from "@walls/supabase/admin";

export const runtime = "nodejs";

/**
 * Optional public-site webhook mirror.
 * Prefer pointing Stripe at Admin `/api/billing/webhook` so one host owns sync.
 * This route stays available if marketing domain is the configured endpoint.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(rawBody, signature);
  } catch (error) {
    console.error("[public-site] stripe webhook signature:", error);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  try {
    await dispatchKenooBillingWebhook(event, {
      onCheckoutCompleted: async (session) => {
        const accountId = session.metadata?.account_id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        if (!accountId || !customerId) {
          console.warn(
            "[public-site] checkout.session.completed missing account_id/customer",
            session.id,
          );
          return;
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          await syncAccountSubscriptionFromStripe(
            admin,
            subscription,
            accountId,
          );
          return;
        }

        await upsertAccountSubscriptionFromCheckout(admin, {
          accountId,
          stripeCustomerId: customerId,
          status: "active",
        });
      },
      onSubscriptionUpdated: async (subscription) => {
        await syncAccountSubscriptionFromStripe(admin, subscription);
      },
      onSubscriptionDeleted: async (subscription) => {
        await markAccountSubscriptionCanceled(admin, subscription);
      },
    });
  } catch (error) {
    console.error("[public-site] stripe webhook handler:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
