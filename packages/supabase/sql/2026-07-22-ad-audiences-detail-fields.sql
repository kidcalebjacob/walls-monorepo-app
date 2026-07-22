-- AdPilot: richer provider-agnostic audience detail columns for Meta/Google/X.
-- Applied 2026-07-22 via Supabase MCP (oehqusxpbwtbeenzixjh).

ALTER TABLE public.ad_audiences
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS status_code integer,
  ADD COLUMN IF NOT EXISTS is_ready boolean,
  ADD COLUMN IF NOT EXISTS catalog_source text,
  ADD COLUMN IF NOT EXISTS origin_type text,
  ADD COLUMN IF NOT EXISTS retention_days integer,
  ADD COLUMN IF NOT EXISTS data_source_id text,
  ADD COLUMN IF NOT EXISTS data_source_type text,
  ADD COLUMN IF NOT EXISTS rule_spec jsonb,
  ADD COLUMN IF NOT EXISTS lookalike_ratio numeric,
  ADD COLUMN IF NOT EXISTS lookalike_starting_ratio numeric,
  ADD COLUMN IF NOT EXISTS lookalike_country_codes text[],
  ADD COLUMN IF NOT EXISTS lookalike_origin_audience_ids text[],
  ADD COLUMN IF NOT EXISTS lookalike_origin_names text[],
  ADD COLUMN IF NOT EXISTS provider_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_updated_at timestamptz;

COMMENT ON COLUMN public.ad_audiences.status IS
  'Provider-agnostic delivery/readiness status label (e.g. Ready, Updating).';
COMMENT ON COLUMN public.ad_audiences.status_code IS
  'Provider-native numeric status code when available (Meta delivery_status.code).';
COMMENT ON COLUMN public.ad_audiences.is_ready IS
  'Whether the audience is usable for delivery across providers.';
COMMENT ON COLUMN public.ad_audiences.catalog_source IS
  'How AdPilot discovered the row: account_catalog | targeting_segment.';
COMMENT ON COLUMN public.ad_audiences.origin_type IS
  'Normalized origin: website, customer_file, engagement, app, lookalike, interest, remarketing, similar, etc.';
COMMENT ON COLUMN public.ad_audiences.retention_days IS
  'Membership retention window in days when the provider exposes one.';
COMMENT ON COLUMN public.ad_audiences.data_source_id IS
  'Upstream source id (pixel, app, customer list, remarketing tag) when known.';
COMMENT ON COLUMN public.ad_audiences.data_source_type IS
  'Upstream source kind: pixel, app, customer_file, page, video, user_list, etc.';
COMMENT ON COLUMN public.ad_audiences.rule_spec IS
  'Provider audience rules / filters as JSON (Meta rule, Google user list rules).';
COMMENT ON COLUMN public.ad_audiences.lookalike_ratio IS
  'Lookalike / similar expansion ratio (0.01–0.20 Meta; Google similar lists when available).';
COMMENT ON COLUMN public.ad_audiences.lookalike_starting_ratio IS
  'Optional lookalike band start ratio when the provider supports ranges.';
COMMENT ON COLUMN public.ad_audiences.lookalike_country_codes IS
  'Countries used to build the lookalike / similar audience.';
COMMENT ON COLUMN public.ad_audiences.lookalike_origin_audience_ids IS
  'Seed / origin audience provider IDs for lookalikes.';
COMMENT ON COLUMN public.ad_audiences.lookalike_origin_names IS
  'Seed / origin audience display names when the provider returns them.';
COMMENT ON COLUMN public.ad_audiences.provider_created_at IS
  'Provider-side created timestamp when available.';
COMMENT ON COLUMN public.ad_audiences.provider_updated_at IS
  'Provider-side updated timestamp when available.';

ALTER TABLE public.ad_audiences
  DROP CONSTRAINT IF EXISTS ad_audiences_type_check;

ALTER TABLE public.ad_audiences
  ADD CONSTRAINT ad_audiences_type_check
  CHECK (audience_type IN (
    'lookalike',
    'interest',
    'custom',
    'behavior',
    'life_event',
    'family_status',
    'industry',
    'income',
    'education',
    'work',
    'relationship',
    'remarketing',
    'similar',
    'in_market',
    'affinity',
    'custom_intent',
    'other'
  ));

ALTER TABLE public.ad_audiences
  DROP CONSTRAINT IF EXISTS ad_audiences_catalog_source_check;

ALTER TABLE public.ad_audiences
  ADD CONSTRAINT ad_audiences_catalog_source_check
  CHECK (
    catalog_source IS NULL
    OR catalog_source IN ('account_catalog', 'targeting_segment')
  );

ALTER TABLE public.ad_audience_usages
  ADD COLUMN IF NOT EXISTS targeting_context jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ad_audience_usages.targeting_context IS
  'Provider-agnostic snapshot of parent entity targeting when this usage was synced (age, geo, platforms, etc.).';

CREATE INDEX IF NOT EXISTS ad_audiences_origin_type_idx
  ON public.ad_audiences (account_id, origin_type);

CREATE INDEX IF NOT EXISTS ad_audiences_status_idx
  ON public.ad_audiences (account_id, status);
