-- User work hours (wall-clock times in the user's timezone)
-- Used for calendar display and future auto-scheduling.
-- Interpreted relative to users.timezone (or browser default when timezone is null).
-- Applied 2026-07-17 for Kenoo settings + calendar.
-- Source of truth for Kenoo DB (oehqusxpbwtbeenzixjh).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS work_hours_start time,
  ADD COLUMN IF NOT EXISTS work_hours_end time;

COMMENT ON COLUMN public.users.work_hours_start IS
  'Start of workday as local wall-clock time (no timezone). Interpreted in users.timezone.';

COMMENT ON COLUMN public.users.work_hours_end IS
  'End of workday as local wall-clock time (no timezone). Interpreted in users.timezone.';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_work_hours_end_after_start;

ALTER TABLE public.users
  ADD CONSTRAINT users_work_hours_end_after_start
  CHECK (
    work_hours_start IS NULL
    OR work_hours_end IS NULL
    OR work_hours_end > work_hours_start
  );
