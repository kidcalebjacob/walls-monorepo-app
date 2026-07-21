import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export type AccountSubscriptionRecord = {
  accountId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string | null;
};

type AccountSubscriptionRow = {
  account_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  updated_at: string | null;
};

function mapRow(row: AccountSubscriptionRow): AccountSubscriptionRecord {
  return {
    accountId: row.account_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    updatedAt: row.updated_at,
  };
}

export async function getAccountSubscription(
  admin: SupabaseClient,
  accountId: string,
): Promise<AccountSubscriptionRecord | null> {
  const { data, error } = await admin
    .from("account_subscriptions")
    .select(
      "account_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_end, cancel_at_period_end, updated_at",
    )
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    console.error("[billing] getAccountSubscription:", error);
    return null;
  }

  return data ? mapRow(data as AccountSubscriptionRow) : null;
}

export async function upsertAccountSubscriptionFromCheckout(
  admin: SupabaseClient,
  input: {
    accountId: string;
    stripeCustomerId: string;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    status?: string;
  },
): Promise<void> {
  const { error } = await admin.from("account_subscriptions").upsert(
    {
      account_id: input.accountId,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      stripe_price_id: input.stripePriceId ?? null,
      status: input.status ?? "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" },
  );

  if (error) {
    console.error("[billing] upsertAccountSubscriptionFromCheckout:", error);
    throw new Error(error.message);
  }
}

export async function syncAccountSubscriptionFromStripe(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  accountIdFallback?: string | null,
): Promise<void> {
  const accountId =
    subscription.metadata?.account_id ||
    subscription.metadata?.accountId ||
    accountIdFallback ||
    null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!accountId || !customerId) {
    console.warn(
      "[billing] syncAccountSubscriptionFromStripe: missing account_id or customer",
      subscription.id,
    );
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const periodEnd = subscription.items.data[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
    : subscription.ended_at
      ? new Date(subscription.ended_at * 1000).toISOString()
      : null;

  const { error } = await admin.from("account_subscriptions").upsert(
    {
      account_id: accountId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status: subscription.status,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" },
  );

  if (error) {
    console.error("[billing] syncAccountSubscriptionFromStripe:", error);
    throw new Error(error.message);
  }
}

export async function markAccountSubscriptionCanceled(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  await syncAccountSubscriptionFromStripe(admin, {
    ...subscription,
    status: "canceled",
  } as Stripe.Subscription);
}

/** Ensure a Stripe customer exists for this account; returns customer id. */
export async function ensureStripeCustomerId(input: {
  admin: SupabaseClient;
  stripe: Stripe;
  accountId: string;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  const existing = await getAccountSubscription(input.admin, input.accountId);
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  const customer = await input.stripe.customers.create({
    email: input.email ?? undefined,
    name: input.name ?? undefined,
    metadata: {
      account_id: input.accountId,
    },
  });

  await upsertAccountSubscriptionFromCheckout(input.admin, {
    accountId: input.accountId,
    stripeCustomerId: customer.id,
    status: "incomplete",
  });

  return customer.id;
}
