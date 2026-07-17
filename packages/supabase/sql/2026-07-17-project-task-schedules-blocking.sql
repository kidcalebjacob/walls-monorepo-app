-- Optional calendar blocking for project task schedule chunks
-- When true, the timed block should be treated as busy/blocked time.
-- Applied 2026-07-17 for Kenoo calendar task scheduling UI.
-- Source of truth for Kenoo DB (oehqusxpbwtbeenzixjh).

ALTER TABLE public.project_task_schedules
  ADD COLUMN IF NOT EXISTS is_blocking boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project_task_schedules.is_blocking IS
  'When true, this schedule chunk blocks calendar time (busy). Default false.';
