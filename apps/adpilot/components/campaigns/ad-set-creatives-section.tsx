"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { AdCreativeLightbox } from "@/components/campaigns/ad-creative-lightbox";
import {
  AdThumbnail,
  DetailSection,
} from "@/components/campaigns/entity-detail-shared";
import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import type { AdSetAdSummary } from "@/lib/entity-detail-server";
import { formatCpaFromMicros } from "@/lib/entity-daily-progress";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatResultCount,
  formatRoas,
} from "@/lib/format-analytics";
import type { AdCreativePreview } from "@/lib/meta-creatives";
import type { DashboardObjectiveBucket } from "@/lib/meta-objectives";

type AdSetCreativesSectionProps = {
  ads: AdSetAdSummary[];
  objectiveBucket: DashboardObjectiveBucket | null;
};

function primaryMetricForAd(
  ad: AdSetAdSummary,
  objective: DashboardObjectiveBucket | null,
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

function secondaryMetricForAd(
  ad: AdSetAdSummary,
  objective: DashboardObjectiveBucket | null,
): { label: string; value: string } | null {
  if (objective === "OUTCOME_SALES") {
    return { label: "Spend", value: formatCurrencyFromMicros(ad.spendMicros) };
  }

  if (objective === "OUTCOME_TRAFFIC" || objective === "OUTCOME_LEADS") {
    return { label: "CTR", value: formatPercent(ad.ctr) };
  }

  if (objective === "OUTCOME_ENGAGEMENT") {
    return { label: "Clicks", value: formatCompactNumber(ad.clicks) };
  }

  return { label: "Spend", value: formatCurrencyFromMicros(ad.spendMicros) };
}

function tertiaryMetricForAd(
  ad: AdSetAdSummary,
  objective: DashboardObjectiveBucket | null,
): { label: string; value: string } | null {
  if (objective === "OUTCOME_SALES") {
    if (ad.websitePurchases != null) {
      return {
        label: "Purchases",
        value: formatResultCount(ad.websitePurchases),
      };
    }
    return null;
  }

  return null;
}

function quaternaryMetricForAd(
  ad: AdSetAdSummary,
  objective: DashboardObjectiveBucket | null,
): { label: string; value: string } | null {
  if (objective === "OUTCOME_SALES") {
    return {
      label: "CPA",
      value: formatCpaFromMicros(ad.spendMicros, ad.websitePurchases ?? 0),
    };
  }

  return null;
}

function formatAdStatus(status: string | null): string | null {
  if (!status) return null;
  return status.replaceAll("_", " ");
}

function creativeSubtitle(
  preview: AdCreativePreview | null,
  status: string | null,
): string {
  const copy = preview?.title ?? preview?.body ?? null;
  const statusLabel = formatAdStatus(status);

  if (copy && statusLabel) return `${statusLabel} · ${copy}`;
  return copy ?? statusLabel ?? "-";
}

export function AdSetCreativesSection({
  ads,
  objectiveBucket,
}: AdSetCreativesSectionProps) {
  const [creativePreview, setCreativePreview] = React.useState<{
    adName: string;
    adId: string;
    preview: AdCreativePreview;
  } | null>(null);

  return (
    <>
      <DetailSection title="Creatives">
        {ads.length === 0 ? (
          <p className="text-sm font-light text-neutral-500">
            No ads synced for this ad set yet.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {ads.map((ad, index) => {
              const primary = primaryMetricForAd(ad, objectiveBucket);
              const secondary = secondaryMetricForAd(ad, objectiveBucket);
              const tertiary = tertiaryMetricForAd(ad, objectiveBucket);
              const quaternary = quaternaryMetricForAd(ad, objectiveBucket);

              return (
                <motion.div
                  key={ad.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-4 py-3"
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
                    <p className="truncate text-sm font-medium text-neutral-800">
                      {ad.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-light text-neutral-400">
                      {creativeSubtitle(ad.creativePreview, ad.status)}
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

                  {tertiary ? (
                    <div className="hidden shrink-0 text-right md:block">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                        {tertiary.label}
                      </p>
                      <p className="text-sm font-light tabular-nums text-neutral-600">
                        <AnimatedMetricValue value={tertiary.value} />
                      </p>
                    </div>
                  ) : null}

                  {quaternary ? (
                    <div className="hidden shrink-0 text-right lg:block">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                        {quaternary.label}
                      </p>
                      <p className="text-sm font-light tabular-nums text-neutral-600">
                        <AnimatedMetricValue value={quaternary.value} />
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
        )}
      </DetailSection>

      <AdCreativeLightbox
        open={creativePreview != null}
        onClose={() => setCreativePreview(null)}
        adName={creativePreview?.adName ?? ""}
        adId={creativePreview?.adId ?? null}
        preview={creativePreview?.preview ?? null}
      />
    </>
  );
}
