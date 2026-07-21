import type { ProjectTask } from "./types";
import { getTaskAssigneeIds } from "./task-assignee";

export type TaskVisibilityFields = Pick<
  ProjectTask,
  "is_private" | "assignee_id" | "assigned_by" | "assignees"
> & {
  assignee_ids?: string[] | null;
};

/**
 * Public tasks: anyone with project access.
 * Private tasks: any assignee and the user who assigned the task only.
 */
export function isTaskVisibleToUser(
  task: TaskVisibilityFields,
  viewerUserId: string | null | undefined
): boolean {
  if (!task.is_private) return true;
  if (!viewerUserId) return false;
  const assigneeIds =
    task.assignee_ids ??
    getTaskAssigneeIds({
      assignees: task.assignees,
      assignee_id: task.assignee_id,
    });
  if (assigneeIds.includes(viewerUserId)) return true;
  return task.assigned_by === viewerUserId;
}

export function filterTasksVisibleToUser<T extends TaskVisibilityFields>(
  tasks: T[],
  viewerUserId: string | null | undefined
): T[] {
  return tasks.filter((task) => isTaskVisibleToUser(task, viewerUserId));
}
