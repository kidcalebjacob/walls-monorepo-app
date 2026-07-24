"use client";

import { getCountryCode, getCountryDisplayName } from "@/types/country.types";
import { useMemo } from "react";
import WorldMap from "react-svg-worldmap";
import type { AudienceDistributionItem } from "./audience-analysis.types";
import { formatSpacedNumber } from "./audience-charts";

const HEATMAP_MIN = "#e8f4f7";
const HEATMAP_MAX = "#6eadc0";
const HEATMAP_EMPTY = "#ececec";

function mixHeatColor(intensity: number): string {
  const t = Math.max(0, Math.min(1, intensity));
  const from = {
    r: 0xe8,
    g: 0xf4,
    b: 0xf7,
  };
  const to = {
    r: 0x6e,
    g: 0xad,
    b: 0xc0,
  };

  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

function toMapEntries(items: AudienceDistributionItem[]) {
  return items
    .filter((item) => item.label !== "Unknown")
    .map((item) => {
      const code = getCountryCode(item.label);
      if (!code || code === "UN") return null;
      return {
        country: code,
        label: getCountryDisplayName(item.label) || item.label,
        value: item.value,
        percentage: item.percentage,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export function AudienceRegionHeatmapPanel({
  title,
  items,
}: {
  title: string;
  items: AudienceDistributionItem[];
}) {
  const mapEntries = useMemo(() => toMapEntries(items), [items]);
  const maxValue = useMemo(
    () => Math.max(...mapEntries.map((entry) => entry.value), 1),
    [mapEntries]
  );
  const valueByCode = useMemo(
    () => new Map(mapEntries.map((entry) => [entry.country, entry])),
    [mapEntries]
  );

  if (mapEntries.length === 0) {
    return null;
  }

  const topMarket = mapEntries[0];

  return (
    <div className="border-t border-neutral-200/70 bg-white/50 p-6 sm:p-8 lg:p-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <p className="text-[15px] font-light text-neutral-800">{title}</p>
        {topMarket && (
          <div className="text-right">
            <p className="text-[10px] font-light uppercase tracking-[0.12em] text-neutral-400">
              Top market
            </p>
            <p className="mt-1 text-[28px] font-black leading-none text-neutral-900 sm:text-[34px]">
              {topMarket.label}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
        <div className="aspect-[2.1/1] w-full min-h-[240px] overflow-hidden rounded-2xl bg-neutral-100/30">
          <div className="flex h-full w-full items-center justify-center [&_svg]:!bg-transparent [&>div]:!bg-transparent">
            <WorldMap
              color={HEATMAP_MAX}
              backgroundColor="transparent"
              valueSuffix=" partners"
              size="responsive"
              data={mapEntries.map((entry) => ({
                country: entry.country,
                value: entry.value,
              }))}
              tooltipBgColor="#fafafa"
              tooltipTextColor="#171717"
              frame={false}
              strokeOpacity={0}
              styleFunction={(country) => {
                const entry = valueByCode.get(country.countryCode);
                const intensity = entry ? entry.value / maxValue : 0;

                return {
                  fill: entry ? mixHeatColor(intensity) : HEATMAP_EMPTY,
                  stroke: "#ffffff",
                  strokeWidth: 0.35,
                  strokeOpacity: 1,
                  fillOpacity: 1,
                  cursor: entry ? "pointer" : "default",
                };
              }}
            />
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-3 text-[10px] font-light uppercase tracking-[0.12em] text-neutral-400">
              Partner density
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-200/80">
              <div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${HEATMAP_MIN}, ${HEATMAP_MAX})`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-light uppercase tracking-[0.1em] text-neutral-400">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <div className="space-y-3">
            {mapEntries.slice(0, 6).map((entry) => (
              <div key={entry.country} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[1px]"
                    style={{
                      backgroundColor: mixHeatColor(entry.value / maxValue),
                    }}
                  />
                  <span className="truncate text-[13px] font-light text-neutral-600">
                    {entry.label}
                  </span>
                </div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="text-[13px] font-semibold tabular-nums text-neutral-900">
                    {formatSpacedNumber(entry.value)}
                  </span>
                  <span className="text-[11px] font-light tabular-nums text-neutral-400">
                    {entry.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
