-- Remove organization scoping from AdPilot ad_* tables.
-- Organizations settings tables (organizations, user_organizations) are unchanged.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ad_account_settings',
    'ad_automation_profiles',
    'ad_budget_adjustments',
    'ad_creative_assets',
    'ad_creatives',
    'ad_entities',
    'ad_entity_automation',
    'ad_metrics_daily',
    'ad_sync_state'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      tbl,
      tbl || '_organization_id_fkey'
    );
    EXECUTE format(
      'DROP INDEX IF EXISTS public.%I',
      tbl || '_organization_id_idx'
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP COLUMN IF EXISTS organization_id',
      tbl
    );
  END LOOP;
END $$;
