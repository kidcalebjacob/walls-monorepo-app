import type Stripe from "stripe";

import { getStripe, getStripeWebhookSecret } from "./stripe";

export function constructStripeWebhookEvent(
  rawBody: string | Buffer,
  signatureHeader: string | null,
): Stripe.Event {
  if (!signatureHeader) {
    throw new Error("Missing stripe-signature header");
  }

  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    rawBody,
    signatureHeader,
    getStripeWebhookSecret(),
  );
}

export type KenooBillingWebhookHandlers = {
  onCheckoutCompleted?: (
    session: Stripe.Checkout.Session,
    event: Stripe.Event,
  ) => Promise<void> | void;
  onSubscriptionUpdated?: (
    subscription: Stripe.Subscription,
    event: Stripe.Event,
  ) => Promise<void> | void;
  onSubscriptionDeleted?: (
    subscription: Stripe.Subscription,
    event: Stripe.Event,
  ) => Promise<void> | void;
  onInvoicePaymentFailed?: (
    invoice: Stripe.Invoice,
    event: Stripe.Event,
  ) => Promise<void> | void;
};

export async function dispatchKenooBillingWebhook(
  event: Stripe.Event,
  handlers: KenooBillingWebhookHandlers,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      await handlers.onCheckoutCompleted?.(
        event.data.object as Stripe.Checkout.Session,
        event,
      );
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await handlers.onSubscriptionUpdated?.(
        event.data.object as Stripe.Subscription,
        event,
      );
      break;
    }
    case "customer.subscription.deleted": {
      await handlers.onSubscriptionDeleted?.(
        event.data.object as Stripe.Subscription,
        event,
      );
      break;
    }
    case "invoice.payment_failed": {
      await handlers.onInvoicePaymentFailed?.(
        event.data.object as Stripe.Invoice,
        event,
      );
      break;
    }
    default:
      break;
  }
}
