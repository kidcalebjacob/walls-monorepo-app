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
  account_id?: string | null;
  priority: number | null;
  color: string | null;
  metadata: Record<string, unknown> | null;
  slug: string;
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
  assignee_id: string | null;
  assigned_by: string | null;
  is_private: boolean;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  metadata: Record<string, unknown> | null;
  thread_id?: string | null;
  project?: {
    id: string;
    name: string;
    color: string | null;
  };
}

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badge: string; accent: string }
> = {
  todo: {
    label: "To do",
    badge: "bg-neutral-100 text-neutral-700",
    accent: "rgb(115 115 115)",
  },
  in_progress: {
    label: "In progress",
    badge: "bg-sky-100 text-sky-700",
    accent: "var(--kenoo-sky)",
  },
  in_review: {
    label: "In review",
    badge: "bg-violet-100 text-violet-700",
    accent: "rgb(139 92 246)",
  },
  on_hold: {
    label: "On hold",
    badge: "bg-amber-100 text-amber-700",
    accent: "rgb(245 158 11)",
  },
  completed: {
    label: "Completed",
    badge: "bg-lime-100 text-lime-700",
    accent: "var(--kenoo-lime)",
  },
  blocked: {
    label: "Blocked",
    badge: "bg-red-100 text-red-700",
    accent: "var(--kenoo-red)",
  },
};
