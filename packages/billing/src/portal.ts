import { getStripe } from "./stripe";

export type CreateBillingPortalSessionInput = {
  stripeCustomerId: string;
  returnUrl: string;
};

export async function createBillingPortalSession(
  input: CreateBillingPortalSessionInput,
): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: input.returnUrl,
  });

  if (!session.url) {
    throw new Error("Stripe Billing Portal session was created without a URL");
  }

  return { url: session.url };
}
