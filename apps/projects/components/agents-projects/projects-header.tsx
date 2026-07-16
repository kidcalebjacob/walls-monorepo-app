"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@walls/auth";
import { useActiveAccount } from "@/components/active-account-context";
import {
  ACCESSIBLE_PROJECT_SELECT,
  loadAccessibleProjects,
} from "./load-accessible-projects";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, Folder } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Project,
  ProjectStatus,
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUS_OPTIONS,
  BoardTaskScope,
  BOARD_TASK_SCOPE_CONFIG,
} from "./types";

interface ProjectsHeaderProps {
  onNewProject?: () => void;
  onNewTask?: () => void;
  projects?: Project[];
  projectFilter?: string;
  onProjectFilterChange?: (value: string) => void;
  /** When set, only projects with these statuses appear in the project dropdown. */
  projectStatusFilter?: ProjectStatus[];
  taskScopeOptions?: BoardTaskScope[];
  taskScopeFilter?: BoardTaskScope;
  onTaskScopeFilterChange?: (value: BoardTaskScope) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
}

export function ProjectsHeader({
  onNewProject,
  onNewTask,
  projects,
  projectFilter,
  onProjectFilterChange,
  projectStatusFilter,
  taskScopeOptions = [],
  taskScopeFilter = "project",
  onTaskScopeFilterChange,
  statusFilter,
  onStatusFilterChange,
}: ProjectsHeaderProps) {
  const { user } = useAuth();
  const { activeAccountId, loading: accountLoading } = useActiveAccount();
  const pathname = usePathname();
  const isBoard = pathname.startsWith("/tasks");
  const isTimeline = pathname.startsWith("/timeline");
  const isList = pathname.startsWith("/projects");

  const pageLabel = isBoard ? "Tasks" : isTimeline ? "Timeline" : isList ? "Projects" : "Overview";

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [taskScopeDropdownOpen, setTaskScopeDropdownOpen] = useState(false);
  const taskScopeDropdownRef = useRef<HTMLDivElement>(null);
  const [accessibleProjects, setAccessibleProjects] = useState<Project[]>([]);
  const [loadingAccessibleProjects, setLoadingAccessibleProjects] = useState(false);

  const showTaskScopeDropdown =
    isBoard && !!onTaskScopeFilterChange && taskScopeOptions.length > 1;
  const taskScopeLabel = BOARD_TASK_SCOPE_CONFIG[taskScopeFilter].menuLabel;

  const showProjectFilter = !!onProjectFilterChange;

  useEffect(() => {
    if (!showProjectFilter || !user?.id || !activeAccountId || accountLoading) {
      setAccessibleProjects([]);
      setLoadingAccessibleProjects(false);
      return;
    }

    let cancelled = false;
    setLoadingAccessibleProjects(true);
    const run = async () => {
      try {
        const data = await loadAccessibleProjects(user.id, {
          accountId: activeAccountId,
          select: ACCESSIBLE_PROJECT_SELECT.summary,
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
  }, [showProjectFilter, user?.id, activeAccountId, accountLoading]);

  const filterProjects = useMemo(() => {
    const source =
      accessibleProjects.length > 0 || !loadingAccessibleProjects
        ? accessibleProjects
        : (projects ?? []);
    if (!projectStatusFilter?.length) return source;
    const allowed = new Set(projectStatusFilter);
    return source.filter((p) => allowed.has(p.status));
  }, [
    accessibleProjects,
    loadingAccessibleProjects,
    projects,
    projectStatusFilter,
  ]);

  useEffect(() => {
    if (!showProjectFilter || !onProjectFilterChange) return;
    if (loadingAccessibleProjects) return;
    if (!projectFilter || projectFilter === "all") return;
    if (filterProjects.some((p) => p.id === projectFilter)) return;
    onProjectFilterChange("all");
  }, [
    showProjectFilter,
    onProjectFilterChange,
    projectFilter,
    filterProjects,
    loadingAccessibleProjects,
  ]);

  const selectedProject = filterProjects.find((p) => p.id === projectFilter);
  const selectorLabel = selectedProject
    ? selectedProject.name
    : loadingAccessibleProjects && filterProjects.length === 0
      ? "Loading…"
      : "All Projects";

  const showStatusFilter = !!onStatusFilterChange;
  const selectedStatus = statusFilter ? PROJECT_STATUS_CONFIG[statusFilter as ProjectStatus] : null;
  const statusLabel = selectedStatus ? selectedStatus.label : "All Statuses";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (taskScopeDropdownRef.current && !taskScopeDropdownRef.current.contains(e.target as Node)) {
        setTaskScopeDropdownOpen(false);
      }
    }
    if (dropdownOpen || statusDropdownOpen || taskScopeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, statusDropdownOpen, taskScopeDropdownOpen]);

  return (
    <div className="relative z-50 w-full bg-transparent h-auto py-3 px-5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
      {/* Left: label + project filter */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-x-1.5 min-w-0 flex-wrap">
          {showTaskScopeDropdown ? (
            <div className="relative min-w-0" ref={taskScopeDropdownRef}>
              <button
                type="button"
                onClick={() => setTaskScopeDropdownOpen((o) => !o)}
                className={cn(
                  "inline-flex items-center gap-1 min-w-0 max-w-[min(100%,18rem)] rounded-none border-0 bg-transparent p-0 shadow-none",
                  "text-sm md:text-base font-light uppercase tracking-wider text-neutral-800",
                  "hover:text-neutral-900 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                )}
              >
                <span className="truncate">{taskScopeLabel}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                    taskScopeDropdownOpen && "rotate-180"
                  )}
                  strokeWidth={1.8}
                />
              </button>

              {taskScopeDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 min-w-[180px] bg-white border border-neutral-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  {taskScopeOptions.map((scope) => (
                    <button
                      type="button"
                      key={scope}
                      onClick={() => {
                        onTaskScopeFilterChange?.(scope);
                        setTaskScopeDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors",
                        taskScopeFilter === scope
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      {BOARD_TASK_SCOPE_CONFIG[scope].menuLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm md:text-base font-light uppercase tracking-wider text-neutral-800">
              {isBoard ? BOARD_TASK_SCOPE_CONFIG.mine.menuLabel : pageLabel}
            </span>
          )}

          {showProjectFilter && (
            <>
              <span
                className="text-sm md:text-base font-light text-neutral-400 select-none"
                aria-hidden
              >
                /
              </span>
              <div className="relative min-w-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className={cn(
                    "inline-flex items-center gap-1 min-w-0 max-w-[min(100%,18rem)] rounded-none border-0 bg-transparent p-0 shadow-none",
                    "text-sm md:text-base font-light uppercase tracking-wider text-neutral-700",
                    "hover:text-neutral-900 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  )}
                >
                  <span className="truncate">{selectorLabel}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                      dropdownOpen && "rotate-180"
                    )}
                    strokeWidth={1.8}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 min-w-[180px] bg-white border border-neutral-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        onProjectFilterChange("all");
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                        projectFilter === "all" || !projectFilter
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      <Folder className="h-3 w-3 flex-shrink-0" strokeWidth={1.8} />
                      All Projects
                    </button>
                    {loadingAccessibleProjects && filterProjects.length === 0 ? (
                      <div className="px-3 py-2 text-xs font-light text-neutral-400">
                        Loading projects…
                      </div>
                    ) : null}
                    {filterProjects.length > 0 && (
                      <div className="border-t border-neutral-100 mt-1 pt-1">
                        {filterProjects.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => {
                              onProjectFilterChange(p.id);
                              setDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                              projectFilter === p.id
                                ? "bg-neutral-100 text-neutral-900"
                                : "text-neutral-700 hover:bg-neutral-50"
                            )}
                          >
                            {p.color && (
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: p.color }}
                              />
                            )}
                            <span className="truncate">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </>
          )}

          {showStatusFilter && (
            <>
              <span
                className="text-sm md:text-base font-light text-neutral-400 select-none"
                aria-hidden
              >
                /
              </span>
              <div className="relative min-w-0" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen((o) => !o)}
                  className={cn(
                    "inline-flex items-center gap-1 min-w-0 max-w-[min(100%,18rem)] rounded-none border-0 bg-transparent p-0 shadow-none",
                    "text-sm md:text-base font-light uppercase tracking-wider text-neutral-700",
                    "hover:text-neutral-900 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  )}
                >
                  <span className="truncate">{statusLabel}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                      statusDropdownOpen && "rotate-180"
                    )}
                    strokeWidth={1.8}
                  />
                </button>

                {statusDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 min-w-[160px] bg-white border border-neutral-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        onStatusFilterChange!("");
                        setStatusDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                        !statusFilter
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      All Statuses
                    </button>
                    <div className="border-t border-neutral-100 mt-1 pt-1">
                      {PROJECT_STATUS_OPTIONS.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => {
                            onStatusFilterChange!(s);
                            setStatusDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                            statusFilter === s
                              ? "bg-neutral-100 text-neutral-900"
                              : "text-neutral-700 hover:bg-neutral-50"
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: PROJECT_STATUS_CONFIG[s].accent }}
                          />
                          {PROJECT_STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: new dropdown */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {(onNewProject || onNewTask) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                title="New"
                className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
              >
                <div className="relative">
                  <div className="relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-kenoo-white group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95">
                    <Plus className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem] rounded-xl">
              {onNewProject && (
                <DropdownMenuItem
                  onSelect={onNewProject}
                  className="cursor-pointer focus:bg-neutral-100"
                >
                  New project
                </DropdownMenuItem>
              )}
              {onNewTask && (
                <DropdownMenuItem
                  onSelect={onNewTask}
                  className="cursor-pointer focus:bg-neutral-100"
                >
                  New task
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      </div>
    </div>
  );
}
