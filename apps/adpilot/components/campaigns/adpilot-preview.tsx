"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import { cn } from "@walls/utils";

import { DetailSection } from "@/components/campaigns/entity-detail-shared";
import type { BudgetAdjustmentRow } from "@/lib/automation-server";
import {
  adpilotTrendLabel,
  fetchAdPilotApply,
  fetchAdPilotPreview,
  type AdPilotPreview,
  type AdPilotTrendDirection,
} from "@/lib/adpilot-preview";
import { formatCurrencyFromMicros, formatRoas } from "@/lib/format-analytics";

function trendTheme(direction: AdPilotTrendDirection): {
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (direction) {
    case "growing":
      return { className: "text-emerald-600", Icon: TrendingUp };
    case "falling":
      return { className: "text-rose-600", Icon: TrendingDown };
    case "flat":
    default:
      return { className: "text-neutral-500", Icon: ArrowRight };
  }
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-[18px] border border-neutral-200/70 bg-transparent p-3">
      <p className="text-[11px] font-light uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[11px] font-light text-neutral-400">{hint}</p>
      ) : null}
    </div>
  );
}

function canApplyPreview(preview: AdPilotPreview): boolean {
  return (
    preview.wouldApply &&
    (preview.decision.action === "deactivate" ||
      preview.decision.budget.finalMicros != null)
  );
}

type PreviewResultProps = {
  entityId: string;
  preview: AdPilotPreview;
  onApplied?: (adjustment: BudgetAdjustmentRow) => void;
};

function PreviewResult({ entityId, preview, onApplied }: PreviewResultProps) {
  const { decision, trend, allowedRange } = preview;
  const trendUi = trendTheme(trend.direction);
  const { Icon: TrendIcon } = trendUi;
  const [applying, setApplying] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [applied, setApplied] = React.useState(false);

  const currency = decision.budget.currency;
  const previous = decision.budget.previousMicros;
  const final = decision.budget.finalMicros;
  const changePct = decision.budget.changePct;
  const showApply = canApplyPreview(preview);

  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);

    const result = await fetchAdPilotApply({ entityId, preview });

    setApplying(false);

    if (!result.ok) {
      setApplyError(result.error);
      return;
    }

    setApplied(true);
    onApplied?.(result.result.adjustment);
  };

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {final != null ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            {previous != null ? (
              <span className="text-neutral-400 line-through">
                {formatCurrencyFromMicros(previous, currency)}
              </span>
            ) : null}
            <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
            <span>{formatCurrencyFromMicros(final, currency)}/day</span>
            {changePct != null ? (
              <span
                className={cn(
                  "text-xs font-light",
                  changePct >= 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                ({changePct >= 0 ? "+" : ""}
                {changePct.toFixed(1)}%)
              </span>
            ) : null}
          </span>
        ) : decision.action === "deactivate" ? (
          <span className="text-sm font-medium text-rose-600">
            Would pause this {preview.entity.type === "ad_group" ? "ad set" : "campaign"}
          </span>
        ) : null}

        {!preview.wouldApply ? (
          <span className="text-xs font-light text-neutral-400">
            No change would be made
          </span>
        ) : null}
      </div>

      {showApply ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={applying || applied}
            onClick={() => void handleApply()}
            className="inline-flex items-center gap-2 rounded-none border-0 bg-walls-yellow px-5 py-2.5 text-sm font-medium text-black shadow-none hover:bg-walls-yellow"
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : applied ? (
              <>
                <Check className="h-4 w-4" />
                Applied to Meta
              </>
            ) : (
              "Apply changes now"
            )}
          </Button>
          <p className="text-xs font-light text-neutral-500">
            Updates Meta immediately and logs this change in budget history.
          </p>
        </div>
      ) : null}

      {applyError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {applyError}
        </div>
      ) : null}

      <div className="rounded-[18px] border border-neutral-200/70 bg-transparent p-4">
        <p className="flex items-center gap-2 text-xs font-light uppercase tracking-wider text-neutral-400">
          <Sparkles className="h-3.5 w-3.5" />
          Why
          <span className="normal-case tracking-normal text-neutral-400">
            · {decision.source}
            {decision.confidence != null
              ? ` · ${Math.round(decision.confidence * 100)}% confidence`
              : ""}
          </span>
        </p>
        <p className="mt-2 text-sm font-light leading-6 text-neutral-700">
          {decision.reason}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Trend"
          value={
            <span className={cn("inline-flex items-center gap-1.5", trendUi.className)}>
              <TrendIcon className="h-4 w-4" />
              {adpilotTrendLabel(trend.direction)}
            </span>
          }
          hint={
            trend.relativeChange != null
              ? `${trend.relativeChange >= 0 ? "+" : ""}${(trend.relativeChange * 100).toFixed(1)}% vs baseline`
              : undefined
          }
        />
        <StatTile
          label="ROAS (now / baseline)"
          value={`${formatRoas(trend.currentRoas)} / ${formatRoas(trend.baselineRoas)}`}
          hint={trend.fatigueDetected ? "Fatigue detected" : undefined}
        />
        <StatTile
          label="Allowed range"
          value={
            <>
              {formatCurrencyFromMicros(allowedRange.minMicros, currency)} –{" "}
              {allowedRange.maxMicros != null
                ? formatCurrencyFromMicros(allowedRange.maxMicros, currency)
                : "∞"}
            </>
          }
          hint={`+${Math.round(allowedRange.maxIncreasePct * 100)}% / -${Math.round(
            allowedRange.maxDecreasePct * 100,
          )}% per window`}
        />
        <StatTile
          label="State"
          value={decision.wouldSetStatus}
          hint={
            decision.cooldown.active
              ? decision.cooldown.endsAt
                ? `Cooldown until ${new Date(decision.cooldown.endsAt).toLocaleString()}`
                : "In cooldown"
              : decision.learning
                ? "Learning phase"
                : undefined
          }
        />
      </div>

      {allowedRange.notes.length > 0 ? (
        <ul className="space-y-1 text-xs font-light text-neutral-500">
          {allowedRange.notes.map((note, index) => (
            <li key={index} className="flex gap-2">
              <span className="text-neutral-300">•</span>
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type AdPilotPreviewCardProps = {
  entityId: string;
  entityLabel: string;
  onApplied?: (adjustment: BudgetAdjustmentRow) => void;
};

export function AdPilotPreviewCard({
  entityId,
  entityLabel,
  onApplied,
}: AdPilotPreviewCardProps) {
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<AdPilotPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);

    const result = await fetchAdPilotPreview(entityId);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPreview(result.preview);
  };

  return (
    <DetailSection
      title="Preview AdPilot decision"
      description={`See exactly what AdPilot would do to this ${entityLabel} right now — a dry run that reads live metrics and applies your guardrails without changing anything on Meta.`}
    >
      <Button
        type="button"
        disabled={loading}
        onClick={() => void run()}
        className="inline-flex items-center gap-2 rounded-none border-0 bg-walls-yellow px-5 py-2.5 text-sm font-medium text-black shadow-none hover:bg-walls-yellow"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking…
          </>
        ) : preview ? (
          "Re-run preview"
        ) : (
          "Preview decision"
        )}
      </Button>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {preview ? (
        <PreviewResult
          entityId={entityId}
          preview={preview}
          onApplied={onApplied}
        />
      ) : null}
    </DetailSection>
  );
}
