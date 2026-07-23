-- AdPilot: drop redundant fiscal_year / fiscal_quarter from budget periods.
-- Applied 2026-07-23 via Supabase MCP (oehqusxpbwtbeenzixjh).
-- Period timing is fully determined by start_date / end_date / period_type.

ALTER TABLE public.ad_budget_periods
  DROP CONSTRAINT IF EXISTS ad_budget_periods_fiscal_quarter_check;

ALTER TABLE public.ad_budget_periods
  DROP COLUMN IF EXISTS fiscal_year,
  DROP COLUMN IF EXISTS fiscal_quarter;
