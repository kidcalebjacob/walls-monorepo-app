-- Apple Health / HealthKit schema extensions
-- Applied 2026-07-16 for Wallie Mobile HealthKit sync.
-- Source of truth for Kenoo DB (oehqusxpbwtbeenzixjh).

ALTER TABLE public.user_connections
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN refresh_token DROP NOT NULL;

ALTER TABLE public.health_daily_summaries
  ADD COLUMN IF NOT EXISTS steps integer,
  ADD COLUMN IF NOT EXISTS distance_walking_meters numeric(12,2),
  ADD COLUMN IF NOT EXISTS flights_climbed numeric(8,2),
  ADD COLUMN IF NOT EXISTS active_energy_kcal integer,
  ADD COLUMN IF NOT EXISTS basal_energy_kcal integer,
  ADD COLUMN IF NOT EXISTS exercise_minutes integer,
  ADD COLUMN IF NOT EXISTS stand_minutes integer,
  ADD COLUMN IF NOT EXISTS stand_hours smallint,
  ADD COLUMN IF NOT EXISTS resting_heart_rate smallint,
  ADD COLUMN IF NOT EXISTS avg_heart_rate smallint,
  ADD COLUMN IF NOT EXISTS walking_heart_rate_avg smallint,
  ADD COLUMN IF NOT EXISTS hrv_sdnn_ms numeric(8,2),
  ADD COLUMN IF NOT EXISTS respiratory_rate numeric(6,2),
  ADD COLUMN IF NOT EXISTS oxygen_saturation numeric(5,4),
  ADD COLUMN IF NOT EXISTS body_temperature_c numeric(5,2),
  ADD COLUMN IF NOT EXISTS blood_glucose_mg_dl numeric(8,2),
  ADD COLUMN IF NOT EXISTS vo2_max numeric(6,2),
  ADD COLUMN IF NOT EXISTS mindfulness_minutes integer,
  ADD COLUMN IF NOT EXISTS sleep_asleep_minutes integer,
  ADD COLUMN IF NOT EXISTS sleep_in_bed_minutes integer,
  ADD COLUMN IF NOT EXISTS sleep_deep_minutes integer,
  ADD COLUMN IF NOT EXISTS sleep_rem_minutes integer,
  ADD COLUMN IF NOT EXISTS sleep_core_minutes integer,
  ADD COLUMN IF NOT EXISTS sleep_awake_minutes integer,
  ADD COLUMN IF NOT EXISTS apple_health_synced_at timestamptz;

CREATE TABLE IF NOT EXISTS public.health_metric_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_connection_id uuid REFERENCES public.user_connections(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'apple_health',
  provider_sample_id text,
  metric_type text NOT NULL,
  recorded_at timestamptz NOT NULL,
  ended_at timestamptz,
  value numeric(14,6) NOT NULL,
  unit text NOT NULL,
  source_name text,
  source_bundle_id text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS health_metric_samples_provider_sample_key
  ON public.health_metric_samples (user_id, provider, provider_sample_id)
  WHERE provider_sample_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS health_metric_samples_user_metric_time_idx
  ON public.health_metric_samples (user_id, metric_type, recorded_at DESC);

ALTER TABLE public.health_metric_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_metric_samples_select_own ON public.health_metric_samples;
DROP POLICY IF EXISTS health_metric_samples_insert_own ON public.health_metric_samples;
DROP POLICY IF EXISTS health_metric_samples_update_own ON public.health_metric_samples;
DROP POLICY IF EXISTS health_metric_samples_delete_own ON public.health_metric_samples;

CREATE POLICY health_metric_samples_select_own
  ON public.health_metric_samples FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY health_metric_samples_insert_own
  ON public.health_metric_samples FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY health_metric_samples_update_own
  ON public.health_metric_samples FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY health_metric_samples_delete_own
  ON public.health_metric_samples FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_metric_samples TO authenticated;
GRANT ALL ON public.health_metric_samples TO service_role;

CREATE TABLE IF NOT EXISTS public.health_sleep_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_connection_id uuid REFERENCES public.user_connections(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'apple_health',
  provider_session_id text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  asleep_minutes integer NOT NULL DEFAULT 0,
  in_bed_minutes integer NOT NULL DEFAULT 0,
  deep_minutes integer NOT NULL DEFAULT 0,
  rem_minutes integer NOT NULL DEFAULT 0,
  core_minutes integer NOT NULL DEFAULT 0,
  awake_minutes integer NOT NULL DEFAULT 0,
  source_name text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS health_sleep_sessions_provider_session_key
  ON public.health_sleep_sessions (user_id, provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS health_sleep_sessions_user_started_idx
  ON public.health_sleep_sessions (user_id, started_at DESC);

ALTER TABLE public.health_sleep_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_sleep_sessions_select_own ON public.health_sleep_sessions;
DROP POLICY IF EXISTS health_sleep_sessions_insert_own ON public.health_sleep_sessions;
DROP POLICY IF EXISTS health_sleep_sessions_update_own ON public.health_sleep_sessions;
DROP POLICY IF EXISTS health_sleep_sessions_delete_own ON public.health_sleep_sessions;

CREATE POLICY health_sleep_sessions_select_own
  ON public.health_sleep_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY health_sleep_sessions_insert_own
  ON public.health_sleep_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY health_sleep_sessions_update_own
  ON public.health_sleep_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY health_sleep_sessions_delete_own
  ON public.health_sleep_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_sleep_sessions TO authenticated;
GRANT ALL ON public.health_sleep_sessions TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS health_weight_logs_apple_sample_key
  ON public.health_weight_logs (user_id, ((source_metadata ->> 'provider_sample_id')))
  WHERE source = 'apple_health'
    AND (source_metadata ->> 'provider_sample_id') IS NOT NULL;
