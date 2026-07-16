"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@walls/auth";
import { getSupabaseClient } from "@walls/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Plus,
  X,
  Calendar,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveAccount } from "@/components/active-account-context";
import { ProjectsHeader } from "../projects-header";
import {
  Project,
  ProjectWithStats,
  ProjectStatus,
  PROJECT_STATUS_CONFIG,
} from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateProjectsPopup } from "../create-projects-popup";
import { isTaskVisibleToUser } from "../task-visibility";
import { CreateTasksPopup } from "../create-tasks-popup";

/* ─── Markdown helpers ───────────────────────────────────────────────────── */
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

/* ─── Types ──────────────────────────────────────────────────────────────── */
type SortKey = "name" | "priority" | "due_date" | "progress";

const GROUP_ORDER: ProjectStatus[] = [
  "active",
  "planning",
  "on_hold",
  "completed",
  "cancelled",
];

const DEFAULT_COLLAPSED_GROUPS = new Set<ProjectStatus>([
  "on_hold",
  "completed",
  "cancelled",
]);

/* ─── Status label (dot + text for category group headings) ──────────────── */
function StatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = PROJECT_STATUS_CONFIG[status] ?? {
    label: status,
    badge: "bg-neutral-100 text-neutral-600",
    accent: "rgb(163 163 163)",
  };
  return (
    <span className="inline-flex items-center gap-2 flex-shrink-0">
      <span
        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: cfg.accent }}
        aria-hidden
      />
      <span className="text-sm font-light text-neutral-600">{cfg.label}</span>
    </span>
  );
}

/* ─── Column headers ────────────────────────────────────────────────────── */
function ColumnHeaders({
  sortBy,
  sortDir,
  onSort,
}: {
  sortBy: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortBy === k ? (
      sortDir === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )
    ) : null;

  const headerBtn = (key: SortKey, label: string, extraClass?: string) => (
    <button
      onClick={() => onSort(key)}
      className={cn(
        "flex items-center gap-1 text-xs text-neutral-400 uppercase tracking-wide hover:text-neutral-600 transition-colors",
        sortBy === key && "text-neutral-700 font-medium",
        extraClass
      )}
    >
      {label}
      <SortIcon k={key} />
    </button>
  );

  return (
    <div className="sticky top-0 z-10 flex items-center gap-8 border-b border-neutral-100 bg-kenoo-white px-5 py-2">
      <div className="w-1 flex-shrink-0" />
      <div className="flex-1 min-w-0">{headerBtn("name", "Name")}</div>
      <div className="mr-36 hidden w-40 shrink-0 pl-1 sm:flex">{headerBtn("progress", "Progress")}</div>
      <div className="hidden w-24 shrink-0 text-left md:block">
        <span className="text-xs text-neutral-400 uppercase tracking-wide">Tasks</span>
      </div>
      <div className="ml-16 hidden w-36 shrink-0 pl-1 lg:flex">{headerBtn("due_date", "Due Date")}</div>
      <div className="w-32 shrink-0 pl-6" />
    </div>
  );
}

/* ─── Due date ──────────────────────────────────────────────────────────── */
function DueDateLabel({
  date,
  status,
}: {
  date: string | null;
  status: ProjectStatus;
}) {
  if (!date) return <span className="text-xs text-neutral-300 font-light">—</span>;
  const d = new Date(date);
  const now = new Date();
  const isOverdue =
    d < now && status !== "completed" && status !== "cancelled";
  const formatted = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <span
      className={cn(
        "text-xs font-light flex items-center gap-1",
        isOverdue ? "text-red-500" : "text-neutral-500"
      )}
    >
      <Calendar className="h-3 w-3 flex-shrink-0" />
      {formatted}
    </span>
  );
}

/* ─── Project row ────────────────────────────────────────────────────────── */
interface ProjectRowProps {
  project: ProjectWithStats;
  index: number;
  onEdit: (p: Project) => void;
}

