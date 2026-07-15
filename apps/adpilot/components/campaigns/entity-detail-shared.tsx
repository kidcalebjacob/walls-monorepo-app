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
import type { EntityDetailMetrics, EntityDetailResult } from "@/lib/entity-detail-server";
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
   * Title + rule still toggle the section open/closed.
   */
  trailing?: React.ReactNode;
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
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--walls-sky)] opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--walls-sky)] shadow-[0_0_8px_var(--walls-sky)]" />
        </span>
      ) : null}
      <span className="text-2xl font-black tracking-tight text-black transition-opacity duration-300 group-hover:opacity-70 sm:text-3xl">
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
          <button
            type="button"
            onClick={() => setOpen(!isOpen)}
            aria-expanded={isOpen}
            className="group flex min-w-0 flex-1 items-center"
          >
            {titleBlock}
            <div className="h-px flex-1 border-t border-black/80 transition-opacity duration-300 group-hover:opacity-60" />
            {!trailing ? (
              isOpen ? (
                <Minus className="ml-4 h-4 w-4 shrink-0 text-neutral-600 transition-opacity duration-300 group-hover:opacity-70" />
              ) : (
                <Plus className="ml-4 h-4 w-4 shrink-0 text-neutral-600 transition-opacity duration-300 group-hover:opacity-70" />
              )
            ) : null}
          </button>
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
  "var(--walls-sky)",
  "var(--walls-blue)",
  "#00d1c1",
  "#7a04eb",
] as const;

const ENTITY_METRIC_ICONS = [
  CircleDollarSign,
  Eye,
  MousePointerClick,
  TrendingUp,
] as const;

export function EntityMetricsGrid({ metrics }: { metrics: EntityDetailMetrics }) {
  const items = [
    { label: "Spend", value: formatCurrencyFromMicros(metrics.spendMicros) },
    { label: "Impressions", value: formatCompactNumber(metrics.impressions) },
    { label: "CTR", value: formatPercent(metrics.ctr) },
    { label: "ROAS", value: formatRoas(metrics.roas) },
  ];

  return (
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
  );
}

export function AdPilotBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-walls-yellow/40 bg-walls-yellow/15 px-3 py-1 text-xs font-medium text-neutral-800">
      <Bot className="h-3.5 w-3.5" />
      AdPilot active
    </span>
  );
}

/**
 * Header enable/disable toggle for AdPilot on a campaign or ad set. Persists
 * immediately; settings below auto-save separately.
 */
export function AdPilotEnableToggle({
  entityId,
  enabled,
  onAutomationUpdated,
}: {
  entityId: string;
  enabled: boolean;
  onAutomationUpdated: (automation: EntityDetailResult["automation"]) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [chromeMounted, setChromeMounted] = React.useState(enabled);

  React.useEffect(() => {
    if (enabled) setChromeMounted(true);
  }, [enabled]);

  const toggle = async (value: boolean) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${entityId}/automation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: value }),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          automation: EntityDetailResult["automation"];
        };
        onAutomationUpdated(payload.automation);
      }
    } finally {
      setSaving(false);
    }
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
            exit={{ opacity: 0, scale: 1.12, filter: "blur(8px)" }}
            transition={{
              opacity: { duration: 0.15 },
              exit: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
            }}
          >
            <span className="adpilot-chrome-orbit absolute inset-0" />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <div className="relative inline-flex items-center gap-4 rounded-[14.5px] bg-walls-white px-4 py-2.5">
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
          disabled={saving}
          onCheckedChange={(value) => void toggle(value)}
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
