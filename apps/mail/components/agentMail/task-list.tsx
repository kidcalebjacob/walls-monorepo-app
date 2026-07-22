"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { CreateTasksPopup } from "@/components/agentsProjects/create-tasks-popup";
import type { Project, ProjectTask } from "@/components/agentsProjects/types";
import { TASK_STATUS_CONFIG } from "@/components/agentsProjects/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { showTaskCompleteToast } from "@/components/agentsProjects/ui/show-task-complete-toast";
import { cleanSubject, formatPreviewDate } from "@/utils/format-utils";

interface TaskWithProject extends ProjectTask {
  thread_id?: string | null;
  project?: { id: string; name: string; color: string | null };
  threadPreview?: { subject: string; snippet: string; lastMessageDate: string };
}

// Date group labels: past (like email-list) + future (Tomorrow, Next Week, Later)
type TaskDateGroup =
  | "today"
  | "yesterday"
  | "tomorrow"
  | "this_week"   // past: earlier this week
  | "next_week"  // future: in the next 7 days
  | "last_week"
  | "older"
  | "later"      // future: 7+ days out
  | "no_date";
const TASK_DATE_GROUP_LABELS: Record<TaskDateGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  tomorrow: "Tomorrow",
  this_week: "This Week",
  next_week: "Next Week",
  last_week: "Last Week",
  older: "Older",
  later: "Later",
  no_date: "No date",
};

/** Parse date-only string (YYYY-MM-DD) as local date so the calendar day doesn't shift with timezone. */
function parseLocalDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return new Date(dateStr);
  const [, y, m, d] = match;
  return new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
}

function getTaskDateGroup(dueDate: string | null): TaskDateGroup {
  const date = parseLocalDate(dueDate);
  if (!date) return "no_date";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === -1) return "yesterday";
  if (diffDays === 1) return "tomorrow";
  if (diffDays >= -6 && diffDays <= -2) return "this_week";   // past: earlier this week
  if (diffDays >= 2 && diffDays <= 6) return "next_week";     // future: next 7 days
  if (diffDays >= -13 && diffDays <= -7) return "last_week";
  if (diffDays <= -14) return "older";
  if (diffDays >= 7) return "later";
  return "no_date";
}

function groupTasksByDate(tasks: TaskWithProject[]): [TaskDateGroup, TaskWithProject[]][] {
  const order: TaskDateGroup[] = [
    "yesterday", "this_week", "last_week", "older",
    "today", "tomorrow", "next_week", "later",
    "no_date",
  ];
  const map: Record<TaskDateGroup, TaskWithProject[]> = {
    today: [],
    yesterday: [],
    tomorrow: [],
    this_week: [],
    next_week: [],
    last_week: [],
    older: [],
    later: [],
    no_date: [],
  };
  for (const t of tasks) {
    map[getTaskDateGroup(t.due_date)].push(t);
  }
  return order.filter((g) => map[g].length > 0).map((g) => [g, map[g]]);
}

/** Short label for the date on the right of the card (like email list). Uses local date so day doesn't shift. */
function formatTaskDateRight(dueDate: string | null): string {
  const d = parseLocalDate(dueDate);
  if (!d) return "—";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays >= -6 && diffDays <= 6) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TaskListProps {
  userId: string | undefined;
  onRefresh?: () => void;
  /** When user clicks an email card, open this thread in the email preview */
  onOpenThread?: (threadId: string) => void;
}

