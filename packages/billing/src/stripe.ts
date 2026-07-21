import Stripe from "stripe";

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return key;
}

export function getStripePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;
}

/** Prefer STRIPE_WEBHOOK_SECRET, then snapshot/thin secrets used in this monorepo. */
export function getStripeWebhookSecret(): string {
  const secret =
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET_SNAPSHOT?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET_THIN?.trim();

  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET_SNAPSHOT) is not configured",
    );
  }
  return secret;
}

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(getStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
      typescript: true,
    });
  }
  return stripeSingleton;
}
