"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getSupabaseClient } from "@walls/auth";
import { useAuth } from "@walls/auth";
import { Save, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Project,
  ProjectTask,
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
import { MiniDatePicker } from "@/components/ui/mini-date-picker";
import { SequenceSwitch as Switch } from "@/components/ui/sequence-switch";
import { motion } from "framer-motion";
import { format, isValid, parseISO } from "date-fns";
import { AgentSearch } from "@/components/ui/searches/agent-search";
import { SimpleMarkdownEditor } from "@/components/agents-projects/simple-markdown-editor";
import {
  notifyTaskAssignee,
  resolveActorDisplayName,
} from "@/lib/user-notifications";
import { useActiveAccount } from "@/components/active-account-context";
import { loadAccessibleProjects as fetchAccessibleProjects } from "./load-accessible-projects";
import {
  getTaskAssigneeIds,
  syncProjectTaskAssignees,
} from "./task-assignee";

/* ─── Form config ────────────────────────────────────────────────────────── */
const popupButtonOuterClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";
const popupButtonInnerClass =
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-kenoo-white group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";
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
  assignee_ids: string[];
  /** When true (default), task is public (is_private = false). */
  is_public: boolean;
}

const EMPTY_TASK_FORM: TaskFormState = {
  title: "",
  description: "",
  status: "todo",
  due_date: "",
  priority: "3",
  project_id: "",
  assignee_ids: [],
  is_public: true,
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

/** Set when any assignee is someone other than the actor; null for self-only or none. */
function resolveAssignedBy(
  assigneeIds: string[],
  actorUserId: string | null
): string | null {
  if (!actorUserId || assigneeIds.length === 0) return null;
  if (assigneeIds.every((id) => id === actorUserId)) return null;
  return actorUserId;
}

function toggleAssigneeId(ids: string[], agentId: string): string[] {
  return ids.includes(agentId)
    ? ids.filter((id) => id !== agentId)
    : [...ids, agentId];
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
  existing,
}: CreateTasksPopupProps) {
  const { user: authUser } = useAuth();
  const { activeAccountId, loading: accountLoading } = useActiveAccount();
  const [form, setForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigneeDisplayNames, setAssigneeDisplayNames] = useState<
    Record<string, string>
  >({});
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [duePopoverOpen, setDuePopoverOpen] = useState(false);
  const [projectSelectOpen, setProjectSelectOpen] = useState(false);
  const [statusSelectOpen, setStatusSelectOpen] = useState(false);
  const [prioritySelectOpen, setPrioritySelectOpen] = useState(false);
  /** True while a nested dropdown is open, and briefly after — blocks dialog dismiss / overlay click-through. */
  const [blockDialogDismiss, setBlockDialogDismiss] = useState(false);
  const blockDialogDismissRef = useRef(false);
  const blockDialogDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const armDialogDismissBlock = useCallback(() => {
    if (blockDialogDismissTimerRef.current) {
      clearTimeout(blockDialogDismissTimerRef.current);
      blockDialogDismissTimerRef.current = null;
    }
    blockDialogDismissRef.current = true;
    setBlockDialogDismiss(true);
  }, []);

  const releaseDialogDismissBlock = useCallback(() => {
    if (blockDialogDismissTimerRef.current) {
      clearTimeout(blockDialogDismissTimerRef.current);
    }
    blockDialogDismissRef.current = true;
    setBlockDialogDismiss(true);
    blockDialogDismissTimerRef.current = setTimeout(() => {
      blockDialogDismissRef.current = false;
      setBlockDialogDismiss(false);
      blockDialogDismissTimerRef.current = null;
    }, 250);
  }, []);

  const clearDialogDismissBlock = useCallback(() => {
    if (blockDialogDismissTimerRef.current) {
      clearTimeout(blockDialogDismissTimerRef.current);
      blockDialogDismissTimerRef.current = null;
    }
    blockDialogDismissRef.current = false;
    setBlockDialogDismiss(false);
  }, []);

  const forceCloseDialog = useCallback(() => {
    clearDialogDismissBlock();
    setAssigneePopoverOpen(false);
    setDuePopoverOpen(false);
    setProjectSelectOpen(false);
    setStatusSelectOpen(false);
    setPrioritySelectOpen(false);
    onClose();
  }, [clearDialogDismissBlock, onClose]);

  const setNestedDropdownOpen = useCallback(
    (setter: React.Dispatch<React.SetStateAction<boolean>>) => (next: boolean) => {
      if (next) {
        armDialogDismissBlock();
        setter(true);
        return;
      }
      setter(false);
      releaseDialogDismissBlock();
    },
    [armDialogDismissBlock, releaseDialogDismissBlock]
  );

  const handleAssigneePopoverOpenChange = useCallback(
    (next: boolean) => {
      if (next && !form.project_id) return;
      setNestedDropdownOpen(setAssigneePopoverOpen)(next);
    },
    [form.project_id, setNestedDropdownOpen]
  );
  const projectNameRef = useRef<HTMLSpanElement | null>(null);
  const [isProjectNameTruncated, setIsProjectNameTruncated] = useState(false);
  const [projectMemberIds, setProjectMemberIds] = useState<string[]>([]);
  const [loadingProjectMembers, setLoadingProjectMembers] = useState(false);
  const [accessibleProjects, setAccessibleProjects] = useState<Project[]>([]);
  const [loadingAccessibleProjects, setLoadingAccessibleProjects] = useState(false);

  useEffect(() => {
    return () => {
      if (blockDialogDismissTimerRef.current) {
        clearTimeout(blockDialogDismissTimerRef.current);
      }
    };
  }, []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!authUser?.id || !open) return;
    const resolve = async () => {
      const supabase = getSupabaseClient();
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
    if (!userId || !activeAccountId || accountLoading) return;

    let cancelled = false;
    setLoadingAccessibleProjects(true);
    const run = async () => {
      try {
        const data = await fetchAccessibleProjects(userId, {
          accountId: activeAccountId,
        });
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
  }, [open, userId, activeAccountId, accountLoading]);

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
        assignee_ids: getTaskAssigneeIds(existing),
        is_public: existing.is_private === false,
      });
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
        assignee_ids: currentUserId ? [currentUserId] : [],
      });
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
    setForm((f) =>
      f.assignee_ids.length > 0 ? f : { ...f, assignee_ids: [currentUserId] }
    );
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
        const supabase = getSupabaseClient();

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
              await getSupabaseClient()
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
      setForm((f) => (f.assignee_ids.length ? { ...f, assignee_ids: [] } : f));
      return;
    }

    if (projectMemberIds.length === 0) return;

    setForm((f) => {
      const kept = f.assignee_ids.filter((id) => projectMemberIds.includes(id));
      if (kept.length > 0) {
        if (kept.length === f.assignee_ids.length) return f;
        return { ...f, assignee_ids: kept };
      }
      const nextAssignee =
        currentUserId && projectMemberIds.includes(currentUserId)
          ? [currentUserId]
          : [];
      if (
        nextAssignee.length === f.assignee_ids.length &&
        nextAssignee.every((id, i) => id === f.assignee_ids[i])
      ) {
        return f;
      }
      return { ...f, assignee_ids: nextAssignee };
    });
  }, [loadingProjectMembers, projectMemberIds, form.project_id, currentUserId]);

  useEffect(() => {
    if (form.assignee_ids.length === 0) {
      setAssigneeDisplayNames({});
      return;
    }
    const fetchNames = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, email")
        .in("id", form.assignee_ids);
      const next: Record<string, string> = {};
      for (const row of data ?? []) {
        const name =
          `${(row.first_name ?? "").trim()} ${(row.last_name ?? "").trim()}`.trim();
        next[row.id] = name || row.email || "Assigned";
      }
      setAssigneeDisplayNames(next);
    };
    void fetchNames();
  }, [form.assignee_ids.join(",")]);

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

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
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
      const supabase = getSupabaseClient();
      const actorUserId = currentUserId ?? authUser?.id ?? null;
      const actorName = await resolveActorDisplayName(supabase, actorUserId);
      const taskTitle = form.title.trim();
      const previousAssigneeIds = existing ? getTaskAssigneeIds(existing) : [];
      const assigneeIds = [...new Set(form.assignee_ids.filter(Boolean))];
      const primaryAssigneeId = assigneeIds[0] ?? null;
      const assignedBy = resolveAssignedBy(assigneeIds, actorUserId);
      const newlyAdded = assigneeIds.filter(
        (id) => !previousAssigneeIds.includes(id)
      );
      const assigneesChanged =
        assigneeIds.length !== previousAssigneeIds.length ||
        assigneeIds.some((id) => !previousAssigneeIds.includes(id));

      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        due_date: form.due_date || null,
        priority: form.priority ? parseInt(form.priority, 10) : null,
        project_id: form.project_id,
        assignee_id: primaryAssigneeId,
        is_private: !form.is_public,
      };
      if (threadId) payload.thread_id = threadId;

      if (assigneesChanged) {
        payload.assigned_by = assignedBy;
      }

      let taskId = existing?.id ?? null;

      if (existing) {
        const { error: err } = await supabase
          .from("project_tasks")
          .update(payload)
          .eq("id", existing.id);
        if (err) throw err;
        taskId = existing.id;
      } else {
        payload.assigned_by = assignedBy;
        const { data: newTask, error: err } = await supabase
          .from("project_tasks")
          .insert(payload)
          .select("id")
          .single();
        if (err) throw err;
        taskId = newTask?.id ?? null;
      }

      if (!taskId) throw new Error("Failed to save task.");

      await syncProjectTaskAssignees(
        supabase,
        taskId,
        assigneeIds,
        assignedBy
      );

      await Promise.all(
        newlyAdded.map((assigneeId) =>
          notifyTaskAssignee(supabase, {
            assigneeId,
            taskId: taskId!,
            taskTitle,
            projectId: form.project_id,
            projectName: selectedProject?.name,
            actorUserId,
            actorName,
          })
        )
      );

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && blockDialogDismissRef.current) return;
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[900px] [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button]:focus-visible:ring-0 [&>button]:ring-0"
        overlayClassName={blockDialogDismiss ? "pointer-events-none" : undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (blockDialogDismissRef.current) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (blockDialogDismissRef.current) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Always allow Escape to close the task popup.
          e.preventDefault();
          forceCloseDialog();
        }}
      >
        <button
          type="button"
          onClick={forceCloseDialog}
          className="absolute right-6 top-4 z-20 cursor-pointer rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-0 focus-visible:ring-0"
          aria-label="Close"
        >
          <X className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
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
          <div className="space-y-2 pl-6 min-w-0">
            {/* Project */}
            <Select
              value={form.project_id}
              onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
              open={projectSelectOpen}
              onOpenChange={setNestedDropdownOpen(setProjectSelectOpen)}
              disabled={saving || (loadingAccessibleProjects && projectOptions.length === 0)}
            >
              <TooltipProvider delayDuration={180}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      className="inline-flex max-w-full cursor-pointer overflow-hidden"
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

            {/* Assignees */}
            <Popover
              modal={false}
              open={assigneePopoverOpen}
              onOpenChange={handleAssigneePopoverOpenChange}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving || !form.project_id}
                  className="w-full flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 hover:bg-gray-100 focus:outline-none text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className={cn("shrink-0", fieldLabelClass)}>Assignees:</span>
                  <span
                    className={cn(
                      "flex-1 truncate",
                      fieldValueClass,
                      form.assignee_ids.length === 0 && fieldPlaceholderClass
                    )}
                  >
                    {!form.project_id
                      ? "Select a project"
                      : form.assignee_ids.length === 0
                        ? "No assignees"
                        : form.assignee_ids
                            .map((id) =>
                              id === currentUserId
                                ? "You"
                                : assigneeDisplayNames[id] ?? "Assigned"
                            )
                            .join(", ")}
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
                    multiple
                    values={form.assignee_ids}
                    allowedUserIds={projectMemberIds}
                    emptyMessage="No project members found"
                    onSelect={(agentId) => {
                      setForm((f) => ({
                        ...f,
                        assignee_ids: toggleAssigneeId(f.assignee_ids, agentId),
                      }));
                    }}
                  />
                )}
              </PopoverContent>
            </Popover>

            {/* Status */}
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}
              open={statusSelectOpen}
              onOpenChange={setNestedDropdownOpen(setStatusSelectOpen)}
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
              open={prioritySelectOpen}
              onOpenChange={setNestedDropdownOpen(setPrioritySelectOpen)}
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
            <MiniDatePicker
              label="Due:"
              value={dueDate}
              onChange={(date) => {
                setForm((f) => ({
                  ...f,
                  due_date: date ? format(date, "yyyy-MM-dd") : "",
                }));
              }}
              showClearButton
              disabled={saving}
              open={duePopoverOpen}
              onOpenChange={setNestedDropdownOpen(setDuePopoverOpen)}
              labelClassName={fieldLabelClass}
              valueClassName={fieldValueClass}
              placeholderClassName={fieldPlaceholderClass}
            />

            {/* Visibility */}
            <div
              role="button"
              tabIndex={saving ? -1 : 0}
              onClick={() => {
                if (saving) return;
                setForm((f) => ({ ...f, is_public: !f.is_public }));
              }}
              onKeyDown={(e) => {
                if (saving) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setForm((f) => ({ ...f, is_public: !f.is_public }));
                }
              }}
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-full px-4 hover:bg-gray-100",
                saving ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              )}
            >
              <span className={fieldLabelClass}>Public:</span>
              <Switch
                checked={form.is_public}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_public: checked }))
                }
                disabled={saving}
                aria-label="Make task public"
                onClick={(e) => e.stopPropagation()}
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