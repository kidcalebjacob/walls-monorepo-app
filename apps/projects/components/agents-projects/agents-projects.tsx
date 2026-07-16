"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@walls/auth";
import { getSupabaseClient } from "@walls/auth";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Plus,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { useActiveAccount } from "@/components/active-account-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { loadAccessibleProjects } from "./load-accessible-projects";
import { isTaskVisibleToUser } from "./task-visibility";
import { CreateProjectsPopup } from "./create-projects-popup";
import { CreateTasksPopup } from "./create-tasks-popup";
import {
  Project,
  ProjectWithStats,
  ProjectTask,
  TASK_STATUS_CONFIG,
} from "./types";

// ─── Themes ────────────────────────────────────────────────────────────────────

type GlassTheme = {
  background: string;
  border: string;
  shadow: string;
  bar: string;
};

function hashTheme<T>(id: string, themes: T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % themes.length;
  return themes[h]!;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, "");
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function shadeColor(r: number, g: number, b: number, amount: number) {
  const t = Math.min(1, Math.max(0, amount));
  const shade = (c: number) => Math.round(c * (1 - t));
  return `rgb(${shade(r)}, ${shade(g)}, ${shade(b)})`;
}

function glassThemeFromRgb(r: number, g: number, b: number): GlassTheme {
  return {
    background: `linear-gradient(155deg, ${rgba(r, g, b, 0.18)} 0%, ${rgba(r, g, b, 0.07)} 52%, rgba(255,255,255,0.72) 100%)`,
    border: rgba(r, g, b, 0.14),
    shadow: `0 8px 20px ${rgba(r, g, b, 0.05)}, inset 0 1px 0 rgba(255,255,255,0.85)`,
    bar: `linear-gradient(90deg, ${rgba(r, g, b, 0.45)} 0%, rgb(${r}, ${g}, ${b}) 55%, ${shadeColor(r, g, b, 0.18)} 100%)`,
  };
}

const TASK_GLASS: GlassTheme[] = [
  glassThemeFromRgb(59, 130, 196),
  glassThemeFromRgb(107, 91, 149),
  glassThemeFromRgb(224, 122, 95),
  glassThemeFromRgb(64, 145, 108),
  glassThemeFromRgb(232, 107, 148),
  glassThemeFromRgb(224, 168, 0),
];

/** Frosted glass theme tinted from a project color; falls back to pastel glass hash. */
function themeFromProjectColor(
  color: string | null | undefined,
  fallbackId: string
): GlassTheme {
  const rgb = color ? parseHexColor(color) : null;
  if (!rgb) return hashTheme(fallbackId, TASK_GLASS);
  return glassThemeFromRgb(rgb.r, rgb.g, rgb.b);
}

/** Primary CTA with the same chrome-glow rim as AdPilot’s Generate button. */
function NewProjectChromeButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative inline-flex h-11 shrink-0 overflow-hidden rounded-full bg-kenoo-white p-[1.5px]",
        "transition-[filter] duration-300 hover:brightness-[1.03]",
        "focus-visible:outline-none",
        className
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-[-60%]">
        <span className="walls-chrome-orbit absolute inset-0" />
      </span>
      <span className="relative inline-flex h-full items-center gap-2 rounded-full bg-kenoo-white px-5 text-sm font-medium text-neutral-700">
        <Plus className="h-4 w-4" /> New Project
      </span>
    </button>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type HubTask = Pick<
  ProjectTask,
  | "id"
  | "project_id"
  | "title"
  | "status"
  | "due_date"
  | "assignee_id"
  | "assigned_by"
  | "is_private"
  | "priority"
  | "updated_at"
  | "completed_at"
>;

type MemberUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
};

type ProjectWithHub = ProjectWithStats & { members: MemberUser[] };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromToday(dateStr: string) {
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - startOfToday().getTime()) / 86_400_000);
}

function memberName(m: MemberUser) {
  const n = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim();
  return n || m.email.split("@")[0] || "User";
}

