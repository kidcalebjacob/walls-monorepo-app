"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CircleDollarSign,
  Eye,
  Link2,
  Loader2,
  MousePointerClick,
  Plus,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import { cn } from "@walls/utils";

import type { DashboardAnalytics } from "@/lib/analytics-server";
import { META_PROVIDER, META_SERVICE, type SafeAccountConnection } from "@/lib/connections";
import { ZERO_DASHBOARD_STATS } from "@/lib/dashboard-defaults";
import type { TimeRangeValue } from "@/lib/time-range";

import { HeroStat, MetricBarItem, SectionLabel } from "./dashboard-metrics";
import { SpendTrendChart } from "./spend-trend-chart";
import { TopPerformingAds } from "./top-performing-ads";

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

function formatConnectionLabel(connection: SafeAccountConnection) {
  const accountName = connection.token_payload?.account_name;
  if (accountName) return accountName;
  if (connection.provider_account_id) {
    return connection.provider_account_id.replace(/^act_/, "Ad account ");
  }
  return "Meta Ads";
}

function parseMetricNumber(value: string): number {
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

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

  React.useEffect(() => {
    if (!analytics?.syncing) return;

    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [analytics?.syncing, loadDashboard]);

  const metaConnections = connections.filter(
    (c) => c.provider === META_PROVIDER && c.service === META_SERVICE,
  );
  const hasLiveConnections = metaConnections.length > 0;

  React.useEffect(() => {
    if (loading || autoSyncStarted.current || !hasLiveConnections || !analytics) return;
    if (analytics.syncing || analytics.hasData) return;

    autoSyncStarted.current = true;
    void fetch("/api/sync/meta", { method: "POST" }).then(() => loadDashboard());
  }, [loading, hasLiveConnections, analytics, loadDashboard]);

  const isSyncing = analytics?.syncing ?? false;
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

  const accounts = React.useMemo(() => {
    if (analytics?.accounts && analytics.accounts.length > 0) {
      return analytics.accounts;
    }

    if (hasLiveConnections) {
      return metaConnections.map((connection) => ({
        id: connection.id,
        name: formatConnectionLabel(connection),
        platform: "Meta",
        spend: "$0",
        impressions: "0",
        ctr: "0.00%",
        status: isSyncing ? "Syncing" : "Connected",
      }));
    }

    return [];
  }, [analytics?.accounts, hasLiveConnections, metaConnections, isSyncing]);

  const maxAccountSpend = Math.max(
    ...accounts.map((account) => parseMetricNumber(account.spend)),
    1,
  );

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
        <div className="flex flex-row flex-wrap items-stretch justify-center gap-6 pb-2 pt-2 md:gap-8">
          {stats.map((stat, index) => (
            <HeroStat
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={HERO_ICONS[index] ?? CircleDollarSign}
              accentColor={HERO_ACCENTS[index] ?? HERO_ACCENTS[0]}
              loading={loading}
              delay={index * 0.06}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <SectionLabel>Performance — {periodLabel}</SectionLabel>
          <SpendTrendChart days={spendByDay} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
        >
          <TopPerformingAds
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            topPerformingAds={topPerformingAds}
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SectionLabel>Connected Accounts</SectionLabel>
            <div className="space-y-3.5">
              {metaConnections.map((connection, index) => (
                  <div key={connection.id} className="flex items-center gap-3">
                    <div
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{
                        background:
                          HERO_ACCENTS[index % HERO_ACCENTS.length] ??
                          "var(--kenoo-sky)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-light text-neutral-700">
                        {formatConnectionLabel(connection)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-light text-neutral-400">
                        Meta Ads
                        {connection.token_expiry
                          ? ` · Expires ${new Date(connection.token_expiry).toLocaleDateString()}`
                          : " · Connected"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex-shrink-0 text-[11px] font-medium uppercase tracking-wide",
                        isSyncing ? "text-amber-600" : "text-emerald-600",
                      )}
                    >
                      {isSyncing ? "Syncing" : "Live"}
                    </span>
                  </div>
                ))}
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-8 rounded-full px-0 font-light text-neutral-500 hover:bg-transparent hover:text-neutral-800"
                >
                  <Link href="/settings">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Manage connections
                  </Link>
                </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34 }}
          >
            <SectionLabel>Account Performance</SectionLabel>
            {accounts.length === 0 ? (
              <p className="text-sm font-light text-neutral-400">
                Connect a Meta ad account to see performance here.
              </p>
            ) : (
              <div className="space-y-4">
                {accounts.map((account, index) => (
                  <MetricBarItem
                    key={account.id}
                    label={account.name}
                    sublabel={`${account.platform} · CTR ${account.ctr} · ${account.status}`}
                    value={account.spend}
                    numericValue={parseMetricNumber(account.spend)}
                    max={maxAccountSpend}
                    color={
                      HERO_ACCENTS[index % HERO_ACCENTS.length] ??
                      "var(--kenoo-sky)"
                    }
                  />
                ))}
                {hasLiveConnections && !analytics?.hasData ? (
                  <p className="text-xs font-light text-neutral-400">
                    {isSyncing
                      ? "Waiting for Meta sync. Spend bars will populate when data arrives."
                      : "No spend recorded in the last 30 days for connected accounts."}
                  </p>
                ) : null}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
