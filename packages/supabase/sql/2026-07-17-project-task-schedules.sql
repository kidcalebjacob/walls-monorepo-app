-- Project task time-block schedules
-- Optional timed chunks for planning work on the calendar, separate from due_date.
-- Applied 2026-07-17 for Kenoo calendar + projects hub scheduling.
-- Source of truth for Kenoo DB (oehqusxpbwtbeenzixjh).

CREATE TABLE IF NOT EXISTS public.project_task_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  position integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT project_task_schedules_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_project_task_schedules_task_id
  ON public.project_task_schedules (task_id);

CREATE INDEX IF NOT EXISTS idx_project_task_schedules_time
  ON public.project_task_schedules (start_time, end_time);

COMMENT ON TABLE public.project_task_schedules IS
  'Timed work blocks for project_tasks. Independent of due_date; a task may have zero or many chunks.';

DROP TRIGGER IF EXISTS trg_project_task_schedules_updated_at ON public.project_task_schedules;
CREATE TRIGGER trg_project_task_schedules_updated_at
  BEFORE UPDATE ON public.project_task_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.project_task_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_task_schedules_select_accessible ON public.project_task_schedules;
DROP POLICY IF EXISTS project_task_schedules_insert_accessible ON public.project_task_schedules;
DROP POLICY IF EXISTS project_task_schedules_update_accessible ON public.project_task_schedules;
DROP POLICY IF EXISTS project_task_schedules_delete_accessible ON public.project_task_schedules;

CREATE POLICY project_task_schedules_select_accessible
  ON public.project_task_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = task_id
        AND public.is_project_accessible(t.project_id)
    )
  );

CREATE POLICY project_task_schedules_insert_accessible
  ON public.project_task_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = task_id
        AND public.is_project_accessible(t.project_id)
    )
  );

CREATE POLICY project_task_schedules_update_accessible
  ON public.project_task_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = task_id
        AND public.is_project_accessible(t.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = task_id
        AND public.is_project_accessible(t.project_id)
    )
  );

CREATE POLICY project_task_schedules_delete_accessible
  ON public.project_task_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = task_id
        AND public.is_project_accessible(t.project_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_schedules TO authenticated;
GRANT ALL ON public.project_task_schedules TO service_role;