function memberInitials(m: MemberUser) {
  const a = m.first_name?.[0] ?? "";
  const b = m.last_name?.[0] ?? "";
  if (a || b) return `${a}${b}`.toUpperCase();
  return (m.email?.[0] ?? "U").toUpperCase();
}

const PANEL_GLASS_CLASS =
  "border border-neutral-200/70 bg-white/80 backdrop-blur-xl shadow-[0_8px_28px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.95)]";

function SectionCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-[28px] p-5 md:p-6",
        PANEL_GLASS_CLASS,
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900 md:text-lg">
          {title}
        </h2>
        {action}
      </div>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

function SeeAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-700"
    >
      See All <ChevronRight className="h-3 w-3" />
    </Link>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div
        className={cn(
          "h-20 animate-pulse rounded-[24px] bg-white/50",
          PANEL_GLASS_CLASS
        )}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div
          className={cn(
            "h-64 animate-pulse rounded-[28px] bg-white/50 lg:col-span-3",
            PANEL_GLASS_CLASS
          )}
        />
        <div
          className={cn(
            "h-64 animate-pulse rounded-[28px] bg-white/50 lg:col-span-2",
            PANEL_GLASS_CLASS
          )}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-56 animate-pulse rounded-[28px] bg-white/50",
              PANEL_GLASS_CLASS
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Pie legend ring ───────────────────────────────────────────────────────────

