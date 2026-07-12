import type { ProjectTask } from "./types";

export type TaskVisibilityFields = Pick<
  ProjectTask,
  "is_private" | "assignee_id" | "assigned_by"
>;

/**
 * Public tasks: anyone with project access.
 * Private tasks: assignee and the user who assigned the task only.
 */
export function isTaskVisibleToUser(
  task: TaskVisibilityFields,
  viewerUserId: string | null | undefined
): boolean {
  if (!task.is_private) return true;
  if (!viewerUserId) return false;
  if (task.assignee_id === viewerUserId) return true;
  return task.assigned_by === viewerUserId;
}

export function filterTasksVisibleToUser<T extends TaskVisibilityFields>(
  tasks: T[],
  viewerUserId: string | null | undefined
): T[] {
  return tasks.filter((task) => isTaskVisibleToUser(task, viewerUserId));
}
