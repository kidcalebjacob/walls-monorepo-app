-- AdPilot: Meta Insights frequency_value reach distribution (Ads Manager–style).
-- Period snapshots for UI presets (1/7/14/30d) — not daily rows (unique reach is not additive).
-- Applied 2026-07-22 via Supabase MCP (oehqusxpbwtbeenzixjh).

CREATE TABLE IF NOT EXISTS public.ad_metrics_frequency_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.ad_entities(id) ON DELETE CASCADE,
  -- Matches AdPilot UI presets / days-hours rollups: 1, 7, 14, 30.
  range_days smallint NOT NULL,
  -- Meta frequency_value bucket label, e.g. "1", "2", "6-10", "11-15".
  frequency_value text NOT NULL,
  reach bigint NOT NULL DEFAULT 0,
  CONSTRAINT ad_metrics_frequency_breakdowns_range_check
    CHECK (range_days IN (1, 7, 14, 30)),
  CONSTRAINT ad_metrics_frequency_breakdowns_unique
    UNIQUE (entity_id, range_days, frequency_value)
);

COMMENT ON TABLE public.ad_metrics_frequency_breakdowns IS
  'AdPilot: Meta Insights frequency_value reach distribution for fixed UI ranges (1/7/14/30d). One snapshot per entity+range+bucket; reach is unique people in that bucket for the whole window (not daily).';

CREATE INDEX IF NOT EXISTS ad_metrics_frequency_breakdowns_account_range_idx
  ON public.ad_metrics_frequency_breakdowns (account_id, range_days);

CREATE INDEX IF NOT EXISTS ad_metrics_frequency_breakdowns_connection_range_idx
  ON public.ad_metrics_frequency_breakdowns (account_connection_id, range_days);

CREATE INDEX IF NOT EXISTS ad_metrics_frequency_breakdowns_entity_range_idx
  ON public.ad_metrics_frequency_breakdowns (entity_id, range_days);

ALTER TABLE public.ad_metrics_frequency_breakdowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_metrics_frequency_breakdowns_select_member ON public.ad_metrics_frequency_breakdowns;
CREATE POLICY ad_metrics_frequency_breakdowns_select_member
  ON public.ad_metrics_frequency_breakdowns
  FOR SELECT
  TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_frequency_breakdowns_insert_member ON public.ad_metrics_frequency_breakdowns;
CREATE POLICY ad_metrics_frequency_breakdowns_insert_member
  ON public.ad_metrics_frequency_breakdowns
  FOR INSERT
  TO authenticated
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_frequency_breakdowns_update_member ON public.ad_metrics_frequency_breakdowns;
CREATE POLICY ad_metrics_frequency_breakdowns_update_member
  ON public.ad_metrics_frequency_breakdowns
  FOR UPDATE
  TO authenticated
  USING (is_ad_account_member(account_id))
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_metrics_frequency_breakdowns_delete_member ON public.ad_metrics_frequency_breakdowns;
CREATE POLICY ad_metrics_frequency_breakdowns_delete_member
  ON public.ad_metrics_frequency_breakdowns
  FOR DELETE
  TO authenticated
  USING (is_ad_account_member(account_id));
