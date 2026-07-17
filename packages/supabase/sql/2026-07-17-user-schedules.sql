-- User schedules: named work / personal / custom calendars with per-weekday hours.
-- Replaces users.work_hours_start / users.work_hours_end.
-- Applied 2026-07-17 for Kenoo settings + calendar.
-- Source of truth for Kenoo DB (oehqusxpbwtbeenzixjh).
--
-- Model (intentionally small):
--   user_schedules      → named schedule (Work, Personal, or custom)
--   user_schedule_days  → one row per active weekday (missing day = day off)
-- day_of_week uses JS Date.getDay(): 0=Sunday … 6=Saturday.

CREATE TABLE IF NOT EXISTS public.user_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('work', 'personal', 'custom')),
  color text,
  CONSTRAINT user_schedules_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_schedules_user_id
  ON public.user_schedules (user_id);

-- At most one built-in Work and one Personal schedule per user.
CREATE UNIQUE INDEX IF NOT EXISTS user_schedules_one_work_per_user
  ON public.user_schedules (user_id)
  WHERE kind = 'work';

CREATE UNIQUE INDEX IF NOT EXISTS user_schedules_one_personal_per_user
  ON public.user_schedules (user_id)
  WHERE kind = 'personal';

COMMENT ON TABLE public.user_schedules IS
  'Named availability schedules per user. kind=work|personal are defaults; custom is freeform.';

CREATE TABLE IF NOT EXISTS public.user_schedule_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  schedule_id uuid NOT NULL REFERENCES public.user_schedules(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CONSTRAINT user_schedule_days_end_after_start CHECK (end_time > start_time)
);

-- Multiple blocks per weekday are allowed (e.g. 07:00–09:00 and 17:00–22:00).
CREATE UNIQUE INDEX IF NOT EXISTS user_schedule_days_unique_interval
  ON public.user_schedule_days (schedule_id, day_of_week, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_user_schedule_days_schedule_id
  ON public.user_schedule_days (schedule_id);

COMMENT ON TABLE public.user_schedule_days IS
  'Time blocks for a user_schedule. Multiple rows per weekday allowed. day_of_week 0=Sun…6=Sat. Absent day = day off.';

COMMENT ON COLUMN public.user_schedule_days.day_of_week IS
  '0=Sunday, 1=Monday, …, 6=Saturday (matches JavaScript Date.getDay()).';

DROP TRIGGER IF EXISTS trg_user_schedules_updated_at ON public.user_schedules;
CREATE TRIGGER trg_user_schedules_updated_at
  BEFORE UPDATE ON public.user_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_schedule_days_updated_at ON public.user_schedule_days;
CREATE TRIGGER trg_user_schedule_days_updated_at
  BEFORE UPDATE ON public.user_schedule_days
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schedule_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_schedules_select_own ON public.user_schedules;
DROP POLICY IF EXISTS user_schedules_insert_own ON public.user_schedules;
DROP POLICY IF EXISTS user_schedules_update_own ON public.user_schedules;
DROP POLICY IF EXISTS user_schedules_delete_own ON public.user_schedules;

CREATE POLICY user_schedules_select_own
  ON public.user_schedules FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_schedules_insert_own
  ON public.user_schedules FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_schedules_update_own
  ON public.user_schedules FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_schedules_delete_own
  ON public.user_schedules FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_schedule_days_select_own ON public.user_schedule_days;
DROP POLICY IF EXISTS user_schedule_days_insert_own ON public.user_schedule_days;
DROP POLICY IF EXISTS user_schedule_days_update_own ON public.user_schedule_days;
DROP POLICY IF EXISTS user_schedule_days_delete_own ON public.user_schedule_days;

CREATE POLICY user_schedule_days_select_own
  ON public.user_schedule_days FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_schedules s
      WHERE s.id = schedule_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY user_schedule_days_insert_own
  ON public.user_schedule_days FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_schedules s
      WHERE s.id = schedule_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY user_schedule_days_update_own
  ON public.user_schedule_days FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_schedules s
      WHERE s.id = schedule_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_schedules s
      WHERE s.id = schedule_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY user_schedule_days_delete_own
  ON public.user_schedule_days FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_schedules s
      WHERE s.id = schedule_id
        AND s.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_schedules TO authenticated;
GRANT ALL ON public.user_schedules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_schedule_days TO authenticated;
GRANT ALL ON public.user_schedule_days TO service_role;

-- Migrate existing flat work hours → Work schedule, Mon–Fri.
INSERT INTO public.user_schedules (user_id, name, kind)
SELECT u.id, 'Work', 'work'
FROM public.users u
WHERE u.work_hours_start IS NOT NULL
  AND u.work_hours_end IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_schedules s
    WHERE s.user_id = u.id
      AND s.kind = 'work'
  );

INSERT INTO public.user_schedule_days (schedule_id, day_of_week, start_time, end_time)
SELECT s.id, d.dow, u.work_hours_start, u.work_hours_end
FROM public.user_schedules s
JOIN public.users u ON u.id = s.user_id
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS d(dow)
WHERE s.kind = 'work'
  AND u.work_hours_start IS NOT NULL
  AND u.work_hours_end IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_schedule_days sd
    WHERE sd.schedule_id = s.id
      AND sd.day_of_week = d.dow
  );

-- Ensure Personal default exists for anyone who already has Work.
INSERT INTO public.user_schedules (user_id, name, kind)
SELECT s.user_id, 'Personal', 'personal'
FROM public.user_schedules s
WHERE s.kind = 'work'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_schedules p
    WHERE p.user_id = s.user_id
      AND p.kind = 'personal'
  );

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_work_hours_end_after_start;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS work_hours_start,
  DROP COLUMN IF EXISTS work_hours_end;
