-- AdPilot: Meta Insights age / gender / country demographic breakdowns.
-- Applied 2026-07-22 via Supabase MCP (oehqusxpbwtbeenzixjh).
-- Extends ad_metrics_daily_breakdowns used for device/placement.

ALTER TABLE public.ad_metrics_daily_breakdowns
  ADD COLUMN IF NOT EXISTS age text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.ad_metrics_daily_breakdowns.age IS
  'Meta age bucket (e.g. 18-24). Empty for non-age breakdowns.';
COMMENT ON COLUMN public.ad_metrics_daily_breakdowns.gender IS
  'Meta gender (male/female/unknown). Empty for non-gender breakdowns.';
COMMENT ON COLUMN public.ad_metrics_daily_breakdowns.country IS
  'Meta country code (e.g. us). Empty for non-country breakdowns.';

ALTER TABLE public.ad_metrics_daily_breakdowns
  DROP CONSTRAINT IF EXISTS ad_metrics_daily_breakdowns_type_check;

ALTER TABLE public.ad_metrics_daily_breakdowns
  ADD CONSTRAINT ad_metrics_daily_breakdowns_type_check
  CHECK (breakdown_type IN (
    'device_platform',
    'placement_device',
    'age',
    'gender',
    'age_gender',
    'country'
  ));

ALTER TABLE public.ad_metrics_daily_breakdowns
  DROP CONSTRAINT IF EXISTS ad_metrics_daily_breakdowns_unique;

ALTER TABLE public.ad_metrics_daily_breakdowns
  ADD CONSTRAINT ad_metrics_daily_breakdowns_unique
  UNIQUE (
    entity_id,
    metric_date,
    breakdown_type,
    publisher_platform,
    platform_position,
    device_platform,
    impression_device,
    age,
    gender,
    country
  );

CREATE INDEX IF NOT EXISTS ad_metrics_daily_breakdowns_demo_idx
  ON public.ad_metrics_daily_breakdowns (breakdown_type, age, gender, country)
  WHERE age <> '' OR gender <> '' OR country <> '';

COMMENT ON TABLE public.ad_metrics_daily_breakdowns IS
  'AdPilot: daily Meta Insights by device/placement or demographics (age, gender, age_gender, country).';
