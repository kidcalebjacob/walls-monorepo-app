"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "@walls/auth";
import { getSupabaseClient } from "@walls/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  Circle,
  Timer,
  AlertTriangle,
  LayoutList,
  GanttChartSquare,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveAccount } from "@/components/active-account-context";
import { ProjectsHeader } from "../projects-header";
import {
  ACCESSIBLE_PROJECT_SELECT,
  loadAccessibleProjects,
} from "../load-accessible-projects";
import { filterTasksVisibleToUser } from "../task-visibility";
import {
  Project,
  ProjectTask,
  TaskStatus,
  TASK_STATUS_CONFIG,
  PROJECT_STATUS_CONFIG,
  PRIORITY_CONFIG,
} from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  addDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  differenceInDays,
  format,
  isToday,
  isSameDay,
  parseISO,
  startOfDay,
  endOfDay,
  isWithinInterval,
  clamp,
} from "date-fns";

/* ─── Constants ──────────────────────────────────────────────────────────── */
const DAY_WIDTH = 72; // px per day column (wider for readability)
const ROW_HEIGHT = 80; // px per row (taller project/task containers)
const LABEL_WIDTH = 220; // px for left label column

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function parseDateSafe(d: string | null): Date | null {
  if (!d) return null;
  try {
    return startOfDay(parseISO(d));
  } catch {
    return null;
  }
}

function isOverdue(date: string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}

function isDueSoon(date: string | null): boolean {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff >= 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

/* ─── View mode types ─────────────────────────────────────────────────────── */
type ViewMode = "gantt" | "list";
type GanttMode = "project" | "task";

/* ─── Gantt bar positioning ───────────────────────────────────────────────── */
interface BarPosition {
  left: number;
  width: number;
  clamped: boolean;
}

function getBarPosition(
  startDate: Date | null,
  endDate: Date | null,
  timelineStart: Date,
  totalDays: number
): BarPosition | null {
  if (!startDate && !endDate) return null;

  const tStart = startDate ?? endDate!;
  const tEnd = endDate ?? startDate!;

  const rawLeft = differenceInDays(tStart, timelineStart);
  const rawRight = differenceInDays(tEnd, timelineStart) + 1;

  if (rawRight < 0 || rawLeft > totalDays) return null;

  const clampedLeft = Math.max(0, rawLeft);
  const clampedRight = Math.min(totalDays, rawRight);
  const clamped = clampedLeft !== rawLeft || clampedRight !== rawRight;

  return {
    left: clampedLeft * DAY_WIDTH,
    width: Math.max((clampedRight - clampedLeft) * DAY_WIDTH, DAY_WIDTH / 2),
    clamped,
  };
}

/* ─── Gantt row types ─────────────────────────────────────────────────────── */
interface BaseGanttRow {
  id: string;
  label: string;
  color: string;
  barPos: BarPosition | null;
  isCompleted: boolean;
  isOverdueFlag: boolean;
  subLabel?: string;
}

interface ProjectGanttRow extends BaseGanttRow {
  // project-level rows have no task-specific fields
}

interface TaskGanttRow extends BaseGanttRow {
  status: TaskStatus;
  priority?: number | null;
  task: ProjectTask;
}

type AnyGanttRow = ProjectGanttRow | TaskGanttRow;

/* ─── Task status icon ───────────────────────────────────────────────────── */
function TaskStatusIcon({ status }: { status: TaskStatus }) {
  if (status === "completed")
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />;
  if (status === "blocked")
    return <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
  if (status === "in_progress")
    return <Timer className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />;
  const cfg = TASK_STATUS_CONFIG[status];
  return (
    <Circle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: cfg.accent }} />
  );
}

/* ─── Task detail dialog ─────────────────────────────────────────────────── */
const TASK_STATUS_OPTIONS: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "on_hold",
  "completed",
  "blocked",
];

