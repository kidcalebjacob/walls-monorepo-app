"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";

import {
  DetailBreadcrumbs,
  DetailSection,
  EntityMetricsGrid,
  formatStatus,
  isActiveStatus,
} from "@/components/campaigns/entity-detail-shared";
import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import { MetaIcon } from "@/components/settings/meta-icon";
import type {
  AudienceDetailResult,
  AudienceUsageSummary,
} from "@/lib/audiences-server";
import {
  formatAudienceOriginLabel,
  formatAudienceTypeLabel,
} from "@/lib/audience-types";
import { META_PROVIDER } from "@/lib/connections";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";

function formatAudienceSize(lower: number | null, upper: number | null): string {
  if (lower != null && upper != null) {
    if (lower === upper) return formatCompactNumber(upper);
    return `${formatCompactNumber(lower)}–${formatCompactNumber(upper)}`;
  }
  if (upper != null) return formatCompactNumber(upper);
  if (lower != null) return formatCompactNumber(lower);
  return "-";
}

function formatLookalikeRatio(
  ratio: number | null,
  startingRatio: number | null,
): string | null {
  if (ratio == null && startingRatio == null) return null;
  const toPct = (value: number) => `${Math.round(value * 1000) / 10}%`;
  if (startingRatio != null && ratio != null) {
    return `${toPct(startingRatio)}–${toPct(ratio)}`;
  }
  if (ratio != null) return toPct(ratio);
  if (startingRatio != null) return toPct(startingRatio);
  return null;
}

function formatAgeBand(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `${min}+`;
  return `≤${max}`;
}

function summarizeTargeting(usage: AudienceUsageSummary): string {
  const ctx = usage.targetingContext;
  const parts: string[] = [];
  const age = formatAgeBand(ctx.ageMin, ctx.ageMax);
  if (age) parts.push(`Age ${age}`);
  if (ctx.genders?.length) {
    parts.push(
      ctx.genders
        .map((gender) => gender.charAt(0).toUpperCase() + gender.slice(1))
        .join("/"),
    );
  }
  if (ctx.countries?.length) parts.push(ctx.countries.join(", "));
  else if (ctx.regions?.length) parts.push(ctx.regions.slice(0, 2).join(", "));
  else if (ctx.cities?.length) parts.push(ctx.cities.slice(0, 2).join(", "));
  if (ctx.publisherPlatforms?.length) {
    parts.push(ctx.publisherPlatforms.join(", "));
  }
  return parts.length > 0 ? parts.join(" · ") : "-";
}

function OverviewItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-light text-neutral-800">{value}</p>
    </div>
  );
}

