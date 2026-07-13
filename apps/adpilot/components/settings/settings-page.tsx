"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Facebook,
  RefreshCw,
  Unplug,
} from "lucide-react";

import { Button } from "@walls/ui/button";

import {
  META_PROVIDER,
  META_SERVICE,
  type SafeAccountConnection,
} from "@/lib/connections";

import { AdSpendControls } from "./ad-spend-controls";
import { SectionLabel } from "./section-label";

function formatConnectionLabel(connection: SafeAccountConnection) {
  if (connection.provider_account_id) {
    return connection.provider_account_id.replace(/^act_/, "Ad account ");
  }
  return "Meta Ads account";
}

export function SettingsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = React.useState<SafeAccountConnection[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const loadConnections = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/connections");
      if (!response.ok) return;
      const payload = (await response.json()) as {
        connections?: SafeAccountConnection[];
      };
      setConnections(payload.connections ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const metaConnection = connections.find(
    (c) => c.provider === META_PROVIDER && c.service === META_SERVICE,
  );

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/sync/meta", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        results?: Array<{ ok: boolean }>;
      } | null;

      if (!response.ok) {
        setSyncResult({
          ok: false,
          message: payload?.error ?? "Could not pull the latest metrics.",
        });
        return;
      }

      const synced = payload?.results?.filter((r) => r.ok).length ?? 0;
      const failed = payload?.results?.filter((r) => !r.ok).length ?? 0;
      setSyncResult({
        ok: failed === 0,
        message:
          failed === 0
            ? `Metrics updated across ${synced} connected account${synced === 1 ? "" : "s"}.`
            : `Updated ${synced} account${synced === 1 ? "" : "s"}, ${failed} failed. Try again.`,
      });
    } catch {
      setSyncResult({
        ok: false,
        message: "Could not reach the sync service. Try again.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: META_PROVIDER,
          service: META_SERVICE,
        }),
      });
      await loadConnections();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <main className="min-h-full w-full bg-walls-white px-6 py-8 md:px-10 md:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-14">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-2 text-sm font-light text-neutral-500">
            Connect ad platforms and tune how AdPilot manages spend scaling.
          </p>
        </header>

        {connected === "meta" && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Meta account connected successfully.
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Connection failed ({error}). Please try again.
          </div>
        )}

        <section>
          <SectionLabel
            title="Connected accounts"
            description="Ad platforms authorized to sync insights into AdPilot."
          />
          {loading ? (
            <p className="text-sm font-light text-neutral-500">Loading…</p>
          ) : metaConnection ? (
            <div className="rounded-3xl border border-neutral-200/70 bg-walls-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-[#1877F2]/10 p-3">
                    <Facebook className="h-5 w-5 text-[#1877F2]" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Meta Ads</p>
                    <p className="mt-1 text-sm font-light text-neutral-500">
                      {formatConnectionLabel(metaConnection)}
                    </p>
                    <p className="mt-1 text-xs font-light text-neutral-400">
                      Connected{" "}
                      {new Date(metaConnection.created_at).toLocaleDateString()}
                      {metaConnection.token_expiry
                        ? ` · Token expires ${new Date(metaConnection.token_expiry).toLocaleDateString()}`
                        : null}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Active
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  className="rounded-full bg-walls-yellow/90 font-medium text-black hover:bg-walls-yellow"
                  onClick={() => void handleSync()}
                  disabled={syncing}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Pulling metrics…" : "Pull latest metrics"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-neutral-200 bg-walls-white font-light"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-neutral-200 bg-walls-white font-light"
                >
                  <a href="/api/oauth/meta/login">Reconnect</a>
                </Button>
              </div>

              {syncResult ? (
                <div
                  className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
                    syncResult.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {syncResult.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  {syncResult.message}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-walls-white p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-[#1877F2]/10 p-3">
                  <Facebook className="h-5 w-5 text-[#1877F2]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Meta Ads API</p>
                  <p className="mt-2 text-sm font-light leading-6 text-neutral-500">
                    Authorize AdPilot to read ad account insights, campaigns, and
                    performance data. You&apos;ll be redirected to Meta to grant
                    consent for ads and business permissions.
                  </p>
                  <ul className="mt-3 space-y-1 text-xs font-light text-neutral-500">
                    <li>ads_read</li>
                    <li>ads_management</li>
                    <li>business_management</li>
                  </ul>
                  <Button
                    asChild
                    className="mt-5 rounded-full bg-walls-yellow/90 px-6 font-medium text-black hover:bg-walls-yellow"
                  >
                    <a href="/api/oauth/meta/login">Connect Meta account</a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <AdSpendControls />
      </div>
    </main>
  );
}
