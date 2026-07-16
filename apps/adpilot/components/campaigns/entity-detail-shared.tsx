"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CircleDollarSign,
  Eye,
  ImageIcon,
  Minus,
  MousePointerClick,
  Plus,
  TrendingUp,
} from "lucide-react";

import { Switch } from "@walls/ui/switch";
import { cn } from "@walls/utils";

import {
  toggleCardActiveClass,
  toggleCardBaseClass,
  toggleCardInactiveClass,
} from "@/components/ui/button-styles";

import { HeroStat } from "@/components/dashboard/dashboard-metrics";
import type {
  EntityDetailMetrics,
  EntityDetailResult,
  ReachSaturation,
} from "@/lib/entity-detail-server";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";

/**
 * Settings-page aesthetic: transparent, free-flowing sections with a bold
 * title and a thin rule — no filled gray card containers.
 */
export function DetailSection({
  title,
  description,
  children,
  className,
  collapsible = true,
  defaultOpen = false,
  open: openControlled,
  onOpenChange,
  trailing,
  headerToggle = true,
  collapsedBadgeCount,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Controlled open state. When set, pair with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Replaces the default +/- collapse control on the far right.
   * Title + rule still toggle the section open/closed when `headerToggle` is true.
   */
  trailing?: React.ReactNode;
  /**
   * When false, the title/rule row does not toggle open/closed (e.g. expand only
   * via a trailing action like Generate). Content visibility still follows `open`.
   */
  headerToggle?: boolean;
  /** Glowing status dot left of the title when > 0 (e.g. active instruction count). */
  collapsedBadgeCount?: number;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = openControlled !== undefined;
  const open = isControlled ? openControlled : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const isOpen = collapsible ? open : true;
  const showActiveDot =
    collapsedBadgeCount != null && collapsedBadgeCount > 0;

  const titleBlock = (
    <span className="mr-3 flex shrink-0 items-center gap-2.5">
      {showActiveDot ? (
        <span
          className="relative flex h-2 w-2 shrink-0"
          aria-label={`${collapsedBadgeCount} active instruction${collapsedBadgeCount === 1 ? "" : "s"}`}
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--kenoo-sky)] opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--kenoo-sky)] shadow-[0_0_8px_var(--kenoo-sky)]" />
        </span>
      ) : null}
      <span className="text-2xl font-black tracking-tight text-black sm:text-3xl">
        {title}
      </span>
    </span>
  );

  return (
    <section className={cn("scroll-mt-24", className)}>
      {collapsible ? (
        <div
          className={cn(
            "flex w-full items-center",
            isOpen ? "mb-4" : "mb-0",
          )}
        >
          {headerToggle ? (
            <button
              type="button"
              onClick={() => setOpen(!isOpen)}
              aria-expanded={isOpen}
              className="flex min-w-0 flex-1 items-center"
            >
              {titleBlock}
              <div className="h-px flex-1 border-t border-black/80" />
              {!trailing ? (
                isOpen ? (
                  <Minus className="ml-4 h-4 w-4 shrink-0 text-neutral-600" />
                ) : (
                  <Plus className="ml-4 h-4 w-4 shrink-0 text-neutral-600" />
                )
              ) : null}
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-center">
              {titleBlock}
              <div className="h-px flex-1 border-t border-black/80" />
            </div>
          )}
          {trailing ? (
            <div className="ml-4 shrink-0">{trailing}</div>
          ) : null}
        </div>
      ) : (
        <div className="mb-4 flex items-center">
          <span className="mr-4 text-2xl font-black tracking-tight text-black sm:text-3xl">
            {title}
          </span>
          <div className="h-px flex-1 border-t border-black/80" />
        </div>
      )}

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* Inner padding wrapper keeps focus rings / glow from clipping */}
            <div className="px-0.5 pt-0.5 pb-1">
              {description ? (
                <p className="mb-6 max-w-2xl text-sm font-light text-neutral-500">
                  {description}
                </p>
              ) : null}
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

