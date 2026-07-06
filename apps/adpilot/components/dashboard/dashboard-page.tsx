"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Eye,
  Link2,
  Loader2,
  MousePointerClick,
  Plus,
  RefreshCw,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@walls/ui/card";
import { cn } from "@walls/utils";

import type { DashboardAnalytics } from "@/lib/analytics-server";
import { META_PROVIDER, META_SERVICE, type SafeUserConnection } from "@/lib/connections";
import { FAUX_ANALYTICS } from "@/lib/faux-analytics";

function formatConnectionLabel(connection: SafeUserConnection) {
  const accountName = connection.token_payload?.account_name;
  if (accountName) return accountName;
  if (connection.account_id) {
    return connection.account_id.replace(/^act_/, "Ad account ");
  }
  return "Meta Ads";
}

export function DashboardPage() {
  const [connections, setConnections] = React.useState<SafeUserConnection[]>([]);
  const [analytics, setAnalytics] = React.useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const autoSyncStarted = React.useRef(false);

  const loadDashboard = React.useCallback(async () => {
    const [connectionsResponse, analyticsResponse] = await Promise.all([
      fetch("/api/connections"),
      fetch("/api/analytics"),
    ]);

    if (connectionsResponse.ok) {
      const payload = (await connectionsResponse.json()) as {
        connections?: SafeUserConnection[];
      };
      setConnections(payload.connections ?? []);
    }

    if (analyticsResponse.ok) {
      const payload = (await analyticsResponse.json()) as DashboardAnalytics;
      setAnalytics(payload);
    }
  }, []);

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
  const useLiveAnalytics = hasLiveConnections && analytics?.hasData;
  const isSyncing = analytics?.syncing ?? false;

  const stats = useLiveAnalytics ? analytics.stats : FAUX_ANALYTICS.stats;
  const spendByWeek = useLiveAnalytics
    ? analytics.spendByWeek
    : FAUX_ANALYTICS.spendByWeek;
  const accounts = useLiveAnalytics ? analytics.accounts : FAUX_ANALYTICS.accounts;
  const periodLabel = analytics?.periodLabel ?? FAUX_ANALYTICS.periodLabel;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/sync/meta", { method: "POST" });
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-full w-full px-6 py-8 md:px-10 md:py-10">
      <div className="flex w-full flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-light text-neutral-500">Overview</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              AdPilot
            </h1>
            <p className="mt-2 max-w-xl text-sm font-light text-neutral-500">
              {hasLiveConnections
                ? isSyncing
                  ? "Syncing live data from Meta. This can take a minute for larger accounts."
                  : useLiveAnalytics
                    ? "Live analytics across your connected ad accounts."
                    : "Meta is connected. Initial sync is running or no spend data was found yet."
                : "Connect Meta in Settings to replace sample data with live insights."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-light text-neutral-600">
              {periodLabel}
              {!useLiveAnalytics && " · Sample"}
              {isSyncing && " · Syncing"}
            </span>
            {hasLiveConnections && (
              <Button
                type="button"
                variant="outline"
                disabled={refreshing || isSyncing}
                onClick={() => void handleRefresh()}
                className="rounded-full border-neutral-200 bg-neutral-100 font-light shadow-inner"
              >
                {refreshing || isSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="rounded-full border-neutral-200 bg-neutral-100 font-light shadow-inner"
            >
              <Link href="/settings">
                <Link2 className="mr-2 h-4 w-4" />
                Connections
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="rounded-[28px] border-neutral-200/60 bg-neutral-100 shadow-inner"
            >
              <CardContent className="p-5">
                <p className="text-sm font-light text-neutral-500">{stat.label}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      stat.positive ? "text-emerald-600" : "text-rose-500",
                    )}
                  >
                    {stat.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card className="rounded-[32px] border-neutral-200/60 bg-neutral-100 shadow-inner">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <BarChart3 className="h-4 w-4 text-neutral-500" />
                Spend trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="flex h-48 items-end gap-3 px-2">
                {spendByWeek.map((week) => (
                  <div
                    key={week.label}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div
                      className="w-full rounded-t-2xl bg-walls-blue/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.12)]"
                      style={{ height: `${week.value}%` }}
                    />
                    <span className="text-xs font-light text-neutral-500">
                      {week.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-neutral-200/60 bg-neutral-100 shadow-inner">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base font-medium">
                <span className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-neutral-500" />
                  Connected accounts
                </span>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full font-light"
                >
                  <Link href="/settings">
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-6">
              {loading ? (
                <p className="text-sm font-light text-neutral-500">Loading…</p>
              ) : metaConnections.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-neutral-300 bg-walls-white p-5">
                  <p className="text-sm font-light text-neutral-600">
                    No Meta accounts connected yet.
                  </p>
                  <Button
                    asChild
                    className="mt-4 rounded-full bg-walls-yellow/90 font-medium text-black hover:bg-walls-yellow"
                  >
                    <a href="/api/oauth/meta/login">Connect Meta</a>
                  </Button>
                </div>
              ) : (
                metaConnections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between rounded-[24px] border border-neutral-200/70 bg-walls-white px-4 py-3 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatConnectionLabel(connection)}
                      </p>
                      <p className="text-xs font-light text-neutral-500">
                        Meta Ads ·{" "}
                        {connection.token_expiry
                          ? `Expires ${new Date(connection.token_expiry).toLocaleDateString()}`
                          : "Connected"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs",
                        isSyncing
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {isSyncing ? "Syncing" : "Live"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-[32px] border-neutral-200/60 bg-neutral-100 shadow-inner">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Account performance
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pb-6">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200/80 text-xs font-light text-neutral-500">
                  <th className="px-3 py-3 font-light">Account</th>
                  <th className="px-3 py-3 font-light">Platform</th>
                  <th className="px-3 py-3 font-light">Spend</th>
                  <th className="px-3 py-3 font-light">Impressions</th>
                  <th className="px-3 py-3 font-light">CTR</th>
                  <th className="px-3 py-3 font-light">Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={"id" in account ? account.id : account.name}
                    className="border-b border-neutral-200/50 last:border-0"
                  >
                    <td className="px-3 py-4 font-medium text-foreground">
                      {account.name}
                    </td>
                    <td className="px-3 py-4 font-light text-neutral-600">
                      {account.platform}
                    </td>
                    <td className="px-3 py-4 font-light text-neutral-700">
                      <span className="inline-flex items-center gap-1">
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        {account.spend}
                      </span>
                    </td>
                    <td className="px-3 py-4 font-light text-neutral-700">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {account.impressions}
                      </span>
                    </td>
                    <td className="px-3 py-4 font-light text-neutral-700">
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="h-3.5 w-3.5" />
                        {account.ctr}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-walls-white px-2.5 py-1 text-xs font-light text-neutral-600 shadow-sm">
                        {account.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!useLiveAnalytics && (
              <p className="mt-4 px-3 text-xs font-light text-neutral-500">
                {hasLiveConnections
                  ? "Waiting for Meta sync to finish. Sample rows shown until live metrics are available."
                  : "Sample performance rows shown until Meta accounts are connected."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-sm font-light text-walls-blue hover:underline"
          >
            View full reports
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
