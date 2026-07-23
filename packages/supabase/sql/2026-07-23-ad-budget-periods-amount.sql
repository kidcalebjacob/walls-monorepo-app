-- AdPilot: period-level budget amount on ad_budget_periods.
-- Applied 2026-07-23 via Supabase MCP (oehqusxpbwtbeenzixjh).

ALTER TABLE public.ad_budget_periods
  ADD COLUMN IF NOT EXISTS budget_amount_micros bigint NOT NULL DEFAULT 0;

ALTER TABLE public.ad_budget_periods
  DROP CONSTRAINT IF EXISTS ad_budget_periods_budget_amount_check;

ALTER TABLE public.ad_budget_periods
  ADD CONSTRAINT ad_budget_periods_budget_amount_check
  CHECK (budget_amount_micros >= 0);

COMMENT ON COLUMN public.ad_budget_periods.budget_amount_micros IS
  'Total planned budget for the period × 1,000,000 (same scale as ad_metrics_daily.spend_micros).';

-- Backfill from existing allocation totals where period amount is still zero.
UPDATE public.ad_budget_periods p
SET budget_amount_micros = COALESCE(a.total_micros, 0)
FROM (
  SELECT period_id, SUM(amount_micros)::bigint AS total_micros
  FROM public.ad_budget_allocations
  GROUP BY period_id
) a
WHERE p.id = a.period_id
  AND p.budget_amount_micros = 0
  AND a.total_micros > 0;
