-- AdPilot: Meta audiences catalog + ad-set targeting usage links.
-- Applied 2026-07-22 via Supabase MCP (oehqusxpbwtbeenzixjh).

ALTER TABLE public.ad_metrics_daily
  ADD COLUMN IF NOT EXISTS add_to_cart numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ad_metrics_daily.add_to_cart IS
  'Add-to-cart actions for the day (omni/pixel priority, same as breakdowns).';

CREATE TABLE IF NOT EXISTS public.ad_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta',
  provider_audience_id text NOT NULL,
  audience_type text NOT NULL,
  name text NOT NULL,
  subtype text,
  description text,
  approximate_size_lower bigint,
  approximate_size_upper bigint,
  lookalike_spec jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  CONSTRAINT ad_audiences_type_check
    CHECK (audience_type IN (
      'lookalike',
      'interest',
      'custom',
      'behavior',
      'life_event',
      'family_status',
      'industry',
      'income',
      'other'
    )),
  CONSTRAINT ad_audiences_unique
    UNIQUE (account_connection_id, provider, provider_audience_id, audience_type)
);

COMMENT ON TABLE public.ad_audiences IS
  'AdPilot: Meta audiences (custom/lookalike from account edge + interests/behaviors from ad-set targeting).';

CREATE INDEX IF NOT EXISTS ad_audiences_account_type_idx
  ON public.ad_audiences (account_id, audience_type);

CREATE INDEX IF NOT EXISTS ad_audiences_connection_idx
  ON public.ad_audiences (account_connection_id);

CREATE INDEX IF NOT EXISTS ad_audiences_name_idx
  ON public.ad_audiences (account_id, name);

CREATE TABLE IF NOT EXISTS public.ad_audience_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_connection_id uuid NOT NULL REFERENCES public.account_connections(id) ON DELETE CASCADE,
  audience_id uuid NOT NULL REFERENCES public.ad_audiences(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.ad_entities(id) ON DELETE CASCADE,
  inclusion text NOT NULL DEFAULT 'include',
  source text NOT NULL DEFAULT 'targeting',
  CONSTRAINT ad_audience_usages_inclusion_check
    CHECK (inclusion IN ('include', 'exclude')),
  CONSTRAINT ad_audience_usages_unique
    UNIQUE (audience_id, entity_id, inclusion)
);

COMMENT ON TABLE public.ad_audience_usages IS
  'AdPilot: which ad entities (typically ad sets) include/exclude a given audience in targeting.';

CREATE INDEX IF NOT EXISTS ad_audience_usages_entity_idx
  ON public.ad_audience_usages (entity_id);

CREATE INDEX IF NOT EXISTS ad_audience_usages_audience_idx
  ON public.ad_audience_usages (audience_id);

CREATE INDEX IF NOT EXISTS ad_audience_usages_account_idx
  ON public.ad_audience_usages (account_id);

ALTER TABLE public.ad_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_audience_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_audiences_select_member ON public.ad_audiences;
CREATE POLICY ad_audiences_select_member
  ON public.ad_audiences
  FOR SELECT
  TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_audiences_insert_member ON public.ad_audiences;
CREATE POLICY ad_audiences_insert_member
  ON public.ad_audiences
  FOR INSERT
  TO authenticated
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_audiences_update_member ON public.ad_audiences;
CREATE POLICY ad_audiences_update_member
  ON public.ad_audiences
  FOR UPDATE
  TO authenticated
  USING (is_ad_account_member(account_id))
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_audiences_delete_member ON public.ad_audiences;
CREATE POLICY ad_audiences_delete_member
  ON public.ad_audiences
  FOR DELETE
  TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_audience_usages_select_member ON public.ad_audience_usages;
CREATE POLICY ad_audience_usages_select_member
  ON public.ad_audience_usages
  FOR SELECT
  TO authenticated
  USING (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_audience_usages_insert_member ON public.ad_audience_usages;
CREATE POLICY ad_audience_usages_insert_member
  ON public.ad_audience_usages
  FOR INSERT
  TO authenticated
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_audience_usages_update_member ON public.ad_audience_usages;
CREATE POLICY ad_audience_usages_update_member
  ON public.ad_audience_usages
  FOR UPDATE
  TO authenticated
  USING (is_ad_account_member(account_id))
  WITH CHECK (is_ad_account_member(account_id));

DROP POLICY IF EXISTS ad_audience_usages_delete_member ON public.ad_audience_usages;
CREATE POLICY ad_audience_usages_delete_member
  ON public.ad_audience_usages
  FOR DELETE
  TO authenticated
  USING (is_ad_account_member(account_id));
