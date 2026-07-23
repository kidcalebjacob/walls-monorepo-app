"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
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

import {
  panelGlassClass,
  primaryButtonClass,
} from "@/components/ui/button-styles";

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

const LOADING_STEPS = [
  "Reading live metrics…",
  "Scoring trend & fatigue…",
  "Applying guardrails…",
  "Drafting budget decision…",
] as const;

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

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-neutral-200/70",
        className,
      )}
    >
      <div className="absolute inset-0 animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
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
    <div className="min-w-0 px-4 py-3.5 md:px-5 md:py-4">
      <p className="text-[11px] font-light uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium tracking-tight text-neutral-900">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] font-light text-neutral-400">{hint}</p>
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
    <div className="space-y-0">
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-6">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-widest text-neutral-500">
            Decision
          </p>
          {final != null ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {previous != null ? (
                <span className="text-lg font-light tabular-nums text-neutral-400 line-through">
                  {formatCurrencyFromMicros(previous, currency)}
                </span>
              ) : null}
              <ArrowRight className="relative top-0.5 h-4 w-4 shrink-0 text-neutral-300" />
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-neutral-900">
                {formatCurrencyFromMicros(final, currency)}
                <span className="ml-1 text-base font-light text-neutral-400">
                  /day
                </span>
              </span>
              {changePct != null ? (
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    changePct >= 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(1)}%
                </span>
              ) : null}
            </div>
          ) : decision.action === "deactivate" ? (
            <p className="text-2xl font-semibold tracking-tight text-rose-600">
              Would pause this{" "}
              {preview.entity.type === "ad_group" ? "ad set" : "campaign"}
            </p>
          ) : (
            <p className="text-2xl font-semibold tracking-tight text-neutral-900">
              No change
            </p>
          )}
          {!preview.wouldApply && final == null && decision.action !== "deactivate" ? (
            <p className="text-sm font-light text-neutral-500">
              Guardrails or cooldown would keep the current budget.
            </p>
          ) : null}
        </div>

        {showApply ? (
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Button
              type="button"
              disabled={applying || applied}
              onClick={() => void handleApply()}
              className={cn(primaryButtonClass, "inline-flex items-center gap-2")}
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
            <p className="max-w-[220px] text-xs font-light text-neutral-500 sm:text-right">
              Updates Meta immediately and logs this in budget history.
            </p>
          </div>
        ) : null}
      </div>

      {applyError ? (
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-800 sm:px-6">
          {applyError}
        </div>
      ) : null}

      <div className="border-b border-neutral-200/80 px-5 py-5 sm:px-6 sm:py-6">
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-neutral-500">
          <Sparkles className="h-3.5 w-3.5" />
          Why
          <span className="font-light normal-case tracking-normal text-neutral-400">
            · {decision.source}
            {decision.confidence != null
              ? ` · ${Math.round(decision.confidence * 100)}% confidence`
              : ""}
          </span>
        </p>
        <p className="mt-3 text-sm font-light leading-6 text-neutral-700">
          {decision.reason}
        </p>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          "[&>*]:border-b [&>*]:border-neutral-200/80 [&>*:last-child]:border-b-0",
          "sm:[&>*]:border-r sm:[&>*:nth-child(2n)]:border-r-0",
          "lg:[&>*]:border-r lg:[&>*:nth-child(2n)]:border-r",
          "lg:[&>*:nth-child(4n)]:border-r-0",
          "sm:[&>*:nth-last-child(-n+2)]:border-b-0",
          "lg:[&>*]:border-b-0",
        )}
      >
        <StatTile
          label="Trend"
          value={
            <span
              className={cn("inline-flex items-center gap-1.5", trendUi.className)}
            >
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
          value={
            <span className="capitalize">{decision.wouldSetStatus}</span>
          }
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
        <ul className="space-y-1.5 border-t border-neutral-200/80 px-5 py-4 text-xs font-light text-neutral-500 sm:px-6">
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

function PreviewSkeleton({ stepLabel }: { stepLabel: string }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-[#c5e7ff]/50 opacity-50" />
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#c5e7ff]/40 via-white to-[#ffd2e8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <Sparkles className="h-4 w-4 text-neutral-600" />
          </span>
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-neutral-700">{stepLabel}</p>
          <div className="h-1.5 max-w-[240px] overflow-hidden rounded-full bg-neutral-200/60 shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)]">
            <motion.div
              className="adpilot-chrome-progress h-full w-[42%] rounded-full"
              initial={{ x: "-110%" }}
              animate={{ x: "280%" }}
              transition={{
                duration: 1.35,
                ease: "easeInOut",
                repeat: Infinity,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SkeletonPulse className="h-7 w-24" />
        <SkeletonPulse className="h-4 w-4 rounded-full" />
        <SkeletonPulse className="h-8 w-36" />
        <SkeletonPulse className="h-5 w-14 rounded-full" />
      </div>

      <div className="space-y-3 border-y border-neutral-200/70 py-5">
        <SkeletonPulse className="h-3 w-16" />
        <SkeletonPulse className="h-3.5 w-full" />
        <SkeletonPulse className="h-3.5 w-[92%]" />
        <SkeletonPulse className="h-3.5 w-[68%]" />
      </div>

      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "space-y-2.5 px-4 py-3.5",
              "border-b border-neutral-200/70 last:border-b-0",
              "sm:border-r sm:odd:border-r sm:even:border-r-0",
              "lg:border-r lg:even:border-r lg:[&:nth-child(4n)]:border-r-0",
              "sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0",
            )}
          >
            <SkeletonPulse className="h-2.5 w-14" />
            <SkeletonPulse className="h-4 w-24" />
            <SkeletonPulse className="h-2.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChromeFrame({
  children,
  className,
  active = true,
  size = "md",
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  size?: "md" | "lg";
}) {
  const radius = size === "lg" ? "rounded-[28px]" : "rounded-2xl";
  const innerRadius = size === "lg" ? "rounded-[26.5px]" : "rounded-[14.5px]";

  return (
    <div
      className={cn(
        "group relative inline-flex overflow-hidden bg-kenoo-white p-[1.5px]",
        radius,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-[-60%] transition-opacity duration-500",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        <span className="adpilot-chrome-orbit absolute inset-0" />
      </span>
      <div className={cn("relative w-full", innerRadius)}>{children}</div>
    </div>
  );
}

function AdPilotGenerateButton({
  loading,
  hasResult,
  onClick,
  size = "sm",
}: {
  loading: boolean;
  hasResult: boolean;
  onClick: () => void;
  size?: "sm" | "lg";
}) {
  const isLarge = size === "lg";

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      aria-label={
        loading
          ? "Generating AdPilot decision"
          : hasResult
            ? "Regenerate AdPilot decision"
            : "Generate AdPilot decision"
      }
      className={cn(
        "focus-visible:outline-none disabled:cursor-wait",
        isLarge && "w-full max-w-md",
      )}
    >
      <ChromeFrame
        active={isLarge || loading}
        size={isLarge ? "lg" : "md"}
        className={cn(
          "w-full transition-[filter,transform] duration-300",
          "hover:brightness-[1.03]",
          isLarge && "active:scale-[0.985]",
          loading && "opacity-90",
        )}
      >
        <span
          className={cn(
            "relative flex w-full flex-col items-center justify-center gap-3 bg-kenoo-white text-neutral-700",
            isLarge
              ? cn(
                  "gap-4 px-8 py-10 sm:px-12 sm:py-12",
                  panelGlassClass,
                  "rounded-[26.5px]",
                )
              : "flex-row gap-2 rounded-[14.5px] px-3.5 py-2 text-sm font-medium",
          )}
        >
          {isLarge ? (
            <>
              <span className="relative flex h-14 w-14 items-center justify-center">
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />
                <Sparkles className="relative h-6 w-6 text-neutral-700" />
              </span>
              <span className="text-center">
                <span className="block text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
                  Generate preview
                </span>
                <span className="mt-1.5 block text-sm font-light text-neutral-500">
                  Dry-run the next budget decision — nothing applies yet
                </span>
              </span>
            </>
          ) : loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              {hasResult ? "Regenerate" : "Generate"}
            </>
          )}
        </span>
      </ChromeFrame>
    </button>
  );
}

type AdPilotPreviewCardProps = {
  entityId: string;
  onApplied?: (adjustment: BudgetAdjustmentRow) => void;
  /** Tab layout: always show content area with generate control up top. */
  standalone?: boolean;
};

export function AdPilotPreviewCard({
  entityId,
  onApplied,
  standalone = false,
}: AdPilotPreviewCardProps) {
  const [open, setOpen] = React.useState(standalone);
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<AdPilotPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    if (!loading) {
      setStepIndex(0);
      return;
    }

    const id = window.setInterval(() => {
      setStepIndex((current) =>
        current < LOADING_STEPS.length - 1 ? current + 1 : current,
      );
    }, 900);

    return () => window.clearInterval(id);
  }, [loading]);

  const run = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setPreview(null);
    setStepIndex(0);

    const result = await fetchAdPilotPreview(entityId);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPreview(result.preview);
  };

  const stepLabel = LOADING_STEPS[stepIndex] ?? LOADING_STEPS[0];

  if (standalone) {
    const showIdle = !loading && !preview && !error;

    return (
      <div className="relative min-h-[320px]">
        <AnimatePresence mode="wait">
          {showIdle ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-[320px] flex-col items-center justify-center py-10"
            >
              <AdPilotGenerateButton
                loading={false}
                hasResult={false}
                size="lg"
                onClick={() => void run()}
              />
            </motion.div>
          ) : null}

          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <ChromeFrame active size="lg" className="block w-full">
                <div
                  className={cn(
                    "rounded-[26.5px] px-5 py-6 sm:px-7 sm:py-7",
                    panelGlassClass,
                  )}
                >
                  <PreviewSkeleton stepLabel={stepLabel} />
                </div>
              </ChromeFrame>
            </motion.div>
          ) : null}

          {!loading && error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
              <div className="flex justify-center">
                <AdPilotGenerateButton
                  loading={false}
                  hasResult={false}
                  onClick={() => void run()}
                />
              </div>
            </motion.div>
          ) : null}

          {!loading && preview ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                  Preview result
                </p>
                <AdPilotGenerateButton
                  loading={false}
                  hasResult
                  onClick={() => void run()}
                />
              </div>

              <div
                className={cn(
                  "overflow-hidden rounded-[28px]",
                  panelGlassClass,
                )}
              >
                <PreviewResult
                  entityId={entityId}
                  preview={preview}
                  onApplied={onApplied}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <DetailSection
      title="Preview AdPilot decision"
      open={open}
      headerToggle={false}
      trailing={
        <AdPilotGenerateButton
          loading={loading}
          hasResult={preview != null}
          onClick={() => void run()}
        />
      }
    >
      {loading && !preview && !error ? (
        <PreviewSkeleton stepLabel={stepLabel} />
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
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