function StatusRings({
  done,
  active,
  backlog,
  total,
}: {
  done: number;
  active: number;
  backlog: number;
  total: number;
}) {
  const donePct = total ? Math.round((done / total) * 100) : 0;
  const activePct = total ? Math.round((active / total) * 100) : 0;
  const backlogPct = total ? Math.round((backlog / total) * 100) : 0;

  const track = [{ name: "Track", value: 1 }];
  const outer = [
    { name: "Done", value: Math.max(done, 0.01), color: "var(--kenoo-yellow)" },
    { name: "Rest", value: Math.max(total - done, 0.01), color: "transparent" },
  ];
  const mid = [
    { name: "Active", value: Math.max(active, 0.01), color: "var(--kenoo-orange)" },
    { name: "Rest", value: Math.max(total - active, 0.01), color: "transparent" },
  ];
  const inner = [
    { name: "Backlog", value: Math.max(backlog, 0.01), color: "var(--kenoo-sky)" },
    { name: "Rest", value: Math.max(total - backlog, 0.01), color: "transparent" },
  ];

  return (
    <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-6 sm:flex-row sm:justify-between sm:gap-4">
      <div className="space-y-4 text-base">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-kenoo-yellow" />
          <span className="font-light text-neutral-500">Done</span>
          <span className="font-semibold tabular-nums text-neutral-900">{donePct}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-kenoo-orange" />
          <span className="font-light text-neutral-500">In Progress</span>
          <span className="font-semibold tabular-nums text-neutral-900">{activePct}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-kenoo-sky" />
          <span className="font-light text-neutral-500">Backlog</span>
          <span className="font-semibold tabular-nums text-neutral-900">{backlogPct}%</span>
        </div>
      </div>
      <div className="relative h-[210px] w-[210px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={track}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={96}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              fill="#EEF1F6"
              isAnimationActive={false}
            />
            <Pie
              data={outer}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={96}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              cornerRadius={8}
            >
              {outer.map((e, i) => (
                <Cell key={i} fill={e.color} />
              ))}
            </Pie>
            <Pie
              data={track}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={72}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              fill="#EEF1F6"
              isAnimationActive={false}
            />
            <Pie
              data={mid}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={72}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              cornerRadius={6}
            >
              {mid.map((e, i) => (
                <Cell key={i} fill={e.color} />
              ))}
            </Pie>
            <Pie
              data={track}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              fill="#EEF1F6"
              isAnimationActive={false}
            />
            <Pie
              data={inner}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              cornerRadius={6}
            >
              {inner.map((e, i) => (
                <Cell key={i} fill={e.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

interface AgentsProjectsProps {
  analyticsData: unknown;
}

function AgentsProjectsContent({ analyticsData: _analyticsData }: AgentsProjectsProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { activeAccount, activeAccountId, loading: accountLoading } = useActiveAccount();
  const [projects, setProjects] = useState<ProjectWithHub[]>([]);
  const [tasks, setTasks] = useState<HubTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const refresh = useCallback(() => setRefreshTrigger((r) => r + 1), []);

  const loadProjects = useCallback(async () => {
    if (authLoading || accountLoading) return;
    if (!user || !activeAccountId) {
      setProjects([]);
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const rows = (
        await loadAccessibleProjects(user.id, { accountId: activeAccountId })
      ).sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      if (rows.length === 0) {
        setProjects([]);
        setTasks([]);
        return;
      }

      const projectIds = rows.map((p) => p.id);
      const [{ data: taskRows }, { data: memberRows }] = await Promise.all([
        supabase
          .from("project_tasks")
          .select(
            "id, project_id, title, status, due_date, assignee_id, assigned_by, is_private, priority, updated_at, completed_at"
          )
          .in("project_id", projectIds),
        supabase
          .from("project_members")
          .select("project_id, user_id")
          .in("project_id", projectIds),
      ]);

      const visibleTasks = (taskRows ?? []).filter((t) =>
        isTaskVisibleToUser(t, user.id)
      ) as HubTask[];

      const countMap = new Map<string, { total: number; done: number }>();
      for (const t of visibleTasks) {
        if (!countMap.has(t.project_id)) countMap.set(t.project_id, { total: 0, done: 0 });
        const entry = countMap.get(t.project_id)!;
        entry.total += 1;
        if (t.status === "completed") entry.done += 1;
      }

      const membersByProject = new Map<string, string[]>();
      const allUserIds = new Set<string>();
      for (const row of memberRows ?? []) {
        if (!membersByProject.has(row.project_id)) membersByProject.set(row.project_id, []);
        membersByProject.get(row.project_id)!.push(row.user_id);
        allUserIds.add(row.user_id);
      }
      for (const p of rows) {
        if (p.owner_id) {
          allUserIds.add(p.owner_id);
          const list = membersByProject.get(p.id) ?? [];
          if (!list.includes(p.owner_id)) {
            membersByProject.set(p.id, [p.owner_id, ...list]);
          }
        }
      }

      const userMap = new Map<string, MemberUser>();
      if (allUserIds.size > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, first_name, last_name, email, avatar_url")
          .in("id", Array.from(allUserIds));
        for (const u of usersData ?? []) userMap.set(u.id, u as MemberUser);
      }

      setTasks(visibleTasks);
      setProjects(
        rows.map((p) => ({
          ...p,
          task_count: countMap.get(p.id)?.total ?? 0,
          done_count: countMap.get(p.id)?.done ?? 0,
          members: (membersByProject.get(p.id) ?? [])
            .map((id) => userMap.get(id))
            .filter((u): u is MemberUser => !!u),
        }))
      );
    } catch {
      setProjects([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, accountLoading, activeAccountId, refreshTrigger]);

  useEffect(() => {
    if (authLoading || accountLoading) return;
    loadProjects();
  }, [loadProjects, authLoading, accountLoading]);

  const showLoading = authLoading || accountLoading || loading;

  const projectById = useMemo(() => {
    const map = new Map<string, ProjectWithHub>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const allMembers = useMemo(() => {
    const map = new Map<string, MemberUser>();
    for (const p of projects) {
      for (const m of p.members) map.set(m.id, m);
    }
    return Array.from(map.values());
  }, [projects]);

  const total = projects.length;
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const planningProjects = projects.filter((p) => p.status === "planning").length;

  const openTasks = tasks.filter((t) => t.status !== "completed");

  const todayTasks = useMemo(() => {
    const dueTodayOrOverdue = openTasks
      .filter((t) => t.due_date && daysFromToday(t.due_date) <= 0)
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    const mine = openTasks
      .filter((t) => t.assignee_id === user?.id)
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return (a.priority ?? 99) - (b.priority ?? 99);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    const dueSoon = openTasks
      .filter((t) => {
        if (!t.due_date) return false;
        const d = daysFromToday(t.due_date);
        return d > 0 && d <= 7;
      })
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

    const seen = new Set<string>();
    const feed: HubTask[] = [];
    for (const t of [...dueTodayOrOverdue, ...mine, ...dueSoon, ...openTasks]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      feed.push(t);
      if (feed.length >= 3) break;
    }
    return feed;
  }, [openTasks, user?.id]);

  const attentionFeed = useMemo(() => {
    const overdue = openTasks
      .filter((t) => t.due_date && daysFromToday(t.due_date) < 0)
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    const mine = openTasks.filter((t) => t.assignee_id === user?.id);
    const seen = new Set<string>();
    const feed: HubTask[] = [];
    for (const t of [...overdue, ...mine, ...openTasks]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      feed.push(t);
      if (feed.length >= 3) break;
    }
    return feed;
  }, [openTasks, user?.id]);

  const rankPerformance = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== "completed" || !t.assignee_id) continue;
      counts.set(t.assignee_id, (counts.get(t.assignee_id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, points]) => {
        const member = allMembers.find((m) => m.id === id);
        return member ? { member, points } : null;
      })
      .filter((r): r is { member: MemberUser; points: number } => !!r)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
  }, [tasks, allMembers]);

  const trackerData = useMemo(() => {
    const days: { label: string; done: number; open: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      let done = 0;
      let open = 0;
      for (const t of tasks) {
        if (t.completed_at) {
          const c = new Date(t.completed_at);
          if (c >= d && c < next) done += 1;
        } else if (t.updated_at) {
          const u = new Date(t.updated_at);
          if (u >= d && u < next) open += 1;
        }
      }
      days.push({ label, done, open });
    }
    return days;
  }, [tasks]);

  const accountShortId = activeAccountId
    ? activeAccountId.replace(/-/g, "").slice(0, 10).toUpperCase()
    : "—";

  const copyAccountId = async () => {
    if (!activeAccountId) return;
    try {
      await navigator.clipboard.writeText(activeAccountId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const openBoard = (projectId?: string) => {
    router.push(
      projectId ? `/tasks?project=${projectId}` : "/tasks"
    );
  };

  return (
    <>
      <div className="flex h-full overflow-hidden">
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-kenoo-white">
            {/* Padding lives on the scroller so card shadows aren't clipped at the sidebar edge */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-8 pb-10 pt-4 md:pr-6">
              {showLoading ? (
                <DashboardSkeleton />
              ) : total === 0 ? (
                <div
                  className={cn(
                    "flex min-h-[420px] flex-col items-center justify-center rounded-[28px] px-4 text-center",
                    PANEL_GLASS_CLASS
                  )}
                >
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
                    <FolderOpen className="h-8 w-8 text-neutral-400" />
                  </div>
                  <p className="font-medium text-neutral-700">No projects yet</p>
                  <p className="mt-1 max-w-sm text-sm font-light text-neutral-400">
                    Spin up your first project to unlock this hub.
                  </p>
                  <NewProjectChromeButton
                    className="mt-5"
                    onClick={() => {
                      setEditProject(null);
                      setFormOpen(true);
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* ── Workspace hero ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex flex-col gap-4 rounded-[28px] px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6",
                      PANEL_GLASS_CLASS
                    )}
                  >
                    <div className="min-w-0">
                      <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-900 md:text-2xl">
                        {activeAccount?.name ?? "Workspace"} Hub
                      </h1>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-light text-neutral-500">
                        <span>
                          {activeAccount?.accountType === "organization"
                            ? "Organization workspace"
                            : "Personal workspace"}
                        </span>
                        <span className="text-neutral-300">|</span>
                        <button
                          type="button"
                          onClick={copyAccountId}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-400 transition-colors hover:text-neutral-700"
                          title="Copy account ID"
                        >
                          ID {accountShortId}
                          {copiedId ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-3">
                      <div className="flex items-center -space-x-2">
                        {allMembers.slice(0, 5).map((m) => (
                          <Avatar
                            key={m.id}
                            className="h-9 w-9 border-2 border-kenoo-white shadow-sm"
                            title={memberName(m)}
                          >
                            {m.avatar_url ? <AvatarImage src={m.avatar_url} alt="" /> : null}
                            <AvatarFallback className="bg-neutral-100 text-[10px] font-medium text-neutral-600">
                              {memberInitials(m)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {allMembers.length > 5 && (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-kenoo-white bg-[#1F1B2E] text-[10px] font-semibold text-white shadow-sm">
                            +{allMembers.length - 5}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTaskFormOpen(true)}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-kenoo-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                      >
                        <Plus className="h-4 w-4" /> New Task
                      </button>
                      <NewProjectChromeButton
                        onClick={() => {
                          setEditProject(null);
                          setFormOpen(true);
                        }}
                      />
                    </div>
                  </motion.div>

                  {/* ── Today Task + Status rings ── */}
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                    <SectionCard
                      title="Today Task"
                      action={<SeeAllLink href="/tasks" />}
                      className="lg:col-span-3"
                    >
                      {todayTasks.length === 0 ? (
                        <div className="flex min-h-[180px] items-center justify-center text-sm font-light text-neutral-400">
                          Nothing due today — nice.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {todayTasks.map((task, i) => {
                            const project = projectById.get(task.project_id);
                            const theme = themeFromProjectColor(
                              project?.color,
                              task.id
                            );
                            const pct =
                              project && project.task_count > 0
                                ? Math.round(
                                    (project.done_count / project.task_count) * 100
                                  )
                                : task.status === "completed"
                                  ? 100
                                  : task.status === "in_progress" || task.status === "in_review"
                                    ? 55
                                    : 20;
                            const members = (project?.members ?? []).slice(0, 3);
                            return (
                              <motion.button
                                key={task.id}
                                type="button"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => openBoard(task.project_id)}
                                className="flex min-h-[200px] flex-col rounded-[22px] border p-4 text-left backdrop-blur-xl transition-transform hover:-translate-y-0.5"
                                style={{
                                  background: theme.background,
                                  borderColor: theme.border,
                                  boxShadow: theme.shadow,
                                }}
                              >
                                <h3 className="line-clamp-3 text-base font-semibold leading-snug text-neutral-900">
                                  {task.title}
                                </h3>
                                <p className="mt-1 truncate text-xs font-light text-neutral-600/80">
                                  {project?.name ?? "Project"}
                                </p>
                                <div className="mt-auto pt-6">
                                  <div className="mb-3 flex items-center -space-x-1.5">
                                    {members.map((m) => (
                                      <Avatar
                                        key={m.id}
                                        className="h-7 w-7 border-2 border-white/70"
                                      >
                                        {m.avatar_url ? (
                                          <AvatarImage src={m.avatar_url} alt="" />
                                        ) : null}
                                        <AvatarFallback className="bg-white/70 text-[9px] text-neutral-600">
                                          {memberInitials(m)}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/45">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${pct}%`,
                                          background: theme.bar,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-semibold tabular-nums text-neutral-700">
                                      {project
                                        ? `${project.done_count}/${project.task_count}`
                                        : `${pct}%`}
                                    </span>
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard
                      title="Project Status"
                      action={
                        <span className="text-xs font-light text-neutral-400">
                          Total {total}
                        </span>
                      }
                      className="lg:col-span-2"
                      bodyClassName="flex"
                    >
                      <StatusRings
                        done={completedProjects}
                        active={activeProjects}
                        backlog={planningProjects + projects.filter((p) => p.status === "on_hold").length}
                        total={Math.max(total, 1)}
                      />
                    </SectionCard>
                  </div>

                  {/* ── Rank + Tracker + Attention ── */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    <SectionCard
                      title="Rank Performance"
                      action={<SeeAllLink href="/projects" />}
                    >
                      {rankPerformance.length === 0 ? (
                        <p className="py-10 text-center text-sm font-light text-neutral-400">
                          Complete tasks to build the leaderboard.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {rankPerformance.map(({ member, points }, i) => (
                            <li
                              key={member.id}
                              className="flex items-center gap-3 rounded-2xl px-1 py-1.5"
                            >
                              <Avatar className="h-11 w-11 flex-shrink-0">
                                {member.avatar_url ? (
                                  <AvatarImage src={member.avatar_url} alt="" />
                                ) : null}
                                <AvatarFallback className="bg-neutral-100 text-xs font-medium text-neutral-600">
                                  {memberInitials(member)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-neutral-900">
                                  {memberName(member)}
                                </p>
                                <p className="truncate text-xs font-light text-neutral-400">
                                  {i === 0 ? "Top contributor" : "Team member"}
                                </p>
                              </div>
                              <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-neutral-800">
                                {points}{" "}
                                <span className="font-light text-neutral-400">Point</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SectionCard>

                    <SectionCard
                      title="Tracker Detail"
                      action={<SeeAllLink href="/timeline" />}
                    >
                      <div className="mb-3 flex items-center gap-4 text-[11px] font-medium text-neutral-500">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm bg-kenoo-yellow" /> Done
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm bg-kenoo-sky" /> Active
                        </span>
                      </div>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={trackerData}
                            margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
                            barGap={4}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#E8EEF5"
                            />
                            <XAxis
                              dataKey="label"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#9CA3AF", fontSize: 11 }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                              tick={{ fill: "#9CA3AF", fontSize: 11 }}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(0,0,0,0.03)" }}
                              contentStyle={{
                                borderRadius: 12,
                                border: "none",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                              }}
                            />
                            <Bar
                              dataKey="done"
                              name="Done"
                              fill="var(--kenoo-yellow)"
                              radius={[8, 8, 8, 8]}
                              maxBarSize={18}
                            />
                            <Bar
                              dataKey="open"
                              name="Active"
                              fill="var(--kenoo-sky)"
                              radius={[8, 8, 8, 8]}
                              maxBarSize={18}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </SectionCard>

                    <SectionCard
                      title="Needs Attention"
                      action={<SeeAllLink href="/tasks" />}
                      className="md:col-span-2 xl:col-span-1"
                    >
                      {attentionFeed.length === 0 ? (
                        <p className="py-10 text-center text-sm font-light text-neutral-400">
                          You&apos;re all clear.
                        </p>
                      ) : (
                        <ul className="space-y-2.5">
                          {attentionFeed.map((task, i) => {
                            const project = projectById.get(task.project_id);
                            const assignee =
                              allMembers.find((m) => m.id === task.assignee_id) ??
                              project?.members[0];
                            const highlight = i === 0;
                            const status = TASK_STATUS_CONFIG[task.status];
                            return (
                              <li key={task.id}>
                                <button
                                  type="button"
                                  onClick={() => openBoard(task.project_id)}
                                  className={cn(
                                    "flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition-all",
                                    highlight
                                      ? "border border-white/80 bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md"
                                      : "hover:bg-white/40"
                                  )}
                                >
                                  <Avatar className="h-10 w-10 flex-shrink-0">
                                    {assignee?.avatar_url ? (
                                      <AvatarImage src={assignee.avatar_url} alt="" />
                                    ) : null}
                                    <AvatarFallback className="bg-neutral-100 text-[10px] font-medium text-neutral-600">
                                      {assignee ? memberInitials(assignee) : "T"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-neutral-900">
                                      {assignee ? memberName(assignee) : project?.name}
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 text-xs font-light leading-relaxed text-neutral-500">
                                      {task.title}
                                    </p>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <span className="truncate text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                                        {status?.label}
                                      </span>
                                      {task.due_date && (
                                        <span className="flex-shrink-0 text-[10px] font-light text-neutral-400">
                                          {new Date(task.due_date).toLocaleDateString("en-US", {
                                            day: "numeric",
                                            month: "short",
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </SectionCard>
                  </div>
                </div>
              )}
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

export default function AgentsProjects(props: AgentsProjectsProps) {
  return <AgentsProjectsContent {...props} />;
}
