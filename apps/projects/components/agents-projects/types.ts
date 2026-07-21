export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "in_review"
  | "on_hold"
  | "completed"
  | "blocked";

export type BoardTaskScope = "project" | "mine" | "assigned";

export const BOARD_TASK_SCOPE_CONFIG: Record<
  BoardTaskScope,
  { label: string; menuLabel: string }
> = {
  project: { label: "All", menuLabel: "All Tasks" },
  mine: { label: "Mine", menuLabel: "My Tasks" },
  assigned: { label: "Assigned", menuLabel: "Assigned Tasks" },
};

export interface Project {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  owner_id: string | null;
  account_id: string;
  priority: number | null;
  color: string | null;
  metadata: Record<string, unknown> | null;
  slug: string;
}

export interface ProjectWithStats extends Project {
  task_count: number;
  done_count: number;
}

export interface TaskAssignee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
}

/** Timed work block for a project task — independent of due_date. */
export interface ProjectTaskSchedule {
  id: string;
  created_at: string;
  updated_at: string;
  task_id: string;
  start_time: string;
  end_time: string;
  position: number;
  notes: string | null;
  created_by: string | null;
  /** When true, this chunk blocks calendar time (busy). */
  is_blocking?: boolean;
}

export interface ProjectTask {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  position: number | null;
  priority: number | null;
  /** Primary / first assignee — kept in sync with `assignees[0]` for backward compat. */
  assignee_id: string | null;
  /** @deprecated Prefer `assignees`; still populated as the primary assignee. */
  assignee?: TaskAssignee | null;
  /** All tagged assignees for this task. */
  assignees?: TaskAssignee[];
  assigned_by: string | null;
  is_private: boolean;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  metadata: Record<string, unknown> | null;
  /** Optional calendar time chunks; empty/undefined = unscheduled. */
  schedules?: ProjectTaskSchedule[];
  project?: {
    id: string;
    name: string;
    color: string | null;
  };
}

export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; badge: string; accent: string }
> = {
  planning: {
    label: "Planning",
    badge: "bg-indigo-100 text-indigo-700",
    accent: "rgb(99 102 241)",
  },
  active: {
    label: "Active",
    badge: "bg-lime-100 text-lime-700",
    accent: "var(--kenoo-lime)",
  },
  on_hold: {
    label: "On Hold",
    badge: "bg-amber-100 text-amber-700",
    accent: "rgb(245 158 11)",
  },
  completed: {
    label: "Completed",
    badge: "bg-emerald-100 text-emerald-700",
    accent: "rgb(16 185 129)",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-red-100 text-red-700",
    accent: "#ff1744",
  },
};

export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];

/** Projects shown in task board filters and task creation dropdowns. */
export const TASK_BOARD_PROJECT_STATUSES: ProjectStatus[] = ["active", "planning"];

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badge: string; accent: string }
> = {
  todo: {
    label: "To Do",
    badge: "bg-neutral-100 text-neutral-600",
    accent: "rgb(163 163 163)",
  },
  in_progress: {
    label: "In Progress",
    badge: "bg-neutral-100 text-[var(--kenoo-sky-hover)]",
    accent: "var(--kenoo-sky)",
  },
  in_review: {
    label: "In Review",
    badge: "bg-neutral-100 text-neutral-800",
    accent: "var(--kenoo-dark-yellow)",
  },
  on_hold: {
    label: "On Hold",
    badge: "bg-orange-50 text-orange-700",
    accent: "rgb(249 115 22)",
  },
  completed: {
    label: "Completed",
    badge: "bg-emerald-50 text-emerald-700",
    accent: "rgb(16 185 129)",
  },
  blocked: {
    label: "Blocked",
    badge: "bg-red-50 text-red-700",
    accent: "#ff1744",
  },
};

export const PRIORITY_CONFIG: Record<
  number,
  { label: string; color: string; dot: string }
> = {
  1: { label: "Urgent", color: "#ff1744", dot: "bg-red-500" },
  2: { label: "High", color: "rgb(245 158 11)", dot: "bg-amber-400" },
  3: { label: "Medium", color: "var(--kenoo-lime)", dot: "bg-lime-400" },
  4: { label: "Low", color: "rgb(148 163 184)", dot: "bg-slate-300" },
};

export const KANBAN_COLUMNS: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "on_hold",
  "blocked",
  "completed",
];
