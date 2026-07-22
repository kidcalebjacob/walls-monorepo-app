"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Unplug } from "lucide-react";

import { Button } from "@walls/ui/button";
import { cn } from "@walls/utils";

import {
  GOOGLE_ADS_SERVICE,
  GOOGLE_PROVIDER,
  META_PROVIDER,
  META_SERVICE,
  type SafeAccountConnection,
} from "@/lib/connections";

import { AdSpendControls } from "./ad-spend-controls";
import { dangerButtonClass, primaryButtonClass } from "@/components/ui/button-styles";
import { GoogleAdsIcon } from "./google-ads-icon";
import { MetaIcon } from "./meta-icon";
import { SectionLabel } from "./section-label";

function formatMetaConnectionLabel(connection: SafeAccountConnection) {
  if (connection.provider_account_id) {
    return connection.provider_account_id.replace(/^act_/, "Ad account ");
  }
  return "Meta Ads account";
}

function formatGoogleConnectionLabel(connection: SafeAccountConnection) {
  const name = connection.token_payload?.account_name;
  if (name) return name;
  if (connection.provider_account_id) {
    return `Customer ${connection.provider_account_id}`;
  }
  return "Google Ads account";
}

export function SettingsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = React.useState<SafeAccountConnection[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [disconnectingProvider, setDisconnectingProvider] = React.useState<
    string | null
  >(null);

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
  const googleConnection = connections.find(
    (c) => c.provider === GOOGLE_PROVIDER && c.service === GOOGLE_ADS_SERVICE,
  );

  const handleDisconnect = async (provider: string, service: string) => {
    setDisconnectingProvider(provider);
    try {
      await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, service }),
      });
      await loadConnections();
    } finally {
      setDisconnectingProvider(null);
    }
  };

  return (
    <main className="min-h-full w-full bg-kenoo-white px-6 py-8 md:px-10 md:py-12">
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

        {connected === "google" && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Google Ads account connected successfully.
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
          ) : (
            <div className="flex flex-col gap-4">
              {metaConnection ? (
                <div className="rounded-3xl border border-neutral-200/70 bg-kenoo-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <MetaIcon className="h-8 w-8 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Meta Ads</p>
                      <p className="mt-1 text-sm font-light text-neutral-500">
                        {formatMetaConnectionLabel(metaConnection)}
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
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      className={dangerButtonClass}
                      onClick={() =>
                        void handleDisconnect(META_PROVIDER, META_SERVICE)
                      }
                      disabled={disconnectingProvider === META_PROVIDER}
                    >
                      <Unplug className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-neutral-300 bg-kenoo-white p-6">
                  <div className="flex items-start gap-3">
                    <MetaIcon className="h-8 w-8 shrink-0" />
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
                        className={cn(primaryButtonClass, "mt-5 px-6")}
                      >
                        <a href="/api/oauth/meta/login">Connect Meta account</a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {googleConnection ? (
                <div className="rounded-3xl border border-neutral-200/70 bg-kenoo-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <GoogleAdsIcon className="h-8 w-8 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Google Ads</p>
                      <p className="mt-1 text-sm font-light text-neutral-500">
                        {formatGoogleConnectionLabel(googleConnection)}
                      </p>
                      <p className="mt-1 text-xs font-light text-neutral-400">
                        Connected{" "}
                        {new Date(
                          googleConnection.created_at,
                        ).toLocaleDateString()}
                        {googleConnection.token_expiry
                          ? ` · Access token refreshes automatically`
                          : null}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      className={dangerButtonClass}
                      onClick={() =>
                        void handleDisconnect(
                          GOOGLE_PROVIDER,
                          GOOGLE_ADS_SERVICE,
                        )
                      }
                      disabled={disconnectingProvider === GOOGLE_PROVIDER}
                    >
                      <Unplug className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-neutral-300 bg-kenoo-white p-6">
                  <div className="flex items-start gap-3">
                    <GoogleAdsIcon className="h-8 w-8 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        Google Ads API
                      </p>
                      <p className="mt-2 text-sm font-light leading-6 text-neutral-500">
                        Authorize AdPilot to access Google Ads accounts via
                        OAuth. You&apos;ll be redirected to Google to grant
                        consent; AdPilot stores a refresh token so access stays
                        active without reconnecting every 60 days.
                      </p>
                      <ul className="mt-3 space-y-1 text-xs font-light text-neutral-500">
                        <li>https://www.googleapis.com/auth/adwords</li>
                      </ul>
                      <Button
                        asChild
                        className={cn(primaryButtonClass, "mt-5 px-6")}
                      >
                        <a href="/api/oauth/google/login">
                          Connect Google Ads account
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <AdSpendControls />
      </div>
    </main>
  );
}
