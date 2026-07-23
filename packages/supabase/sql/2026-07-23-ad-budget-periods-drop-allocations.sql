-- AdPilot: drop ad_budget_allocations.
-- Applied 2026-07-23 via Supabase MCP (oehqusxpbwtbeenzixjh).
-- Planned spend lives on ad_budget_periods.budget_amount_micros;
-- actual spend comes from existing AdPilot metrics tables.

DROP TRIGGER IF EXISTS ad_budget_allocations_account_match ON public.ad_budget_allocations;

DROP POLICY IF EXISTS ad_budget_allocations_select_member ON public.ad_budget_allocations;
DROP POLICY IF EXISTS ad_budget_allocations_insert_member ON public.ad_budget_allocations;
DROP POLICY IF EXISTS ad_budget_allocations_update_member ON public.ad_budget_allocations;
DROP POLICY IF EXISTS ad_budget_allocations_delete_member ON public.ad_budget_allocations;

DROP INDEX IF EXISTS public.ad_budget_allocations_period_idx;
DROP INDEX IF EXISTS public.ad_budget_allocations_account_idx;

DROP TABLE IF EXISTS public.ad_budget_allocations;
