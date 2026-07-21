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

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(rawBody, signature);
  } catch (error) {
    console.error("[admin] stripe webhook signature:", error);
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
            "[admin] checkout.session.completed missing account_id/customer",
            session.id,
          );
          return;
        }

        let subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        let priceId: string | null = null;
        let status = "active";

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          priceId = subscription.items.data[0]?.price?.id ?? null;
          status = subscription.status;
          await syncAccountSubscriptionFromStripe(admin, subscription, accountId);
          return;
        }

        await upsertAccountSubscriptionFromCheckout(admin, {
          accountId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId,
          status,
        });
      },
      onSubscriptionUpdated: async (subscription) => {
        await syncAccountSubscriptionFromStripe(admin, subscription);
      },
      onSubscriptionDeleted: async (subscription) => {
        await markAccountSubscriptionCanceled(admin, subscription);
      },
      onInvoicePaymentFailed: async (invoice) => {
        const subscriptionRef = (
          invoice as Stripe.Invoice & {
            subscription?: string | Stripe.Subscription | null;
          }
        ).subscription;
        const subscriptionId =
          typeof subscriptionRef === "string"
            ? subscriptionRef
            : subscriptionRef?.id ?? null;
        if (!subscriptionId) return;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncAccountSubscriptionFromStripe(admin, subscription);
      },
    });
  } catch (error) {
    console.error("[admin] stripe webhook handler:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
