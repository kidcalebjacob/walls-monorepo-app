import type { ProjectTask, TaskAssignee, TaskStatus } from "./types";

export function getTaskAssigneeDisplayName(
  assignee: TaskAssignee | null | undefined,
  assigneeId: string | null | undefined,
  currentUserId?: string | null
): string {
  if (assigneeId && currentUserId && assigneeId === currentUserId) return "You";
  if (!assignee) return assigneeId ? "Assigned" : "Unassigned";
  const name = `${assignee.first_name ?? ""} ${assignee.last_name ?? ""}`.trim();
  return name || assignee.email || "Unassigned";
}

export function getTaskAssigneesDisplayLabel(
  assignees: TaskAssignee[] | null | undefined,
  currentUserId?: string | null
): string {
  const list = assignees ?? [];
  if (list.length === 0) return "Unassigned";
  if (list.length === 1) {
    return getTaskAssigneeDisplayName(list[0], list[0].id, currentUserId);
  }

  const names = list.map((a) =>
    getTaskAssigneeDisplayName(a, a.id, currentUserId)
  );
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]} +${names.length - 1}`;
}

export function getTaskAssigneeInitials(
  assignee: TaskAssignee | null | undefined
): string {
  if (!assignee) return "?";
  const first = assignee.first_name?.[0] ?? "";
  const last = assignee.last_name?.[0] ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return assignee.email?.[0]?.toUpperCase() ?? "?";
}

function parseAssigneeEntry(entry: unknown): TaskAssignee | null {
  if (!entry || typeof entry !== "object" || !("id" in entry)) return null;
  return entry as TaskAssignee;
}

/** Pull assignees from join embed or legacy single assignee embed. */
export function extractTaskAssignees(
  row: Record<string, unknown>
): TaskAssignee[] {
  const joinRaw = row.task_assignees ?? row.project_task_assignees;
  if (Array.isArray(joinRaw) && joinRaw.length > 0) {
    const parsed: TaskAssignee[] = [];
    for (const link of joinRaw) {
      if (!link || typeof link !== "object") continue;
      const userRaw =
        (link as { user?: unknown; users?: unknown }).user ??
        (link as { users?: unknown }).users;
      const entry = Array.isArray(userRaw) ? userRaw[0] : userRaw;
      const assignee = parseAssigneeEntry(entry);
      if (assignee) parsed.push(assignee);
    }
    if (parsed.length > 0) return parsed;
  }

  const assigneeRaw = row.assignee ?? row.users;
  if (assigneeRaw) {
    const entry = Array.isArray(assigneeRaw) ? assigneeRaw[0] : assigneeRaw;
    const assignee = parseAssigneeEntry(entry);
    if (assignee) return [assignee];
  }

  return [];
}

export function getTaskAssigneeIds(task: {
  assignees?: TaskAssignee[] | null;
  assignee_id?: string | null;
}): string[] {
  if (task.assignees && task.assignees.length > 0) {
    return task.assignees.map((a) => a.id);
  }
  return task.assignee_id ? [task.assignee_id] : [];
}

export function isUserTaskAssignee(
  task: {
    assignees?: TaskAssignee[] | null;
    assignee_id?: string | null;
  },
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  return getTaskAssigneeIds(task).includes(userId);
}

/** Normalizes a Supabase `project_tasks` row (optional embedded assignees). */
export function mapProjectTaskRow(
  row: Record<string, unknown>
): Omit<ProjectTask, "project"> {
  const assignees = extractTaskAssignees(row);
  const primary = assignees[0] ?? null;

  const {
    assignee: _a,
    users: _u,
    task_assignees: _ta,
    project_task_assignees: _pta,
    ...rest
  } = row;
  const rawStatus = String(rest.status ?? "todo");
  const status = (
    rawStatus === "done" ? "completed" : rawStatus
  ) as TaskStatus;

  const assigneeId =
    (rest.assignee_id as string | null | undefined) ?? primary?.id ?? null;

  return {
    ...(rest as Omit<
      ProjectTask,
      "project" | "assignee" | "assignees" | "status" | "assignee_id"
    >),
    status,
    assignee_id: assigneeId,
    assignee: primary,
    assignees,
  };
}

/** Select fragment for task queries that need assignees on cards. */
export const PROJECT_TASK_SELECT_WITH_ASSIGNEE =
  "id, project_id, title, description, status, due_date, priority, position, parent_task_id, created_at, updated_at, completed_at, start_date, assignee_id, assigned_by, is_private, estimated_minutes, actual_minutes, metadata, assignee:users!assignee_id(id, first_name, last_name, email, avatar_url), task_assignees:project_task_assignees(user_id, user:users!project_task_assignees_user_id_fkey(id, first_name, last_name, email, avatar_url))";

type AssigneesClient = {
  from: (table: string) => any;
};

/** Replace join rows for a task. Keeps order of `userIds`. */
export async function syncProjectTaskAssignees(
  supabase: AssigneesClient,
  taskId: string,
  userIds: string[],
  assignedBy: string | null
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("project_task_assignees")
    .delete()
    .eq("task_id", taskId);
  if (deleteError) throw deleteError;

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("project_task_assignees")
    .insert(
      uniqueIds.map((user_id) => ({
        task_id: taskId,
        user_id,
        assigned_by: assignedBy,
      }))
    );
  if (insertError) throw insertError;
}
