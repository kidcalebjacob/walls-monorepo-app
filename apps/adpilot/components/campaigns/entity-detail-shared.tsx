"use client";

import * as React from "react";
import Link from "next/link";
import { Bot } from "lucide-react";

import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import { SectionLabel } from "@/components/dashboard/dashboard-metrics";
import type { EntityDetailMetrics } from "@/lib/entity-detail-server";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";

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

export function EntityMetricsGrid({ metrics }: { metrics: EntityDetailMetrics }) {
  const items = [
    { label: "Spend", value: formatCurrencyFromMicros(metrics.spendMicros) },
    { label: "Impressions", value: formatCompactNumber(metrics.impressions) },
    { label: "CTR", value: formatPercent(metrics.ctr) },
    { label: "ROAS", value: formatRoas(metrics.roas) },
  ];

  return (
    <div>
      <SectionLabel>Performance — Last 30 days</SectionLabel>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-neutral-100 bg-neutral-50/80 px-4 py-3"
          >
            <p className="text-xs font-light uppercase tracking-wider text-neutral-400">
              {metric.label}
            </p>
            <p className="mt-1 text-lg font-medium tabular-nums text-neutral-800">
              <AnimatedMetricValue value={metric.value} />
            </p>
          </div>
        ))}
      </div>
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

export function AdPilotRowBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-walls-yellow/40 bg-walls-yellow/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-700">
      <Bot className="h-3 w-3" />
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