/** Small uppercase label used above a block of content on settings-style pages. */
export function DetailSubLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Selectable card/pill styling matching the settings page. */
export function detailSelectableClass(isSelected: boolean, extra?: string) {
  return cn(
    toggleCardBaseClass,
    isSelected ? toggleCardActiveClass : toggleCardInactiveClass,
    extra,
  );
}

export function formatStatus(status: string | null) {
  if (!status) return "—";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isActiveStatus(status: string | null) {
  const normalized = (status ?? "").toLowerCase();
  return normalized === "active" || normalized === "learning";
}

const ENTITY_METRIC_ACCENTS = [
  "var(--kenoo-sky)",
  "var(--kenoo-blue)",
  "#00d1c1",
  "#7a04eb",
] as const;

const ENTITY_METRIC_ICONS = [
  CircleDollarSign,
  Eye,
  MousePointerClick,
  TrendingUp,
] as const;

export function EntityMetricsGrid({
  metrics,
  reachSaturation,
}: {
  metrics: EntityDetailMetrics;
  reachSaturation?: ReachSaturation | null;
}) {
  const items = [
    { label: "Spend", value: formatCurrencyFromMicros(metrics.spendMicros) },
    { label: "Impressions", value: formatCompactNumber(metrics.impressions) },
    { label: "CTR", value: formatPercent(metrics.ctr) },
    { label: "ROAS", value: formatRoas(metrics.roas) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-row flex-wrap items-stretch justify-center gap-6 pb-2 pt-2 md:gap-8">
        {items.map((metric, index) => (
          <HeroStat
            key={metric.label}
            label={metric.label}
            value={metric.value}
            icon={ENTITY_METRIC_ICONS[index] ?? CircleDollarSign}
            accentColor={ENTITY_METRIC_ACCENTS[index] ?? ENTITY_METRIC_ACCENTS[0]}
            delay={index * 0.06}
          />
        ))}
      </div>
      <ReachSaturationBar saturation={reachSaturation ?? null} />
    </div>
  );
}

function formatAudienceBand(lower: number | null, upper: number | null): string | null {
  if (lower != null && upper != null) {
    if (lower === upper) return formatCompactNumber(upper);
    return `${formatCompactNumber(lower)}–${formatCompactNumber(upper)}`;
  }
  if (upper != null) return formatCompactNumber(upper);
  if (lower != null) return formatCompactNumber(lower);
  return null;
}

/** Keep sub-1% values readable instead of rounding to a misleading 0%. */
function formatSaturationPercent(pct: number): string {
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct > 0) return `${pct.toFixed(2)}%`;
  return "0%";
}

/**
 * Extrapolate remaining spend to fill the estimated audience at the current
 * spend-per-reach rate. Rough guide only — Meta won't deliver linearly.
 */
function estimateRemainingSpendMicros(
  spendMicros: number,
  saturationRatio: number,
): number | null {
  if (spendMicros <= 0 || saturationRatio <= 0) return null;
  if (saturationRatio >= 1) return 0;
  const projectedTotal = spendMicros / saturationRatio;
  if (!Number.isFinite(projectedTotal)) return null;
  return Math.max(0, Math.round(projectedTotal - spendMicros));
}

/** Rough audience-saturation guideposts — hover markers on the reach bar. */
const SATURATION_GUIDES = [
  {
    pct: 5,
    label: "~5%",
    title: "Low saturation",
    description:
      "Under ~5% of a very large audience, saturation is almost never the issue.",
  },
  {
    pct: 20,
    label: "~20%",
    title: "Rising costs",
    description:
      "From 5–20%, some highly responsive segments may begin to exhaust. At 20%+, costs are more likely to rise as Meta reaches less responsive users.",
  },
  {
    pct: 50,
    label: "~50%",
    title: "Harder unique reach",
    description:
      "At 50%+, reaching new unique people becomes increasingly difficult, and frequency often becomes a bigger factor.",
  },
] as const;

function ReachSaturationBar({
  saturation,
}: {
  saturation: ReachSaturation | null;
}) {
  if (!saturation) return null;

  const {
    lifetimeReach,
    lifetimeSpendMicros,
    estimatedAudienceLower,
    estimatedAudienceUpper,
    audienceEstimateReady,
  } = saturation;

  const spendMicros = lifetimeSpendMicros ?? 0;
  const ceiling = estimatedAudienceUpper ?? estimatedAudienceLower;
  const hasReach = lifetimeReach != null && lifetimeReach > 0;
  const hasEstimate = ceiling != null && ceiling > 0;

  if (!hasReach && !hasEstimate) return null;

  const saturationRatio =
    hasReach && hasEstimate ? Math.min(1, lifetimeReach / ceiling) : null;
  const pct = saturationRatio != null ? saturationRatio * 100 : null;

  const remainingSpendMicros =
    saturationRatio != null
      ? estimateRemainingSpendMicros(spendMicros, saturationRatio)
      : null;

  const audienceLabel = formatAudienceBand(
    estimatedAudienceLower,
    estimatedAudienceUpper,
  );

  const estimateUnavailable =
    audienceEstimateReady === false || (!hasEstimate && hasReach);

  const isFilled = remainingSpendMicros === 0;
  const remainingValue =
    remainingSpendMicros == null
      ? "—"
      : isFilled
        ? "$0"
        : formatCurrencyFromMicros(remainingSpendMicros);

  const segmentCount = 4;
  const overallPct = pct ?? 0;
  const segmentFills = Array.from({ length: segmentCount }, (_, index) => {
    const start = (index / segmentCount) * 100;
    const end = ((index + 1) / segmentCount) * 100;
    if (overallPct <= start) return 0;
    if (overallPct >= end) return 100;
    return ((overallPct - start) / (end - start)) * 100;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.35 }}
      className="w-full"
    >
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="w-16 shrink-0 sm:w-20">
          <p className="text-2xl font-black tabular-nums tracking-tight text-neutral-800 sm:text-3xl">
            {pct != null ? formatSaturationPercent(pct) : "—"}
          </p>
          <p className="mt-0.5 text-[10px] font-normal uppercase tracking-[0.14em] text-neutral-400">
            Saturated
          </p>
        </div>

        <div className="relative min-w-0 flex-1 py-1">
          <div className="flex gap-1.5 sm:gap-2">
            {segmentFills.map((fill, index) => (
              <div
                key={index}
                className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/[0.05] sm:h-3"
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #c4b5fd 0%, #93c5fd 55%, #38bdf8 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${fill}%` }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.08 + index * 0.06,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2">
            {SATURATION_GUIDES.map((guide) => {
              const tooltipAlign =
                guide.pct <= 10
                  ? "left-0 translate-x-0"
                  : guide.pct >= 45
                    ? "right-0 translate-x-0 left-auto"
                    : "left-1/2 -translate-x-1/2";

              return (
                <button
                  key={guide.pct}
                  type="button"
                  style={{ left: `${guide.pct}%` }}
                  className={cn(
                    "group/guide pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
                    "flex h-5 w-3 cursor-help items-center justify-center outline-none",
                  )}
                  aria-label={`${guide.label}: ${guide.title}. ${guide.description}`}
                >
                  <span
                    className={cn(
                      "block h-5 w-0 border-l-[1.5px] border-dashed border-red-400/75",
                      "transition-colors duration-150",
                      "group-hover/guide:border-red-500 group-focus-visible/guide:border-red-500",
                    )}
                  />
                  <span
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute bottom-[calc(100%+10px)] z-20 w-56",
                      "rounded-xl border border-neutral-200/80 bg-white/95 px-3 py-2 text-left shadow-lg backdrop-blur-sm",
                      "opacity-0 transition-opacity duration-150",
                      "group-hover/guide:opacity-100 group-focus-visible/guide:opacity-100",
                      tooltipAlign,
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold text-neutral-800">
                        {guide.title}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                        {guide.label}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] font-light leading-snug text-neutral-500">
                      {guide.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-light text-neutral-500">
          {hasReach ? (
            <>
              <span className="font-medium tabular-nums text-neutral-800">
                {formatCompactNumber(lifetimeReach)}
              </span>
              {audienceLabel ? (
                <>
                  {" "}
                  of{" "}
                  <span className="tabular-nums text-neutral-700">{audienceLabel}</span>
                  {" "}
                  estimated audience
                </>
              ) : (
                <> people reached lifetime</>
              )}
              {spendMicros > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="tabular-nums">
                    {formatCurrencyFromMicros(spendMicros)}
                  </span>{" "}
                  spent lifetime
                </>
              ) : null}
            </>
          ) : (
            <>
              Estimated audience{" "}
              <span className="tabular-nums text-neutral-700">{audienceLabel}</span>
              {" "}
              · reach syncing
            </>
          )}
        </p>

        <p className="text-sm font-light text-neutral-500">
          <span className="font-semibold tabular-nums text-neutral-900">
            {remainingValue}
          </span>{" "}
          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">
            {isFilled ? "maxed out" : "potential left"}
          </span>
        </p>
      </div>

      {estimateUnavailable ? (
        <p className="mt-1 text-xs font-light text-neutral-400">
          Meta estimated audience size isn’t ready yet for this targeting.
        </p>
      ) : null}
    </motion.div>
  );
}

export function AdPilotBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-kenoo-yellow/40 bg-kenoo-yellow/15 px-3 py-1 text-xs font-medium text-neutral-800">
      <Bot className="h-3.5 w-3.5" />
      AdPilot active
    </span>
  );
}

/**
 * Header enable/disable toggle for AdPilot on a campaign or ad set. Persists
 * immediately with an optimistic UI; settings below auto-save separately.
 */
export function AdPilotEnableToggle({
  entityId,
  automation,
  onAutomationUpdated,
}: {
  entityId: string;
  automation: EntityDetailResult["automation"];
  onAutomationUpdated: (automation: EntityDetailResult["automation"]) => void;
}) {
  const enabled = automation.enabled;
  const [chromeMounted, setChromeMounted] = React.useState(enabled);
  const requestIdRef = React.useRef(0);

  React.useEffect(() => {
    if (enabled) setChromeMounted(true);
  }, [enabled]);

  const toggle = (value: boolean) => {
    const requestId = ++requestIdRef.current;
    const previous = automation;
    onAutomationUpdated({
      ...automation,
      enabled: value,
      automationStatus: value ? "active" : "inactive",
    });

    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${entityId}/automation`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: value }),
        });

        if (requestId !== requestIdRef.current) return;

        if (!response.ok) {
          onAutomationUpdated(previous);
          return;
        }

        const payload = (await response.json()) as {
          automation: EntityDetailResult["automation"];
        };
        // First-time enable returns full profile-backed state. Subsequent toggles
        // use a settings-free fast path — keep the settings we already have.
        onAutomationUpdated(
          !previous.profileId && payload.automation.profileId
            ? payload.automation
            : {
                ...previous,
                enabled: payload.automation.enabled,
                automationStatus: payload.automation.automationStatus,
                profileId:
                  payload.automation.profileId ?? previous.profileId,
                lastError: payload.automation.lastError,
                lastReviewedAt: payload.automation.lastReviewedAt,
                lastAdjustedAt: payload.automation.lastAdjustedAt,
              },
        );
      } catch {
        if (requestId !== requestIdRef.current) return;
        onAutomationUpdated(previous);
      }
    })();
  };

  const showChromeFrame = enabled || chromeMounted;

  return (
    <div
      className={cn(
        "relative inline-flex rounded-2xl p-[1.5px]",
        showChromeFrame ? "overflow-hidden" : "overflow-visible",
      )}
    >
      <AnimatePresence onExitComplete={() => setChromeMounted(false)}>
        {enabled ? (
          <motion.span
            key="adpilot-chrome"
            aria-hidden
            className="pointer-events-none absolute inset-[-60%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              scale: 1.12,
              filter: "blur(8px)",
              transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
            }}
            transition={{
              opacity: { duration: 0.15 },
            }}
          >
            <span className="adpilot-chrome-orbit absolute inset-0" />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <div className="relative inline-flex items-center gap-4 rounded-[14.5px] bg-kenoo-white px-4 py-2.5">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            AdPilot
          </span>
          <span
            className={cn(
              "text-sm font-medium transition-colors duration-300",
              enabled ? "text-neutral-700" : "text-neutral-500",
            )}
          >
            {enabled ? "Active" : "Off"}
          </span>
        </div>
        <Switch
          size="lg"
          checked={enabled}
          onCheckedChange={toggle}
          aria-label="Enable AdPilot for this entity"
        />
      </div>
    </div>
  );
}

/**
 * Meta delivery learning-phase badge. Only rendered while an entity is still
 * learning (LEARNING or LEARNING_LIMITED) — a stabilized (SUCCESS) entity shows
 * nothing. Accepts the raw `learning_status` value from `ad_entities`.
 */
export function LearningBadge({
  status,
  className,
}: {
  status: string | null;
  className?: string;
}) {
  const normalized = (status ?? "").toUpperCase();

  const config =
    normalized === "LEARNING"
      ? {
          label: "Learning",
          title: "Still in Meta's learning phase",
          className:
            "border-[rgba(226,248,92,0.55)] bg-white/40 text-neutral-600 shadow-[0_0_0_1px_rgba(226,248,92,0.45),0_0_12px_rgba(226,248,92,0.45)]",
        }
      : normalized === "LEARNING_LIMITED"
        ? {
            label: "Learning limited",
            title:
              "Learning limited — not enough optimization events to exit the learning phase",
            className:
              "border-[rgba(239,68,68,0.45)] bg-white/40 text-neutral-600 shadow-[0_0_0_1px_rgba(239,68,68,0.35),0_0_12px_rgba(239,68,68,0.3)]",
          }
        : null;

  if (!config) return null;

  return (
    <span
      title={config.title}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export function AdThumbnail({
  url,
  title,
  creativeType,
  onClick,
  interactive = Boolean(onClick),
  size = "sm",
}: {
  url: string | null;
  title: string;
  creativeType?: string | null;
  onClick?: () => void;
  interactive?: boolean;
  size?: "sm" | "lg";
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(url) && !failed;
  const isInteractive = interactive && Boolean(onClick);

  const content = (
    <>
      {showImage ? (
        <img
          src={url!}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-neutral-300"
          aria-hidden
        >
          <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
        </div>
      )}
    </>
  );

  const className = cn(
    "relative flex-shrink-0 overflow-hidden border border-neutral-200/70 bg-neutral-100",
    size === "lg"
      ? "h-44 w-full rounded-xl"
      : "h-9 w-9 rounded-md",
    isInteractive &&
      "cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none",
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        title={`Preview ${title}`}
        aria-label={`Preview creative for ${title}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} title={title}>
      {content}
    </div>
  );
}

export function AdPilotRowBadge({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center rounded-full border border-[rgba(110,173,192,0.45)] bg-white/40 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 shadow-[0_0_0_1px_rgba(110,173,192,0.35),0_0_12px_rgba(110,173,192,0.25)]"
    >
      AdPilot
    </span>
  );
}

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function DetailBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="mb-8 flex shrink-0 flex-wrap items-center gap-2 text-xs font-light text-neutral-400">
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <span className="text-neutral-300">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-neutral-700">
              {item.label}
            </Link>
          ) : (
            <span className="text-neutral-600">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
