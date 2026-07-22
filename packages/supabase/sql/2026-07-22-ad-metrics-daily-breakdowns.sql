-- AdPilot: Meta Insights placement/device breakdowns (Auction Insights–style).
-- Applied 2026-07-22 via Supabase MCP (oehqusxpbwtbeenzixjh).

ALTER TABLE public.ad_entities
  ADD COLUMN IF NOT EXISTS budget_optimization text;

COMMENT ON COLUMN public.ad_entities.budget_optimization IS
  'Meta campaign budget mode: cbo (campaign/Advantage campaign budget) or abo (ad set budgets). Null for non-campaign entities.';

CREATE TABLE IF NOT EXISTS public.ad_metrics_daily_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.ad_entities(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  -- Which Meta breakdown combination produced this row.
  breakdown_type text NOT NULL,
  publisher_platform text NOT NULL DEFAULT '',
  platform_position text NOT NULL DEFAULT '',
  device_platform text NOT NULL DEFAULT '',
  impression_device text NOT NULL DEFAULT '',
  -- Same core metrics as ad_metrics_daily
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  spend_micros bigint NOT NULL DEFAULT 0,
  reach bigint,
  frequency numeric,
  conversions numeric NOT NULL DEFAULT 0,
  conversion_value_micros bigint NOT NULL DEFAULT 0,
  website_purchases numeric NOT NULL DEFAULT 0,
  add_to_cart numeric NOT NULL DEFAULT 0,
  ctr numeric,
  cpc_micros bigint,
  cpm_micros bigint,
  roas numeric,
  extra_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ad_metrics_daily_breakdowns_type_check
    CHECK (breakdown_type IN ('device_platform', 'placement_device')),
  CONSTRAINT ad_metrics_daily_breakdowns_unique
    UNIQUE (
      entity_id,
      metric_date,
      breakdown_type,
      publisher_platform,
      platform_position,
      device_platform,
      impression_device
    )
);

COMMENT ON TABLE public.ad_metrics_daily_breakdowns IS
  'AdPilot: daily Meta Insights broken down by device and/or placement. breakdown_type=device_platform → mobile/desktop; breakdown_type=placement_device → publisher+position+impression_device (OS derivable).';

CREATE INDEX IF NOT EXISTS ad_metrics_daily_breakdowns_account_date_idx
  ON public.ad_metrics_daily_breakdowns (account_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS ad_metrics_daily_breakdowns_connection_date_idx
  ON public.ad_metrics_daily_breakdowns (account_connection_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS ad_metrics_daily_breakdowns_entity_date_idx
  ON public.ad_metrics_daily_breakdowns (entity_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS ad_metrics_daily_breakdowns_type_date_idx
  ON public.ad_metrics_daily_breakdowns (breakdown_type, metric_date DESC);

CREATE INDEX IF NOT EXISTS ad_metrics_daily_breakdowns_publisher_idx
  ON public.ad_metrics_daily_breakdowns (publisher_platform, platform_position)
  WHERE publisher_platform <> '';

ALTER TABLE public.ad_metrics_daily_breakdowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_metrics_daily_breakdowns_select_member ON public.ad_metrics_daily_breakdowns;
CREATE POLICY ad_metrics_daily_breakdowns_select_member
  ON public.ad_metrics_daily_breakdowns
  FOR SELECT
  TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_daily_breakdowns_insert_member ON public.ad_metrics_daily_breakdowns;
CREATE POLICY ad_metrics_daily_breakdowns_insert_member
  ON public.ad_metrics_daily_breakdowns
  FOR INSERT
  TO authenticated
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_daily_breakdowns_update_member ON public.ad_metrics_daily_breakdowns;
CREATE POLICY ad_metrics_daily_breakdowns_update_member
  ON public.ad_metrics_daily_breakdowns
  FOR UPDATE
  TO authenticated
  USING (is_ad_account_member(account_id))
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_daily_breakdowns_delete_member ON public.ad_metrics_daily_breakdowns;
CREATE POLICY ad_metrics_daily_breakdowns_delete_member
  ON public.ad_metrics_daily_breakdowns
  FOR DELETE
  TO authenticated
  USING (is_ad_account_member(account_id));
