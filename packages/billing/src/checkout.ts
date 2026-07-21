import type Stripe from "stripe";

import { resolveStripePriceId } from "./plans";
import { getStripe } from "./stripe";

export type CreateCheckoutSessionInput = {
  /** Plan slug (`starter`) or raw Stripe `price_…` id */
  planOrPriceId: string;
  /** Absolute success URL (may include `{CHECKOUT_SESSION_ID}`) */
  successUrl: string;
  /** Absolute cancel URL */
  cancelUrl: string;
  customerEmail?: string | null;
  /** Existing Stripe customer id, when known */
  stripeCustomerId?: string | null;
  /** Quantity of seats / licenses */
  quantity?: number;
  /** Attached to Checkout Session + subscription metadata */
  metadata?: Record<string, string>;
  /** Allow promo codes in Checkout */
  allowPromotionCodes?: boolean;
  mode?: "subscription" | "payment";
};

export type CreateCheckoutSessionResult = {
  sessionId: string;
  url: string;
};

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  const priceId = resolveStripePriceId(input.planOrPriceId);
  if (!priceId) {
    throw new Error(
      `No Stripe price configured for "${input.planOrPriceId}". Set STRIPE_PRICE_* env vars.`,
    );
  }

  const stripe = getStripe();
  const quantity = Math.max(1, input.quantity ?? 1);
  const metadata = input.metadata ?? {};

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: input.mode ?? "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price: priceId, quantity }],
    allow_promotion_codes: input.allowPromotionCodes ?? true,
    metadata,
    subscription_data:
      (input.mode ?? "subscription") === "subscription"
        ? { metadata }
        : undefined,
  };

  if (input.stripeCustomerId) {
    params.customer = input.stripeCustomerId;
  } else if (input.customerEmail) {
    params.customer_email = input.customerEmail;
  }

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    throw new Error("Stripe Checkout session was created without a URL");
  }

  return { sessionId: session.id, url: session.url };
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });
}
