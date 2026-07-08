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
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isOpen = collapsible ? open : true;

  return (
    <section className={cn("scroll-mt-24", className)}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className="mb-4 flex w-full items-center transition-opacity hover:opacity-80"
        >
          <span className="mr-4 text-2xl font-black tracking-tight text-black sm:text-3xl">
            {title}
          </span>
          <div className="h-px flex-1 border-t border-black/80" />
          {isOpen ? (
            <Minus className="ml-4 h-4 w-4 shrink-0 text-neutral-600" />
          ) : (
            <Plus className="ml-4 h-4 w-4 shrink-0 text-neutral-600" />
          )}
        </button>
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

/** Selectable card/pill styling matching the agent settings page. */
export function detailSelectableClass(isSelected: boolean, extra?: string) {
  return cn(
    "relative z-10 rounded-2xl border border-transparent transition-all duration-300 ease-in-out",
    "hover:border-neutral-200 hover:bg-walls-white hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] hover:scale-[0.99]",
    isSelected
      ? "border-[rgba(110,173,192,0.45)] bg-white/40 shadow-[0_0_0_1px_rgba(110,173,192,0.35),0_0_12px_rgba(110,173,192,0.25)] hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(110,173,192,0.35),0_0_12px_rgba(110,173,192,0.25)]"
      : "bg-transparent",
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
          change="—"
          positive
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
 * Header enable/disable toggle for AdPilot on a campaign or ad set. Persists the
 * change immediately (does not require the Save AdPilot settings button).
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

  return (
    <div
      className={cn(
        "inline-flex items-center gap-4 rounded-2xl border px-4 py-2.5 transition-colors",
        enabled
          ? "border-walls-sky/40 bg-walls-sky/5"
          : "border-neutral-200 bg-walls-white",
      )}
    >
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          AdPilot
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            enabled ? "text-neutral-900" : "text-neutral-500",
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
}: {
  url: string | null;
  title: string;
  creativeType?: string | null;
  onClick?: () => void;
  interactive?: boolean;
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
    "relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md border border-neutral-200/70 bg-neutral-100",
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
