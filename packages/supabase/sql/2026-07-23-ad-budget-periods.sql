-- AdPilot: organization budget periods and objectives.
-- Applied 2026-07-23 via Supabase MCP (oehqusxpbwtbeenzixjh).
-- Planned spend lives on ad_budget_periods.budget_amount_micros;
-- actual spend comes from existing AdPilot metrics tables.
-- See also:
--   2026-07-23-ad-budget-periods-amount.sql
--   2026-07-23-ad-budget-periods-drop-fiscal.sql
--   2026-07-23-ad-budget-periods-drop-allocations.sql
--   2026-07-23-ad-budget-periods-drop-status.sql

CREATE TABLE IF NOT EXISTS public.ad_budget_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  name text NOT NULL,
  description text,

  period_type text NOT NULL DEFAULT 'quarter',
  start_date date NOT NULL,
  end_date date,

  currency text NOT NULL DEFAULT 'USD',
  budget_amount_micros bigint NOT NULL DEFAULT 0,

  -- Narrative primary focus for the period (e.g. "Profitable Meta prospecting")
  primary_focus text,

  CONSTRAINT ad_budget_periods_type_check
    CHECK (period_type IN ('quarter', 'month', 'year', 'custom', 'ongoing')),
  CONSTRAINT ad_budget_periods_dates_check
    CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT ad_budget_periods_ongoing_end_check
    CHECK (period_type <> 'ongoing' OR end_date IS NULL),
  CONSTRAINT ad_budget_periods_name_len_check
    CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 200),
  CONSTRAINT ad_budget_periods_currency_check
    CHECK (char_length(currency) = 3),
  CONSTRAINT ad_budget_periods_budget_amount_check
    CHECK (budget_amount_micros >= 0)
);

COMMENT ON TABLE public.ad_budget_periods IS
  'AdPilot: organization planning periods (quarter/year/custom/ongoing) with a planned budget and objectives.';

COMMENT ON COLUMN public.ad_budget_periods.end_date IS
  'Inclusive end date. NULL means ongoing / evergreen until archived.';

COMMENT ON COLUMN public.ad_budget_periods.primary_focus IS
  'Optional narrative focus for the period (strategy headline for stakeholders).';

COMMENT ON COLUMN public.ad_budget_periods.budget_amount_micros IS
  'Total planned budget for the period × 1,000,000 (same scale as ad_metrics_daily.spend_micros).';

CREATE INDEX IF NOT EXISTS ad_budget_periods_account_dates_idx
  ON public.ad_budget_periods (account_id, start_date DESC, end_date DESC NULLS FIRST);

CREATE INDEX IF NOT EXISTS ad_budget_periods_account_window_idx
  ON public.ad_budget_periods (account_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS public.ad_budget_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.ad_budget_periods(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  name text NOT NULL,
  metric_key text NOT NULL,
  custom_metric_label text,

  target_value numeric NOT NULL,
  target_operator text NOT NULL DEFAULT 'gte',
  target_unit text,

  is_primary boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,

  CONSTRAINT ad_budget_objectives_metric_check
    CHECK (metric_key IN (
      'roas',
      'ctr',
      'cpa',
      'cpc',
      'conversions',
      'conversion_rate',
      'reach',
      'impressions',
      'frequency',
      'cpm',
      'brand_recognition',
      'awareness',
      'engagement',
      'custom'
    )),
  CONSTRAINT ad_budget_objectives_operator_check
    CHECK (target_operator IN ('gte', 'lte', 'eq')),
  CONSTRAINT ad_budget_objectives_status_check
    CHECK (status IN ('active', 'achieved', 'missed', 'cancelled')),
  CONSTRAINT ad_budget_objectives_custom_label_check
    CHECK (
      metric_key <> 'custom'
      OR (custom_metric_label IS NOT NULL AND char_length(trim(custom_metric_label)) >= 1)
    ),
  CONSTRAINT ad_budget_objectives_name_len_check
    CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 200)
);

COMMENT ON TABLE public.ad_budget_objectives IS
  'AdPilot: KPI / OKR targets for a planning period (ROAS, CTR, recognition, etc.).';

COMMENT ON COLUMN public.ad_budget_objectives.is_primary IS
  'When true, this is the headline objective for the period. At most one primary per period (enforced by unique index).';

CREATE INDEX IF NOT EXISTS ad_budget_objectives_period_idx
  ON public.ad_budget_objectives (period_id, is_primary DESC, priority, created_at);

CREATE INDEX IF NOT EXISTS ad_budget_objectives_account_idx
  ON public.ad_budget_objectives (account_id);

-- At most one primary objective per period
CREATE UNIQUE INDEX IF NOT EXISTS ad_budget_objectives_one_primary_per_period_idx
  ON public.ad_budget_objectives (period_id)
  WHERE is_primary = true;

-- Keep account_id aligned with parent period
CREATE OR REPLACE FUNCTION public.ad_budget_child_account_matches_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  parent_account_id uuid;
BEGIN
  SELECT p.account_id INTO parent_account_id
  FROM public.ad_budget_periods p
  WHERE p.id = NEW.period_id;

  IF parent_account_id IS NULL THEN
    RAISE EXCEPTION 'Budget period % not found', NEW.period_id;
  END IF;

  IF NEW.account_id IS DISTINCT FROM parent_account_id THEN
    RAISE EXCEPTION 'account_id must match parent budget period';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ad_budget_objectives_account_match ON public.ad_budget_objectives;
CREATE TRIGGER ad_budget_objectives_account_match
  BEFORE INSERT OR UPDATE OF account_id, period_id
  ON public.ad_budget_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.ad_budget_child_account_matches_period();

ALTER TABLE public.ad_budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_budget_objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_budget_periods_select_member ON public.ad_budget_periods;
CREATE POLICY ad_budget_periods_select_member
  ON public.ad_budget_periods FOR SELECT TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_budget_periods_insert_member ON public.ad_budget_periods;
CREATE POLICY ad_budget_periods_insert_member
  ON public.ad_budget_periods FOR INSERT TO authenticated
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_budget_periods_update_member ON public.ad_budget_periods;
CREATE POLICY ad_budget_periods_update_member
  ON public.ad_budget_periods FOR UPDATE TO authenticated
  USING (is_ad_account_member(account_id))
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_budget_periods_delete_member ON public.ad_budget_periods;
CREATE POLICY ad_budget_periods_delete_member
  ON public.ad_budget_periods FOR DELETE TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_budget_objectives_select_member ON public.ad_budget_objectives;
CREATE POLICY ad_budget_objectives_select_member
  ON public.ad_budget_objectives FOR SELECT TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_budget_objectives_insert_member ON public.ad_budget_objectives;
CREATE POLICY ad_budget_objectives_insert_member
  ON public.ad_budget_objectives FOR INSERT TO authenticated
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_budget_objectives_update_member ON public.ad_budget_objectives;
CREATE POLICY ad_budget_objectives_update_member
  ON public.ad_budget_objectives FOR UPDATE TO authenticated
  USING (is_ad_account_member(account_id))
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_budget_objectives_delete_member ON public.ad_budget_objectives;
CREATE POLICY ad_budget_objectives_delete_member
  ON public.ad_budget_objectives FOR DELETE TO authenticated
  USING (is_ad_account_member(account_id));
