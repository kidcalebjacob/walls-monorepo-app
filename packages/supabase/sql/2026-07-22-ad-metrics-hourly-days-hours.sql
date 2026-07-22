-- AdPilot: hourly Meta Insights + precomputed DOW×hour rollups for instant dashboard heatmaps.
-- Applied 2026-07-22 via Supabase MCP (oehqusxpbwtbeenzixjh).

CREATE TABLE IF NOT EXISTS public.ad_metrics_hourly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.ad_entities(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  hour_of_day smallint NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  spend_micros bigint NOT NULL DEFAULT 0,
  conversions numeric NOT NULL DEFAULT 0,
  conversion_value_micros bigint NOT NULL DEFAULT 0,
  website_purchases numeric NOT NULL DEFAULT 0,
  ctr numeric,
  cpc_micros bigint,
  cpm_micros bigint,
  roas numeric,
  extra_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ad_metrics_hourly_hour_check
    CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  CONSTRAINT ad_metrics_hourly_unique
    UNIQUE (entity_id, metric_date, hour_of_day)
);

COMMENT ON TABLE public.ad_metrics_hourly IS
  'AdPilot: Meta Insights broken down by calendar day + hour (advertiser timezone). Prefer account-level rows for dashboard heatmaps.';

CREATE INDEX IF NOT EXISTS ad_metrics_hourly_account_date_idx
  ON public.ad_metrics_hourly (account_id, metric_date DESC, hour_of_day);

CREATE INDEX IF NOT EXISTS ad_metrics_hourly_connection_date_idx
  ON public.ad_metrics_hourly (account_connection_id, metric_date DESC, hour_of_day);

CREATE INDEX IF NOT EXISTS ad_metrics_hourly_entity_date_idx
  ON public.ad_metrics_hourly (entity_id, metric_date DESC, hour_of_day);

ALTER TABLE public.ad_metrics_hourly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_metrics_hourly_select_member ON public.ad_metrics_hourly;
CREATE POLICY ad_metrics_hourly_select_member
  ON public.ad_metrics_hourly
  FOR SELECT
  TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_hourly_insert_member ON public.ad_metrics_hourly;
CREATE POLICY ad_metrics_hourly_insert_member
  ON public.ad_metrics_hourly
  FOR INSERT
  TO authenticated
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_hourly_update_member ON public.ad_metrics_hourly;
CREATE POLICY ad_metrics_hourly_update_member
  ON public.ad_metrics_hourly
  FOR UPDATE
  TO authenticated
  USING (is_ad_account_member(account_id))
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_hourly_delete_member ON public.ad_metrics_hourly;
CREATE POLICY ad_metrics_hourly_delete_member
  ON public.ad_metrics_hourly
  FOR DELETE
  TO authenticated
  USING (is_ad_account_member(account_id));

-- Pre-aggregated DOW × hour cells for common dashboard ranges (instant reads).
-- day_of_week: 0=Sunday … 6=Saturday (Postgres EXTRACT(DOW)).
CREATE TABLE IF NOT EXISTS public.ad_metrics_days_hours_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  range_days smallint NOT NULL,
  day_of_week smallint NOT NULL,
  hour_of_day smallint NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  spend_micros bigint NOT NULL DEFAULT 0,
  conversion_value_micros bigint NOT NULL DEFAULT 0,
  website_purchases numeric NOT NULL DEFAULT 0,
  CONSTRAINT ad_metrics_days_hours_rollups_range_check
    CHECK (range_days IN (1, 7, 14, 30)),
  CONSTRAINT ad_metrics_days_hours_rollups_dow_check
    CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT ad_metrics_days_hours_rollups_hour_check
    CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  CONSTRAINT ad_metrics_days_hours_rollups_unique
    UNIQUE (account_id, account_connection_id, range_days, day_of_week, hour_of_day)
);

COMMENT ON TABLE public.ad_metrics_days_hours_rollups IS
  'AdPilot: precomputed day-of-week × hour aggregates from ad_metrics_hourly for instant Days & Hours heatmaps. Refreshed after Meta sync.';

CREATE INDEX IF NOT EXISTS ad_metrics_days_hours_rollups_lookup_idx
  ON public.ad_metrics_days_hours_rollups (account_id, range_days, day_of_week, hour_of_day);

ALTER TABLE public.ad_metrics_days_hours_rollups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_metrics_days_hours_rollups_select_member ON public.ad_metrics_days_hours_rollups;
CREATE POLICY ad_metrics_days_hours_rollups_select_member
  ON public.ad_metrics_days_hours_rollups
  FOR SELECT
  TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_days_hours_rollups_insert_member ON public.ad_metrics_days_hours_rollups;
CREATE POLICY ad_metrics_days_hours_rollups_insert_member
  ON public.ad_metrics_days_hours_rollups
  FOR INSERT
  TO authenticated
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_days_hours_rollups_update_member ON public.ad_metrics_days_hours_rollups;
CREATE POLICY ad_metrics_days_hours_rollups_update_member
  ON public.ad_metrics_days_hours_rollups
  FOR UPDATE
  TO authenticated
  USING (is_ad_account_member(account_id))
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_days_hours_rollups_delete_member ON public.ad_metrics_days_hours_rollups;
CREATE POLICY ad_metrics_days_hours_rollups_delete_member
  ON public.ad_metrics_days_hours_rollups
  FOR DELETE
  TO authenticated
  USING (is_ad_account_member(account_id));

CREATE OR REPLACE FUNCTION public.refresh_ad_metrics_days_hours_rollups(
  p_account_id uuid,
  p_account_connection_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_days smallint;
BEGIN
  FOREACH r_days IN ARRAY ARRAY[1, 7, 14, 30]::smallint[] LOOP
    DELETE FROM public.ad_metrics_days_hours_rollups
    WHERE account_id = p_account_id
      AND account_connection_id = p_account_connection_id
      AND range_days = r_days;

    INSERT INTO public.ad_metrics_days_hours_rollups (
      account_id,
      account_connection_id,
      range_days,
      day_of_week,
      hour_of_day,
      impressions,
      clicks,
      spend_micros,
      conversion_value_micros,
      website_purchases,
      updated_at
    )
    SELECT
      p_account_id,
      p_account_connection_id,
      r_days,
      EXTRACT(DOW FROM h.metric_date)::smallint AS day_of_week,
      h.hour_of_day,
      COALESCE(SUM(h.impressions), 0),
      COALESCE(SUM(h.clicks), 0),
      COALESCE(SUM(h.spend_micros), 0),
      COALESCE(SUM(h.conversion_value_micros), 0),
      COALESCE(SUM(h.website_purchases), 0),
      now()
    FROM public.ad_metrics_hourly h
    INNER JOIN public.ad_entities e ON e.id = h.entity_id
    WHERE h.account_id = p_account_id
      AND h.account_connection_id = p_account_connection_id
      AND e.entity_type = 'account'
      AND h.metric_date >= (CURRENT_DATE - (r_days - 1))
      AND h.metric_date <= CURRENT_DATE
    GROUP BY EXTRACT(DOW FROM h.metric_date), h.hour_of_day;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_ad_metrics_days_hours_rollups(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_ad_metrics_days_hours_rollups(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ad_metrics_days_hours_rollups(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.refresh_ad_metrics_days_hours_rollups(uuid, uuid) IS
  'Rebuilds DOW×hour rollups (1/7/14/30d) for one Meta connection from account-level hourly metrics.';
