"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, SlidersHorizontal } from "lucide-react";

import { Button } from "@walls/ui/button";
import { cn } from "@walls/utils";

import {
  GOOGLE_ADS_SERVICE,
  GOOGLE_PROVIDER,
  META_PROVIDER,
  META_SERVICE,
  type SafeAccountConnection,
} from "@/lib/connections";

import {
  panelGlassClass,
  primaryButtonClass,
} from "@/components/ui/button-styles";
import { ConnectionRow } from "./connection-row";
import { GoogleAdsIcon } from "./google-ads-icon";
import { MetaIcon } from "./meta-icon";
import { SectionLabel } from "./section-label";

function formatMetaStatus(connection: SafeAccountConnection | undefined) {
  if (!connection) return "Not connected";
  if (connection.provider_account_id) {
    return connection.provider_account_id.replace(/^act_/, "Ad account ");
  }
  return "Connected";
}

function formatGoogleStatus(connection: SafeAccountConnection | undefined) {
  if (!connection) return "Not connected";
  const name = connection.token_payload?.account_name;
  if (name) return name;
  if (connection.provider_account_id) {
    return `Customer ${connection.provider_account_id}`;
  }
  return "Connected";
}

export function SettingsPage() {
  const [connections, setConnections] = React.useState<SafeAccountConnection[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/connections");
        if (!response.ok) return;
        const payload = (await response.json()) as {
          connections?: SafeAccountConnection[];
        };
        if (!cancelled) {
          setConnections(payload.connections ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metaConnection = connections.find(
    (c) => c.provider === META_PROVIDER && c.service === META_SERVICE,
  );
  const googleConnection = connections.find(
    (c) => c.provider === GOOGLE_PROVIDER && c.service === GOOGLE_ADS_SERVICE,
  );

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
        </header>

        <section>
          <SectionLabel
            title="Connected accounts"
            description="Ad platforms authorized to sync insights into AdPilot."
          />
          {loading ? (
            <p className="text-sm font-light text-neutral-500">Loading…</p>
          ) : (
            <div className="flex flex-col gap-2">
              <ConnectionRow
                href="/settings/connections/meta"
                icon={<MetaIcon className="h-6 w-6" />}
                title="Meta Ads"
                status={formatMetaStatus(metaConnection)}
                connected={Boolean(metaConnection)}
              />
              <ConnectionRow
                href="/settings/connections/google"
                icon={<GoogleAdsIcon className="h-6 w-6" />}
                title="Google Ads"
                status={formatGoogleStatus(googleConnection)}
                connected={Boolean(googleConnection)}
              />
            </div>
          )}
        </section>

        <section>
          <SectionLabel
            title="Automation presets"
            description="Workspace-wide spend automation presets applied when AdPilot is enabled on campaigns and ad sets."
          />
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
              panelGlassClass,
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">Manage presets</p>
                <p className="mt-1 text-sm font-light leading-6 text-neutral-500">
                  Create, edit, and set default automation profiles for
                  aggressiveness, guardrails, and optimization goals.
                </p>
              </div>
              <Button asChild className={cn(primaryButtonClass, "shrink-0 px-6")}>
                <Link href="/presets">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Manage presets
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section>
          <SectionLabel
            title="Alerts"
            description="Choose which organization members get email or text alerts for AdPilot events."
          />
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
              panelGlassClass,
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">Manage alerts</p>
                <p className="mt-1 text-sm font-light leading-6 text-neutral-500">
                  Add recipients for ROAS floor breaches and other automation
                  alerts across email and text.
                </p>
              </div>
              <Button asChild className={cn(primaryButtonClass, "shrink-0 px-6")}>
                <Link href="/alerts">
                  <Bell className="mr-2 h-4 w-4" />
                  Manage alerts
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
