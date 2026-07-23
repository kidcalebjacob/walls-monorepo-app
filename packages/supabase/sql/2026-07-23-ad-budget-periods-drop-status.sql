-- AdPilot: drop status from ad_budget_periods.
-- Applied 2026-07-23 via Supabase MCP (oehqusxpbwtbeenzixjh).
-- Periods are live once created; effectiveness is date-window based.

DROP INDEX IF EXISTS public.ad_budget_periods_account_status_idx;
DROP INDEX IF EXISTS public.ad_budget_periods_account_active_window_idx;

ALTER TABLE public.ad_budget_periods
  DROP CONSTRAINT IF EXISTS ad_budget_periods_status_check;

ALTER TABLE public.ad_budget_periods
  DROP COLUMN IF EXISTS status;

CREATE INDEX IF NOT EXISTS ad_budget_periods_account_window_idx
  ON public.ad_budget_periods (account_id, start_date, end_date);
