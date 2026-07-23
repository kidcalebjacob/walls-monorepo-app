"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@walls/utils";

import {
  GOOGLE_ADS_SERVICE,
  GOOGLE_PROVIDER,
  META_PROVIDER,
  META_SERVICE,
  type SafeAccountConnection,
} from "@/lib/connections";
import { useConnections } from "@/lib/connections-cache";

import { panelGlassClass } from "@/components/ui/button-styles";
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

function SettingsActionPanel({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
        panelGlassClass,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm font-light leading-6 text-neutral-500">
            {description}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--kenoo-sky)] transition-opacity hover:opacity-80"
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { connections, loading } = useConnections();

  const metaConnection = connections.find(
    (c) => c.provider === META_PROVIDER && c.service === META_SERVICE,
  );
  const googleConnection = connections.find(
    (c) =>
      c.provider === GOOGLE_PROVIDER && c.service === GOOGLE_ADS_SERVICE,
  );

  return (
    <main className="min-h-full w-full bg-kenoo-white px-6 pb-8 pt-4 md:px-10 md:pb-12 md:pt-6">
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
          <SectionLabel title="Connected accounts" />
          <div className="flex flex-col gap-2">
            <ConnectionRow
              href="/settings/connections/meta"
              icon={<MetaIcon className="h-6 w-6" />}
              title="Meta Ads"
              status={formatMetaStatus(metaConnection)}
              connected={Boolean(metaConnection)}
              statusLoading={loading}
            />
            <ConnectionRow
              href="/settings/connections/google"
              icon={<GoogleAdsIcon className="h-6 w-6" />}
              title="Google Ads"
              status={formatGoogleStatus(googleConnection)}
              connected={Boolean(googleConnection)}
              statusLoading={loading}
            />
          </div>
        </section>

        <section>
          <SectionLabel title="Budgets & objectives" />
          <SettingsActionPanel
            title="Manage budgets"
            description="Set period budgets and objectives like ROAS, CTR, or brand recognition for each planning window."
            href="/budgets"
            actionLabel="Manage budgets"
          />
        </section>

        <section>
          <SectionLabel title="Automation presets" />
          <SettingsActionPanel
            title="Manage presets"
            description="Create, edit, and set default automation profiles for aggressiveness, guardrails, and optimization goals."
            href="/presets"
            actionLabel="Manage presets"
          />
        </section>

        <section>
          <SectionLabel title="Alerts" />
          <SettingsActionPanel
            title="Manage alerts"
            description="Add recipients for ROAS floor breaches and other automation alerts across email and text."
            href="/alerts"
            actionLabel="Manage alerts"
          />
        </section>
      </div>
    </main>
  );
}
