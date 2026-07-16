"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@walls/auth";
import { getSupabaseClient } from "@walls/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Calendar,
  Flag,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveAccount } from "@/components/active-account-context";
import { ProjectsHeader } from "../projects-header";
import {
  Project,
  ProjectTask,
  type TaskAssignee,
  TaskStatus,
  BoardTaskScope,
  TASK_STATUS_CONFIG,
  PRIORITY_CONFIG,
  KANBAN_COLUMNS,
  TASK_BOARD_PROJECT_STATUSES,
} from "../types";
import {
  getTaskAssigneeDisplayName,
  getTaskAssigneeInitials,
  mapProjectTaskRow,
  PROJECT_TASK_SELECT_WITH_ASSIGNEE,
} from "../task-assignee";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreateTasksPopup } from "../create-tasks-popup";
import {
  ACCESSIBLE_PROJECT_SELECT,
  loadAccessibleProjects,
} from "../load-accessible-projects";
import { filterTasksVisibleToUser } from "../task-visibility";
import {
  defaultBoardTaskScope,
  getBoardTaskScopeOptions,
  getTaskScopeFlags,
  parseBoardTaskScope,
  resolveBoardTaskScope,
  type TaskScopeMetaRow,
} from "../board-task-scope";
import { CreateProjectsPopup } from "../create-projects-popup";
import {
  notifyTaskAssignerOnComplete,
  resolveActorDisplayName,
} from "@/lib/user-notifications";

/* Parse date as local calendar date (avoids timezone shifting to previous day). */
function parseLocalDate(dateStr: string): Date {
  const dateOnly = dateStr.slice(0, 10);
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function todayDateString(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

function renderMarkdownPreview(
  text: string,
  options?: { maxLines?: number; textClassName?: string }
): React.ReactNode {
  if (!text.trim()) return null;
  const lines = text.split("\n");
  const limitedLines =
    options?.maxLines && options.maxLines > 0 ? lines.slice(0, options.maxLines) : lines;
  const textClassName = options?.textClassName ?? "";

  return (
    <>
      {limitedLines.map((line, i) => {
        const h3 = line.match(/^###\s+(.*)/);
        const h2 = !h3 ? line.match(/^##\s+(.*)/) : null;
        const h1 = !h3 && !h2 ? line.match(/^#\s+(.*)/) : null;
        const bullet = line.match(/^-\s+(.*)/);
        const numbered = line.match(/^(\d+)\.\s+(.*)/);

        if (h3) {
          return (
            <div key={i} className="font-semibold text-sm mt-1">
              {renderInlineMarkdown(h3[1])}
            </div>
          );
        }

        if (h2) {
          return (
            <div key={i} className="font-semibold text-base mt-1.5">
              {renderInlineMarkdown(h2[1])}
            </div>
          );
        }

        if (h1) {
          return (
            <div key={i} className="font-bold text-lg mt-2">
              {renderInlineMarkdown(h1[1])}
            </div>
          );
        }

        if (bullet) {
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-[-0.5px] text-current shrink-0">•</span>
              <span className={textClassName}>{renderInlineMarkdown(bullet[1])}</span>
            </div>
          );
        }

        if (numbered) {
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-neutral-500 shrink-0">{numbered[1]}.</span>
              <span className={textClassName}>{renderInlineMarkdown(numbered[2])}</span>
            </div>
          );
        }

        if (line.trim() === "") {
          return <div key={i} className="h-1.5" />;
        }

        return (
          <div key={i} className={textClassName}>
            {renderInlineMarkdown(line)}
          </div>
        );
      })}
    </>
  );
}

/* ─── Plus icon button (matches ProjectsHeader — no bg at rest, inset ring on hover) ─ */
const KANBAN_PLUS_HOVER_RING =
  "relative z-10 flex items-center justify-center rounded-full transition-all duration-300 ease-in-out group-hover:bg-kenoo-white group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";

function KanbanPlusButton({
  onClick,
  title,
  size = "md",
  className,
}: {
  onClick: () => void;
  title: string;
  size?: "md" | "sm";
  className?: string;
}) {
  const isMd = size === "md";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-transparent p-0 shadow-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2",
        isMd ? "h-10 w-10" : "h-8 w-8",
        className
      )}
    >
      <div className="relative">
        <div className={cn(KANBAN_PLUS_HOVER_RING, isMd ? "p-3" : "p-2")}>
          <Plus
            className={cn(
              "stroke-[1.5] text-neutral-500",
              isMd ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"
            )}
          />
        </div>
      </div>
    </button>
  );
}

