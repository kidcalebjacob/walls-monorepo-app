-- Kenoo SaaS billing: one Stripe subscription row per account.
-- Applied 2026-07-21 via Supabase MCP (oehqusxpbwtbeenzixjh).

CREATE TABLE IF NOT EXISTS public.account_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  status text NOT NULL DEFAULT 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  CONSTRAINT account_subscriptions_account_id_key UNIQUE (account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS account_subscriptions_stripe_customer_id_uidx
  ON public.account_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_subscriptions_stripe_subscription_id_uidx
  ON public.account_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS account_subscriptions_status_idx
  ON public.account_subscriptions (status);

COMMENT ON TABLE public.account_subscriptions IS
  'Kenoo SaaS Stripe billing state per account (personal or organization).';

ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;

-- Members can read their account billing status.
DROP POLICY IF EXISTS account_subscriptions_select_member ON public.account_subscriptions;
CREATE POLICY account_subscriptions_select_member
  ON public.account_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_users au
      WHERE au.account_id = account_subscriptions.account_id
        AND au.user_id = auth.uid()
    )
  );

-- Writes go through service role / server routes only (no insert/update policies for authenticated).
