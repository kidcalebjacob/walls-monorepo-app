"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@walls/supabase/client";
import { useAuth } from "@walls/auth";
import { Plus, Save, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Project,
  ProjectTask,
  ProjectTaskSchedule,
  TaskStatus,
  TASK_STATUS_CONFIG,
  KANBAN_COLUMNS,
  PRIORITY_CONFIG,
  PROJECT_STATUS_CONFIG,
  TASK_BOARD_PROJECT_STATUSES,
} from "./types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { SequenceSwitch as Switch } from "@/components/ui/sequence-switch";
import { motion } from "framer-motion";
import { format, isValid, parseISO, setHours, setMinutes } from "date-fns";
import { AgentSearch } from "@/components/ui/searches/agent-search";
import { SimpleMarkdownEditor } from "@/components/agents-projects/simple-markdown-editor";
import {
  notifyTaskAssignee,
  resolveActorDisplayName,
} from "@/lib/user-notifications";
import { loadAccessibleProjects as fetchAccessibleProjects } from "./load-accessible-projects";

/* ─── Schedule drafts (optional time chunks, separate from due date) ───── */
interface ScheduleDraft {
  key: string;
  date: string;
  start: string;
  end: string;
}

const TIME_OPTIONS = (() => {
  const options: { label: string; value: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const labelDate = setMinutes(setHours(new Date(), hour), minute);
      options.push({ label: format(labelDate, "h:mm a"), value });
    }
  }
  return options;
})();

function nextHalfHourTime(from = new Date()): string {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  const rounded = mins === 0 || mins === 30 ? mins : mins < 30 ? 30 : 60;
  if (rounded === 60) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMinutes(rounded, 0, 0);
  }
  return format(d, "HH:mm");
}

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + hours * 60;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function createScheduleDraft(baseDate?: Date | null): ScheduleDraft {
  const date = baseDate && isValid(baseDate) ? baseDate : new Date();
  const start = nextHalfHourTime();
  return {
    key: crypto.randomUUID(),
    date: format(date, "yyyy-MM-dd"),
    start,
    end: addHoursToTime(start, 1),
  };
}

function scheduleToDraft(schedule: ProjectTaskSchedule): ScheduleDraft {
  const start = parseISO(schedule.start_time);
  const end = parseISO(schedule.end_time);
  return {
    key: schedule.id,
    date: format(start, "yyyy-MM-dd"),
    start: format(start, "HH:mm"),
    end: format(end, "HH:mm"),
  };
}

function draftToIsoRange(draft: ScheduleDraft): { start_time: string; end_time: string } | null {
  if (!draft.date || !draft.start || !draft.end) return null;
  const start = parseISO(`${draft.date}T${draft.start}:00`);
  const end = parseISO(`${draft.date}T${draft.end}:00`);
  if (!isValid(start) || !isValid(end) || end <= start) return null;
  return { start_time: start.toISOString(), end_time: end.toISOString() };
}

/* ─── Form config ────────────────────────────────────────────────────────── */
const popupButtonOuterClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";
const popupButtonInnerClass =
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";
const fieldLabelClass =
  "text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500";
const fieldValueClass = "truncate text-[15px] font-light text-neutral-900";
const fieldPlaceholderClass = "text-neutral-300";

interface TaskFormState {
  title: string;
  description: string;
  status: TaskStatus;
  due_date: string;
  priority: string;
  project_id: string;
  assignee_id: string;
  /** When false (default), task is private (is_private = true). */
  is_public: boolean;
}

const EMPTY_TASK_FORM: TaskFormState = {
  title: "",
  description: "",
  status: "todo",
  due_date: "",
  priority: "3",
  project_id: "",
  assignee_id: "",
  is_public: false,
};

function projectSwatchColor(project: Project): string {
  return (
    project.color ??
    PROJECT_STATUS_CONFIG[project.status]?.accent ??
    "rgb(163 163 163)"
  );
}

/** Ensures the project owner is always included in the member list. */
function withOwnerAsMember(
  memberIds: string[],
  ownerId: string | null | undefined
): string[] {
  if (!ownerId) return memberIds;
  if (memberIds.includes(ownerId)) return memberIds;
  return [ownerId, ...memberIds];
}