/* ─── Due date label ─────────────────────────────────────────────────────── */
function TaskDueDate({
  date,
  isCompleted,
}: {
  date: string | null;
  isCompleted?: boolean;
}) {
  if (!date) return null;
  const d = parseLocalDate(date);
  const overdue = !isCompleted && date.slice(0, 10) < todayDateString();
  return (
    <span
      className={cn(
        "text-[10px] flex items-center gap-1 font-light uppercase tracking-wider",
        overdue ? "text-red-500" : "text-neutral-400"
      )}
    >
      <Calendar className="h-2 w-2" />
      {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
    </span>
  );
}

/* ─── Priority indicator ─────────────────────────────────────────────────── */
function PriorityFlag({
  priority,
  className,
}: {
  priority: number | null;
  className?: string;
}) {
  if (!priority) return null;
  const cfg = PRIORITY_CONFIG[priority];
  if (!cfg) return null;
  return (
    <span
      title={cfg.label}
      className={cn(
        "text-[10px] font-light uppercase tracking-wider text-neutral-400 flex items-center gap-1 flex-shrink-0",
        className
      )}
    >
      <Flag className="h-2 w-2" />
      {cfg.label}
    </span>
  );
}

function TaskAssignee({
  assignee,
  assigneeId,
  currentUserId,
}: {
  assignee?: TaskAssignee | null;
  assigneeId: string | null;
  currentUserId?: string | null;
}) {
  const label = getTaskAssigneeDisplayName(assignee, assigneeId, currentUserId);
  const initials = getTaskAssigneeInitials(assignee);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <Avatar className="h-5 w-5 shrink-0">
        {assignee?.avatar_url ? (
          <AvatarImage src={assignee.avatar_url} alt="" />
        ) : null}
        <AvatarFallback className="bg-neutral-100 text-[9px] font-medium text-neutral-500">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-[10px] font-light uppercase tracking-wider text-neutral-400">
        {label}
      </span>
    </div>
  );
}

const CARD_GLASS_CLASS = "bg-white/90 backdrop-blur-md";
const CARD_HOVER_OVERLAY_CLASS = "bg-neutral-100";

/* ─── Task card (sortable) ───────────────────────────────────────────────── */
interface TaskCardProps {
  task: ProjectTask;
  isDragOverlay?: boolean;
  columnStatus?: TaskStatus;
  onEdit: (task: ProjectTask) => void;
}

