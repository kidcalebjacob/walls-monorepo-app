"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@walls/auth";
import { getSupabaseClient } from "@walls/auth";
import { motion } from "framer-motion";
import { useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  FolderOpen,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Layers,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveAccount } from "@/components/active-account-context";
import { loadAccessibleProjects } from "./load-accessible-projects";
import { isTaskVisibleToUser } from "./task-visibility";
import {
  Project,
  ProjectWithStats,
  ProjectStatus,
  PROJECT_STATUS_CONFIG,
  PRIORITY_CONFIG,
} from "./types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}

// ─── Skeleton block ────────────────────────────────────────────────────────────

function SkeletonBlock({ h = "h-40" }: { h?: string }) {
  return <div className={`${h} rounded-2xl bg-neutral-100 animate-pulse`} />;
}

function ProjectsOverviewSkeleton() {
  return (
    <div className="mt-8 space-y-16 pb-12">
      <div className="pt-4 pb-2 flex flex-row items-stretch justify-center gap-6 md:gap-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center flex-1 min-w-0 gap-2">
            <div className="h-10 w-20 rounded bg-neutral-100 animate-pulse" />
            <div className="h-3 w-16 rounded bg-neutral-100 animate-pulse" />
          </div>
        ))}
      </div>
      <SkeletonBlock h="h-[260px]" />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <SkeletonBlock h="h-[200px]" />
        <SkeletonBlock h="h-[200px]" />
      </div>
      <SkeletonBlock h="h-[220px]" />
      <div className="pt-2 flex flex-row items-stretch justify-center gap-6 md:gap-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center flex-1 min-w-0 gap-2">
            <div className="h-8 w-16 rounded bg-neutral-100 animate-pulse" />
            <div className="h-3 w-20 rounded bg-neutral-100 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-3 w-28 rounded bg-neutral-100 animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-neutral-50 pb-4">
            <div className="h-3 w-32 rounded bg-neutral-100 animate-pulse" />
            <div className="h-3 w-16 rounded bg-neutral-100 animate-pulse hidden sm:block" />
            <div className="h-3 flex-1 max-w-28 rounded bg-neutral-100 animate-pulse hidden md:block" />
            <div className="h-3 w-10 rounded bg-neutral-100 animate-pulse hidden lg:block" />
            <div className="h-3 w-14 rounded bg-neutral-100 animate-pulse hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Animated count ────────────────────────────────────────────────────────────

function AnimatedCount({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 120, damping: 18, mass: 0.6 });
  const formatted = useTransform(spring, (latest) =>
    Math.round(latest).toLocaleString()
  );
  useEffect(() => { mv.set(value); }, [mv, value]);
  return <motion.span>{formatted}</motion.span>;
}

// ─── Bar list item ─────────────────────────────────────────────────────────────

function BarListItem({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = Math.round((count / Math.max(max, 1)) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-light text-neutral-600 truncate block">{label}</span>
        <div className="mt-1 w-full h-1 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
      <span className="text-xs font-medium tabular-nums text-neutral-800 flex-shrink-0 w-8 text-right">
        {count}
      </span>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function groupProjectsByMonth(projects: Project[]): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of projects) {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, count]) => ({
      month: new Date(key + "-15").toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      count,
    }));
}

// ─── Main component ─────────────────────────────────────────────────────────────

interface AgentsProjectsProps {
  analyticsData: unknown;
}

