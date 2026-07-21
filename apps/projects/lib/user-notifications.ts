import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECT_NOTIFICATION_TYPE = "projects";
export const SCOUTER_NOTIFICATION_TYPE = "scouter";
export const SCOUTER_INDEX_URL = "/agents/scouter";

export type UserNotificationInsert = {
  user_id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  redirect_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function insertUserNotifications(
  supabase: SupabaseClient,
  notifications: UserNotificationInsert[]
): Promise<void> {
  if (notifications.length === 0) return;

  const rows = notifications.map((n) => ({
    user_id: n.user_id,
    title: n.title,
    body: n.body ?? null,
    type: n.type ?? "info",
    redirect_url: n.redirect_url ?? null,
    metadata: n.metadata ?? null,
  }));

  const { error } = await supabase.from("user_notifications").insert(rows);
  if (error) {
    console.error("Failed to insert user notifications:", error);
  }
}

export function projectBoardUrl(projectId: string): string {
  return `/tasks?project=${projectId}`;
}

/** Scouter notifications open the index, not a specific profile sheet. */
export function scouterNotificationUrl(): string {
  return SCOUTER_INDEX_URL;
}

export async function resolveTeamMemberUserId(
  supabase: SupabaseClient,
  teamOrUserId: string | null | undefined
): Promise<string | null> {
  if (!teamOrUserId) return null;

  const { data: teamRow } = await supabase
    .from("team")
    .select("user_id")
    .eq("id", teamOrUserId)
    .maybeSingle();

  if (teamRow?.user_id) return teamRow.user_id;

  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("id", teamOrUserId)
    .maybeSingle();

  return userRow?.id ?? teamOrUserId;
}

export async function notifyScouterProfileAssigned(
  supabase: SupabaseClient,
  options: {
    assigneeTeamId: string;
    profileId: string;
    profileName: string;
    actorUserId: string | null | undefined;
    actorName: string;
  }
): Promise<void> {
  const { assigneeTeamId, profileId, profileName, actorUserId, actorName } = options;
  const assigneeUserId = await resolveTeamMemberUserId(supabase, assigneeTeamId);
  if (!assigneeUserId || assigneeUserId === actorUserId) return;

  await insertUserNotifications(supabase, [
    {
      user_id: assigneeUserId,
      title: "New scouter profile assigned",
      body: `${actorName} assigned you ${profileName}`,
      type: SCOUTER_NOTIFICATION_TYPE,
      redirect_url: scouterNotificationUrl(),
      metadata: {
        kind: "scouter_profile_assigned",
        profile_id: profileId,
        assigned_by: actorUserId ?? null,
        scouted_by: assigneeTeamId,
      },
    },
  ]);
}

export async function notifyProjectMembersAdded(
  supabase: SupabaseClient,
  options: {
    userIds: string[];
    projectId: string;
    projectName: string;
    actorUserId: string | null | undefined;
    actorName: string;
  }
): Promise<void> {
  const { userIds, projectId, projectName, actorUserId, actorName } = options;
  const recipients = userIds.filter((id) => id && id !== actorUserId);
  if (recipients.length === 0) return;

  await insertUserNotifications(
    supabase,
    recipients.map((userId) => ({
      user_id: userId,
      title: "Added to project",
      body: `${actorName} added you to "${projectName}"`,
      type: PROJECT_NOTIFICATION_TYPE,
      redirect_url: projectBoardUrl(projectId),
      metadata: {
        kind: "project_member_added",
        project_id: projectId,
        added_by: actorUserId ?? null,
      },
    }))
  );
}

export async function notifyTaskAssignee(
  supabase: SupabaseClient,
  options: {
    assigneeId: string;
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName?: string | null;
    actorUserId: string | null | undefined;
    actorName: string;
  }
): Promise<void> {
  const { assigneeId, taskId, taskTitle, projectId, projectName, actorUserId, actorName } =
    options;

  if (!assigneeId || assigneeId === actorUserId) return;

  const projectLabel = projectName ? ` in "${projectName}"` : "";

  await insertUserNotifications(supabase, [
    {
      user_id: assigneeId,
      title: "Task assigned to you",
      body: `${actorName} assigned you "${taskTitle}"${projectLabel}`,
      type: PROJECT_NOTIFICATION_TYPE,
      redirect_url: projectBoardUrl(projectId),
      metadata: {
        kind: "task_assigned",
        task_id: taskId,
        project_id: projectId,
        assigned_by: actorUserId ?? null,
      },
    },
  ]);
}

type TaskCompletionNotifyRow = {
  id: string;
  title: string;
  project_id: string;
  assignee_id: string | null;
  assigned_by: string | null;
  assignees?: { id: string }[] | null;
  projects?: { name: string } | { name: string }[] | null;
};

function projectNameFromTaskRow(
  projects: TaskCompletionNotifyRow["projects"]
): string | null {
  if (!projects) return null;
  const row = Array.isArray(projects) ? projects[0] : projects;
  return row?.name ?? null;
}

function taskHasAssignee(
  task: TaskCompletionNotifyRow,
  userId: string
): boolean {
  if (task.assignees?.some((a) => a.id === userId)) return true;
  return task.assignee_id === userId;
}

/** Notify `assigned_by` when the assignee marks a task complete. */
export async function notifyTaskAssignerOnComplete(
  supabase: SupabaseClient,
  options: {
    assignerId: string;
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName?: string | null;
    completerUserId: string | null | undefined;
    completerName: string;
  }
): Promise<void> {
  const {
    assignerId,
    taskId,
    taskTitle,
    projectId,
    projectName,
    completerUserId,
    completerName,
  } = options;

  if (!assignerId || assignerId === completerUserId) return;

  const projectLabel = projectName ? ` in "${projectName}"` : "";

  await insertUserNotifications(supabase, [
    {
      user_id: assignerId,
      title: "Task completed",
      body: `${completerName} completed "${taskTitle}"${projectLabel}`,
      type: PROJECT_NOTIFICATION_TYPE,
      redirect_url: projectBoardUrl(projectId),
      metadata: {
        kind: "task_completed",
        task_id: taskId,
        project_id: projectId,
        completed_by: completerUserId ?? null,
      },
    },
  ]);
}

export async function notifyAssignersForCompletedTasks(
  supabase: SupabaseClient,
  tasks: TaskCompletionNotifyRow[],
  completerUserId: string,
  completerName: string
): Promise<void> {
  await Promise.all(
    tasks.map((task) => {
      if (!task.assigned_by || task.assigned_by === completerUserId) {
        return Promise.resolve();
      }
      if (!taskHasAssignee(task, completerUserId)) {
        return Promise.resolve();
      }
      return notifyTaskAssignerOnComplete(supabase, {
        assignerId: task.assigned_by,
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.project_id,
        projectName: projectNameFromTaskRow(task.projects),
        completerUserId,
        completerName,
      });
    })
  );
}

export async function resolveActorDisplayName(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<string> {
  if (!userId) return "Someone";

  const { data } = await supabase
    .from("users")
    .select("first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return "Someone";

  const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
  return name || data.email || "Someone";
}
