-- AdPilot: store reusable agentic instruction templates on workspace presets.
-- Copied onto campaigns/ad sets when a preset is applied.
-- Applied 2026-07-23 via Supabase MCP (oehqusxpbwtbeenzixjh).

ALTER TABLE public.ad_automation_profiles
  ADD COLUMN IF NOT EXISTS agent_instructions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ad_automation_profiles.agent_instructions IS
  'JSON array of agentic instruction templates [{ "instructions": "..." }, ...] copied onto entities when the preset is applied.';

ALTER TABLE public.ad_automation_profiles
  DROP CONSTRAINT IF EXISTS ad_automation_profiles_agent_instructions_is_array;

ALTER TABLE public.ad_automation_profiles
  ADD CONSTRAINT ad_automation_profiles_agent_instructions_is_array
  CHECK (jsonb_typeof(agent_instructions) = 'array');
