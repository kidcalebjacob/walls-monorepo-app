"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/auth";
import { motion } from "framer-motion";
import { useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Users,
  UserCircle,
  Activity,
  ChevronRight,
  Globe,
  Monitor,
  Clock,
  TrendingUp,
  Layers,
  Cpu,
  Building2,
  LayoutGrid,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AnalyticsSession {
  first_seen_at: string;
  last_seen_at: string;
  page_count: number;
  device_type: string | null;
  browser: string | null;
  country: string | null;
}

interface UserRow {
  created_at: string;
}

// ─── Section label ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBlock({ h = "h-40" }: { h?: string }) {
  return <div className={`${h} rounded-2xl bg-neutral-100 animate-pulse`} />;
}

// ─── Animated count ──────────────────────────────────────────────────────────

function AnimatedCount({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 120, damping: 18, mass: 0.6 });
  const formatted = useTransform(spring, (latest) =>
    Math.round(latest).toLocaleString()
  );
  useEffect(() => {
    mv.set(value);
  }, [mv, value]);
  return <motion.span>{formatted}</motion.span>;
}

// ─── Bar list item ───────────────────────────────────────────────────────────

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
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-light text-neutral-600 truncate block">
          {label}
        </span>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByMonth(
  items: { date: string }[]
): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.date);
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

function topN(
  items: (string | null)[],
  n = 5
): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item ?? "Unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

// ─── Quick-access links ───────────────────────────────────────────────────────

const overviewLinks = [
  {
    name: "Users",
    description: "View and manage all WALLS users",
    path: "/users",
    icon: UserCircle,
  },
  {
    name: "Accounts",
    description: "Manage account app access and organizations",
    path: "/accounts",
    icon: Building2,
  },
  {
    name: "Apps",
    description: "Activate apps and review the catalog",
    path: "/apps",
    icon: LayoutGrid,
  },
  {
    name: "Teams",
    description: "Manage your team members",
    path: "/teams",
    icon: Users,
  },
];

const DEVICE_COLORS: Record<string, string> = {
  desktop: "rgb(99 102 241)",
  mobile: "var(--kenoo-lime)",
  tablet: "rgb(245 158 11)",
  Unknown: "rgb(163 163 163)",
};

const CHART_COLORS = [
  "rgb(99 102 241)",
  "var(--kenoo-lime)",
  "rgb(245 158 11)",
  "rgb(239 68 68)",
  "rgb(16 185 129)",
];

