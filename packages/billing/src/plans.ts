export type KenooPlanId = "starter" | "pro" | "enterprise";

export type KenooPlan = {
  id: KenooPlanId;
  name: string;
  description: string;
  /** Stripe Price ID from env, if configured */
  priceId: string | null;
  /** Display-only monthly amount in cents (optional marketing copy) */
  amountCents: number | null;
};

const PLAN_META: Record<
  KenooPlanId,
  { name: string; description: string; envKey: string; amountEnvKey: string }
> = {
  starter: {
    name: "Starter",
    description: "Core Kenoo access for small teams",
    envKey: "STRIPE_PRICE_STARTER",
    amountEnvKey: "STRIPE_PRICE_STARTER_AMOUNT_CENTS",
  },
  pro: {
    name: "Pro",
    description: "Full suite access with higher limits",
    envKey: "STRIPE_PRICE_PRO",
    amountEnvKey: "STRIPE_PRICE_PRO_AMOUNT_CENTS",
  },
  enterprise: {
    name: "Enterprise",
    description: "Custom deployment and support",
    envKey: "STRIPE_PRICE_ENTERPRISE",
    amountEnvKey: "STRIPE_PRICE_ENTERPRISE_AMOUNT_CENTS",
  },
};

function readPriceId(envKey: string): string | null {
  return process.env[envKey]?.trim() || null;
}

function readAmountCents(envKey: string): number | null {
  const raw = process.env[envKey]?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Resolve a Stripe price ID from a plan slug or a raw `price_…` id. */
export function resolveStripePriceId(planOrPriceId: string): string | null {
  const value = planOrPriceId.trim();
  if (!value) return null;
  if (value.startsWith("price_")) return value;

  const planId = value.toLowerCase() as KenooPlanId;
  if (planId in PLAN_META) {
    return readPriceId(PLAN_META[planId].envKey);
  }

  // Fallback single-price env for simple setups
  if (value === "default") {
    return (
      process.env.STRIPE_PRICE_ID?.trim() ||
      readPriceId("STRIPE_PRICE_STARTER")
    );
  }

  return null;
}

export function listKenooPlans(): KenooPlan[] {
  return (Object.keys(PLAN_META) as KenooPlanId[]).map((id) => {
    const meta = PLAN_META[id];
    return {
      id,
      name: meta.name,
      description: meta.description,
      priceId: readPriceId(meta.envKey),
      amountCents: readAmountCents(meta.amountEnvKey),
    };
  });
}

export function getConfiguredKenooPlans(): KenooPlan[] {
  return listKenooPlans().filter((plan) => Boolean(plan.priceId));
}
