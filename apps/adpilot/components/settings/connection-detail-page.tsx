"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Unplug } from "lucide-react";

import { Button } from "@walls/ui/button";
import { Skeleton } from "@walls/ui/skeleton";
import { cn } from "@walls/utils";

import {
  GOOGLE_ADS_SERVICE,
  GOOGLE_PROVIDER,
  META_PROVIDER,
  META_SERVICE,
  type SafeAccountConnection,
} from "@/lib/connections";
import {
  removeCachedConnection,
  useConnections,
} from "@/lib/connections-cache";

import {
  dangerButtonClass,
  panelGlassClass,
  primaryButtonClass,
} from "@/components/ui/button-styles";
import { GoogleAdsIcon } from "./google-ads-icon";
import { MetaIcon } from "./meta-icon";

export type ConnectionProvider = "meta" | "google";

const PROVIDER_CONFIG = {
  meta: {
    provider: META_PROVIDER,
    service: META_SERVICE,
    title: "Meta Ads",
    description:
      "Authorize AdPilot to read ad account insights, campaigns, and performance data. You will be redirected to Meta to grant consent for ads and business permissions.",
    scopes: ["ads_read", "ads_management", "business_management"],
    connectHref: "/api/oauth/meta/login",
    connectLabel: "Connect Meta account",
    successParam: "meta",
    icon: MetaIcon,
    formatLabel: (connection: SafeAccountConnection) => {
      if (connection.provider_account_id) {
        return connection.provider_account_id.replace(/^act_/, "Ad account ");
      }
      return "Meta Ads account";
    },
    expiryHint: (connection: SafeAccountConnection) =>
      connection.token_expiry
        ? ` · Token expires ${new Date(connection.token_expiry).toLocaleDateString()}`
        : null,
  },
  google: {
    provider: GOOGLE_PROVIDER,
    service: GOOGLE_ADS_SERVICE,
    title: "Google Ads",
    description:
      "Authorize AdPilot to access Google Ads accounts via OAuth. You will be redirected to Google to grant consent; AdPilot stores a refresh token so access stays active without reconnecting every 60 days.",
    scopes: ["https://www.googleapis.com/auth/adwords"],
    connectHref: "/api/oauth/google/login",
    connectLabel: "Connect Google Ads account",
    successParam: "google",
    icon: GoogleAdsIcon,
    formatLabel: (connection: SafeAccountConnection) => {
      const name = connection.token_payload?.account_name;
      if (name) return name;
      if (connection.provider_account_id) {
        return `Customer ${connection.provider_account_id}`;
      }
      return "Google Ads account";
    },
    expiryHint: (connection: SafeAccountConnection) =>
      connection.token_expiry ? " · Access token refreshes automatically" : null,
  },
} as const;

export function ConnectionDetailPage({
  providerKey,
}: {
  providerKey: ConnectionProvider;
}) {
  const config = PROVIDER_CONFIG[providerKey];
  const Icon = config.icon;
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  const justConnected = connected === config.successParam;

  const { connections, loading, refetch } = useConnections();
  const [disconnecting, setDisconnecting] = React.useState(false);

  const connection =
    connections.find(
      (c) => c.provider === config.provider && c.service === config.service,
    ) ?? null;

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: config.provider,
          service: config.service,
        }),
      });
      if (!response.ok) return;
      // Optimistically update the shared cache so settings reflects disconnect
      // immediately when navigating back.
      removeCachedConnection(config.provider, config.service);
      await refetch();
    } finally {
      setDisconnecting(false);
    }
  };

  // Only skeleton when we have nothing cached yet — known connect/disconnect UI
  // should stay visible once we know the status.
  const showSkeleton = loading && !connection;

  return (
    <main className="min-h-full w-full bg-kenoo-white px-6 py-8 md:px-10 md:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <div>
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-2 text-sm font-light text-neutral-500 transition-colors hover:text-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to settings
          </Link>
          <header className="flex items-center gap-3">
            <Icon className="h-9 w-9 shrink-0" />
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                Connection
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                {config.title}
              </h1>
            </div>
          </header>
        </div>

        {justConnected && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {config.title} account connected successfully.
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Connection failed ({error}). Please try again.
          </div>
        )}

        {showSkeleton ? (
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
              panelGlassClass,
            )}
          >
            <Skeleton className="h-5 w-24 rounded bg-neutral-200/80" />
            <Skeleton className="mt-3 h-4 w-48 rounded bg-neutral-200/80" />
            <Skeleton className="mt-2 h-3 w-36 rounded bg-neutral-200/80" />
            <Skeleton className="mt-5 h-10 w-32 rounded-md bg-neutral-200/80" />
          </div>
        ) : connection ? (
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
              panelGlassClass,
            )}
          >
            <p className="font-medium text-foreground">Connected</p>
            <p className="mt-1 text-sm font-light text-neutral-500">
              {config.formatLabel(connection)}
            </p>
            <p className="mt-1 text-xs font-light text-neutral-400">
              Connected {new Date(connection.created_at).toLocaleDateString()}
              {config.expiryHint(connection)}
            </p>
            <div className="mt-5">
              <Button
                className={dangerButtonClass}
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
              panelGlassClass,
            )}
          >
            <p className="font-medium text-foreground">Connect account</p>
            <p className="mt-2 text-sm font-light leading-6 text-neutral-500">
              {config.description}
            </p>
            <ul className="mt-3 space-y-1 text-xs font-light text-neutral-500">
              {config.scopes.map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
            </ul>
            <Button asChild className={cn(primaryButtonClass, "mt-5 px-6")}>
              <a href={config.connectHref}>{config.connectLabel}</a>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
