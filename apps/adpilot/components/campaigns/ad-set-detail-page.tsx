"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";

import { EntityAutomationSection } from "@/components/campaigns/automation-panel";
import { EntityDailyProgressSection } from "@/components/campaigns/entity-daily-progress-section";
import {
  AdPilotEnableToggle,
  DetailBreadcrumbs,
  EntityMetricsGrid,
} from "@/components/campaigns/entity-detail-shared";
import type { AdSetDetailResult } from "@/lib/entity-detail-server";
import { formatCurrencyFromMicros } from "@/lib/format-analytics";

export function AdSetDetailPage() {
  const params = useParams<{ campaignId: string; adSetId: string }>();
  const router = useRouter();
  const { campaignId, adSetId } = params;

  const [detail, setDetail] = React.useState<AdSetDetailResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/campaigns/${campaignId}/ad-sets/${adSetId}`);
    if (!response.ok) {
      setError(response.status === 404 ? "Ad set not found." : "Failed to load ad set.");
      setDetail(null);
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as AdSetDetailResult;
    setDetail(payload);
    setLoading(false);
  }, [campaignId, adSetId]);

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
      <div className="px-6 pt-16 md:px-10 md:pt-20">
        <button
          type="button"
          onClick={() => router.push(`/campaigns/${campaignId}`)}
          className="mb-8 inline-flex items-center gap-2 text-sm font-light text-neutral-500 transition-colors hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to campaign
        </button>
        <p className="text-sm font-light text-neutral-500">{error ?? "Ad set not found."}</p>
      </div>
    );
  }

  const campaignName = detail.parentName ?? "Campaign";

  return (
    <div className="px-6 pt-8 pb-10 md:px-10 md:pt-10">
      <DetailBreadcrumbs
        items={[
          { label: "Campaigns", href: "/campaigns" },
          { label: campaignName, href: `/campaigns/${campaignId}` },
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
              Ad set · {detail.accountName}
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-neutral-900">
              {detail.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-light text-neutral-500">
              <span>Campaign: {campaignName}</span>
              {detail.status ? <span>Status: {detail.status}</span> : null}
              {detail.dailyBudgetMicros != null && detail.dailyBudgetMicros > 0 ? (
                <span>
                  Daily budget: {formatCurrencyFromMicros(detail.dailyBudgetMicros)}
                </span>
              ) : null}
            </div>
          </div>

          {detail.canAutomate ? (
            <AdPilotEnableToggle
              entityId={detail.id}
              enabled={detail.automation.enabled}
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

      <EntityAutomationSection
        entityId={detail.id}
        entityLabel="ad set"
        detail={detail}
        onAutomationUpdated={(automation) =>
          setDetail((prev) => (prev ? { ...prev, automation } : prev))
        }
      />

      <EntityDailyProgressSection progress={detail.dailyProgress} />
    </div>
  );
}
