"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { cn } from "@walls/utils";

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
import {
  TIME_RANGE_OPTIONS,
  timeRangeLabel,
  type TimeRangeValue,
} from "@/lib/time-range";

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

type AdPerformanceRowProps = {
  ad: DashboardTopPerformingAd;
  index: number;
  objective: DashboardObjectiveBucket;
  rankTone?: "top" | "bottom";
  onPreviewCreative: (payload: {
    adName: string;
    adId: string;
    preview: AdCreativePreview;
  }) => void;
};

function AdPerformanceRow({
  ad,
  index,
  objective,
  rankTone = "top",
  onPreviewCreative,
}: AdPerformanceRowProps) {
  const href = adDetailHref(ad);
  const primary = primaryMetricForObjective(ad, objective);
  const secondary = secondaryMetricForObjective(ad, objective);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-4 py-3"
    >
      <span
        className={
          rankTone === "bottom"
            ? "w-5 flex-shrink-0 text-center text-xs font-medium tabular-nums text-rose-400"
            : "w-5 flex-shrink-0 text-center text-xs font-medium tabular-nums text-neutral-400"
        }
      >
        {ad.overallRank}
      </span>

      <AdThumbnail
        url={ad.thumbnailUrl}
        title={ad.name}
        creativeType={ad.creativeType}
        onClick={
          ad.creativePreview
            ? () =>
                onPreviewCreative({
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
            className="block truncate text-sm font-medium text-neutral-800 transition-colors hover:text-[var(--kenoo-sky)]"
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
}

type AdHighlightsTimeRangePickerProps = {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
};

function AdHighlightsTimeRangePicker({
  value,
  onChange,
}: AdHighlightsTimeRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex items-center gap-1 rounded-none border-0 bg-transparent p-0 text-xs font-medium uppercase tracking-widest text-neutral-500 shadow-none transition-colors hover:text-neutral-800",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{timeRangeLabel(value)}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-neutral-400 transition-transform duration-200",
            open && "rotate-180",
          )}
          strokeWidth={1.8}
        />
      </button>

      {open ? (
        <div
          className="absolute top-full left-0 z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                value === option.value
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-700 hover:bg-neutral-50",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 flex-shrink-0 rounded-full",
                  value === option.value ? "bg-[var(--kenoo-sky)]" : "bg-neutral-200",
                )}
                aria-hidden
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type TopPerformingAdsProps = {
  timeRange: TimeRangeValue;
  onTimeRangeChange: (value: TimeRangeValue) => void;
  topPerformingAds: DashboardTopAdsByObjective;
};

export function TopPerformingAds({
  timeRange,
  onTimeRangeChange,
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

  const activeObjective = selectedObjective ?? availableObjectives[0]?.value ?? null;
  const activeAds =
    activeObjective != null
      ? (topPerformingAds.byObjective[activeObjective] ?? [])
      : [];
  const bottomAds =
    activeObjective != null
      ? (topPerformingAds.bottomByObjective[activeObjective] ?? [])
      : [];

  if (availableObjectives.length === 0) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
          <SectionLabel>Ad highlights —</SectionLabel>
          <AdHighlightsTimeRangePicker
            value={timeRange}
            onChange={onTimeRangeChange}
          />
        </div>
        <p className="text-sm font-light text-neutral-400">
          Ad highlights will appear here once ad-level performance syncs from Meta.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Ad highlights —
          </p>
          <AdHighlightsTimeRangePicker
            value={timeRange}
            onChange={onTimeRangeChange}
          />
        </div>
        <SegmentToggle
          aria-label="Campaign objective"
          value={activeObjective ?? availableObjectives[0].value}
          onChange={setSelectedObjective}
          options={availableObjectives.map((objective) => ({
            value: objective.value,
            label: objective.label,
          }))}
        />
      </div>

      <div className="divide-y divide-neutral-100">
        {activeAds.map((ad, index) => (
          <AdPerformanceRow
            key={ad.id}
            ad={ad}
            index={index}
            objective={activeObjective ?? availableObjectives[0].value}
            onPreviewCreative={setCreativePreview}
          />
        ))}
      </div>

      {bottomAds.length > 0 ? (
        <>
          <div className="relative my-5">
            <div className="border-t border-dashed border-rose-400" />
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-kenoo-white px-3 text-[10px] font-medium uppercase tracking-wider text-rose-500">
              Bottom performers
            </p>
          </div>

          <div className="divide-y divide-neutral-100">
            {bottomAds.map((ad, index) => (
              <AdPerformanceRow
                key={ad.id}
                ad={ad}
                index={index}
                objective={activeObjective ?? availableObjectives[0].value}
                rankTone="bottom"
                onPreviewCreative={setCreativePreview}
              />
            ))}
          </div>
        </>
      ) : null}

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
