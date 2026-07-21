-- Multi-assignee support for project_tasks
-- Join table pattern (same idea as project_members / project_task_schedules).
-- assignee_id on project_tasks is kept as a denormalized primary assignee
-- (first assignee) for backward compatibility with calendar and existing filters.
-- Applied 2026-07-20 for Kenoo DB (oehqusxpbwtbeenzixjh).

CREATE TABLE IF NOT EXISTS public.project_task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT project_task_assignees_task_user_unique UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_task_assignees_task_id
  ON public.project_task_assignees (task_id);

CREATE INDEX IF NOT EXISTS idx_project_task_assignees_user_id
  ON public.project_task_assignees (user_id);

COMMENT ON TABLE public.project_task_assignees IS
  'Many-to-many assignees for project_tasks. A task may have zero or many assignees.';

-- Backfill from existing single assignee_id
INSERT INTO public.project_task_assignees (task_id, user_id, assigned_by)
SELECT t.id, t.assignee_id, t.assigned_by
FROM public.project_tasks t
WHERE t.assignee_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

ALTER TABLE public.project_task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_task_assignees_select_accessible ON public.project_task_assignees;
DROP POLICY IF EXISTS project_task_assignees_insert_accessible ON public.project_task_assignees;
DROP POLICY IF EXISTS project_task_assignees_update_accessible ON public.project_task_assignees;
DROP POLICY IF EXISTS project_task_assignees_delete_accessible ON public.project_task_assignees;

CREATE POLICY project_task_assignees_select_accessible
  ON public.project_task_assignees
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

CREATE POLICY project_task_assignees_insert_accessible
  ON public.project_task_assignees
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

CREATE POLICY project_task_assignees_update_accessible
  ON public.project_task_assignees
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

CREATE POLICY project_task_assignees_delete_accessible
  ON public.project_task_assignees
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_assignees TO authenticated;
GRANT ALL ON public.project_task_assignees TO service_role;