export function AudienceDetailPage() {
  const params = useParams<{ audienceId: string }>();
  const router = useRouter();
  const audienceId = params.audienceId;

  const [detail, setDetail] = React.useState<AudienceDetailResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/audiences/${audienceId}`);
    if (!response.ok) {
      setError(
        response.status === 404 ? "Audience not found." : "Failed to load audience.",
      );
      setDetail(null);
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as AudienceDetailResult;
    setDetail(payload);
    setLoading(false);
  }, [audienceId]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto w-full max-w-7xl px-6 pt-16 md:px-10 md:pt-20">
        <button
          type="button"
          onClick={() => router.push("/audiences")}
          className="mb-8 inline-flex items-center gap-2 text-sm font-light text-neutral-500 transition-colors hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to audiences
        </button>
        <p className="text-sm font-light text-neutral-500">
          {error ?? "Audience not found."}
        </p>
      </div>
    );
  }

  const lookalikeRatio = formatLookalikeRatio(
    detail.lookalikeRatio,
    detail.lookalikeStartingRatio,
  );
  const hasLookalikeDetails =
    lookalikeRatio != null ||
    detail.lookalikeCountryCodes.length > 0 ||
    detail.lookalikeOriginNames.length > 0 ||
    detail.lookalikeOriginAudienceIds.length > 0;

  const hasRuleDetails = detail.ruleSpec != null;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 pt-8 pb-10 md:px-10 md:pt-10">
      <DetailBreadcrumbs
        items={[
          { label: "Audiences", href: "/audiences" },
          { label: detail.name },
        ]}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-light uppercase tracking-wider text-neutral-400">
              {detail.provider === META_PROVIDER ? (
                <MetaIcon className="h-3.5 w-3.5" />
              ) : null}
              Audience · {detail.accountName}
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-neutral-900">
              {detail.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-light text-neutral-500">
              <span>{formatAudienceTypeLabel(detail.audienceType)}</span>
              {detail.originType ? (
                <span>{formatAudienceOriginLabel(detail.originType)}</span>
              ) : null}
              {detail.status ? <span>{detail.status}</span> : null}
              <span>
                Size {formatAudienceSize(
                  detail.approximateSizeLower,
                  detail.approximateSizeUpper,
                )}
              </span>
              <span>
                {detail.includeCount} include
                {detail.excludeCount > 0 ? ` · ${detail.excludeCount} exclude` : ""}
              </span>
            </div>
            {detail.description ? (
              <p className="mt-3 max-w-3xl text-sm font-light text-neutral-600">
                {detail.description}
              </p>
            ) : null}
          </div>
        </div>
      </motion.div>

      <div className="mb-8">
        <EntityMetricsGrid metrics={detail.metrics} />
      </div>

      <div className="space-y-12">
        <DetailSection title="Overview" defaultOpen>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <OverviewItem
              label="Type"
              value={formatAudienceTypeLabel(detail.audienceType)}
            />
            <OverviewItem
              label="Origin"
              value={formatAudienceOriginLabel(detail.originType)}
            />
            <OverviewItem
              label="Subtype"
              value={detail.subtype?.replaceAll("_", " ") || "-"}
            />
            <OverviewItem
              label="Status"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {detail.isReady ? (
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--kenoo-sky)]"
                      aria-hidden
                    />
                  ) : null}
                  {detail.status || "-"}
                </span>
              }
            />
            <OverviewItem
              label="Audience size"
              value={formatAudienceSize(
                detail.approximateSizeLower,
                detail.approximateSizeUpper,
              )}
            />
            <OverviewItem
              label="Retention"
              value={
                detail.retentionDays != null
                  ? `${detail.retentionDays} days`
                  : "-"
              }
            />
            <OverviewItem
              label="Data source"
              value={
                detail.dataSourceType || detail.dataSourceId
                  ? [
                      detail.dataSourceType?.replaceAll("_", " "),
                      detail.dataSourceId ? `ID ${detail.dataSourceId}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "-"
              }
            />
            <OverviewItem
              label="Catalog source"
              value={
                detail.catalogSource === "account_catalog"
                  ? "Account catalog"
                  : detail.catalogSource === "targeting_segment"
                    ? "Ad set targeting"
                    : "-"
              }
            />
            <OverviewItem
              label="Provider ID"
              value={detail.providerAudienceId}
            />
          </div>
        </DetailSection>

        {hasLookalikeDetails ? (
          <DetailSection
            title="Lookalike details"
            description="Seed audience and expansion settings used to build this lookalike."
            defaultOpen
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <OverviewItem label="Ratio" value={lookalikeRatio ?? "-"} />
              <OverviewItem
                label="Countries"
                value={
                  detail.lookalikeCountryCodes.length > 0
                    ? detail.lookalikeCountryCodes.join(", ")
                    : "-"
                }
              />
              <OverviewItem
                label="Seed audiences"
                value={
                  detail.lookalikeOriginNames.length > 0
                    ? detail.lookalikeOriginNames.join(", ")
                    : detail.lookalikeOriginAudienceIds.length > 0
                      ? detail.lookalikeOriginAudienceIds.join(", ")
                      : "-"
                }
              />
            </div>
          </DetailSection>
        ) : null}

        {hasRuleDetails ? (
          <DetailSection
            title="Audience rules"
            description="Membership rules from the ad platform (pixel events, URL filters, etc.)."
          >
            <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-4 text-xs font-light leading-relaxed text-neutral-700">
              {JSON.stringify(detail.ruleSpec, null, 2)}
            </pre>
          </DetailSection>
        ) : null}

        <DetailSection
          title="Used in ad sets"
          description="Where this audience is included or excluded, plus the geo/age/platform targeting on those ad sets."
          defaultOpen
        >
          {detail.usages.length === 0 ? (
            <p className="py-8 text-center text-sm font-light text-neutral-400">
              No ad sets are currently using this audience.
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200/70 text-left text-xs font-medium tracking-wide text-neutral-400 uppercase">
                    <th className="py-3 pr-4">Ad set</th>
                    <th className="py-3 pr-4">Campaign</th>
                    <th className="py-3 pr-4">Inclusion</th>
                    <th className="py-3 pr-4">Targeting</th>
                    <th className="py-3 pr-4">Spend</th>
                    <th className="py-3 pr-4">CTR</th>
                    <th className="py-3 pr-4">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.usages.map((usage) => {
                    const adSetHref =
                      usage.campaignId != null
                        ? `/campaigns/${usage.campaignId}/ad-sets/${usage.entityId}`
                        : null;
                    const campaignHref = usage.campaignId
                      ? `/campaigns/${usage.campaignId}`
                      : null;

                    return (
                      <tr
                        key={usage.id}
                        className="border-b border-neutral-100 transition-colors hover:bg-kenoo-white"
                      >
                        <td className="py-4 pr-4">
                          <div className="flex min-w-0 flex-col gap-1">
                            {adSetHref ? (
                              <Link
                                href={adSetHref}
                                className="truncate text-sm font-medium text-neutral-800 transition-colors hover:text-[var(--kenoo-sky)]"
                              >
                                {usage.entityName}
                              </Link>
                            ) : (
                              <span className="truncate text-sm font-medium text-neutral-800">
                                {usage.entityName}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1.5 text-xs font-light text-neutral-400">
                              {isActiveStatus(usage.entityStatus) ? (
                                <span
                                  className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--kenoo-sky)]"
                                  aria-hidden
                                />
                              ) : null}
                              {formatStatus(usage.entityStatus)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-xs font-light text-neutral-500">
                          {campaignHref && usage.campaignName ? (
                            <Link
                              href={campaignHref}
                              className="transition-colors hover:text-[var(--kenoo-sky)]"
                            >
                              {usage.campaignName}
                            </Link>
                          ) : (
                            (usage.campaignName ?? "-")
                          )}
                        </td>
                        <td className="py-4 pr-4 text-xs font-light capitalize text-neutral-500">
                          {usage.inclusion}
                        </td>
                        <td className="max-w-[220px] py-4 pr-4 text-xs font-light text-neutral-500">
                          <span className="line-clamp-2">
                            {summarizeTargeting(usage)}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-xs font-medium whitespace-nowrap text-neutral-800 tabular-nums">
                          <AnimatedMetricValue
                            value={formatCurrencyFromMicros(usage.spendMicros)}
                          />
                        </td>
                        <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                          <AnimatedMetricValue value={formatPercent(usage.ctr)} />
                        </td>
                        <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                          {formatRoas(usage.roas)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DetailSection>
      </div>
    </div>
  );
}
