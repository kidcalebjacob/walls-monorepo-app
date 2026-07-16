"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";

import { EntityAutomationSection } from "@/components/campaigns/automation-panel";
import {
  AdPilotEnableToggle,
  AdPilotRowBadge,
  DetailBreadcrumbs,
  DetailSection,
  EntityMetricsGrid,
  LearningBadge,
  formatStatus,
  isActiveStatus,
} from "@/components/campaigns/entity-detail-shared";
import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import type { CampaignDetailResult } from "@/lib/entity-detail-server";
import {
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";
import { formatObjectiveLabel } from "@/lib/meta-objectives";

export function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const campaignId = params.campaignId;

  const [detail, setDetail] = React.useState<CampaignDetailResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/campaigns/${campaignId}`);
    if (!response.ok) {
      setError(response.status === 404 ? "Campaign not found." : "Failed to load campaign.");
      setDetail(null);
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as CampaignDetailResult;
    setDetail(payload);
    setLoading(false);
  }, [campaignId]);

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
          onClick={() => router.push("/campaigns")}
          className="mb-8 inline-flex items-center gap-2 text-sm font-light text-neutral-500 transition-colors hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to campaigns
        </button>
        <p className="text-sm font-light text-neutral-500">{error ?? "Campaign not found."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 pt-8 pb-10 md:px-10 md:pt-10">
      <DetailBreadcrumbs
        items={[
          { label: "Campaigns", href: "/campaigns" },
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
            <p className="text-xs font-light uppercase tracking-wider text-neutral-400">
              Campaign · {detail.accountName}
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-neutral-900">
              {detail.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-light text-neutral-500">
              {detail.objective ? (
                <span>Objective: {formatObjectiveLabel(detail.objective)}</span>
              ) : null}
              {detail.status ? <span>Status: {detail.status}</span> : null}
              {detail.dailyBudgetMicros != null && detail.dailyBudgetMicros > 0 ? (
                <span>
                  Daily budget: {formatCurrencyFromMicros(detail.dailyBudgetMicros)}
                </span>
              ) : null}
              <span>{detail.adSets.length} ad sets</span>
            </div>
          </div>

          {detail.canAutomate ? (
            <AdPilotEnableToggle
              entityId={detail.id}
              automation={detail.automation}
              onAutomationUpdated={(automation) =>
                setDetail((prev) => (prev ? { ...prev, automation } : prev))
              }
            />
          ) : null}
        </div>
      </motion.div>

      <div className="mb-8">
        <EntityMetricsGrid metrics={detail.metrics} />
      </div>

      <div className="space-y-12">
        <DetailSection
          title="Ad sets"
          description="Performance for the last 30 days. Open an ad set to configure AdPilot for that specific budget."
        >
          {detail.adSets.length === 0 ? (
            <p className="py-8 text-center text-sm font-light text-neutral-400">
              No ad sets synced for this campaign yet.
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200/70 text-left text-xs font-medium tracking-wide text-neutral-400 uppercase">
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Daily budget</th>
                    <th className="py-3 pr-4">Spend</th>
                    <th className="py-3 pr-4">CTR</th>
                    <th className="py-3 pr-4">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.adSets.map((adSet) => (
                    <tr
                      key={adSet.id}
                      className="border-b border-neutral-100 transition-colors hover:bg-kenoo-white"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/campaigns/${campaignId}/ad-sets/${adSet.id}`}
                            className="truncate text-sm font-medium text-neutral-800 transition-colors hover:text-[var(--kenoo-sky)]"
                          >
                            {adSet.name}
                          </Link>
                          {adSet.adpilotEnabled ? <AdPilotRowBadge /> : null}
                          <LearningBadge status={adSet.learningStatus} />
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500">
                        <span className="inline-flex items-center gap-1.5">
                          {isActiveStatus(adSet.status) ? (
                            <span
                              className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--kenoo-sky)]"
                              aria-hidden
                            />
                          ) : null}
                          {formatStatus(adSet.status)}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                        <AnimatedMetricValue
                          value={
                            adSet.dailyBudgetMicros != null && adSet.dailyBudgetMicros > 0
                              ? formatCurrencyFromMicros(adSet.dailyBudgetMicros)
                              : "—"
                          }
                        />
                      </td>
                      <td className="py-4 pr-4 text-xs font-medium whitespace-nowrap text-neutral-800 tabular-nums">
                        <AnimatedMetricValue
                          value={formatCurrencyFromMicros(adSet.spendMicros)}
                        />
                      </td>
                      <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                        <AnimatedMetricValue value={formatPercent(adSet.ctr)} />
                      </td>
                      <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                        {formatRoas(adSet.roas)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DetailSection>

        <EntityAutomationSection
          entityId={detail.id}
          entityLabel="campaign"
          detail={detail}
          onAutomationUpdated={(automation) =>
            setDetail((prev) => (prev ? { ...prev, automation } : prev))
          }
        />
      </div>
    </div>
  );
}