function TaskDetailDialog({
  task,
  onClose,
  onStatusChange,
}: {
  task: ProjectTask | null;
  onClose: () => void;
  onStatusChange: (task: ProjectTask, status: TaskStatus) => void;
}) {
  if (!task) return null;
  const statusCfg = TASK_STATUS_CONFIG[task.status];
  const priorityCfg = task.priority ? PRIORITY_CONFIG[task.priority] : null;
  const overdue = isOverdue(task.due_date) && task.status !== "completed";

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px] p-0 gap-0 overflow-hidden rounded-3xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-neutral-100">
          <DialogTitle className="text-base font-black tracking-tight uppercase text-neutral-900 leading-snug">
            {task.title}
          </DialogTitle>
          {task.project && (
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: task.project.color ?? "#ceff00" }}
              />
              <span className="text-xs text-neutral-500 font-light">
                {task.project.name}
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {TASK_STATUS_OPTIONS.map((s) => {
                const cfg = TASK_STATUS_CONFIG[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onStatusChange(task, s)}
                    className={cn(
                      "text-xs font-medium px-3 py-1 rounded-full uppercase tracking-wider transition-all",
                      task.status === s
                        ? cn(cfg.badge, "ring-2 ring-offset-1 ring-neutral-400")
                        : cn(cfg.badge, "opacity-50 hover:opacity-100")
                    )}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {task.description && (
            <p className="text-sm text-neutral-600 font-light leading-relaxed">
              {task.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {task.start_date && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Start
                </span>
                <span className="font-light text-neutral-700">
                  {format(parseISO(task.start_date), "MMM d, yyyy")}
                </span>
              </div>
            )}
            {task.due_date && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Due
                </span>
                <span className={cn("font-light", overdue ? "text-red-500" : "text-neutral-700")}>
                  {format(parseISO(task.due_date), "MMM d, yyyy")}
                  {overdue && " · Overdue"}
                </span>
              </div>
            )}
            {priorityCfg && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Priority
                </span>
                <span
                  className="font-light flex items-center gap-1.5"
                  style={{ color: priorityCfg.color }}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {priorityCfg.label}
                </span>
              </div>
            )}
            {task.estimated_minutes && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Estimate
                </span>
                <span className="text-neutral-700 font-light">
                  {Math.floor(task.estimated_minutes / 60)}h{" "}
                  {task.estimated_minutes % 60}m
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 flex items-center justify-end">
          <Button variant="ghost" onClick={onClose} className="rounded-xl text-xs uppercase tracking-wider">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Gantt grid header (dates) ──────────────────────────────────────────── */
function GanttHeader({
  days,
  timelineStart,
}: {
  days: Date[];
  timelineStart: Date;
}) {
  // Group days by month
  const months: { label: string; count: number }[] = [];
  let cur = "";
  for (const d of days) {
    const m = format(d, "MMMM yyyy");
    if (m !== cur) {
      months.push({ label: m, count: 1 });
      cur = m;
    } else {
      months[months.length - 1].count++;
    }
  }

  return (
    <div className="bg-neutral-100 border-b border-neutral-100">
      {/* Month row */}
      <div className="flex">
        {/* Sticky label column header to align with project names */}
        <div
          className="flex-shrink-0 bg-neutral-100 border-r border-neutral-200 sticky left-0 z-20"
          style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
        />
        {months.map((m) => (
          <div
            key={m.label}
            className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 px-2 py-1.5 border-r border-neutral-100 last:border-r-0"
            style={{ width: m.count * DAY_WIDTH }}
          >
            {m.label}
          </div>
        ))}
      </div>
      {/* Day row */}
      <div className="flex">
        {/* Sticky label column header spacer */}
        <div
          className="flex-shrink-0 bg-neutral-100 border-r border-neutral-200 sticky left-0 z-20"
          style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
        />
        {days.map((d) => {
          const today = isToday(d);
          const isSun = d.getDay() === 0;
          const isSat = d.getDay() === 6;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex flex-col items-center justify-center border-r border-neutral-100 last:border-r-0 py-1",
                (isSat || isSun) ? "bg-neutral-50/70" : "",
                today ? "bg-[#ceff00]/20" : ""
              )}
              style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
            >
              <span
                className={cn(
                  "text-[9px] font-medium uppercase tracking-wider",
                  today ? "text-neutral-900 font-black" : "text-neutral-400"
                )}
              >
                {format(d, "EEE")}
              </span>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  today
                    ? "text-neutral-900 font-black w-5 h-5 rounded-full bg-[#ceff00] flex items-center justify-center"
                    : "text-neutral-500 font-light"
                )}
              >
                {format(d, "d")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Gantt row ──────────────────────────────────────────────────────────── */
function GanttRow({
  label,
  color,
  barPos,
  status,
  priority,
  isCompleted,
  isOverdueFlag,
  totalDays,
  days,
  onClick,
  index,
  subLabel,
}: {
  label: string;
  color: string;
  barPos: BarPosition | null;
  status?: TaskStatus;
  priority?: number | null;
  isCompleted: boolean;
  isOverdueFlag: boolean;
  totalDays: number;
  days: Date[];
  onClick?: () => void;
  index: number;
  subLabel?: string;
}) {
  const priorityCfg = priority ? PRIORITY_CONFIG[priority] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.015 }}
      className={cn(
        "flex group relative border-b border-neutral-50 last:border-b-0",
        onClick ? "cursor-pointer" : "",
        isCompleted ? "opacity-50" : "",
        isOverdueFlag ? "bg-red-50/30" : ""
      )}
      style={{ height: ROW_HEIGHT }}
      onClick={onClick}
    >
      {/* Label - sticky like talent names in scouter table */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0 bg-neutral-100 border-r border-neutral-200 sticky left-0 z-20"
        style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
      >
        {status && <TaskStatusIcon status={status} />}
        {!status && (
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <div className="flex flex-col min-w-0">
          <span
            className={cn(
              "text-sm font-semibold text-neutral-800 truncate",
              isCompleted && "line-through text-neutral-400"
            )}
          >
            {label}
          </span>
          {subLabel && (
            <span className="text-xs text-neutral-400 font-light truncate">
              {subLabel}
            </span>
          )}
        </div>
        {priorityCfg && (
          <Flag
            className="h-3 w-3 flex-shrink-0 ml-auto"
            style={{ color: priorityCfg.color }}
          />
        )}
      </div>

      {/* Grid + bar */}
      <div
        className="relative flex-1 flex"
        style={{ width: totalDays * DAY_WIDTH }}
      >
        {/* Day columns */}
        {days.map((d) => {
          const today = isToday(d);
          const isSun = d.getDay() === 0;
          const isSat = d.getDay() === 6;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "h-full border-r border-neutral-100/80 last:border-r-0 flex-shrink-0",
                (isSat || isSun) ? "bg-neutral-50/50" : "",
                today ? "bg-[#ceff00]/10" : ""
              )}
              style={{ width: DAY_WIDTH }}
            />
          );
        })}

        {/* Bar */}
        {barPos && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 rounded-full flex items-center px-3 gap-1 overflow-hidden",
              "transition-all duration-150",
              onClick ? "group-hover:brightness-90" : ""
            )}
            style={{
              left: barPos.left,
              width: barPos.width,
              height: 28,
              backgroundColor: color,
              opacity: isCompleted ? 0.5 : 1,
            }}
          >
            {barPos.width > 50 && (
              <span className="text-xs font-semibold text-white/80 truncate leading-none">
                {label}
              </span>
            )}
          </div>
        )}

        {/* No date indicator */}
        {!barPos && (
          <div className="absolute inset-0 flex items-center">
            <span className="text-xs text-neutral-300 font-light px-3">
              no dates
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Today marker ────────────────────────────────────────────────────────── */
function TodayMarker({
  timelineStart,
  totalDays,
  totalHeight,
}: {
  timelineStart: Date;
  totalDays: number;
  totalHeight: number;
}) {
  const today = startOfDay(new Date());
  const offset = differenceInDays(today, timelineStart);
  if (offset < 0 || offset >= totalDays) return null;

  return (
    <div
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{ left: LABEL_WIDTH + offset * DAY_WIDTH + DAY_WIDTH / 2, width: 1.5 }}
    >
      <div className="h-full bg-[#ceff00] opacity-70" />
      <div
        className="absolute -top-1 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#ceff00]"
        style={{ left: "50%" }}
      />
    </div>
  );
}

/* ─── List view row ───────────────────────────────────────────────────────── */
function ListRow({
  task,
  index,
  onClick,
}: {
  task: ProjectTask;
  index: number;
  onClick: (t: ProjectTask) => void;
}) {
  const statusCfg = TASK_STATUS_CONFIG[task.status];
  const priorityCfg = task.priority ? PRIORITY_CONFIG[task.priority] : null;
  const overdue = isOverdue(task.due_date) && task.status !== "completed";
  const soon = isDueSoon(task.due_date) && task.status !== "completed";

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      onClick={() => onClick(task)}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all hover:shadow-sm",
        task.status === "completed"
          ? "bg-neutral-50/60 border-neutral-100"
          : overdue
          ? "bg-red-50/40 border-red-100 hover:bg-red-50/60"
          : "bg-white border-neutral-100 hover:bg-neutral-50"
      )}
    >
      <TaskStatusIcon status={task.status} />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold text-neutral-800 leading-snug truncate",
            task.status === "completed" && "line-through text-neutral-400"
          )}
        >
          {task.title}
        </p>
        {task.project && (
          <p className="text-[10px] text-neutral-400 font-light truncate flex items-center gap-1 mt-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
              style={{ backgroundColor: task.project.color ?? "#ceff00" }}
            />
            {task.project.name}
          </p>
        )}
      </div>

      <span
        className={cn(
          "text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 hidden sm:block",
          statusCfg.badge
        )}
      >
        {statusCfg.label}
      </span>

      {priorityCfg && (
        <Flag className="h-3.5 w-3.5 flex-shrink-0 hidden sm:block" style={{ color: priorityCfg.color }} />
      )}

      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
        {task.start_date && (
          <span className="text-[10px] text-neutral-400 font-light hidden sm:block">
            {format(parseISO(task.start_date), "MMM d")} →
          </span>
        )}
        {task.due_date ? (
          <span
            className={cn(
              "text-xs font-light",
              overdue ? "text-red-500" : soon ? "text-amber-500" : "text-neutral-400"
            )}
          >
            {overdue ? "Overdue · " : soon ? "Soon · " : ""}
            {format(parseISO(task.due_date), "MMM d")}
          </span>
        ) : (
          <span className="text-xs text-neutral-300 font-light">—</span>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Project list group ─────────────────────────────────────────────────── */
function ProjectListGroup({
  project,
  tasks,
  onTaskClick,
}: {
  project: Project;
  tasks: ProjectTask[];
  onTaskClick: (t: ProjectTask) => void;
}) {
  const [open, setOpen] = useState(true);
  const cfg = PROJECT_STATUS_CONFIG[project.status];
  const done = tasks.filter((t) => t.status === "completed").length;
  const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 mb-2.5 group"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-neutral-400 transition-transform",
            !open && "-rotate-90"
          )}
        />
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: project.color ?? cfg.accent }}
        />
        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 truncate flex-1 text-left">
          {project.name}
        </span>
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0", cfg.badge)}>
          {cfg.label}
        </span>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <div className="w-20 h-1 rounded-full bg-neutral-200 overflow-hidden hidden sm:block">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: project.color ?? "#ceff00" }}
            />
          </div>
          <span className="text-[10px] text-neutral-400 tabular-nums">{done}/{tasks.length}</span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-6 flex flex-col gap-2 overflow-hidden"
          >
            {tasks.length === 0 ? (
              <p className="text-xs text-neutral-400 font-light py-2">No tasks.</p>
            ) : (
              tasks.map((t, i) => (
                <ListRow key={t.id} task={t} index={i} onClick={onTaskClick} />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Toolbar segmented toggles (chevron/Today styling + toggle group) ───── */
/** Fixed toolbar row height — keeps Gantt/List from shifting when nav appears. */
const TIMELINE_TOOLBAR_ROW_H = "h-10";

const TIMELINE_TOGGLE_INNER =
  "relative z-10 flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-3 text-xs font-light uppercase tracking-wider transition-all duration-300 ease-in-out";

const TIMELINE_TOGGLE_ACTIVE =
  "border-neutral-200 bg-neutral-50 text-neutral-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]";

const TIMELINE_TOGGLE_INACTIVE =
  "text-neutral-500 group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-neutral-50 group-hover:text-neutral-700 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]";

function TimelineSegmentToggle<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  equalWidth,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  "aria-label": string;
  /** Keeps segment width fixed so the control does not shift when selection changes. */
  equalWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border border-neutral-200/70 bg-neutral-50/50 p-0.5",
        equalWidth
          ? "grid w-[12.25rem] grid-cols-2 gap-0.5"
          : "flex w-max items-center gap-0.5"
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group flex min-w-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent",
              equalWidth && "w-full"
            )}
          >
            <div
              className={cn(
                TIMELINE_TOGGLE_INNER,
                equalWidth && "w-full justify-center",
                active ? TIMELINE_TOGGLE_ACTIVE : TIMELINE_TOGGLE_INACTIVE
              )}
            >
              {opt.icon}
              {opt.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
interface AgentsProjectsTimelineProps {
  analyticsData: unknown;
}

function AgentsProjectsTimelineContent({
  analyticsData: _analyticsData,
}: AgentsProjectsTimelineProps) {
  const { user } = useAuth();
  const { activeAccountId, loading: accountLoading } = useActiveAccount();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  /* view controls */
  const [viewMode, setViewMode] = useState<ViewMode>("gantt");
  const [ganttMode, setGanttMode] = useState<GanttMode>("project");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [viewTask, setViewTask] = useState<ProjectTask | null>(null);

  /* gantt scroll / range */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rangeStart, setRangeStart] = useState<Date>(() =>
    startOfWeek(subWeeks(new Date(), 2), { weekStartsOn: 1 })
  );
  const TOTAL_DAYS = 90;

  const days = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart]);

  /* scroll to today on mount */
  useEffect(() => {
    if (viewMode === "gantt" && scrollRef.current) {
      const todayOffset = differenceInDays(startOfDay(new Date()), rangeStart);
      const scrollLeft = todayOffset * DAY_WIDTH - 80;
      scrollRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [viewMode, rangeStart]);

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

      const loadedProjects = await loadAccessibleProjects(user.id, {
        accountId: activeAccountId,
        select: ACCESSIBLE_PROJECT_SELECT.timeline,
      });
      setProjects(loadedProjects);

      if (loadedProjects.length === 0) {
        setTasks([]);
        return;
      }

      const projectIds = loadedProjects.map((p) => p.id);
      const { data: taskRows, error: taskErr } = await supabase
        .from("project_tasks")
        .select(
          "id, project_id, title, description, status, due_date, start_date, priority, position, parent_task_id, created_at, updated_at, completed_at, assignee_id, assigned_by, is_private, estimated_minutes, actual_minutes, metadata"
        )
        .in("project_id", projectIds)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (taskErr) throw taskErr;

      const projectMap = new Map(
        loadedProjects.map((p) => [
          p.id,
          { id: p.id, name: p.name, color: p.color },
        ])
      );

      const loadedTasks = filterTasksVisibleToUser(
        (taskRows ?? []) as Omit<ProjectTask, "project">[],
        user.id
      );
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
  }, [user, activeAccountId, accountLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Status change */
  const handleStatusChange = async (task: ProjectTask, status: TaskStatus) => {
    setViewTask((prev) => (prev ? { ...prev, status } : null));
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status } : t))
    );
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from("project_tasks")
        .update({ status })
        .eq("id", task.id);
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  };

  /* Filtered tasks */
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (statusFilter) result = result.filter((t) => t.status === statusFilter);
    if (projectFilter !== "all")
      result = result.filter((t) => t.project_id === projectFilter);
    return result.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [tasks, statusFilter, projectFilter]);

  const filteredProjects = useMemo(() => {
    if (projectFilter !== "all")
      return projects.filter((p) => p.id === projectFilter);
    return projects;
  }, [projects, projectFilter]);

  /* Stats */
  const overdueCount = tasks.filter(
    (t) => isOverdue(t.due_date) && t.status !== "completed"
  ).length;
  const doneCount = tasks.filter((t) => t.status === "completed").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "in_progress"
  ).length;

  /* Gantt data */
  const ganttRows: AnyGanttRow[] = useMemo(() => {
    if (ganttMode === "project") {
      return filteredProjects.map<ProjectGanttRow>((p) => {
        const projectTasks = filteredTasks.filter((t) => t.project_id === p.id);
        const start = parseDateSafe(p.start_date);
        const end = parseDateSafe(p.due_date);
        const barPos = getBarPosition(start, end, rangeStart, TOTAL_DAYS);
        const done = projectTasks.filter((t) => t.status === "completed").length;
        const pct = projectTasks.length === 0 ? 0 : Math.round((done / projectTasks.length) * 100);
        return {
          id: p.id,
          label: p.name,
          color: p.color ?? "#ceff00",
          barPos,
          isCompleted: p.status === "completed",
          isOverdueFlag: isOverdue(p.due_date) && p.status !== "completed",
          subLabel: `${done}/${projectTasks.length} tasks · ${pct}%`,
        };
      });
    }
    return filteredTasks.map<TaskGanttRow>((t) => {
      const start = parseDateSafe(t.start_date);
      const end = parseDateSafe(t.due_date);
      const barPos = getBarPosition(start, end, rangeStart, TOTAL_DAYS);
      return {
        id: t.id,
        label: t.title,
        color: t.project?.color ?? "#ceff00",
        barPos,
        status: t.status,
        priority: t.priority,
        isCompleted: t.status === "completed",
        isOverdueFlag: isOverdue(t.due_date) && t.status !== "completed",
        subLabel: t.project?.name,
        task: t,
      };
    });
  }, [ganttMode, filteredProjects, filteredTasks, rangeStart]);

  const ganttHeight = ganttRows.length * ROW_HEIGHT;

  return (
    <>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 w-full flex flex-col min-h-0">
          {/* Fixed header - no page scroll */}
          <div className="flex-none">
            <div className="pb-0 pl-8 pr-4 md:pr-6">
              <ProjectsHeader
                projects={projects}
                projectFilter={projectFilter}
                onProjectFilterChange={setProjectFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>

            {/* Toolbar — view toggle in a fixed left cluster; grouping collapses beside it */}
            <div
              className={cn(
                "mb-5 flex items-center gap-2.5 px-8",
                TIMELINE_TOOLBAR_ROW_H
              )}
            >
              <div
                className={cn(
                  "flex shrink-0 items-center",
                  TIMELINE_TOOLBAR_ROW_H
                )}
              >
                <TimelineSegmentToggle<ViewMode>
                  equalWidth
                  aria-label="Timeline view"
                  value={viewMode}
                  onChange={(v) => setViewMode(v)}
                  options={[
                    {
                      value: "gantt",
                      label: "Gantt",
                      icon: (
                        <GanttChartSquare
                          className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                          strokeWidth={1.5}
                        />
                      ),
                    },
                    {
                      value: "list",
                      label: "List",
                      icon: (
                        <LayoutList
                          className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                          strokeWidth={1.5}
                        />
                      ),
                    },
                  ]}
                />

                <motion.div
                  className={cn("flex shrink-0 items-center overflow-hidden", TIMELINE_TOOLBAR_ROW_H)}
                  initial={false}
                  animate={
                    viewMode === "gantt"
                      ? { width: "auto", opacity: 1, marginLeft: 10 }
                      : { width: 0, opacity: 0, marginLeft: 0 }
                  }
                  transition={{
                    duration: 0.22,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  aria-hidden={viewMode !== "gantt"}
                >
                  <div
                    className={cn(
                      "w-max shrink-0 whitespace-nowrap",
                      viewMode !== "gantt" && "pointer-events-none"
                    )}
                  >
                    <TimelineSegmentToggle<GanttMode>
                      aria-label="Gantt grouping"
                      value={ganttMode}
                      onChange={(v) => setGanttMode(v)}
                      options={[
                        { value: "project", label: "By Project" },
                        { value: "task", label: "By Task" },
                      ]}
                    />
                  </div>
                </motion.div>
              </div>

              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden",
                  TIMELINE_TOOLBAR_ROW_H
                )}
              >
                {statusFilter && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("")}
                    className="flex shrink-0 items-center gap-1 px-2.5 h-7 rounded-full bg-neutral-900 text-white text-[10px] font-medium uppercase tracking-wider"
                  >
                    {TASK_STATUS_CONFIG[statusFilter as TaskStatus]?.label}
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <motion.div
                className={cn(
                  "flex shrink-0 items-center justify-end overflow-hidden",
                  TIMELINE_TOOLBAR_ROW_H
                )}
                initial={false}
                animate={
                  viewMode === "gantt"
                    ? { width: "auto", opacity: 1 }
                    : { width: 0, opacity: 0 }
                }
                transition={{
                  duration: 0.22,
                  ease: [0.4, 0, 0.2, 1],
                }}
                aria-hidden={viewMode !== "gantt"}
              >
                <div
                  className={cn(
                    "flex w-max shrink-0 items-center gap-1.5 whitespace-nowrap",
                    viewMode !== "gantt" && "pointer-events-none"
                  )}
                >
                  <button
                    type="button"
                    className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent group"
                    onClick={() => setRangeStart((d) => subWeeks(d, 4))}
                  >
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-transparent transition-all duration-300 ease-in-out group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-neutral-50 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]">
                      <ChevronLeft className="h-4 w-4 text-neutral-500" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent group"
                    onClick={() => {
                      const newStart = startOfWeek(subWeeks(new Date(), 2), { weekStartsOn: 1 });
                      setRangeStart(newStart);
                      setTimeout(() => {
                        if (scrollRef.current) {
                          const todayOffset = differenceInDays(startOfDay(new Date()), newStart);
                          scrollRef.current.scrollLeft = Math.max(0, todayOffset * DAY_WIDTH - 80);
                        }
                      }, 50);
                    }}
                  >
                    <div className="relative z-10 flex h-7 items-center gap-2 rounded-full border border-transparent px-3 text-xs font-medium uppercase tracking-wider text-neutral-500 transition-all duration-300 ease-in-out group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-neutral-50 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-kenoo-yellow"
                        aria-hidden
                      />
                      Today
                    </div>
                  </button>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent group"
                    onClick={() => setRangeStart((d) => addWeeks(d, 4))}
                  >
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-transparent transition-all duration-300 ease-in-out group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-neutral-50 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]">
                      <ChevronRight className="h-4 w-4 text-neutral-500" />
                    </div>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Scrollable content area - fills remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {/* ── GANTT VIEW ── */}
            {viewMode === "gantt" && (
              <div className="h-full px-8 flex flex-col">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-12 rounded-xl bg-neutral-100 animate-pulse" />
                    ))}
                  </div>
                ) : ganttRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[240px] text-center">
                    <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                      <GanttChartSquare className="h-7 w-7 text-neutral-300" />
                    </div>
                    <p className="text-sm text-neutral-500 font-medium">No items to display</p>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                      Add start and due dates to your {ganttMode === "project" ? "projects" : "tasks"} to see them here.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden bg-neutral-100 flex-1 min-h-0 flex flex-col">
                    {/* Single scrollport for x + y so sticky left on row labels shares the same
                        ancestor as the header; a nested overflow-y-only wrapper breaks
                        position: sticky left relative to horizontal scroll. */}
                    <div
                      ref={scrollRef}
                      className="overflow-auto flex-1 min-h-0 flex flex-col"
                    >
                      <div
                        style={{
                          width: LABEL_WIDTH + TOTAL_DAYS * DAY_WIDTH,
                          minWidth: LABEL_WIDTH + TOTAL_DAYS * DAY_WIDTH,
                        }}
                        className="flex flex-col"
                      >
                        <div className="sticky top-0 z-30 flex-shrink-0 bg-neutral-100 shadow-sm">
                          <GanttHeader days={days} timelineStart={rangeStart} />
                        </div>
                        <div className="relative flex-shrink-0">
                          <TodayMarker
                            timelineStart={rangeStart}
                            totalDays={TOTAL_DAYS}
                            totalHeight={ganttHeight}
                          />
                          {ganttRows.map((row, i) => {
                            const isTaskRow = (r: AnyGanttRow): r is TaskGanttRow =>
                              "task" in r;
                            return (
                              <GanttRow
                                key={row.id}
                                index={i}
                                label={row.label}
                                color={row.color}
                                barPos={row.barPos}
                                status={isTaskRow(row) ? row.status : undefined}
                                priority={isTaskRow(row) ? row.priority : undefined}
                                isCompleted={row.isCompleted}
                                isOverdueFlag={row.isOverdueFlag}
                                totalDays={TOTAL_DAYS}
                                days={days}
                                subLabel={row.subLabel}
                                onClick={
                                  isTaskRow(row)
                                    ? () => setViewTask(row.task)
                                    : undefined
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LIST VIEW ── */}
            {viewMode === "list" && (
              <div className="h-full px-8 pb-6 overflow-y-auto overscroll-none">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-2xl bg-neutral-100 animate-pulse" />
                    ))}
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[240px] text-center">
                    <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                      <LayoutList className="h-7 w-7 text-neutral-300" />
                    </div>
                    <p className="text-sm text-neutral-500 font-medium">No tasks found</p>
                    <p className="text-xs text-neutral-400 mt-1">Try adjusting your filters.</p>
                  </div>
                ) : (
                  filteredProjects.map((p) => {
                    const pTasks = filteredTasks.filter((t) => t.project_id === p.id);
                    if (pTasks.length === 0) return null;
                    return (
                      <ProjectListGroup
                        key={p.id}
                        project={p}
                        tasks={pTasks}
                        onTaskClick={setViewTask}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskDetailDialog
        task={viewTask}
        onClose={() => setViewTask(null)}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}

export default function AgentsProjectsTimeline(
  props: AgentsProjectsTimelineProps
) {
  return <AgentsProjectsTimelineContent {...props} />;
}