function ProjectRow({ project, index, onEdit }: ProjectRowProps) {
  const cfg = PROJECT_STATUS_CONFIG[project.status];
  const pct =
    project.task_count === 0
      ? 0
      : Math.round((project.done_count / project.task_count) * 100);
  const router = useRouter();
  const [showDescription, setShowDescription] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, delay: index * 0.025, ease: [0.4, 0, 0.2, 1] }}
      role="button"
      tabIndex={0}
      onClick={() => onEdit(project)}
      onKeyDown={(e) => e.key === "Enter" && onEdit(project)}
      className="group flex items-center gap-8 px-3 py-2.5 rounded-2xl hover:bg-neutral-100/80 transition-all cursor-pointer"
    >
      {/* Color accent */}
      <div
        className="w-1 h-9 rounded-full flex-shrink-0"
        style={{ background: project.color ?? cfg.accent }}
      />

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: project.color ?? cfg.accent }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-sm font-light text-neutral-600">
            {project.name}
          </span>
        </div>
        {project.description && (
          <div className="mt-0">
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
                {renderMarkdownPreview(project.description, {
                  textClassName: "text-xs text-neutral-400",
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mr-36 hidden w-40 shrink-0 items-center gap-2.5 pl-1 sm:flex">
        <div className="min-w-0 flex-1 h-1 rounded-full bg-neutral-200 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              pct === 100 ? "bg-kenoo-yellow" : "bg-kenoo-sky/50"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-500">
          {pct}%
        </span>
      </div>

      {/* Task count */}
      <span className="hidden w-24 shrink-0 text-left text-xs tabular-nums text-neutral-400 md:block">
        {project.done_count}/{project.task_count}
      </span>

      {/* Due date */}
      <div className="ml-16 hidden w-36 shrink-0 pl-1 lg:flex">
        <DueDateLabel date={project.due_date} status={project.status} />
      </div>

      {/* Actions — visible on hover */}
      <div
        className="flex w-32 shrink-0 justify-end pl-6 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => router.push(`/tasks?project=${project.id}`)}
          className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-medium hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800 transition-colors whitespace-nowrap"
          title="View tasks"
        >
          View tasks <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Status group ───────────────────────────────────────────────────────── */
interface StatusGroupProps {
  status: ProjectStatus;
  projects: ProjectWithStats[];
  onEdit: (p: Project) => void;
}

function StatusGroup({ status, projects, onEdit }: StatusGroupProps) {
  const [collapsed, setCollapsed] = useState(DEFAULT_COLLAPSED_GROUPS.has(status));
  const totalTasks = projects.reduce((s, p) => s + p.task_count, 0);
  const doneTasks = projects.reduce((s, p) => s + p.done_count, 0);
  const groupPct =
    totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  return (
    <div className="mb-3">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 py-2 px-3 w-full rounded-xl hover:bg-neutral-50 transition-colors text-left"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 flex-shrink-0",
            !collapsed && "rotate-90"
          )}
        />
        <StatusBadge status={status} />
        <span className="text-sm font-light text-neutral-600 tabular-nums">
          ({projects.length})
        </span>
        {totalTasks > 0 && (
          <span className="text-xs text-neutral-400 font-light ml-auto tabular-nums">
            {groupPct}% complete
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 pl-5 pt-0.5 pb-1">
              {projects.map((project, index) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  index={index}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Loading skeleton ─────────────────────────────────────────────────────── */
const SKELETON_GROUP_ROWS = [3, 2, 2] as const;

function ProjectsListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading projects">
      {SKELETON_GROUP_ROWS.map((rowCount, groupIdx) => (
        <div key={groupIdx} className="mb-1">
          <div className="flex items-center gap-2 py-2 px-3">
            <Skeleton className="h-3.5 w-3.5 shrink-0 rounded bg-neutral-100" />
            <Skeleton className="h-4 w-20 rounded bg-neutral-100" />
            <Skeleton className="h-4 w-8 rounded bg-neutral-100" />
          </div>
          <div className="flex flex-col gap-0.5 pl-5 pt-0.5">
            {Array.from({ length: rowCount }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-8 px-3 py-2.5"
              >
                <Skeleton className="h-9 w-1 shrink-0 rounded-full bg-neutral-100" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Skeleton className="h-2 w-2 shrink-0 rounded-full bg-neutral-100" />
                  <Skeleton className="h-4 max-w-[220px] flex-1 rounded bg-neutral-100" />
                </div>
                <Skeleton className="mr-36 hidden h-1 w-40 shrink-0 rounded-full sm:block bg-neutral-100" />
                <Skeleton className="hidden h-4 w-12 shrink-0 rounded md:block bg-neutral-100" />
                <Skeleton className="ml-16 hidden h-4 w-28 shrink-0 rounded lg:block bg-neutral-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Search toolbar ─────────────────────────────────────────────────────── */
function SearchToolbar({
  search,
  onSearch,
  onRefresh,
}: {
  search: string;
  onSearch: (v: string) => void;
  onRefresh: () => void;
}) {
  const [spinning, setSpinning] = useState(false);
  return (
    <div className="flex items-center gap-3 flex-wrap mb-5">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className={cn(
            "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
            search ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
            "focus:border-b-[var(--kenoo-sky)]"
          )}
        />
      </div>

      <button
        type="button"
        onClick={() => { setSpinning(true); onRefresh(); }}
        className={cn(
          "h-9 w-9 flex items-center justify-center text-xs group",
        )}
        aria-label="Refresh projects"
      >
        <div className={cn(
          "relative z-10 p-2.5 rounded-full",
          "transition-all duration-300 ease-in-out",
          "group-hover:bg-neutral-50 group-hover:border group-hover:border-neutral-200/50",
          "group-hover:scale-95 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
        )}>
          <RefreshCw
            className={cn("h-4 w-4 text-neutral-400", spinning && "animate-[spin_0.6s_linear_1]")}
            onAnimationEnd={() => setSpinning(false)}
          />
        </div>
      </button>
    </div>
  );
}

/* ─── Delete confirm ─────────────────────────────────────────────────────── */
interface DeleteConfirmDialogProps {
  project: Project | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteConfirmDialog({
  project,
  onClose,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!project) return;
    setDeleting(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);
      if (err) throw err;
      onDeleted();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[380px] p-0 gap-0 overflow-hidden rounded-3xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-black tracking-tight uppercase text-neutral-900">
            Delete Project?
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            &ldquo;{project?.name}&rdquo; and all its tasks will be permanently
            deleted. This cannot be undone.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="rounded-xl"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-red-600 text-white hover:bg-red-500"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
interface AgentsProjectsListProps {
  analyticsData: unknown;
}

function AgentsProjectsListContent({
  analyticsData: _analyticsData,
}: AgentsProjectsListProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { activeAccountId, loading: accountLoading } = useActiveAccount();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadProjects = useCallback(async () => {
    if (authLoading || accountLoading) return;
    if (!user || !activeAccountId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const { data: memberRows } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id);

      const memberProjectIds = (memberRows ?? []).map((r) => r.project_id);
      const accessFilter =
        memberProjectIds.length > 0
          ? `owner_id.eq.${user.id},id.in.(${memberProjectIds.join(",")})`
          : `owner_id.eq.${user.id}`;

      let query = supabase
        .from("projects")
        .select("*")
        .eq("account_id", activeAccountId)
        .or(accessFilter)
        .order("created_at", { ascending: false });
      if (debouncedSearch) query = query.ilike("name", `%${debouncedSearch}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      const { data: projectRows, error } = await query;
      if (error) throw error;
      const rows = (projectRows ?? []) as Project[];
      if (rows.length === 0) {
        setProjects([]);
        return;
      }
      const projectIds = rows.map((p) => p.id);
      const { data: taskCounts } = await supabase
        .from("project_tasks")
        .select("project_id, status, is_private, assignee_id, assigned_by")
        .in("project_id", projectIds);
      const countMap = new Map<string, { total: number; done: number }>();
      for (const t of taskCounts ?? []) {
        if (!isTaskVisibleToUser(t, user.id)) continue;
        if (!countMap.has(t.project_id))
          countMap.set(t.project_id, { total: 0, done: 0 });
        const entry = countMap.get(t.project_id)!;
        entry.total += 1;
        if (t.status === "completed") entry.done += 1;
      }
      setProjects(
        rows.map((p) => ({
          ...p,
          task_count: countMap.get(p.id)?.total ?? 0,
          done_count: countMap.get(p.id)?.done ?? 0,
        }))
      );
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, accountLoading, activeAccountId, debouncedSearch, statusFilter, refreshTrigger]);

  useEffect(() => {
    if (authLoading || accountLoading) return;
    loadProjects();
  }, [loadProjects, authLoading, accountLoading]);

  const refresh = () => setRefreshTrigger((r) => r + 1);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sortProjects = useCallback(
    (list: ProjectWithStats[]): ProjectWithStats[] =>
      [...list].sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case "name":
            cmp = a.name.localeCompare(b.name);
            break;
          case "priority":
            cmp = (a.priority ?? 99) - (b.priority ?? 99);
            break;
          case "due_date":
            if (!a.due_date && !b.due_date) cmp = 0;
            else if (!a.due_date) cmp = 1;
            else if (!b.due_date) cmp = -1;
            else
              cmp =
                new Date(a.due_date).getTime() -
                new Date(b.due_date).getTime();
            break;
          case "progress": {
            const ap =
              a.task_count === 0 ? 0 : a.done_count / a.task_count;
            const bp =
              b.task_count === 0 ? 0 : b.done_count / b.task_count;
            cmp = ap - bp;
            break;
          }
        }
        return sortDir === "asc" ? cmp : -cmp;
      }),
    [sortBy, sortDir]
  );

  const openEdit = (p: Project) => {
    setEditProject(p);
    setFormOpen(true);
  };

  const sortedProjects = sortProjects(projects);
  const showGroups = !statusFilter && !debouncedSearch;

  const groupedProjects = GROUP_ORDER.map((status) => ({
    status,
    items: sortedProjects.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0);

  const showLoading = authLoading || loading;

  return (
    <>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 w-full flex flex-col min-h-0">
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden pl-8 pr-4 md:pr-6">
            <div className="relative z-50 flex-shrink-0">
              <ProjectsHeader
                onNewProject={() => {
                  setEditProject(null);
                  setFormOpen(true);
                }}
                onNewTask={() => setTaskFormOpen(true)}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>

            <div className="relative z-0 flex min-h-0 flex-1 flex-col">
              <div className="mt-2 flex-shrink-0">
                <SearchToolbar
                  search={search}
                  onSearch={setSearch}
                  onRefresh={refresh}
                />
              </div>

              {/* List body scrolls; column headers stick within this region */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto overscroll-none pb-10">
                {showLoading ? (
                  <>
                    <ColumnHeaders
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <ProjectsListSkeleton />
                  </>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[280px] text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-neutral-200/80 flex items-center justify-center mb-4">
                      <FolderOpen className="h-8 w-8 text-neutral-400" />
                    </div>
                    <p className="text-neutral-600 font-medium">No projects found</p>
                    <p className="text-sm text-neutral-500 mt-1 max-w-sm">
                      {debouncedSearch || statusFilter
                        ? "Try adjusting your search or filter."
                        : "Create your first project to start tracking tasks and progress."}
                    </p>
                    {!debouncedSearch && !statusFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditProject(null);
                          setFormOpen(true);
                        }}
                        className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        New project
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <ColumnHeaders
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    {showGroups ? (
                      <div>
                        {groupedProjects.map(({ status, items }) => (
                          <StatusGroup
                            key={status}
                            status={status}
                            projects={items}
                            onEdit={openEdit}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {sortedProjects.map((project, index) => (
                          <ProjectRow
                            key={project.id}
                            project={project}
                            index={index}
                            onEdit={openEdit}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateProjectsPopup
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditProject(null);
        }}
        onSaved={refresh}
        existing={editProject}
      />

      <CreateTasksPopup
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onSaved={refresh}
        projects={projects}
      />

    </>
  );
}

export default function AgentsProjectsList(props: AgentsProjectsListProps) {
  return <AgentsProjectsListContent {...props} />;
}
