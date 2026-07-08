"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import type {
  DashboardTopAdsByObjective,
  DashboardTopPerformingAd,
} from "@/lib/analytics-server";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatResultCount,
  formatRoas,
} from "@/lib/format-analytics";
import type { AdCreativePreview } from "@/lib/meta-creatives";
import type { DashboardObjectiveBucket } from "@/lib/meta-objectives";

import { AdCreativeLightbox } from "@/components/campaigns/ad-creative-lightbox";
import { AdThumbnail } from "@/components/campaigns/entity-detail-shared";
import { SegmentToggle } from "@/components/ui/segment-toggle";

import { AnimatedMetricValue } from "./animated-metric-value";
import { SectionLabel } from "./dashboard-metrics";

function adDetailHref(ad: DashboardTopPerformingAd): string | null {
  if (!ad.campaignId || !ad.adSetId) return null;
  return `/campaigns/${ad.campaignId}/ad-sets/${ad.adSetId}`;
}

function primaryMetricForObjective(
  ad: DashboardTopPerformingAd,
  objective: DashboardObjectiveBucket,
): { label: string; value: string } {
  switch (objective) {
    case "OUTCOME_SALES":
      return { label: "ROAS", value: formatRoas(ad.roas) };
    case "OUTCOME_TRAFFIC":
      return { label: "Clicks", value: formatCompactNumber(ad.clicks) };
    case "OUTCOME_AWARENESS":
      return { label: "Impressions", value: formatCompactNumber(ad.impressions) };
    case "OUTCOME_ENGAGEMENT":
      return { label: "CTR", value: formatPercent(ad.ctr) };
    case "OUTCOME_LEADS":
      return { label: "Clicks", value: formatCompactNumber(ad.clicks) };
    case "OUTCOME_APP_PROMOTION":
      return { label: "Clicks", value: formatCompactNumber(ad.clicks) };
    default:
      return { label: "Spend", value: formatCurrencyFromMicros(ad.spendMicros) };
  }
}

function secondaryMetricForObjective(
  ad: DashboardTopPerformingAd,
  objective: DashboardObjectiveBucket,
): { label: string; value: string } | null {
  if (objective === "OUTCOME_SALES" && ad.websitePurchases !== null) {
    return {
      label: "Purchases",
      value: formatResultCount(ad.websitePurchases),
    };
  }

  if (objective === "OUTCOME_TRAFFIC" || objective === "OUTCOME_LEADS") {
    return { label: "CTR", value: formatPercent(ad.ctr) };
  }

  if (objective === "OUTCOME_ENGAGEMENT") {
    return { label: "Clicks", value: formatCompactNumber(ad.clicks) };
  }

  return { label: "Spend", value: formatCurrencyFromMicros(ad.spendMicros) };
}

type TopPerformingAdsProps = {
  periodLabel: string;
  topPerformingAds: DashboardTopAdsByObjective;
};

export function TopPerformingAds({
  periodLabel,
  topPerformingAds,
}: TopPerformingAdsProps) {
  const [selectedObjective, setSelectedObjective] =
    React.useState<DashboardObjectiveBucket | null>(null);
  const [creativePreview, setCreativePreview] = React.useState<{
    adName: string;
    adId: string;
    preview: AdCreativePreview;
  } | null>(null);

  const availableObjectives = topPerformingAds.objectives;

  React.useEffect(() => {
    if (availableObjectives.length === 0) {
      setSelectedObjective(null);
      return;
    }

    setSelectedObjective((current) => {
      if (current && availableObjectives.some((item) => item.value === current)) {
        return current;
      }
      return availableObjectives[0]?.value ?? null;
    });
  }, [availableObjectives]);

  const activeAds =
    selectedObjective != null
      ? (topPerformingAds.byObjective[selectedObjective] ?? [])
      : [];

  if (availableObjectives.length === 0) {
    return (
      <div>
        <SectionLabel>Top performing ads — {periodLabel}</SectionLabel>
        <p className="text-sm font-light text-neutral-400">
          Top ads will appear here once ad-level performance syncs from Meta.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Top performing ads — {periodLabel}
        </p>
        <SegmentToggle
          aria-label="Campaign objective"
          value={selectedObjective ?? availableObjectives[0].value}
          onChange={setSelectedObjective}
          options={availableObjectives.map((objective) => ({
            value: objective.value,
            label: objective.label,
          }))}
        />
      </div>

      <div className="space-y-2">
        {activeAds.map((ad, index) => {
          const href = adDetailHref(ad);
          const primary = primaryMetricForObjective(
            ad,
            selectedObjective ?? availableObjectives[0].value,
          );
          const secondary =
            selectedObjective != null
              ? secondaryMetricForObjective(ad, selectedObjective)
              : null;

          return (
            <motion.div
              key={ad.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="flex items-center gap-4 rounded-2xl border border-neutral-200/70 bg-neutral-50/40 px-4 py-3 transition-colors hover:bg-neutral-50"
            >
              <span className="w-5 flex-shrink-0 text-center text-xs font-medium tabular-nums text-neutral-400">
                {index + 1}
              </span>

              <AdThumbnail
                url={ad.thumbnailUrl}
                title={ad.name}
                creativeType={ad.creativeType}
                onClick={
                  ad.creativePreview
                    ? () =>
                        setCreativePreview({
                          adName: ad.name,
                          adId: ad.id,
                          preview: ad.creativePreview!,
                        })
                    : undefined
                }
              />

              <div className="min-w-0 flex-1">
                {href ? (
                  <Link
                    href={href}
                    className="block truncate text-sm font-medium text-neutral-800 transition-colors hover:text-[var(--walls-sky)]"
                  >
                    {ad.name}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium text-neutral-800">{ad.name}</p>
                )}
                <p className="mt-0.5 truncate text-[11px] font-light text-neutral-400">
                  {[ad.campaignName, ad.adSetName].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                  {primary.label}
                </p>
                <p className="text-sm font-semibold tabular-nums text-neutral-800">
                  <AnimatedMetricValue value={primary.value} />
                </p>
              </div>

              {secondary ? (
                <div className="hidden shrink-0 text-right md:block">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                    {secondary.label}
                  </p>
                  <p className="text-sm font-light tabular-nums text-neutral-600">
                    <AnimatedMetricValue value={secondary.value} />
                  </p>
                </div>
              ) : null}

              <div className="shrink-0 text-right sm:hidden">
                <p className="text-sm font-semibold tabular-nums text-neutral-800">
                  <AnimatedMetricValue value={primary.value} />
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AdCreativeLightbox
        open={creativePreview != null}
        onClose={() => setCreativePreview(null)}
        adName={creativePreview?.adName ?? ""}
        adId={creativePreview?.adId ?? null}
        preview={creativePreview?.preview ?? null}
      />
    </div>
  );
}
