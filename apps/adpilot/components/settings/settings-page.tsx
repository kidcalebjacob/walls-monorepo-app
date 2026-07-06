"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Facebook, Link2, Unplug } from "lucide-react";

import { Button } from "@walls/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@walls/ui/card";

import {
  META_PROVIDER,
  META_SERVICE,
  type SafeUserConnection,
} from "@/lib/connections";

import { AdSpendControls } from "./ad-spend-controls";

function formatConnectionLabel(connection: SafeUserConnection) {
  if (connection.account_id) {
    return connection.account_id.replace(/^act_/, "Ad account ");
  }
  return "Meta Ads account";
}

export function SettingsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = React.useState<SafeUserConnection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [disconnecting, setDisconnecting] = React.useState(false);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const loadConnections = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/connections");
      if (!response.ok) return;
      const payload = (await response.json()) as {
        connections?: SafeUserConnection[];
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
    <main className="min-h-full w-full px-6 py-8 md:px-10 md:py-10">
      <div className="flex w-full flex-col gap-8">
        <header>
          <p className="text-sm font-light text-neutral-500">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-2 text-sm font-light text-neutral-500">
            Connect ad platforms and tune how AdPilot manages spend scaling.
          </p>
        </header>

        {connected === "meta" && (
          <div className="flex items-start gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Meta account connected successfully.
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Connection failed ({error}). Please try again.
          </div>
        )}

        <Card className="rounded-[32px] border-neutral-200/60 bg-neutral-100 shadow-inner">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Link2 className="h-4 w-4 text-neutral-500" />
              Connected accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-6">
            {loading ? (
              <p className="text-sm font-light text-neutral-500">Loading…</p>
            ) : metaConnection ? (
              <div className="rounded-[24px] border border-neutral-200/70 bg-walls-white p-5 shadow-sm">
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
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
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
                    className="rounded-full bg-walls-yellow/90 font-medium text-black hover:bg-walls-yellow"
                  >
                    <a href="/api/oauth/meta/login">Reconnect</a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-neutral-300 bg-walls-white p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-[#1877F2]/10 p-3">
                    <Facebook className="h-5 w-5 text-[#1877F2]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Meta Ads API</p>
                    <p className="mt-2 text-sm font-light leading-6 text-neutral-500">
                      Authorize AdPilot to read ad account insights, campaigns,
                      and performance data. You&apos;ll be redirected to Meta to
                      grant consent for ads and business permissions.
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

            <p className="text-xs font-light text-neutral-500">
              Need another platform?{" "}
              <Link href="/" className="text-walls-blue hover:underline">
                Return to dashboard
              </Link>
            </p>
          </CardContent>
        </Card>

        <AdSpendControls />
      </div>
    </main>
  );
}
