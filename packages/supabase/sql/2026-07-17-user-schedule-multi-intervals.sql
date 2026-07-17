-- Allow multiple time blocks per weekday on a user schedule
-- (e.g. Personal: 07:00–09:00 and 17:00–22:00 on the same day).
-- Applied 2026-07-17 for Kenoo schedules UX.
-- Source of truth for Kenoo DB (oehqusxpbwtbeenzixjh).

ALTER TABLE public.user_schedule_days
  DROP CONSTRAINT IF EXISTS user_schedule_days_unique_day;

-- Prevent identical duplicate blocks; overlapping ranges are allowed to be
-- cleaned up in the app (slots merge on save).
CREATE UNIQUE INDEX IF NOT EXISTS user_schedule_days_unique_interval
  ON public.user_schedule_days (schedule_id, day_of_week, start_time, end_time);

COMMENT ON TABLE public.user_schedule_days IS
  'Time blocks for a user_schedule. Multiple rows per weekday are allowed (split days). day_of_week 0=Sun…6=Sat. Absent day = day off.';