export default function TaskList({ userId, onRefresh, onOpenThread }: TaskListProps) {
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState<ProjectTask | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: taskRows, error: taskError } = await supabase
        .from("project_tasks")
        .select(`
          id,
          created_at,
          updated_at,
          project_id,
          parent_task_id,
          title,
          description,
          status,
          start_date,
          due_date,
          completed_at,
          position,
          priority,
          assignee_id,
          estimated_minutes,
          actual_minutes,
          metadata,
          thread_id,
          projects ( id, name, color )
        `)
        .eq("assignee_id", userId)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (taskError) throw taskError;

      const withProject = (taskRows ?? []).map((t: Record<string, unknown>) => {
        const { projects: proj, ...rest } = t;
        const project = proj && typeof proj === "object" && !Array.isArray(proj) ? (proj as { id: string; name: string; color: string | null }) : undefined;
        return { ...rest, project } as TaskWithProject;
      });

      const threadIdsRaw = withProject.map((t) => t.thread_id).filter(Boolean) as string[];
      const threadIds = threadIdsRaw.filter((id, i) => threadIdsRaw.indexOf(id) === i);
      let threadPreviewMap: Record<string, { subject: string; snippet: string; lastMessageDate: string }> = {};
      if (threadIds.length > 0) {
        const { data: threadRows } = await supabase
          .from("email_threads")
          .select("id, subject, latest_snippet, last_message_at")
          .in("id", threadIds);
        if (threadRows) {
          threadPreviewMap = threadRows.reduce(
            (acc, row) => {
              acc[row.id] = {
                subject: row.subject ?? "No subject",
                snippet: row.latest_snippet ?? "",
                lastMessageDate: row.last_message_at ?? new Date().toISOString(),
              };
              return acc;
            },
            {} as Record<string, { subject: string; snippet: string; lastMessageDate: string }>
          );
        }
      }

      const withThreadPreview: TaskWithProject[] = withProject.map((t) => {
        const preview = t.thread_id ? threadPreviewMap[t.thread_id] : undefined;
        return preview ? { ...t, threadPreview: preview } : t;
      });

      setTasks(withThreadPreview);
      const projectIds = Array.from(new Set(withThreadPreview.map((t) => t.project_id).filter(Boolean)));
      fetchProjects(projectIds);
    } catch (e) {
      console.error("Error fetching tasks:", e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchProjects = useCallback(async (taskProjectIds?: string[]) => {
    if (!userId) {
      setProjects([]);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("projects")
        .select("id, name, slug, description, status, start_date, due_date, completed_at, owner_id, priority, color, metadata, created_at, updated_at")
        .eq("owner_id", userId);
      const { data: owned } = await query.order("name");
      const ownedList = owned ?? [];
      if (taskProjectIds?.length) {
        const missingIds = taskProjectIds.filter((id) => !ownedList.some((p) => p.id === id));
        if (missingIds.length > 0) {
          const { data: extra } = await supabase
            .from("projects")
            .select("id, name, slug, description, status, start_date, due_date, completed_at, owner_id, priority, color, metadata, created_at, updated_at")
            .in("id", missingIds);
          const combined = [...ownedList, ...(extra ?? [])];
          combined.sort((a, b) => a.name.localeCompare(b.name));
          setProjects(combined);
          return;
        }
      }
      setProjects(ownedList);
    } catch {
      setProjects([]);
    }
  }, [userId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);


  const handleCardClick = (task: TaskWithProject) => {
    setEditTask(task);
    setTaskFormOpen(true);
  };

  const handleCheckboxChange = (index: number, checked: boolean, shiftKey: boolean) => {
    const newSet = new Set(selectedTaskIds);
    if (shiftKey && lastCheckedIndex !== null) {
      const start = Math.min(lastCheckedIndex, index);
      const end = Math.max(lastCheckedIndex, index);
      const idsInRange = tasks.slice(start, end + 1).map((t) => t.id);
      idsInRange.forEach((id) => (checked ? newSet.add(id) : newSet.delete(id)));
    } else {
      const taskId = tasks[index]?.id;
      if (taskId) (checked ? newSet.add(taskId) : newSet.delete(taskId));
    }
    setLastCheckedIndex(index);
    setSelectedTaskIds(newSet);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(new Set(tasks.map((t) => t.id)));
      setLastCheckedIndex(null);
    } else {
      setSelectedTaskIds(new Set());
      setLastCheckedIndex(null);
    }
  };

  const handleMarkComplete = async () => {
    if (selectedTaskIds.size === 0) return;
    setMarkingComplete(true);
    try {
      const ids = Array.from(selectedTaskIds);
      const completedTitles = tasks
        .filter((t) => ids.includes(t.id))
        .map((t) => t.title);
      const res = await fetch("/api/project-tasks/mark-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update tasks");
      }
      showTaskCompleteToast({
        count: ids.length,
        taskTitle: ids.length === 1 ? completedTitles[0] : undefined,
      });
      setSelectedTaskIds(new Set());
      setLastCheckedIndex(null);
      fetchTasks();
      onRefresh?.();
    } catch (e) {
      console.error("Error marking tasks complete:", e);
      wallsToast.error(e instanceof Error ? e.message : "Failed to update tasks");
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleSaved = () => {
    fetchTasks();
    onRefresh?.();
    setTaskFormOpen(false);
    setEditTask(null);
  };

  if (!userId) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-neutral-100 border border-neutral-200/60 rounded-tl-2xl p-6">
        <p className="text-sm text-muted-foreground">Sign in to see your tasks.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-neutral-100 border border-neutral-200/60 rounded-tl-2xl items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  const selectedCount = selectedTaskIds.size;
  const allSelected = tasks.length > 0 && selectedCount === tasks.length;

  return (
    <div
      className={cn(
        "h-full flex flex-col overflow-hidden",
        "bg-neutral-100 border border-neutral-200/60 rounded-tl-2xl",
        "transition-all duration-300 ease-in-out"
      )}
    >
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex-none overflow-hidden bg-neutral-50"
          >
            <div className="py-3 flex items-center justify-between gap-3 pl-8 pr-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className={cn(
                    "h-5 w-5 rounded-full border-neutral-300",
                    "data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-kenoo-yellow",
                    "focus-visible:ring-0 focus-visible:ring-offset-0"
                  )}
                />
                <span className="text-sm font-normal text-neutral-700">
                  {selectedCount} {selectedCount === 1 ? "task" : "tasks"} selected
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkComplete}
                disabled={markingComplete}
                className="h-8 px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              >
                {markingComplete ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                )}
                Mark as complete
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col",
          "scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent"
        )}
      >
        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-2.5 py-2.5 min-h-0">
            <div className="py-6 flex justify-center">
              <span className="text-xs text-neutral-400">You&apos;re all caught up</span>
            </div>
            <div className="flex flex-col items-center py-2 space-y-0.5">
              <a
                href="/privacy-policy"
                className="text-xs text-neutral-400 hover:text-walls-light transition-colors"
              >
                Privacy Policy
              </a>
              <span className="text-xs text-neutral-300">Powered by WALLS</span>
            </div>
          </div>
        ) : (
          <div className="px-2.5 py-2.5 space-y-4">
            {groupTasksByDate(tasks).map(([group, groupTasks]) => (
              <div key={group}>
                {/* Date group label (same as inbox) */}
                <div className="px-1.5 pb-1.5 pt-0.5">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
                    {TASK_DATE_GROUP_LABELS[group]}
                  </span>
                </div>
                {/* Cards */}
                <div className="space-y-1">
                  {groupTasks.map((task) => {
                    const statusCfg = TASK_STATUS_CONFIG[task.status];
                    const projectColor = task.project?.color ?? "#ceff00";
                    const dueDay = parseLocalDate(task.due_date);
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const isOverdue = dueDay != null && dueDay < todayStart && task.status !== "completed";
                    const isChecked = selectedTaskIds.has(task.id);
                    const globalIndex = tasks.findIndex((t) => t.id === task.id);
                    const threadPreview = task.threadPreview;

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-stretch w-full",
                          threadPreview && "gap-3"
                        )}
                      >
                        {/* Task container — own card */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleCardClick(task)}
                          onKeyDown={(e) => e.key === "Enter" && handleCardClick(task)}
                          className={cn(
                            "group relative flex items-center gap-2 p-2 cursor-pointer min-w-0 text-left rounded-2xl border border-white/30 shadow-lg bg-white/80 hover:bg-white/90 border-l-[3px] transition-all duration-150",
                            threadPreview ? "flex-[2_1_0%]" : "w-full"
                          )}
                          style={{ borderLeftColor: projectColor }}
                        >
                          <div className="relative shrink-0 w-5 h-5 flex items-center justify-center">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full transition-opacity duration-150",
                                "opacity-100 group-hover:opacity-0",
                                isChecked && "opacity-0 pointer-events-none"
                              )}
                              style={{ backgroundColor: projectColor }}
                            />
                            <div
                              className={cn(
                                "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
                                isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckboxChange(globalIndex, !isChecked, (e.nativeEvent as MouseEvent).shiftKey);
                              }}
                            >
                              <Checkbox
                                checked={isChecked}
                                className={cn(
                                  "h-5 w-5 rounded-full border-neutral-300 pointer-events-none",
                                  "data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-kenoo-yellow",
                                  "focus-visible:ring-0 focus-visible:ring-offset-0"
                                )}
                              />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-2 min-h-[18px]">
                              <span className="text-[13px] font-medium text-neutral-800 truncate">
                                {task.title}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                                  statusCfg?.badge ?? "bg-neutral-100 text-neutral-600"
                                )}
                              >
                                {statusCfg?.label ?? task.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 min-h-[18px]">
                              <span className="text-[11px] font-medium text-neutral-500 truncate">
                                {task.project?.name ?? "Project"}
                              </span>
                              <span
                                className={cn(
                                  "text-[11px] text-neutral-400 whitespace-nowrap shrink-0",
                                  isOverdue && "text-red-500 font-medium"
                                )}
                              >
                                {formatTaskDateRight(task.due_date)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Horizontal connector + email container (separate card) */}
                        {threadPreview && (
                          <>
                            <div className="flex shrink-0 items-center self-stretch w-6" aria-hidden title="Linked email">
                              <div className="w-full h-0.5 bg-kenoo-yellow rounded-full" />
                            </div>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (task.thread_id && onOpenThread) onOpenThread(task.thread_id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && task.thread_id && onOpenThread) {
                                  e.stopPropagation();
                                  onOpenThread(task.thread_id);
                                }
                              }}
                              className="flex-[1_1_0%] min-w-0 flex flex-col justify-center p-2 rounded-2xl border border-white/30 shadow-lg bg-white/80 hover:bg-white/90 transition-all duration-150 cursor-pointer"
                            >
                              <div className="truncate text-[13px] font-medium text-neutral-800">
                                {cleanSubject(threadPreview.subject)}
                              </div>
                              <span className="text-xs text-neutral-400 whitespace-nowrap mt-0.5">
                                {formatPreviewDate(threadPreview.lastMessageDate)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateTasksPopup
        open={taskFormOpen}
        onClose={() => {
          setTaskFormOpen(false);
          setEditTask(null);
        }}
        onSaved={handleSaved}
        projects={projects}
        existing={editTask}
      />
    </div>
  );
}