function TaskCard({ task, isDragOverlay = false, columnStatus, onEdit }: TaskCardProps) {
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const projectColor = task.project?.color ?? "#ceff00";
  const status = columnStatus ?? task.status;

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={cn(
        "rounded-2xl px-5 py-4 flex flex-col gap-3 group cursor-pointer select-none relative overflow-hidden",
        CARD_GLASS_CLASS,
        "shadow-[0_3px_12px_rgba(15,23,42,0.07)]",
        !isDragOverlay &&
          isHovered &&
          "shadow-[0_10px_24px_rgba(15,23,42,0.11)]",
        isDragOverlay
          ? "rotate-[1deg] scale-[1.02] ring-2 ring-white/40"
          : "transition-[box-shadow,background-color] duration-200"
      )}
      onMouseEnter={() => !isDragOverlay && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isDragOverlay && onEdit(task)}
    >
      {/* Hover overlay – smooth opacity increase via Framer Motion */}
      {!isDragOverlay && (
        <motion.div
          className={cn("absolute inset-0 rounded-2xl pointer-events-none", CARD_HOVER_OVERLAY_CLASS)}
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          aria-hidden
        />
      )}
      {/* Content (above overlay) */}
      <div className="relative z-10 flex flex-col gap-3">
      {/* Top row: project (left) + priority (right) */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        {task.project ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: projectColor }}
            />
            <span className="truncate text-xs font-light text-neutral-400">
              {task.project.name}
            </span>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <PriorityFlag priority={task.priority} />
      </div>

      <div className="h-px bg-neutral-200/70" />

      {/* Drag handle + title row */}
      <div className="flex items-start">
        <motion.div
          className="mt-0.5 flex-shrink-0 overflow-hidden"
          animate={{
            width: isHovered ? 18 : 0,
            marginRight: isHovered ? 8 : 0,
            opacity: isHovered ? 1 : 0,
          }}
          initial={false}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          style={{ pointerEvents: isHovered ? "auto" : "none" }}
        >
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-0.5 rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-neutral-300" />
          </div>
        </motion.div>

        <div className="flex-1 min-w-0">
          <p className="text-lg font-light text-neutral-600 leading-snug line-clamp-2">
            {task.title}
          </p>
          {task.description && !isDragOverlay && (
            <div className="mt-1">
              <button
                type="button"
                className="text-[11px] text-neutral-400 font-light hover:text-neutral-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDescription((prev) => !prev);
                }}
              >
                {showDescription ? "Hide description" : "+ Show description"}
              </button>

              {showDescription && (
                <div className="text-xs text-neutral-400 mt-1 font-light">
                  {renderMarkdownPreview(task.description, {
                    textClassName: "text-xs text-neutral-400",
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: assignee (left) + due date (right) */}
      <div className="flex items-center justify-between gap-2 pt-0.5 min-w-0">
        <TaskAssignee
          assignee={task.assignee}
          assigneeId={task.assignee_id}
          currentUserId={user?.id}
        />
        <div className="shrink-0">
          <TaskDueDate
            date={task.due_date}
            isCompleted={status === "completed"}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

const COLUMN_PAGE_SIZE = 50;

/* ─── Kanban column ──────────────────────────────────────────────────────── */
interface KanbanColumnProps {
  status: TaskStatus;
  tasks: ProjectTask[];
  overId: string | null;
  onAddTask: (status: TaskStatus) => void;
  onEditTask: (task: ProjectTask) => void;
}

function KanbanColumn({
  status,
  tasks,
  overId,
  onAddTask,
  onEditTask,
}: KanbanColumnProps) {
  const cfg = TASK_STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(COLUMN_PAGE_SIZE);

  const totalCount = tasks.length;
  const visibleTasks = useMemo(
    () => tasks.slice(0, visibleCount),
    [tasks, visibleCount]
  );
  const hasMore = totalCount > visibleCount;
  const countLabel =
    totalCount === 0
      ? "0"
      : hasMore
        ? `${visibleCount}+`
        : String(totalCount);

  useEffect(() => {
    setVisibleCount(COLUMN_PAGE_SIZE);
  }, [totalCount, status]);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + COLUMN_PAGE_SIZE, totalCount));
  }, [totalCount]);

  useEffect(() => {
    if (!hasMore) return;
    const root = scrollRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root, rootMargin: "120px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visibleCount]);

  const setColumnRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  const handleColumnScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    const nearBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (nearBottom) loadMore();
  }, [hasMore, loadMore]);

  const isOverTaskInColumn = overId ? tasks.some((t) => t.id === overId) : false;
  const showDropHighlight = isOver || isOverTaskInColumn;

  return (
    <div className="flex flex-col min-w-[360px] max-w-[420px] flex-shrink-0 h-full min-h-0">
      {/* Column header — fixed, does not scroll */}
      <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: cfg.accent }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
            {cfg.label}
          </span>
          <span className="text-xs text-neutral-400 font-light tabular-nums">
            {countLabel}
          </span>
        </div>
        <KanbanPlusButton
          size="sm"
          onClick={() => onAddTask(status)}
          title={`Add task to ${cfg.label}`}
        />
      </div>

      {/* Drop zone — only this area scrolls (task cards) */}
      <div
        ref={setColumnRef}
        onScroll={handleColumnScroll}
        className={cn(
          "flex-1 min-h-0 rounded-2xl p-4 flex flex-col gap-3 overflow-y-auto transition-colors",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          showDropHighlight && "ring-2 ring-offset-1"
        )}
        style={showDropHighlight ? { outline: `2px solid ${cfg.accent}`, outlineOffset: 2 } : undefined}
      >
        <SortableContext
          items={visibleTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence>
            {visibleTasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <TaskCard task={task} columnStatus={status} onEdit={onEditTask} />
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore && (
            <div ref={loadMoreSentinelRef} className="h-px w-full shrink-0" aria-hidden />
          )}

          {totalCount === 0 && (
            <div className="flex flex-1 min-h-[160px] flex-col items-center justify-center gap-1 opacity-60">
              <KanbanPlusButton
                size="sm"
                onClick={() => onAddTask(status)}
                title={`Add task to ${cfg.label}`}
              />
              <span className="text-xs font-light text-neutral-400">Add task</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

/* ─── Task detail sheet ──────────────────────────────────────────────────── */
interface TaskDetailProps {
  task: ProjectTask | null;
  onClose: () => void;
  onEdit: (task: ProjectTask) => void;
  onDelete: (task: ProjectTask) => void;
}

function TaskDetail({ task, onClose, onEdit, onDelete }: TaskDetailProps) {
  if (!task) return null;
  const statusCfg =
    TASK_STATUS_CONFIG[task.status as TaskStatus] ?? TASK_STATUS_CONFIG.todo;
  const priorityCfg = task.priority ? PRIORITY_CONFIG[task.priority] : null;

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px] p-0 gap-0 overflow-hidden rounded-3xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-neutral-100">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-base font-black tracking-tight uppercase text-neutral-900 leading-snug">
              {task.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                "text-xs font-medium px-2.5 py-0.5 rounded-full uppercase tracking-wider",
                statusCfg.badge
              )}
            >
              {statusCfg.label}
            </span>
            {priorityCfg && (
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                {priorityCfg.label}
              </span>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="text-sm text-neutral-600 font-light leading-relaxed space-y-1">
              {renderMarkdownPreview(task.description, {
                textClassName: "text-sm text-neutral-600",
              })}
            </div>
          )}

          {/* Project */}
          {task.project && (
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: task.project.color ?? "#ceff00" }}
              />
              <span className="text-sm text-neutral-600 font-light">
                {task.project.name}
              </span>
            </div>
          )}

          {/* Due date */}
          {task.due_date && (
            <div className="flex items-center gap-2 text-sm text-neutral-500 font-light">
              <Calendar className="h-4 w-4" />
              {parseLocalDate(task.due_date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => onDelete(task)}
            className="rounded-xl text-red-600 hover:text-red-600 hover:bg-red-50"
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="rounded-xl">
              Close
            </Button>
            <Button
              onClick={() => { onClose(); onEdit(task); }}
              className="rounded-xl bg-neutral-900 text-white hover:bg-neutral-700"
            >
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main kanban component ──────────────────────────────────────────────── */
interface AgentsProjectsKanbanProps {
  analyticsData: unknown;
}

function AgentsProjectsKanbanContent({
  analyticsData: _analyticsData,
}: AgentsProjectsKanbanProps) {
  const { user } = useAuth();
  const { activeAccountId, loading: accountLoading } = useActiveAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>(
    searchParams.get("project") ?? "all"
  );
  const [taskScopeFilter, setTaskScopeFilter] = useState<BoardTaskScope>(() =>
    parseBoardTaskScope(searchParams.get("scope"))
  );
  const [scopeMetaRows, setScopeMetaRows] = useState<TaskScopeMetaRow[]>([]);

  const scopeProjectIds = useMemo(() => {
    if (projectFilter === "all") {
      return projects.map((p) => p.id);
    }
    return projects.some((p) => p.id === projectFilter) ? [projectFilter] : [];
  }, [projectFilter, projects]);

  const taskScopeFlags = useMemo(
    () =>
      user
        ? getTaskScopeFlags(scopeMetaRows, user.id, scopeProjectIds)
        : { canSeeOthersTasks: false, hasAssignedTasks: false },
    [scopeMetaRows, user, scopeProjectIds]
  );

  const taskScopeOptions = useMemo(
    () =>
      getBoardTaskScopeOptions(
        taskScopeFlags.canSeeOthersTasks,
        taskScopeFlags.hasAssignedTasks
      ),
    [taskScopeFlags]
  );

  const handleTaskScopeFilterChange = useCallback(
    (value: BoardTaskScope) => {
      setTaskScopeFilter(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value === defaultBoardTaskScope(taskScopeOptions)) {
        params.delete("scope");
      } else {
        params.set("scope", value);
      }
      const qs = params.toString();
      router.replace(`/tasks${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams, taskScopeOptions]
  );

  const handleProjectFilterChange = useCallback(
    (value: string) => {
      setProjectFilter(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete("project");
      } else {
        params.set("project", value);
      }
      const qs = params.toString();
      router.replace(`/tasks${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Dialog states
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<ProjectTask | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [viewTask, setViewTask] = useState<ProjectTask | null>(null);
  const [deleteTask, setDeleteTask] = useState<ProjectTask | null>(null);

  // DnD state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  /* Load data */
  const loadData = useCallback(async () => {
    if (!user || !activeAccountId || accountLoading) {
      setTasks([]);
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const loadedProjects = (
        await loadAccessibleProjects(user.id, {
          accountId: activeAccountId,
          select: ACCESSIBLE_PROJECT_SELECT.summary,
        })
      ).filter((p) => TASK_BOARD_PROJECT_STATUSES.includes(p.status));
      setProjects(loadedProjects);

      const projectIds = loadedProjects.map((p) => p.id);
      const taskSelect = PROJECT_TASK_SELECT_WITH_ASSIGNEE;

      let metaRows: TaskScopeMetaRow[] = [];
      if (projectIds.length > 0) {
        const { data } = await supabase
          .from("project_tasks")
          .select("project_id, assignee_id, assigned_by, is_private")
          .in("project_id", projectIds);
        metaRows = (data ?? []) as TaskScopeMetaRow[];
      }
      setScopeMetaRows(metaRows);

      const contextualProjectIds =
        projectFilter === "all"
          ? projectIds
          : projectIds.filter((id) => id === projectFilter);
      const { canSeeOthersTasks, hasAssignedTasks } = getTaskScopeFlags(
        metaRows,
        user.id,
        contextualProjectIds
      );

      const scopeOptions = getBoardTaskScopeOptions(
        canSeeOthersTasks,
        hasAssignedTasks
      );
      const effectiveScope = resolveBoardTaskScope(taskScopeFilter, scopeOptions);
      const loadProjectIds =
        contextualProjectIds.length > 0 ? contextualProjectIds : projectIds;

      let taskRows: Omit<ProjectTask, "project">[] = [];
      if (effectiveScope === "assigned" && loadProjectIds.length > 0) {
        const { data } = await supabase
          .from("project_tasks")
          .select(taskSelect)
          .eq("assigned_by", user.id)
          .neq("assignee_id", user.id)
          .in("project_id", loadProjectIds)
          .order("position", { ascending: true, nullsFirst: false });
        taskRows = (data ?? []).map((row) =>
          mapProjectTaskRow(row as Record<string, unknown>)
        );
      } else if (effectiveScope === "mine") {
        const { data } = await supabase
          .from("project_tasks")
          .select(taskSelect)
          .eq("assignee_id", user.id)
          .order("position", { ascending: true, nullsFirst: false });
        taskRows = (data ?? []).map((row) =>
          mapProjectTaskRow(row as Record<string, unknown>)
        );
      } else if (loadProjectIds.length > 0) {
        const { data } = await supabase
          .from("project_tasks")
          .select(taskSelect)
          .in("project_id", loadProjectIds)
          .order("position", { ascending: true, nullsFirst: false });
        taskRows = (data ?? []).map((row) =>
          mapProjectTaskRow(row as Record<string, unknown>)
        );
      }

      const projectMap = new Map(
        loadedProjects.map((p) => [p.id, { id: p.id, name: p.name, color: p.color }])
      );

      const loadedTasks = filterTasksVisibleToUser(taskRows ?? [], user.id);
      setTasks(
        loadedTasks.map((t) => ({
          ...t,
          project: projectMap.get(t.project_id),
        }))
      );
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeAccountId, accountLoading, refreshTrigger, taskScopeFilter, projectFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (taskScopeOptions.length === 0) {
      if (taskScopeFilter !== "mine") setTaskScopeFilter("mine");
      return;
    }
    const resolved = resolveBoardTaskScope(taskScopeFilter, taskScopeOptions);
    if (resolved !== taskScopeFilter) {
      handleTaskScopeFilterChange(resolved);
    }
  }, [
    taskScopeOptions,
    taskScopeFilter,
    handleTaskScopeFilterChange,
    projectFilter,
  ]);

  /* Filter tasks by project */
  const filteredTasks =
    projectFilter === "all"
      ? tasks
      : tasks.filter((t) => t.project_id === projectFilter);

  /* Filter tasks by search (title, description, project name) */
  const searchFilteredTasks = React.useMemo(() => {
    if (!debouncedSearch) return filteredTasks;
    const q = debouncedSearch.toLowerCase();
    return filteredTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.project?.name.toLowerCase().includes(q) ?? false)
    );
  }, [filteredTasks, debouncedSearch]);

  /* Group tasks by status column and sort: non-completed by due_date (soonest first), completed by completed_at (most recent first) */
  const tasksByStatus = React.useMemo(() => {
    const map: Record<TaskStatus, ProjectTask[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      on_hold: [],
      completed: [],
      blocked: [],
    };
    for (const t of searchFilteredTasks) {
      if (map[t.status]) map[t.status].push(t);
      else map.todo.push(t);
    }
    const sortByDueDate = (a: ProjectTask, b: ProjectTask) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    };
    const sortByCompletedAt = (a: ProjectTask, b: ProjectTask) => {
      if (!a.completed_at && !b.completed_at) return 0;
      if (!a.completed_at) return 1;
      if (!b.completed_at) return -1;
      return b.completed_at.localeCompare(a.completed_at);
    };
    for (const col of KANBAN_COLUMNS) {
      if (col === "completed") {
        map[col].sort(sortByCompletedAt);
      } else {
        map[col].sort(sortByDueDate);
      }
    }
    return map;
  }, [searchFilteredTasks]);

  /* DnD handlers */
  const activeTask = activeTaskId
    ? tasks.find((t) => t.id === activeTaskId) ?? null
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    setOverId(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column (status) or another task
    const isColumn = KANBAN_COLUMNS.includes(overId as TaskStatus);
    const targetStatus: TaskStatus | null = isColumn
      ? (overId as TaskStatus)
      : (tasks.find((t) => t.id === overId)?.status ?? null);

    if (!targetStatus) return;

    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    if (draggedTask.status === targetStatus && !isColumn) {
      // Reorder within same column
      const colTasks = [...tasksByStatus[targetStatus]];
      const oldIdx = colTasks.findIndex((t) => t.id === taskId);
      const newIdx = colTasks.findIndex((t) => t.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

      const reordered = arrayMove(colTasks, oldIdx, newIdx);
      // Optimistic update
      setTasks((prev) => {
        const rest = prev.filter((t) => t.project_id !== draggedTask.project_id || t.status !== targetStatus);
        // Actually update all tasks
        const updated = prev.map((t) => {
          const idx = reordered.findIndex((r) => r.id === t.id);
          if (idx === -1) return t;
          return { ...t, position: idx };
        });
        return updated;
      });

      // Persist positions
      try {
        const supabase = getSupabaseClient();
        await Promise.all(
          reordered.map((t, i) =>
            supabase
              .from("project_tasks")
              .update({ position: i })
              .eq("id", t.id)
          )
        );
      } catch {
        // silent - refresh will correct
      }
      return;
    }

    // Move to different column (status change)
    if (draggedTask.status !== targetStatus) {
      const completedAt =
        targetStatus === "completed" ? new Date().toISOString() : null;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: targetStatus, completed_at: completedAt }
            : t
        )
      );

      try {
        const supabase = getSupabaseClient();
        const updatePayload: {
          status: TaskStatus;
          completed_at?: string | null;
        } = { status: targetStatus };
        if (targetStatus === "completed") {
          updatePayload.completed_at = completedAt;
        } else if (draggedTask.status === "completed") {
          updatePayload.completed_at = null;
        }

        await supabase
          .from("project_tasks")
          .update(updatePayload)
          .eq("id", taskId);

        if (
          targetStatus === "completed" &&
          draggedTask.status !== "completed" &&
          user?.id &&
          draggedTask.assignee_id === user.id &&
          draggedTask.assigned_by &&
          draggedTask.assigned_by !== user.id
        ) {
          const completerName = await resolveActorDisplayName(supabase, user.id);
          await notifyTaskAssignerOnComplete(supabase, {
            assignerId: draggedTask.assigned_by,
            taskId: draggedTask.id,
            taskTitle: draggedTask.title,
            projectId: draggedTask.project_id,
            projectName: draggedTask.project?.name,
            completerUserId: user.id,
            completerName,
          });
        }
      } catch {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: draggedTask.status,
                  completed_at: draggedTask.completed_at,
                }
              : t
          )
        );
      }
    }
  };

  const handleDeleteTask = async (task: ProjectTask) => {
    setDeleteTask(null);
    try {
      const supabase = getSupabaseClient();
      await supabase.from("project_tasks").delete().eq("id", task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch {
      // silent
    }
  };

  const refresh = () => { setIsRefreshing(true); setRefreshTrigger((r) => r + 1); };

  return (
    <>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 w-full flex flex-col min-h-0">
          {/* Header (no extra top padding; handled in ProjectsHeader).
              Stack above the toolbar so the project filter dropdown is not covered by the refresh control. */}
          <div className="relative z-20 flex-shrink-0 pl-8 pr-4 md:pr-6">
            <ProjectsHeader
              onNewTask={() => {
                setEditTask(null);
                setTaskFormOpen(true);
              }}
              onNewProject={() => setProjectFormOpen(true)}
              taskScopeOptions={taskScopeOptions}
              taskScopeFilter={taskScopeFilter}
              onTaskScopeFilterChange={handleTaskScopeFilterChange}
              projects={projects}
              projectFilter={projectFilter}
              onProjectFilterChange={handleProjectFilterChange}
              projectStatusFilter={TASK_BOARD_PROJECT_STATUSES}
            />
          </div>

          {/* Toolbar: actions */}
          <div className="flex-shrink-0 pl-8 pr-4 pt-2 pb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm min-w-[12rem]">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search tasks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                    search ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                    "focus:border-b-[var(--kenoo-sky)]"
                  )}
                />
              </div>

              <KanbanPlusButton
                title="New task"
                onClick={() => {
                  setEditTask(null);
                  setTaskFormOpen(true);
                }}
              />

              <button
                type="button"
                onClick={refresh}
                className="h-9 w-9 shrink-0 flex items-center justify-center text-xs group"
                aria-label="Refresh board"
              >
                <div
                  className={cn(
                    "relative z-10 p-2.5 rounded-full",
                    "transition-all duration-300 ease-in-out",
                    "group-hover:bg-neutral-50 group-hover:border group-hover:border-neutral-200/50",
                    "group-hover:scale-95 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]"
                  )}
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4 text-neutral-400",
                      isRefreshing && "animate-[spin_0.6s_linear_1]"
                    )}
                    onAnimationEnd={() => setIsRefreshing(false)}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* Kanban board — scrollable container only; page does not scroll */}
          {loading ? (
            <div className="flex-1 min-h-0 pl-8 pr-4 overflow-x-auto overflow-y-hidden flex flex-col">
              <div className="flex flex-1 min-h-0 gap-6 pb-0 min-w-max">
                {KANBAN_COLUMNS.map((col) => (
                  <div
                    key={col}
                    className="min-w-[360px] rounded-2xl border border-neutral-200/50 h-full animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 pl-8 pr-4 overflow-x-auto overflow-y-hidden overscroll-contain flex flex-col">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="flex flex-1 min-h-0 gap-6 pb-0 min-w-max">
                  {KANBAN_COLUMNS.map((col) => (
                    <KanbanColumn
                      key={col}
                      status={col}
                      tasks={tasksByStatus[col] ?? []}
                      overId={overId}
                      onAddTask={(status) => {
                        setEditTask(null);
                        setDefaultStatus(status);
                        setTaskFormOpen(true);
                      }}
                      onEditTask={(task) => {
                        setEditTask(task);
                        setTaskFormOpen(true);
                      }}
                    />
                  ))}
                </div>

                <DragOverlay>
                  {activeTask && (
                    <TaskCard
                      task={activeTask}
                      isDragOverlay
                      onEdit={() => {}}
                    />
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {/* New project dialog */}
      <CreateProjectsPopup
        open={projectFormOpen}
        onClose={() => setProjectFormOpen(false)}
        onSaved={() => { setProjectFormOpen(false); refresh(); }}
      />

      {/* Task form dialog */}
      <CreateTasksPopup
        open={taskFormOpen}
        onClose={() => {
          setTaskFormOpen(false);
          setEditTask(null);
        }}
        onSaved={refresh}
        projects={projects}
        defaultStatus={defaultStatus}
        existing={editTask}
        defaultProjectId={projectFilter !== "all" ? projectFilter : null}
      />

      {/* Task detail */}
      <TaskDetail
        task={viewTask}
        onClose={() => setViewTask(null)}
        onEdit={(task) => {
          setViewTask(null);
          setEditTask(task);
          setTaskFormOpen(true);
        }}
        onDelete={(task) => {
          setViewTask(null);
          setDeleteTask(task);
        }}
      />

      {/* Delete task confirm */}
      <Dialog
        open={!!deleteTask}
        onOpenChange={(o) => !o && setDeleteTask(null)}
      >
        <DialogContent className="max-w-[360px] p-0 gap-0 overflow-hidden rounded-3xl">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-base font-black tracking-tight uppercase text-neutral-900">
              Delete Task?
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 flex flex-col gap-4">
            <p className="text-sm text-neutral-600">
              &ldquo;{deleteTask?.title}&rdquo; will be permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteTask(null)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteTask && handleDeleteTask(deleteTask)}
                className="rounded-xl bg-red-600 text-white hover:bg-red-500"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AgentsProjectsKanban(
  props: AgentsProjectsKanbanProps
) {
  return <AgentsProjectsKanbanContent {...props} />;
}