function AgentsProjectsContent({ analyticsData: _analyticsData }: AgentsProjectsProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { activeAccountId, loading: accountLoading } = useActiveAccount();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      const rows = (
        await loadAccessibleProjects(user.id, { accountId: activeAccountId })
      ).sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
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
        if (!countMap.has(t.project_id)) countMap.set(t.project_id, { total: 0, done: 0 });
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
  }, [user, authLoading, accountLoading, activeAccountId, refreshTrigger]);

  useEffect(() => {
    if (authLoading || accountLoading) return;
    loadProjects();
  }, [loadProjects, authLoading, accountLoading]);

  const showLoading = authLoading || accountLoading || loading;

  // ── Derived metrics ──
  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const completed = projects.filter((p) => p.status === "completed").length;
  const planning = projects.filter((p) => p.status === "planning").length;
  const onHold = projects.filter((p) => p.status === "on_hold").length;
  const cancelled = projects.filter((p) => p.status === "cancelled").length;
  const overdue = projects.filter(
    (p) => p.due_date && new Date(p.due_date) < new Date() && p.status !== "completed"
  ).length;

  const totalTasks = projects.reduce((a, p) => a + p.task_count, 0);
  const doneTasks = projects.reduce((a, p) => a + p.done_count, 0);

  const refresh = () => setRefreshTrigger((r) => r + 1);
  void refresh;

  // ── Chart data ──
  const statusChartData: { name: string; count: number; color: string }[] = (
    [
      { status: "active" as ProjectStatus, count: active },
      { status: "planning" as ProjectStatus, count: planning },
      { status: "completed" as ProjectStatus, count: completed },
      { status: "on_hold" as ProjectStatus, count: onHold },
      { status: "cancelled" as ProjectStatus, count: cancelled },
    ] as { status: ProjectStatus; count: number }[]
  ).map(({ status, count }) => ({
    name: PROJECT_STATUS_CONFIG[status].label,
    count,
    color: PROJECT_STATUS_CONFIG[status].accent,
  }));

  const priorityCounts = [1, 2, 3, 4].map((p) => ({
    label: PRIORITY_CONFIG[p]?.label ?? `P${p}`,
    count: projects.filter((pr) => pr.priority === p).length,
    color: PRIORITY_CONFIG[p]?.color ?? "#aaa",
  }));

  const projectsByMonth = groupProjectsByMonth(projects);

  // ── Top projects by task count ──
  const topProjectsByTasks = [...projects]
    .sort((a, b) => b.task_count - a.task_count)
    .slice(0, 8);

  const heroStats = [
    {
      label: "Total",
      value: total,
      icon: <Layers className="h-3.5 w-3.5" />,
      accentColor: "rgb(99 102 241)",
    },
    {
      label: "Active",
      value: active,
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      accentColor: "var(--walls-lime)",
    },
    {
      label: "Done",
      value: completed,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      accentColor: "rgb(16 185 129)",
    },
    {
      label: "Overdue",
      value: overdue,
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      accentColor: "rgb(239 68 68)",
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 w-full flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto overscroll-none pl-8 pr-4 md:pr-6">
          {showLoading ? (
            <ProjectsOverviewSkeleton />
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-4 mt-8">
              <div className="w-16 h-16 rounded-full bg-neutral-200/80 flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-neutral-400" />
              </div>
              <p className="text-neutral-600 font-medium">No projects yet</p>
              <p className="text-sm text-neutral-400 mt-1 max-w-sm font-light">
                Head to the Projects list to create your first project.
              </p>
            </div>
          ) : (
            <div className="space-y-16 pb-12">

              {/* ── Hero stats ── */}
              <div className="pt-4 pb-2 flex flex-row items-stretch justify-center gap-6 md:gap-10">
                {heroStats.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex flex-col items-center justify-center flex-1 min-w-0"
                  >
                    <p className="text-3xl md:text-4xl font-black tabular-nums text-neutral-900 tracking-tight">
                      <AnimatedCount value={s.value} />
                    </p>
                    <span
                      className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-xs inline-flex items-center gap-2 w-full max-w-[110px]"
                    >
                      <span className="flex-1 min-w-0 border-t-2 border-solid" style={{ borderColor: s.accentColor }} />
                      <span className="flex-shrink-0 flex items-center gap-1">
                        {s.icon}
                        {s.label}
                      </span>
                      <span className="flex-1 min-w-0 border-t-2 border-solid" style={{ borderColor: s.accentColor }} />
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* ── Projects created over time ── */}
              {projectsByMonth.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <SectionLabel>Projects - Created Over Time</SectionLabel>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projectsByMonth} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--walls-lime)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--walls-lime)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgb(212 212 212)"
                          vertical={true}
                          horizontal={true}
                        />
                        <XAxis
                          dataKey="month"
                          axisLine={{ stroke: "rgb(212 212 212)" }}
                          tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                          allowDecimals={false}
                          width={32}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgb(38 38 38)",
                            border: "1px solid rgb(64 64 64)",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "rgb(212 212 216)" }}
                          itemStyle={{ color: "rgb(212 212 216)" }}
                          formatter={(value: number) => [value, "Projects"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="var(--walls-lime)"
                          strokeWidth={2.5}
                          fill="url(#projGrad)"
                          name="Projects"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {/* ── Status distribution + Priority ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <SectionLabel>Status Distribution</SectionLabel>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={statusChartData}
                        layout="vertical"
                        margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgb(212 212 212)"
                          horizontal={false}
                          vertical={true}
                        />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          width={80}
                          tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(0,0,0,0.04)" }}
                          contentStyle={{
                            backgroundColor: "rgb(38 38 38)",
                            border: "1px solid rgb(64 64 64)",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "rgb(212 212 216)" }}
                          itemStyle={{ color: "rgb(212 212 216)" }}
                          formatter={(value: number) => [value, "Projects"]}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                          {statusChartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.33 }}
                >
                  <SectionLabel>Priority Breakdown</SectionLabel>
                  <div className="space-y-3.5 mt-2">
                    {priorityCounts.map((row) => (
                      <BarListItem
                        key={row.label}
                        label={row.label}
                        count={row.count}
                        max={total}
                        color={row.color}
                      />
                    ))}
                    <BarListItem
                      label="No priority"
                      count={projects.filter((p) => !p.priority).length}
                      max={total}
                      color="rgb(163 163 163)"
                    />
                  </div>
                </motion.div>
              </div>

              {/* ── Task progress per project ── */}
              {topProjectsByTasks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.36 }}
                >
                  <SectionLabel>
                    Task Progress - Top {topProjectsByTasks.length} Projects
                  </SectionLabel>
                  <div style={{ height: Math.max(180, topProjectsByTasks.length * 36) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topProjectsByTasks.map((p) => ({
                          name:
                            p.name.length > 20 ? p.name.slice(0, 18) + "…" : p.name,
                          done: p.done_count,
                          remaining: p.task_count - p.done_count,
                          color: p.color ?? PROJECT_STATUS_CONFIG[p.status].accent,
                        }))}
                        layout="vertical"
                        margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgb(212 212 212)"
                          horizontal={false}
                          vertical={true}
                        />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          width={140}
                          tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(0,0,0,0.04)" }}
                          contentStyle={{
                            backgroundColor: "rgb(38 38 38)",
                            border: "1px solid rgb(64 64 64)",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "rgb(212 212 216)" }}
                          itemStyle={{ color: "rgb(212 212 216)" }}
                        />
                        <Bar
                          dataKey="done"
                          name="Done"
                          stackId="tasks"
                          maxBarSize={26}
                          shape={(props: any) => {
                            const { x, y, width, height, color, index } = props;
                            const gradId = `proj-done-grad-${index}`;
                            return (
                              <g>
                                <defs>
                                  <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.4} />
                                  </linearGradient>
                                </defs>
                                <rect
                                  x={x}
                                  y={y}
                                  width={Math.max(0, width)}
                                  height={height}
                                  fill={`url(#${gradId})`}
                                />
                              </g>
                            );
                          }}
                        />
                        <Bar
                          dataKey="remaining"
                          name="Remaining"
                          stackId="tasks"
                          fill="rgb(229 229 229)"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={26}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {/* ── Task totals ── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="flex flex-row items-stretch justify-center gap-6 md:gap-10 pt-2"
              >
                {[
                  {
                    label: "Total Tasks",
                    value: totalTasks,
                    icon: <Layers className="h-3.5 w-3.5" />,
                    accentColor: "rgb(99 102 241)",
                  },
                  {
                    label: "Completed",
                    value: doneTasks,
                    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                    accentColor: "rgb(16 185 129)",
                  },
                  {
                    label: "Remaining",
                    value: totalTasks - doneTasks,
                    icon: <Clock className="h-3.5 w-3.5" />,
                    accentColor: "rgb(245 158 11)",
                  },
                  {
                    label: "On Hold",
                    value: onHold,
                    icon: <FolderOpen className="h-3.5 w-3.5" />,
                    accentColor: "rgb(148 163 184)",
                  },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.38 + i * 0.05 }}
                    className="flex flex-col items-center justify-center flex-1 min-w-0"
                  >
                    <p className="text-2xl md:text-3xl font-black tabular-nums text-neutral-900 tracking-tight">
                      <AnimatedCount value={s.value} />
                    </p>
                    <span
                      className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-xs inline-flex items-center gap-2 w-full max-w-[120px]"
                    >
                      <span className="flex-1 min-w-0 border-t-2 border-solid" style={{ borderColor: s.accentColor }} />
                      <span className="flex-shrink-0 flex items-center gap-1">
                        {s.icon}
                        {s.label}
                      </span>
                      <span className="flex-1 min-w-0 border-t-2 border-solid" style={{ borderColor: s.accentColor }} />
                    </span>
                  </motion.div>
                ))}
              </motion.div>

              {/* ── All projects table ── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <SectionLabel>All Projects</SectionLabel>
                  <span className="text-xs text-neutral-400 font-light -mt-4">{total} total</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        {["Project", "Status", "Progress", "Tasks", "Due"].map((h) => (
                          <th
                            key={h}
                            className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((project, i) => {
                        const cfg = PROJECT_STATUS_CONFIG[project.status];
                        const pct =
                          project.task_count === 0
                            ? 0
                            : Math.round((project.done_count / project.task_count) * 100);
                        const isOverdue =
                          project.due_date &&
                          new Date(project.due_date) < new Date() &&
                          project.status !== "completed";

                        return (
                          <motion.tr
                            key={project.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.42 + i * 0.015 }}
                            className="border-b border-neutral-50 hover:bg-neutral-50/60 transition-colors"
                          >
                            {/* Name */}
                            <td className="py-4 pr-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: project.color ?? cfg.accent }}
                                />
                                <span className="text-xs font-medium text-neutral-800 truncate max-w-[180px] uppercase tracking-tight">
                                  {project.name}
                                </span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-4 pr-4 hidden sm:table-cell">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                  style={{ backgroundColor: cfg.accent }}
                                  aria-hidden
                                />
                                <span className="text-xs font-medium uppercase tracking-wider text-neutral-800">
                                  {cfg.label}
                                </span>
                              </div>
                            </td>

                            {/* Progress bar */}
                            <td className="py-4 pr-4 hidden md:table-cell">
                              <div className="flex items-center gap-2 w-28">
                                <div className="flex-1 h-1 rounded-full bg-neutral-100 overflow-hidden">
                                  <motion.div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: cfg.accent }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                                  />
                                </div>
                                <span className="text-xs text-neutral-400 tabular-nums w-8 text-right flex-shrink-0 font-light">
                                  {pct}%
                                </span>
                              </div>
                            </td>

                            {/* Task count */}
                            <td className="py-4 pr-4 hidden lg:table-cell">
                              <span className="text-xs text-neutral-400 tabular-nums font-light">
                                {project.done_count}/{project.task_count}
                              </span>
                            </td>

                            {/* Due date */}
                            <td className="py-4 pr-4 hidden sm:table-cell">
                              {project.due_date ? (
                                <span
                                  className={cn(
                                    "flex items-center gap-1 text-xs font-light",
                                    isOverdue ? "text-red-500" : "text-neutral-400"
                                  )}
                                >
                                  <Calendar className="h-3 w-3 flex-shrink-0" />
                                  {new Date(project.due_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              ) : (
                                <span className="text-neutral-300 text-xs">-</span>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentsProjects(props: AgentsProjectsProps) {
  return <AgentsProjectsContent {...props} />;
}