/** Set when assignee is someone other than the actor; null for self-assign or no assignee. */
function resolveAssignedBy(
  assigneeId: string | null,
  actorUserId: string | null
): string | null {
  if (!assigneeId || !actorUserId || assigneeId === actorUserId) return null;
  return actorUserId;
}

/* ─── Props ───────────────────────────────────────────────────────────────── */
export interface CreateTasksPopupProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projects: Project[];
  defaultStatus?: TaskStatus;
  threadId?: string | null;
  defaultProjectId?: string | null;
  /** Prefill date for new schedule blocks (e.g. currently selected calendar day). */
  defaultScheduleDate?: Date | null;
  existing?: ProjectTask | null;
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export function CreateTasksPopup({
  open,
  onClose,
  onSaved,
  projects,
  defaultStatus = "todo",
  threadId,
  defaultProjectId,
  defaultScheduleDate,
  existing,
}: CreateTasksPopupProps) {
  const { user: authUser } = useAuth();
  const [form, setForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [scheduleDatePopoverKey, setScheduleDatePopoverKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigneeDisplayName, setAssigneeDisplayName] = useState<string | null>(null);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const projectNameRef = useRef<HTMLSpanElement | null>(null);
  const [isProjectNameTruncated, setIsProjectNameTruncated] = useState(false);
  const [duePopoverOpen, setDuePopoverOpen] = useState(false);
  const [projectMemberIds, setProjectMemberIds] = useState<string[]>([]);
  const [loadingProjectMembers, setLoadingProjectMembers] = useState(false);
  const [accessibleProjects, setAccessibleProjects] = useState<Project[]>([]);
  const [loadingAccessibleProjects, setLoadingAccessibleProjects] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!authUser?.id || !open) return;
    const resolve = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("id", authUser.id)
        .maybeSingle();
      setCurrentUserId(data?.id ?? null);
    };
    resolve();
  }, [authUser?.id, open]);

  const userId = currentUserId ?? authUser?.id ?? null;

  /* Projects the current user owns or is a member of (source of truth for the dropdown). */
  useEffect(() => {
    if (!open) {
      setAccessibleProjects([]);
      setLoadingAccessibleProjects(false);
      return;
    }
    if (!userId) return;

    let cancelled = false;
    setLoadingAccessibleProjects(true);
    const run = async () => {
      try {
        const data = await fetchAccessibleProjects(userId);
        if (!cancelled) setAccessibleProjects(data);
      } catch {
        if (!cancelled) setAccessibleProjects([]);
      } finally {
        if (!cancelled) setLoadingAccessibleProjects(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const projectsForSelect = useMemo(() => {
    if (accessibleProjects.length > 0 || !loadingAccessibleProjects) {
      return accessibleProjects;
    }
    return projects;
  }, [accessibleProjects, loadingAccessibleProjects, projects]);

  const projectOptions = useMemo(() => {
    const filtered = projectsForSelect.filter((p) =>
      TASK_BOARD_PROJECT_STATUSES.includes(p.status)
    );
    if (!existing?.project_id) return filtered;

    const existingProject = projectsForSelect.find(
      (p) => p.id === existing.project_id
    );
    if (
      existingProject &&
      !filtered.some((p) => p.id === existingProject.id)
    ) {
      return [existingProject, ...filtered];
    }
    return filtered;
  }, [projectsForSelect, existing?.project_id]);

  const prevOpenRef = useRef(false);
  const existingIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_TASK_FORM);
      setSchedules([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    const existingChanged = existing?.id !== existingIdRef.current;

    prevOpenRef.current = open;
    existingIdRef.current = existing?.id;

    if (!open) return;
    if (!justOpened && !existingChanged) return;

    if (existing) {
      setForm({
        title: existing.title,
        description: existing.description ?? "",
        status: existing.status,
        due_date: existing.due_date ?? "",
        priority: existing.priority?.toString() ?? "3",
        project_id: existing.project_id,
        assignee_id: existing.assignee_id ?? "",
        is_public: existing.is_private === false,
      });
      const loaded = (existing.schedules ?? [])
        .slice()
        .sort((a, b) => a.position - b.position || a.start_time.localeCompare(b.start_time))
        .map(scheduleToDraft);
      setSchedules(loaded);
    } else {
      const firstSelectable =
        projectsForSelect.find((p) =>
          TASK_BOARD_PROJECT_STATUSES.includes(p.status)
        )?.id ?? "";
      const initialProjectId =
        defaultProjectId &&
        projectsForSelect.some(
          (p) =>
            p.id === defaultProjectId &&
            TASK_BOARD_PROJECT_STATUSES.includes(p.status)
        )
          ? defaultProjectId
          : firstSelectable;
      setForm({
        ...EMPTY_TASK_FORM,
        status: defaultStatus,
        project_id: initialProjectId,
        assignee_id: currentUserId ?? "",
      });
      setSchedules([]);
    }
    setError(null);
  }, [
    existing,
    defaultStatus,
    defaultProjectId,
    open,
    projectsForSelect,
    currentUserId,
    userId,
    loadingAccessibleProjects,
    accessibleProjects.length,
  ]);

  // When editing, load schedules if the parent passed a task without nested rows
  useEffect(() => {
    if (!open || !existing?.id) return;
    if (existing.schedules !== undefined) return;

    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("project_task_schedules")
        .select(
          "id, created_at, updated_at, task_id, start_time, end_time, position, notes, created_by"
        )
        .eq("task_id", existing.id)
        .order("position", { ascending: true })
        .order("start_time", { ascending: true });
      if (cancelled || err) return;
      setSchedules((data ?? []).map((row) => scheduleToDraft(row as ProjectTaskSchedule)));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, existing?.id, existing?.schedules]);

  // Default project once accessible options are ready (new task only)
  useEffect(() => {
    if (!open || existing) return;
    if (loadingAccessibleProjects && projectOptions.length === 0) return;

    const validIds = new Set(projectOptions.map((p) => p.id));
    const preferred =
      defaultProjectId && validIds.has(defaultProjectId)
        ? defaultProjectId
        : projectOptions[0]?.id ?? "";

    if (!preferred) return;

    setForm((f) => {
      if (f.project_id && validIds.has(f.project_id)) return f;
      return { ...f, project_id: preferred };
    });
  }, [
    open,
    existing,
    loadingAccessibleProjects,
    projectOptions,
    defaultProjectId,
  ]);

  // When currentUserId resolves after dialog open, set assignee only if not already chosen
  useEffect(() => {
    if (!open || existing || !currentUserId) return;
    setForm((f) => (f.assignee_id ? f : { ...f, assignee_id: currentUserId }));
  }, [open, existing, currentUserId]);

  useEffect(() => {
    if (!open || !form.project_id) {
      setProjectMemberIds([]);
      setLoadingProjectMembers(false);
      return;
    }

    const project = projectsForSelect.find((p) => p.id === form.project_id);
    if (!project) {
      setProjectMemberIds([]);
      return;
    }

    let cancelled = false;
    setProjectMemberIds([]);
    const loadMembers = async () => {
      setLoadingProjectMembers(true);
      try {
        const supabase = createClient();

        let ownerId = project.owner_id ?? null;
        if (!ownerId) {
          const { data: projectRow } = await supabase
            .from("projects")
            .select("owner_id")
            .eq("id", form.project_id)
            .maybeSingle();
          ownerId = projectRow?.owner_id ?? null;
        }

        const { data: membersData, error } = await supabase
          .from("project_members")
          .select("user_id")
          .eq("project_id", form.project_id);

        if (error) throw error;

        const ids = withOwnerAsMember(
          (membersData ?? []).map((m: { user_id: string }) => m.user_id),
          ownerId
        );
        if (!cancelled) setProjectMemberIds(ids);
      } catch (err) {
        console.error("Error loading project members:", err);
        if (!cancelled) {
          const ownerId =
            project.owner_id ??
            (
              await createClient()
                .from("projects")
                .select("owner_id")
                .eq("id", form.project_id)
                .maybeSingle()
            ).data?.owner_id ??
            null;
          setProjectMemberIds(withOwnerAsMember([], ownerId));
        }
      } finally {
        if (!cancelled) setLoadingProjectMembers(false);
      }
    };

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [open, form.project_id, projectsForSelect]);

  useEffect(() => {
    if (loadingProjectMembers) return;

    if (!form.project_id) {
      setForm((f) => (f.assignee_id ? { ...f, assignee_id: "" } : f));
      return;
    }

    if (projectMemberIds.length === 0) return;

    setForm((f) => {
      if (f.assignee_id && projectMemberIds.includes(f.assignee_id)) return f;
      const nextAssignee =
        currentUserId && projectMemberIds.includes(currentUserId)
          ? currentUserId
          : "";
      if (f.assignee_id === nextAssignee) return f;
      return { ...f, assignee_id: nextAssignee };
    });
  }, [loadingProjectMembers, projectMemberIds, form.project_id, currentUserId]);

  useEffect(() => {
    if (!form.assignee_id) {
      setAssigneeDisplayName(null);
      return;
    }
    const fetchName = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("first_name, last_name, email")
        .eq("id", form.assignee_id)
        .maybeSingle();
      if (!data) {
        setAssigneeDisplayName(null);
        return;
      }
      const name = `${(data.first_name ?? "").trim()} ${(data.last_name ?? "").trim()}`.trim();
      setAssigneeDisplayName(name || data.email || "Assigned");
    };
    fetchName();
  }, [form.assignee_id]);

  const selectedProject = projectsForSelect.find(
    (project) => project.id === form.project_id
  );
  const selectedProjectName = selectedProject?.name ?? "No project";

  useEffect(() => {
    const textElement = projectNameRef.current;
    if (!textElement) {
      setIsProjectNameTruncated(false);
      return;
    }

    const updateTruncationState = () => {
      setIsProjectNameTruncated(textElement.scrollWidth > textElement.clientWidth + 1);
    };

    updateTruncationState();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateTruncationState);
    observer.observe(textElement);

    return () => observer.disconnect();
  }, [selectedProjectName, open]);

  const syncSchedules = async (
    supabase: ReturnType<typeof createClient>,
    taskId: string,
    actorUserId: string | null
  ) => {
    const rows = schedules
      .map((draft, index) => {
        const range = draftToIsoRange(draft);
        if (!range) return null;
        return {
          task_id: taskId,
          start_time: range.start_time,
          end_time: range.end_time,
          position: index,
          created_by: actorUserId,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length !== schedules.length) {
      throw new Error("Each schedule needs a date and an end time after the start.");
    }

    const { error: deleteError } = await supabase
      .from("project_task_schedules")
      .delete()
      .eq("task_id", taskId);
    if (deleteError) throw deleteError;

    if (rows.length === 0) return;

    const { error: insertError } = await supabase
      .from("project_task_schedules")
      .insert(rows);
    if (insertError) throw insertError;
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("project_tasks")
        .delete()
        .eq("id", existing.id);
      if (err) throw err;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to delete task.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!form.project_id) {
      setError("Please select a project.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const actorUserId = currentUserId ?? authUser?.id ?? null;
      const actorName = await resolveActorDisplayName(supabase, actorUserId);
      const taskTitle = form.title.trim();
      const previousAssigneeId = existing?.assignee_id ?? null;
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        due_date: form.due_date || null,
        priority: form.priority ? parseInt(form.priority, 10) : null,
        project_id: form.project_id,
        assignee_id: form.assignee_id || null,
        is_private: !form.is_public,
      };
      if (threadId) payload.thread_id = threadId;

      const assigneeId = form.assignee_id || null;
      const assigneeChanged = assigneeId !== previousAssigneeId;
      const shouldNotifyAssignee = !!assigneeId && assigneeChanged;

      if (assigneeChanged) {
        payload.assigned_by = resolveAssignedBy(assigneeId, actorUserId);
      }

      let taskId = existing?.id ?? null;

      if (existing) {
        const { error: err } = await supabase
          .from("project_tasks")
          .update(payload)
          .eq("id", existing.id);
        if (err) throw err;

        if (shouldNotifyAssignee && assigneeId) {
          await notifyTaskAssignee(supabase, {
            assigneeId,
            taskId: existing.id,
            taskTitle,
            projectId: form.project_id,
            projectName: selectedProject?.name,
            actorUserId,
            actorName,
          });
        }
      } else {
        payload.assigned_by = resolveAssignedBy(assigneeId, actorUserId);
        const { data: newTask, error: err } = await supabase
          .from("project_tasks")
          .insert(payload)
          .select("id")
          .single();
        if (err) throw err;
        taskId = newTask?.id ?? null;

        if (shouldNotifyAssignee && assigneeId && newTask?.id) {
          await notifyTaskAssignee(supabase, {
            assigneeId,
            taskId: newTask.id,
            taskTitle,
            projectId: form.project_id,
            projectName: selectedProject?.name,
            actorUserId,
            actorName,
          });
        }
      }

      if (!taskId) throw new Error("Failed to resolve task id.");
      await syncSchedules(supabase, taskId, actorUserId);

      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to save task.");
    } finally {
      setSaving(false);
    }
  };

  const parsedDueDate = form.due_date ? parseISO(form.due_date) : null;
  const dueDate = parsedDueDate && isValid(parsedDueDate) ? parsedDueDate : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button]:focus-visible:ring-0 [&>button]:ring-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader />

        <div className="grid grid-cols-[2fr_1fr] divide-x divide-gray-200 gap-6 py-4">
          {/* Left Column */}
          <div className="min-w-0 space-y-4 pr-6">
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Add title"
              disabled={saving}
              className="border-0 border-b-2 rounded-none bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 px-0 border-b-[var(--kenoo-sky)] focus:border-b-[var(--kenoo-sky)] placeholder:text-neutral-300"
            />

            <SimpleMarkdownEditor
              value={form.description}
              onChange={(text) => setForm((f) => ({ ...f, description: text }))}
              placeholder="Description"
              disabled={saving}
              aiConfig={{
                name: form.title,
                type: "task",
                projectName: selectedProject?.name,
                projectDescription: selectedProject?.description ?? undefined,
              }}
              onAIGenerate={(text) => setForm((f) => ({ ...f, description: text }))}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-2 pl-6 min-w-0 max-h-[min(70vh,640px)] overflow-y-auto">
            {/* Project */}
            <Select
              value={form.project_id}
              onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
              disabled={saving || (loadingAccessibleProjects && projectOptions.length === 0)}
            >
              <TooltipProvider delayDuration={180}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      className="inline-flex max-w-full overflow-hidden"
                    >
                      <SelectTrigger className="w-auto max-w-full border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                        <div className="inline-flex items-center gap-2 min-w-0">
                          <span className={cn("shrink-0", fieldLabelClass)}>Project:</span>
                          <motion.div
                            key={form.project_id || "no-project"}
                            initial={{ opacity: 0.6 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="max-w-[260px] min-w-0"
                          >
                            <span
                              ref={projectNameRef}
                              className={cn(
                                fieldValueClass,
                                "[&_[data-placeholder]]:text-neutral-300"
                              )}
                            >
                              {loadingAccessibleProjects &&
                              !form.project_id &&
                              projectOptions.length === 0 ? (
                                <span className={fieldPlaceholderClass}>
                                  Loading…
                                </span>
                              ) : (
                                <SelectValue placeholder="No project" />
                              )}
                            </span>
                          </motion.div>
                        </div>
                      </SelectTrigger>
                    </motion.div>
                  </TooltipTrigger>
                  {isProjectNameTruncated ? (
                    <TooltipContent side="top" align="start">
                      {selectedProjectName}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
              <SelectContent>
                {loadingAccessibleProjects && projectOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs font-light text-neutral-400">
                    Loading projects…
                  </div>
                ) : projectOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs font-light text-neutral-400">
                    No accessible projects
                  </div>
                ) : (
                  projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: projectSwatchColor(p) }}
                          aria-hidden
                        />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* Assignee */}
            <Popover
              open={assigneePopoverOpen}
              onOpenChange={(next) => {
                if (next && !form.project_id) return;
                setAssigneePopoverOpen(next);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving || !form.project_id}
                  className="w-full flex items-center gap-2 rounded-full px-4 py-2 hover:bg-gray-100 focus:outline-none text-left disabled:opacity-50"
                >
                  <span className={cn("shrink-0", fieldLabelClass)}>Assignee:</span>
                  <span
                    className={cn(
                      "flex-1 truncate",
                      fieldValueClass,
                      !(assigneeDisplayName || form.assignee_id) && fieldPlaceholderClass
                    )}
                  >
                    {!form.project_id
                      ? "Select a project"
                      : form.assignee_id && form.assignee_id === currentUserId
                        ? "You"
                        : assigneeDisplayName ?? "No assignee"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[320px] p-0 overflow-hidden rounded-2xl border border-neutral-200/60 shadow-xl bg-white/80 backdrop-blur-xl"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                {loadingProjectMembers ? (
                  <p className="px-4 py-3 text-sm font-light text-neutral-500">
                    Loading project members…
                  </p>
                ) : (
                  <AgentSearch
                    key={form.project_id}
                    value={form.assignee_id}
                    allowedUserIds={projectMemberIds}
                    emptyMessage="No project members found"
                    onSelect={(agentId) => {
                      setForm((f) => ({ ...f, assignee_id: agentId }));
                      setAssigneePopoverOpen(false);
                    }}
                  />
                )}
              </PopoverContent>
            </Popover>

            {/* Status */}
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}
              disabled={saving}
            >
              <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                <div className="flex items-center gap-2">
                  <span className={fieldLabelClass}>Status:</span>
                  <span className={cn(fieldValueClass, "[&_[data-placeholder]]:text-neutral-300")}>
                    <SelectValue />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {KANBAN_COLUMNS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority */}
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              disabled={saving}
            >
              <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                <div className="flex items-center gap-2">
                  <span className={fieldLabelClass}>Priority:</span>
                  <span className={cn(fieldValueClass, "[&_[data-placeholder]]:text-neutral-300")}>
                    <SelectValue />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Due date */}
            <Popover open={duePopoverOpen} onOpenChange={setDuePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className="w-full h-10 flex items-center gap-2 rounded-full px-4 hover:bg-gray-100 focus:outline-none text-left disabled:opacity-50"
                >
                  <span className={cn("shrink-0", fieldLabelClass)}>Due:</span>
                  <span
                    className={cn(
                      fieldValueClass,
                      !dueDate && fieldPlaceholderClass
                    )}
                  >
                    {dueDate ? format(dueDate, "MMM d, yyyy") : "Select date"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]" align="start">
                <MiniCalendar
                  showClearButton
                  selected={dueDate ?? undefined}
                  onSelect={(date) => {
                    setForm((f) => ({
                      ...f,
                      due_date: date ? format(date, "yyyy-MM-dd") : "",
                    }));
                    setDuePopoverOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Schedule time blocks — optional, independent of due date */}
            <div className="space-y-1.5 px-1 pt-1">
              <div className="flex h-10 items-center justify-between gap-2 rounded-full px-3 hover:bg-gray-100">
                <span className={fieldLabelClass}>Schedule:</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setSchedules((prev) => [
                      ...prev,
                      createScheduleDraft(
                        form.due_date
                          ? parseISO(form.due_date)
                          : defaultScheduleDate ?? null
                      ),
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-light text-neutral-600 hover:bg-white/80 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[1.5]" />
                  Add block
                </button>
              </div>

              {schedules.length > 0 && (
                <div className="space-y-2 px-1 pb-1">
                  {schedules.map((draft) => {
                    const draftDate = draft.date ? parseISO(draft.date) : null;
                    const validDraftDate =
                      draftDate && isValid(draftDate) ? draftDate : null;
                    const startLabel =
                      TIME_OPTIONS.find((o) => o.value === draft.start)?.label ??
                      draft.start;
                    const endLabel =
                      TIME_OPTIONS.find((o) => o.value === draft.end)?.label ??
                      draft.end;

                    return (
                      <div
                        key={draft.key}
                        className="rounded-2xl border border-neutral-200/70 bg-white/60 px-3 py-2 space-y-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <Popover
                            open={scheduleDatePopoverKey === draft.key}
                            onOpenChange={(next) =>
                              setScheduleDatePopoverKey(next ? draft.key : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                disabled={saving}
                                className="min-w-0 flex-1 truncate text-left text-[13px] font-light text-neutral-800 hover:underline disabled:opacity-50"
                              >
                                {validDraftDate
                                  ? format(validDraftDate, "MMM d, yyyy")
                                  : "Pick date"}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                              align="start"
                            >
                              <MiniCalendar
                                selected={validDraftDate ?? undefined}
                                onSelect={(date) => {
                                  if (!date) return;
                                  setSchedules((prev) =>
                                    prev.map((s) =>
                                      s.key === draft.key
                                        ? { ...s, date: format(date, "yyyy-MM-dd") }
                                        : s
                                    )
                                  );
                                  setScheduleDatePopoverKey(null);
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <button
                            type="button"
                            disabled={saving}
                            aria-label="Remove schedule block"
                            onClick={() =>
                              setSchedules((prev) =>
                                prev.filter((s) => s.key !== draft.key)
                              )
                            }
                            className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1 text-[13px] font-light text-neutral-700">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                disabled={saving}
                                className="rounded-full px-2 py-0.5 hover:bg-neutral-100 disabled:opacity-50"
                              >
                                {startLabel}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-36 max-h-56 overflow-y-auto py-2"
                              align="start"
                            >
                              <div className="flex flex-col">
                                {TIME_OPTIONS.map((option) => (
                                  <button
                                    key={`start-${draft.key}-${option.value}`}
                                    type="button"
                                    className="px-2 py-1 text-left text-sm text-neutral-700 hover:bg-gray-100"
                                    onClick={() => {
                                      setSchedules((prev) =>
                                        prev.map((s) => {
                                          if (s.key !== draft.key) return s;
                                          const nextEnd =
                                            option.value >= s.end
                                              ? addHoursToTime(option.value, 1)
                                              : s.end;
                                          return {
                                            ...s,
                                            start: option.value,
                                            end: nextEnd,
                                          };
                                        })
                                      );
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <span className="text-neutral-400">–</span>

                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                disabled={saving}
                                className="rounded-full px-2 py-0.5 hover:bg-neutral-100 disabled:opacity-50"
                              >
                                {endLabel}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-36 max-h-56 overflow-y-auto py-2"
                              align="start"
                            >
                              <div className="flex flex-col">
                                {TIME_OPTIONS.filter(
                                  (option) => option.value > draft.start
                                ).map((option) => (
                                  <button
                                    key={`end-${draft.key}-${option.value}`}
                                    type="button"
                                    className="px-2 py-1 text-left text-sm text-neutral-700 hover:bg-gray-100"
                                    onClick={() => {
                                      setSchedules((prev) =>
                                        prev.map((s) =>
                                          s.key === draft.key
                                            ? { ...s, end: option.value }
                                            : s
                                        )
                                      );
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Visibility */}
            <div className="flex h-10 items-center gap-2.5 rounded-full px-4 hover:bg-gray-100">
              <span className={fieldLabelClass}>Public:</span>
              <Switch
                checked={form.is_public}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_public: checked }))
                }
                disabled={saving}
                aria-label="Make task public"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 -mt-2">{error}</p>}

        <DialogFooter>
          <div className="flex items-center justify-end gap-2 w-full">
            {existing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className={popupButtonOuterClass}
              >
                <div className={popupButtonInnerClass}>
                  <Trash2 className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.project_id}
              className={popupButtonOuterClass}
            >
              <div className={popupButtonInnerClass}>
                {saving ? (
                  <div className="h-[18px] w-[18px] border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                )}
              </div>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}