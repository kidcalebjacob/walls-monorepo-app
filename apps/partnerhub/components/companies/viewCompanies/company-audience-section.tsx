"use client";

import { cn } from "@/lib/utils";
import { KnownHashtagItem } from "./known-hashtag-item";
import { cardSurfaceClass } from "../shared";
import {
  FansStyleStemPanel,
  formatSpacedNumber,
  HashtagColumnsPanel,
  MetricColumnsPanel,
  NicheSplitPanel,
  ReachStylePanel,
} from "./audience-charts";
import { AudienceRegionHeatmapPanel } from "./audience-region-heatmap";
import { formatAudienceNumber } from "./analyze-partnership-audience";
import { useCompanyAudienceAnalysis } from "./use-company-audience-analysis";

function AudienceSkeleton() {
  return (
    <div className="overflow-hidden rounded-[inherit]">
      <div className="grid lg:grid-cols-2">
        <div className="h-[320px] animate-pulse bg-neutral-100/70" />
        <div className="h-[320px] animate-pulse border-t border-neutral-200/70 bg-neutral-100/60 lg:border-l lg:border-t-0" />
      </div>
      <div className="grid border-t border-neutral-200/70 lg:grid-cols-2">
        <div className="h-[280px] animate-pulse bg-neutral-100/50" />
        <div className="h-[280px] animate-pulse border-t border-neutral-200/70 bg-neutral-100/40 lg:border-l lg:border-t-0" />
      </div>
    </div>
  );
}

export function CompanyAudienceSection({ companyId }: { companyId: string }) {
  const { loading, analysis } = useCompanyAudienceAnalysis(companyId);

  if (!loading && !analysis) {
    return null;
  }

  return (
    <div className={cn(cardSurfaceClass, "overflow-hidden p-0")}>
      <div className="border-b border-neutral-200/70 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              Partner audience profile
            </p>
          </div>
          {!loading && analysis && (
            <p className="text-sm font-light text-neutral-500">
              {analysis.partnerCount} talent{analysis.partnerCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      {loading || !analysis ? (
        <AudienceSkeleton />
      ) : (
        <>
          <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-neutral-200/70">
            <ReachStylePanel
              title="Platform mix"
              totalValue={formatSpacedNumber(analysis.totalContentPieces)}
              items={analysis.platformDistribution}
            />
            <FansStyleStemPanel
              title="Reach by platform"
              totalValue={formatAudienceNumber(analysis.estimatedReach)}
              items={analysis.platformReach}
            />
          </div>

          {analysis.geographyDistribution.length > 0 && (
            <AudienceRegionHeatmapPanel
              title="Target geography"
              items={analysis.geographyDistribution}
            />
          )}

          <div className="grid border-t border-neutral-200/70 lg:grid-cols-2 lg:divide-x lg:divide-neutral-200/70">
            <div>
              {analysis.nicheDistribution.length > 0 && (
                <NicheSplitPanel
                  title="Niche concentration"
                  left={analysis.nicheDistribution[0]}
                  right={analysis.nicheDistribution[1]}
                />
              )}
            </div>

            <div>
              <MetricColumnsPanel
                title="Talent niches"
                items={analysis.nicheDistribution.map((item) => ({
                  label: item.label,
                  percentage: item.percentage,
                }))}
              />
              <HashtagColumnsPanel
                title="Content themes"
                items={analysis.topHashtags.map((item) => ({
                  label: item.tag,
                  percentage: item.percentage,
                }))}
              />
            </div>
          </div>

          {analysis.genderDistribution.length > 0 && (
            <div className="border-t border-neutral-200/70 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-neutral-200/70">
              <ReachStylePanel
                title="Gender breakdown"
                totalValue={String(analysis.partnerCount)}
                items={analysis.genderDistribution}
              />
              <MetricColumnsPanel
                title="Gender split"
                items={analysis.genderDistribution.map((item) => ({
                  label: item.label,
                  percentage: item.percentage,
                }))}
              />
            </div>
          )}

          {(analysis.knownHashtags ?? []).length > 0 && (
            <div className="border-t border-neutral-200/70 px-6 py-5 sm:px-8">
              <p className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">
                Known hashtags
              </p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                {(analysis.knownHashtags ?? []).map((detail) => (
                  <KnownHashtagItem
                    key={detail.tag}
                    detail={detail}
                    companyId={companyId}
                  />
                ))}
              </div>
            </div>
          )}

          {analysis.insights.length > 0 && (
            <div className="border-t border-neutral-200/70 bg-white/40 px-6 py-5 sm:px-8">
              <p className="max-w-4xl text-[11px] font-light italic leading-relaxed text-neutral-500">
                {analysis.insights[0]}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
