-- Per-user dashboard widget visibility for WALLS Health.
-- Applied 2026-07-19 via Supabase MCP (health_dashboard_widgets).
-- Source of truth for Kenoo DB (oehqusxpbwtbeenzixjh).

CREATE TABLE IF NOT EXISTS public.health_dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visible_widgets text[] NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT health_dashboard_widgets_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS health_dashboard_widgets_user_id_idx
  ON public.health_dashboard_widgets (user_id);

COMMENT ON TABLE public.health_dashboard_widgets IS
  'Stores which dashboard metric widgets each user wants visible in the health app.';

ALTER TABLE public.health_dashboard_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_dashboard_widgets_select_own ON public.health_dashboard_widgets;
DROP POLICY IF EXISTS health_dashboard_widgets_insert_own ON public.health_dashboard_widgets;
DROP POLICY IF EXISTS health_dashboard_widgets_update_own ON public.health_dashboard_widgets;
DROP POLICY IF EXISTS health_dashboard_widgets_delete_own ON public.health_dashboard_widgets;

CREATE POLICY health_dashboard_widgets_select_own
  ON public.health_dashboard_widgets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY health_dashboard_widgets_insert_own
  ON public.health_dashboard_widgets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY health_dashboard_widgets_update_own
  ON public.health_dashboard_widgets FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY health_dashboard_widgets_delete_own
  ON public.health_dashboard_widgets FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_dashboard_widgets TO authenticated;
GRANT ALL ON public.health_dashboard_widgets TO service_role;
