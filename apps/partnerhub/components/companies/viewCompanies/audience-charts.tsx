"use client";

import { cn } from "@/lib/utils";
import type { AudienceDistributionItem, AudiencePlatformReach } from "./audience-analysis.types";
import { formatAudienceNumber } from "./analyze-partnership-audience";
import { Globe2, Layers3, MapPin, type LucideIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export function formatSpacedNumber(value: number): string {
  return value.toLocaleString("en-US").replace(/,/g, " ");
}

function PanelHeader({ title, value }: { title: string; value?: string }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <p className="text-[15px] font-light text-neutral-800">{title}</p>
      {value && (
        <p className="text-right text-[28px] font-black leading-none tabular-nums tracking-tight text-neutral-900 sm:text-[34px]">
          {value}
        </p>
      )}
    </div>
  );
}

function PanelBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white/50 p-6 sm:p-8 lg:p-10", className)}>{children}</div>
  );
}

export function ReachStylePanel({
  title,
  totalValue,
  items,
  emptyLabel = "Not enough data yet",
}: {
  title: string;
  totalValue: string;
  items: AudienceDistributionItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <PanelBlock>
        <PanelHeader title={title} value={totalValue} />
        <p className="text-sm font-light text-neutral-400">{emptyLabel}</p>
      </PanelBlock>
    );
  }

  return (
    <PanelBlock>
      <PanelHeader title={title} value={totalValue} />
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-6">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-[1px]"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-[13px] font-light text-neutral-600">
                  {item.label}
                </span>
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-neutral-900">
                {formatSpacedNumber(item.value)}
              </span>
            </div>
          ))}
        </div>

        <div className="mx-auto h-[180px] w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                dataKey="value"
                nameKey="label"
                innerRadius={86}
                outerRadius={89}
                paddingAngle={2}
                stroke="none"
              >
                {items.map((item, index) => (
                  <Cell
                    key={item.label}
                    fill={item.color}
                    fillOpacity={index === 0 ? 1 : 0.32}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PanelBlock>
  );
}

export function FansStyleStemPanel({
  title,
  totalValue,
  items,
}: {
  title: string;
  totalValue: string;
  items: AudiencePlatformReach[];
}) {
  const maxFollowers = items[0]?.followers ?? 0;
  const minFollowers = items.length > 0 ? Math.min(...items.map((item) => item.followers)) : 0;
  const avgFollowers =
    items.length > 0
      ? Math.round(items.reduce((sum, item) => sum + item.followers, 0) / items.length)
      : 0;

  if (items.length === 0) {
    return (
      <PanelBlock>
        <PanelHeader title={title} value={totalValue} />
        <p className="text-sm font-light text-neutral-400">Follower data not available yet.</p>
      </PanelBlock>
    );
  }

  const displayItems = items.slice(0, 5);

  return (
    <PanelBlock>
      <PanelHeader title={title} value={totalValue} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_72px]">
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 bottom-[72px] top-0 flex flex-col justify-between">
            {[0, 1, 2].map((line) => (
              <div key={line} className="border-t border-dashed border-neutral-200" />
            ))}
          </div>

          <div
            className="relative grid items-end gap-3 border-b border-neutral-300/80 pb-0"
            style={{
              gridTemplateColumns: `repeat(${displayItems.length}, minmax(0, 1fr))`,
              minHeight: "220px",
            }}
          >
            {displayItems.map((item) => (
              <div key={item.label} className="flex h-[220px] flex-col items-center justify-end">
                <div
                  className="w-px bg-[var(--walls-sky)]"
                  style={{ height: `${Math.max(item.percentage, 6)}%` }}
                />
                <span className="relative z-10 -mt-1.5 h-3.5 w-3.5 rounded-full bg-[var(--walls-sky)] ring-2 ring-white" />
              </div>
            ))}
          </div>

          <div
            className="mt-4 grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${displayItems.length}, minmax(0, 1fr))`,
            }}
          >
            {displayItems.map((item) => (
              <p
                key={item.label}
                className="text-center text-[10px] font-light uppercase tracking-[0.08em] text-neutral-500"
              >
                {item.label}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between py-2 text-right text-[10px] font-light uppercase tracking-[0.08em] text-neutral-400">
          <div>
            <p>Max</p>
            <p className="mt-1 text-[13px] font-semibold tabular-nums text-neutral-700">
              {formatSpacedNumber(maxFollowers)}
            </p>
          </div>
          <div>
            <p>Avg</p>
            <p className="mt-1 text-[13px] font-semibold tabular-nums text-neutral-700">
              {formatSpacedNumber(avgFollowers)}
            </p>
          </div>
          <div>
            <p>Min</p>
            <p className="mt-1 text-[13px] font-semibold tabular-nums text-neutral-700">
              {formatSpacedNumber(minFollowers)}
            </p>
          </div>
        </div>
      </div>
    </PanelBlock>
  );
}

function ComparisonColumn({
  icon: Icon,
  label,
  value,
  percentage,
  accentClass,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  percentage: number;
  accentClass: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex items-center gap-2 text-neutral-500">
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <p className="text-[10px] font-light uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="text-[26px] font-black leading-none tabular-nums text-neutral-900 sm:text-[30px]">
        {formatSpacedNumber(value)}
      </p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-200/80">
        <div className={cn("h-full rounded-full", accentClass)} style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-3 text-[13px] font-light tabular-nums text-neutral-600">{percentage}%</p>
    </div>
  );
}

export function DemographicsStylePanel({
  title,
  left,
  right,
}: {
  title: string;
  left: AudienceDistributionItem;
  right?: AudienceDistributionItem;
}) {
  return (
    <PanelBlock className="border-t border-neutral-200/70 lg:border-t-0">
      <p className="mb-8 text-[15px] font-light text-neutral-800">{title}</p>
      <div className="flex flex-col gap-10 sm:flex-row sm:gap-8">
        <ComparisonColumn
          icon={MapPin}
          label={left.label}
          value={left.value}
          percentage={left.percentage}
          accentClass="bg-[var(--walls-sky)]"
        />
        {right ? (
          <ComparisonColumn
            icon={Globe2}
            label={right.label}
            value={right.value}
            percentage={right.percentage}
            accentClass="bg-[var(--walls-lime)]"
          />
        ) : (
          <div className="hidden flex-1 sm:block" />
        )}
      </div>
    </PanelBlock>
  );
}

export function NicheSplitPanel({
  title,
  left,
  right,
}: {
  title: string;
  left: AudienceDistributionItem;
  right?: AudienceDistributionItem;
}) {
  return (
    <PanelBlock className="border-t border-neutral-200/70">
      <p className="mb-8 text-[15px] font-light text-neutral-800">{title}</p>
      <div className="flex flex-col gap-10 sm:flex-row sm:gap-8">
        <ComparisonColumn
          icon={Layers3}
          label={left.label}
          value={left.value}
          percentage={left.percentage}
          accentClass="bg-[var(--walls-sky)]"
        />
        {right ? (
          <ComparisonColumn
            icon={Layers3}
            label={right.label}
            value={right.value}
            percentage={right.percentage}
            accentClass="bg-[var(--walls-lime)]"
          />
        ) : (
          <div className="hidden flex-1 sm:block" />
        )}
      </div>
    </PanelBlock>
  );
}

export function MetricColumnsPanel({
  title,
  items,
}: {
  title: string;
  items: { label: string; percentage: number }[];
}) {
  if (items.length === 0) return null;

  const columns = items.slice(0, 4);

  return (
    <PanelBlock className="border-t border-neutral-200/70 lg:border-t-0">
      <p className="mb-8 text-[15px] font-light text-neutral-800">{title}</p>
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(0, 1fr))` }}
      >
        {columns.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-[10px] font-light uppercase tracking-[0.12em] text-neutral-500">
              {item.label}
            </p>
            <p className="mt-3 text-[34px] font-black leading-none tabular-nums text-neutral-900">
              {item.percentage}%
            </p>
          </div>
        ))}
      </div>
    </PanelBlock>
  );
}

export function HashtagColumnsPanel({
  title,
  items,
}: {
  title: string;
  items: { label: string; percentage: number }[];
}) {
  if (items.length === 0) return null;

  const columns = items.slice(0, 4);

  return (
    <PanelBlock className="border-t border-neutral-200/70">
      <p className="mb-8 text-[15px] font-light text-neutral-800">{title}</p>
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(0, 1fr))` }}
      >
        {columns.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="truncate text-[10px] font-light uppercase tracking-[0.12em] text-neutral-500">
              {item.label}
            </p>
            <p className="mt-3 text-[34px] font-black leading-none tabular-nums text-neutral-900">
              {item.percentage}%
            </p>
          </div>
        ))}
      </div>
    </PanelBlock>
  );
}
