"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  CircleDollarSign,
  Eye,
  Link2,
  Loader2,
  MousePointerClick,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

import type { DashboardAnalytics } from "@/lib/analytics-server";
import { META_PROVIDER, META_SERVICE, type SafeAccountConnection } from "@/lib/connections";
import { ZERO_DASHBOARD_STATS } from "@/lib/dashboard-defaults";
import type { TimeRangeValue } from "@/lib/time-range";

import { HeroStat, HeroStatsBar, SectionLabel } from "./dashboard-metrics";
import { AudienceBreakdownsTable } from "./audience-breakdowns-table";
import { DashboardTimeRangePicker } from "./dashboard-time-range-picker";
import { DaysHoursHeatmap } from "./days-hours-heatmap";
import { FrequencyBreakdownTable } from "./frequency-breakdown-table";
import { SpendTrendChart } from "./spend-trend-chart";
import { TopPerformingAds } from "./top-performing-ads";

const CountryPerformanceMap = dynamic(
  () =>
    import("./country-performance-map").then((mod) => ({
      default: mod.CountryPerformanceMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <SectionLabel>Country map</SectionLabel>
        <div className="h-[380px] animate-pulse rounded-[28px] bg-neutral-100/80 md:h-[460px]" />
      </div>
    ),
  },
);

const HERO_ACCENTS = [
  "var(--kenoo-sky)",
  "var(--kenoo-blue)",
  "#00d1c1",
  "#7a04eb",
  "#f59e0b",
  "#10b981",
] as const;

const HERO_ICONS = [
  CircleDollarSign,
  Eye,
  MousePointerClick,
  TrendingUp,
  ShoppingBag,
  CircleDollarSign,
] as const;

export function DashboardPage() {
  const [connections, setConnections] = React.useState<SafeAccountConnection[]>([]);
  const [analytics, setAnalytics] = React.useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<TimeRangeValue>("30d");
  const autoSyncStarted = React.useRef(false);

  const loadDashboard = React.useCallback(async () => {
    const [connectionsResponse, analyticsResponse] = await Promise.all([
      fetch("/api/connections"),
      fetch(`/api/analytics?range=${timeRange}`),
    ]);

    if (connectionsResponse.ok) {
      const payload = (await connectionsResponse.json()) as {
        connections?: SafeAccountConnection[];
      };
      setConnections(payload.connections ?? []);
    }

    if (analyticsResponse.ok) {
      const payload = (await analyticsResponse.json()) as DashboardAnalytics;
      setAnalytics(payload);
    }
  }, [timeRange]);

  React.useEffect(() => {
    void (async () => {
      try {
        await loadDashboard();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDashboard]);

  const isSyncing = analytics?.syncing ?? false;

  React.useEffect(() => {
    if (!isSyncing) return;

    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isSyncing, loadDashboard]);

  const hasLiveConnections = connections.some(
    (c) => c.provider === META_PROVIDER && c.service === META_SERVICE,
  );

  React.useEffect(() => {
    if (loading || autoSyncStarted.current || !hasLiveConnections || !analytics) return;
    if (analytics.syncing || analytics.hasData) return;

    autoSyncStarted.current = true;
    void fetch("/api/sync/meta", { method: "POST" }).then(() => loadDashboard());
  }, [loading, hasLiveConnections, analytics, loadDashboard]);

  const stats = analytics?.stats ?? [...ZERO_DASHBOARD_STATS];
  const spendByDay = analytics?.spendByDay ?? [];
  const periodLabel = analytics?.periodLabel ?? "Last 30 days";
  const topPerformingAds = analytics?.topPerformingAds ?? {
    objectives: [],
    byObjective: {
      OUTCOME_SALES: [],
      OUTCOME_TRAFFIC: [],
      OUTCOME_AWARENESS: [],
      OUTCOME_ENGAGEMENT: [],
      OUTCOME_LEADS: [],
      OUTCOME_APP_PROMOTION: [],
    },
    bottomByObjective: {
      OUTCOME_SALES: [],
      OUTCOME_TRAFFIC: [],
      OUTCOME_AWARENESS: [],
      OUTCOME_ENGAGEMENT: [],
      OUTCOME_LEADS: [],
      OUTCOME_APP_PROMOTION: [],
    },
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-kenoo-white px-6 py-16">
        <div className="flex items-center gap-2 text-sm font-light text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  if (!hasLiveConnections) {
    return (
      <div className="flex min-h-full items-center justify-center bg-kenoo-white px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <p className="text-sm font-light text-neutral-600">No accounts connected</p>
          <a
            href="/api/oauth/meta/login"
            className="inline-flex items-center gap-2 rounded-none border-0 bg-kenoo-yellow px-5 py-2.5 text-sm font-medium text-black shadow-none hover:bg-kenoo-yellow"
          >
            <Link2 className="h-4 w-4" strokeWidth={1.5} />
            Connect Meta
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-kenoo-white">
      <div className="space-y-16 px-6 pt-6 pb-12 md:px-10 md:pt-8 md:pb-10">
        <div className="space-y-4">
          <div className="flex justify-start">
            <DashboardTimeRangePicker
              value={timeRange}
              onChange={setTimeRange}
            />
          </div>
          <HeroStatsBar>
            {stats.map((stat, index) => (
              <HeroStat
                key={stat.label}
                label={stat.label}
                value={stat.value}
                change={stat.change}
                positive={stat.positive}
                icon={HERO_ICONS[index] ?? CircleDollarSign}
                accentColor={HERO_ACCENTS[index] ?? HERO_ACCENTS[0]}
                loading={loading}
              />
            ))}
          </HeroStatsBar>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="space-y-4"
        >
          <SectionLabel>Performance - {periodLabel}</SectionLabel>
          <SpendTrendChart days={spendByDay} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <TopPerformingAds topPerformingAds={topPerformingAds} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.245 }}
        >
          <CountryPerformanceMap
            data={
              analytics?.audienceBreakdowns ?? {
                hasData: false,
                byType: { age: [], gender: [], age_gender: [], country: [] },
              }
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <AudienceBreakdownsTable
            data={
              analytics?.audienceBreakdowns ?? {
                hasData: false,
                byType: { age: [], gender: [], age_gender: [], country: [] },
              }
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.255 }}
        >
          <DaysHoursHeatmap
            data={analytics?.daysHours ?? { hasData: false, cells: [] }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
        >
          <FrequencyBreakdownTable
            data={
              analytics?.frequencyBreakdowns ?? {
                hasData: false,
                totalReach: 0,
                buckets: [],
              }
            }
          />
        </motion.div>
      </div>
    </div>
  );
}