// ─── Main component ───────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const router = useRouter();

  // Data state
  const [userCount, setUserCount] = useState<number>(0);
  const [newUsersThisMonth, setNewUsersThisMonth] = useState<number>(0);
  const [usersByMonth, setUsersByMonth] = useState<
    { month: string; count: number }[]
  >([]);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [avgSessionMs, setAvgSessionMs] = useState<number>(0);
  const [totalPageViews, setTotalPageViews] = useState<number>(0);
  const [avgPagesPerSession, setAvgPagesPerSession] = useState<number>(0);
  const [sessionsByMonth, setSessionsByMonth] = useState<
    { month: string; count: number }[]
  >([]);
  const [deviceBreakdown, setDeviceBreakdown] = useState<
    { label: string; count: number }[]
  >([]);
  const [browserBreakdown, setBrowserBreakdown] = useState<
    { label: string; count: number }[]
  >([]);
  const [countryBreakdown, setCountryBreakdown] = useState<
    { label: string; count: number }[]
  >([]);
  const [activeToday, setActiveToday] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    async function load() {
      try {
        // ── Users ──
        const { data: userRows } = await supabase
          .from("users")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(5000);

        const users = (userRows ?? []) as UserRow[];
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const newThisMonth = users.filter(
          (u) => new Date(u.created_at) >= thisMonthStart
        ).length;

        // ── Analytics sessions ──
        const { data: sessionRows, count: totalSessionsCount } = await supabase
          .from("analytics_sessions")
          .select(
            "first_seen_at, last_seen_at, page_count, device_type, browser, country",
            { count: "exact" }
          )
          .order("first_seen_at", { ascending: false })
          .limit(5000);

        const sessions = (sessionRows ?? []) as AnalyticsSession[];

        // Duration stats (exclude impossibly long sessions > 4h)
        const MAX_SESSION_MS = 4 * 60 * 60 * 1000;
        const durations = sessions
          .map((s) => {
            const dur =
              new Date(s.last_seen_at).getTime() -
              new Date(s.first_seen_at).getTime();
            return dur;
          })
          .filter((d) => d >= 0 && d <= MAX_SESSION_MS);

        const avgMs =
          durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        const totalViews = sessions.reduce((a, s) => a + (s.page_count ?? 1), 0);
        const avgPages =
          sessions.length > 0 ? totalViews / sessions.length : 0;

        // Active today: sessions with last_seen_at today
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const activeTodayCount = sessions.filter(
          (s) => new Date(s.last_seen_at) >= todayStart
        ).length;

        if (!isMounted) return;

        setUserCount(users.length);
        setNewUsersThisMonth(newThisMonth);
        setUsersByMonth(
          groupByMonth(users.map((u) => ({ date: u.created_at })))
        );

        setSessionCount(totalSessionsCount ?? sessions.length);
        setAvgSessionMs(avgMs);
        setTotalPageViews(totalViews);
        setAvgPagesPerSession(Math.round(avgPages * 10) / 10);
        setActiveToday(activeTodayCount);
        setSessionsByMonth(
          groupByMonth(sessions.map((s) => ({ date: s.first_seen_at })))
        );
        setDeviceBreakdown(topN(sessions.map((s) => s.device_type)));
        setBrowserBreakdown(topN(sessions.map((s) => s.browser)));
        setCountryBreakdown(topN(sessions.map((s) => s.country)));
      } catch {
        // silently fail – partial data is fine
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Hero stats ──
  const heroStats = [
    {
      label: "Total Users",
      value: userCount,
      sub: `+${newUsersThisMonth} this month`,
      icon: <Users className="h-3.5 w-3.5" />,
      accentColor: "rgb(99 102 241)",
    },
    {
      label: "Sessions",
      value: sessionCount,
      sub: `${activeToday} active today`,
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      accentColor: "var(--kenoo-lime)",
    },
    {
      label: "Avg Time",
      value: null,
      valueLabel: formatDuration(avgSessionMs),
      sub: "per session",
      icon: <Clock className="h-3.5 w-3.5" />,
      accentColor: "rgb(245 158 11)",
    },
    {
      label: "Page Views",
      value: totalPageViews,
      sub: `${avgPagesPerSession} avg / session`,
      icon: <Layers className="h-3.5 w-3.5" />,
      accentColor: "rgb(16 185 129)",
    },
  ];

  const tooltipStyle = {
    backgroundColor: "rgb(38 38 38)",
    border: "1px solid rgb(64 64 64)",
    borderRadius: "8px",
  };

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  return (
    <>
      {headerEl &&
        createPortal(
          <div className="flex items-center gap-x-1.5">
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Admin</span>
            <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Overview</span>
          </div>,
          headerEl
        )}
    <div className="space-y-16 px-8 pt-4 pb-24">

      {loading ? (
        <div className="space-y-12">
          <div className="flex flex-row items-stretch justify-center gap-6 md:gap-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center flex-1 min-w-0 gap-2"
              >
                <div className="h-10 w-20 rounded bg-neutral-100 animate-pulse" />
                <div className="h-3 w-16 rounded bg-neutral-100 animate-pulse" />
              </div>
            ))}
          </div>
          <SkeletonBlock h="h-[220px]" />
          <div className="grid grid-cols-2 gap-10">
            <SkeletonBlock h="h-[200px]" />
            <SkeletonBlock h="h-[200px]" />
          </div>
          <SkeletonBlock h="h-[220px]" />
        </div>
      ) : (
        <div className="space-y-16">

          {/* ── Hero stats ── */}
          <div className="flex flex-row items-stretch justify-center gap-6 md:gap-10">
            {heroStats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex flex-col items-center justify-center flex-1 min-w-0"
              >
                {s.value !== null ? (
                  <p className="text-3xl md:text-4xl font-black tabular-nums text-neutral-900 tracking-tight">
                    <AnimatedCount value={s.value} />
                  </p>
                ) : (
                  <p className="text-3xl md:text-4xl font-black tabular-nums text-neutral-900 tracking-tight">
                    {s.valueLabel}
                  </p>
                )}
                <span
                  className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-xs inline-flex items-center gap-2 w-full max-w-[130px]"
                >
                  <span
                    className="flex-1 min-w-0 border-t-2 border-solid"
                    style={{ borderColor: s.accentColor }}
                  />
                  <span className="flex-shrink-0 flex items-center gap-1">
                    {s.icon}
                    {s.label}
                  </span>
                  <span
                    className="flex-1 min-w-0 border-t-2 border-solid"
                    style={{ borderColor: s.accentColor }}
                  />
                </span>
                <p className="mt-1 text-xs text-neutral-400 font-light">
                  {s.sub}
                </p>
              </motion.div>
            ))}
          </div>

          {/* ── User growth over time ── */}
          {usersByMonth.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <SectionLabel>User Growth — Signups Over Time</SectionLabel>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={usersByMonth}
                    margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="userGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="rgb(99 102 241)"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="rgb(99 102 241)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgb(212 212 212)"
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
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "rgb(212 212 216)" }}
                      itemStyle={{ color: "rgb(212 212 216)" }}
                      formatter={(value: number) => [value, "New Users"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="rgb(99 102 241)"
                      strokeWidth={2.5}
                      fill="url(#userGrad)"
                      name="New Users"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* ── Session activity over time ── */}
          {sessionsByMonth.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <SectionLabel>Session Activity — Over Time</SectionLabel>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={sessionsByMonth}
                    margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="sessionGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--kenoo-lime)"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--kenoo-lime)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgb(212 212 212)"
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
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "rgb(212 212 216)" }}
                      itemStyle={{ color: "rgb(212 212 216)" }}
                      formatter={(value: number) => [value, "Sessions"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--kenoo-lime)"
                      strokeWidth={2.5}
                      fill="url(#sessionGrad)"
                      name="Sessions"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* ── Audience breakdown ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Device type */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.33 }}
            >
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <Monitor className="h-3 w-3" />
                  Device Type
                </span>
              </SectionLabel>
              <div className="space-y-3.5 mt-2">
                {deviceBreakdown.length > 0 ? (
                  deviceBreakdown.map((row) => (
                    <BarListItem
                      key={row.label}
                      label={row.label}
                      count={row.count}
                      max={deviceBreakdown[0].count}
                      color={
                        DEVICE_COLORS[row.label.toLowerCase()] ??
                        "rgb(163 163 163)"
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-neutral-400 font-light">
                    No data yet
                  </p>
                )}
              </div>
            </motion.div>

            {/* Browser */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36 }}
            >
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <Cpu className="h-3 w-3" />
                  Browser
                </span>
              </SectionLabel>
              <div className="space-y-3.5 mt-2">
                {browserBreakdown.length > 0 ? (
                  browserBreakdown.map((row, i) => (
                    <BarListItem
                      key={row.label}
                      label={row.label}
                      count={row.count}
                      max={browserBreakdown[0].count}
                      color={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))
                ) : (
                  <p className="text-xs text-neutral-400 font-light">
                    No data yet
                  </p>
                )}
              </div>
            </motion.div>

            {/* Country */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.39 }}
            >
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  Top Countries
                </span>
              </SectionLabel>
              <div className="space-y-3.5 mt-2">
                {countryBreakdown.length > 0 ? (
                  countryBreakdown.map((row, i) => (
                    <BarListItem
                      key={row.label}
                      label={row.label}
                      count={row.count}
                      max={countryBreakdown[0].count}
                      color={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))
                ) : (
                  <p className="text-xs text-neutral-400 font-light">
                    No data yet
                  </p>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Engagement totals ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
            className="flex flex-row items-stretch justify-center gap-6 md:gap-10 pt-2"
          >
            {[
              {
                label: "Total Users",
                value: userCount,
                icon: <Users className="h-3.5 w-3.5" />,
                accentColor: "rgb(99 102 241)",
              },
              {
                label: "Page Views",
                value: totalPageViews,
                icon: <Layers className="h-3.5 w-3.5" />,
                accentColor: "rgb(16 185 129)",
              },
              {
                label: "Active Today",
                value: activeToday,
                icon: <Activity className="h-3.5 w-3.5" />,
                accentColor: "var(--kenoo-lime)",
              },
              {
                label: "Countries",
                value: countryBreakdown.length,
                icon: <Globe className="h-3.5 w-3.5" />,
                accentColor: "rgb(245 158 11)",
              },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 + i * 0.05 }}
                className="flex flex-col items-center justify-center flex-1 min-w-0"
              >
                <p className="text-2xl md:text-3xl font-black tabular-nums text-neutral-900 tracking-tight">
                  <AnimatedCount value={s.value as number} />
                </p>
                <span className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-xs inline-flex items-center gap-2 w-full max-w-[120px]">
                  <span
                    className="flex-1 min-w-0 border-t-2 border-solid"
                    style={{ borderColor: s.accentColor }}
                  />
                  <span className="flex-shrink-0 flex items-center gap-1">
                    {s.icon}
                    {s.label}
                  </span>
                  <span
                    className="flex-1 min-w-0 border-t-2 border-solid"
                    style={{ borderColor: s.accentColor }}
                  />
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Quick access ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
          >
            <SectionLabel>Quick Access</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {overviewLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => router.push(item.path)}
                    className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50/50 focus:outline-none focus:ring-2 focus:ring-kenoo-blue/20 focus:ring-offset-1"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-kenoo-blue/10 group-hover:text-kenoo-blue">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900">{item.name}</p>
                      <p className="text-sm text-zinc-500">{item.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-600" />
                  </button>
                );
              })}
            </div>
          </motion.div>

        </div>
      )}
    </div>
    </>
  );
};

export default AdminDashboard;
