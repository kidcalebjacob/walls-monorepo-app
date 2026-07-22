"use client";

import * as React from "react";
import { Clock3, CalendarDays } from "lucide-react";

import { cn } from "@walls/utils";

import {
  addMetricTotals,
  DOW_DISPLAY_ORDER,
  DOW_LABELS,
  DAYS_HOURS_METRIC_OPTIONS,
  emptyMetricTotals,
  formatDaysHoursMetricValue,
  formatHourLabel,
  metricValueFromTotals,
  type DaysHoursAnalytics,
  type DaysHoursMetric,
  type MetricTotals,
} from "@/lib/days-hours";

import { SegmentToggle } from "@/components/ui/segment-toggle";
import { SectionLabel } from "./dashboard-metrics";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

type DaysHoursHeatmapProps = {
  data: DaysHoursAnalytics;
  className?: string;
};

type GridRow = {
  key: string;
  label: string;
  kind: "every" | "day";
  dayOfWeek?: number;
  cells: Array<MetricTotals | null>;
  avg: MetricTotals;
};

function buildCellMap(data: DaysHoursAnalytics) {
  const map = new Map<string, MetricTotals>();
  for (const cell of data.cells) {
    map.set(`${cell.dayOfWeek}:${cell.hour}`, {
      impressions: cell.impressions,
      clicks: cell.clicks,
      spendMicros: cell.spendMicros,
      conversionValueMicros: cell.conversionValueMicros,
    });
  }
  return map;
}

function buildRows(data: DaysHoursAnalytics): GridRow[] {
  const map = buildCellMap(data);

  const dayRows: GridRow[] = DOW_DISPLAY_ORDER.map((dayOfWeek) => {
    const cells = HOURS.map((hour) => map.get(`${dayOfWeek}:${hour}`) ?? null);
    const avg = cells.reduce<MetricTotals>(
      (acc, cell) => (cell ? addMetricTotals(acc, cell) : acc),
      emptyMetricTotals(),
    );
    return {
      key: `day-${dayOfWeek}`,
      label: DOW_LABELS[dayOfWeek] ?? String(dayOfWeek),
      kind: "day",
      dayOfWeek,
      cells,
      avg,
    };
  });

  const everyCells = HOURS.map((hour) =>
    DOW_DISPLAY_ORDER.reduce<MetricTotals>((acc, dayOfWeek) => {
      const cell = map.get(`${dayOfWeek}:${hour}`);
      return cell ? addMetricTotals(acc, cell) : acc;
    }, emptyMetricTotals()),
  );

  const everyAvg = everyCells.reduce<MetricTotals>(
    (acc, cell) => addMetricTotals(acc, cell),
    emptyMetricTotals(),
  );

  return [
    {
      key: "every",
      label: "Every Day",
      kind: "every",
      cells: everyCells.map((cell) =>
        cell.impressions > 0 || cell.spendMicros > 0 ? cell : null,
      ),
      avg: everyAvg,
    },
    ...dayRows,
  ];
}

function findBestDay(
  rows: GridRow[],
  metric: DaysHoursMetric,
): { label: string; value: number } | null {
  let best: { label: string; value: number } | null = null;
  for (const row of rows) {
    if (row.kind !== "day") continue;
    const value = metricValueFromTotals(row.avg, metric);
    if (value === null) continue;
    if (!best || value > best.value) {
      best = { label: row.label, value };
    }
  }
  return best;
}

function findBestHour(
  everyRow: GridRow | undefined,
  metric: DaysHoursMetric,
): { label: string; value: number } | null {
  if (!everyRow) return null;
  let best: { label: string; value: number } | null = null;
  for (let hour = 0; hour < everyRow.cells.length; hour += 1) {
    const cell = everyRow.cells[hour];
    if (!cell) continue;
    const value = metricValueFromTotals(cell, metric);
    if (value === null) continue;
    if (!best || value > best.value) {
      best = { label: formatHourLabel(hour), value };
    }
  }
  return best;
}

function maxMetricAcrossRows(rows: GridRow[], metric: DaysHoursMetric): number {
  let max = 0;
  for (const row of rows) {
    for (const cell of row.cells) {
      if (!cell) continue;
      const value = metricValueFromTotals(cell, metric);
      if (value !== null && value > max) max = value;
    }
  }
  return max > 0 ? max : 1;
}

function HeatCell({
  totals,
  metric,
  maxValue,
  barClassName,
}: {
  totals: MetricTotals | null;
  metric: DaysHoursMetric;
  maxValue: number;
  barClassName: string;
}) {
  const value = totals ? metricValueFromTotals(totals, metric) : null;
  const heightPct =
    value !== null && maxValue > 0
      ? Math.max(8, Math.min(100, (value / maxValue) * 100))
      : 0;

  return (
    <div
      className="flex h-9 items-end justify-center rounded-[3px] bg-neutral-100/90 px-0.5 pb-0.5"
      title={
        value !== null
          ? formatDaysHoursMetricValue(value, metric)
          : "No data"
      }
    >
      {heightPct > 0 ? (
        <div
          className={cn("w-full max-w-[10px] rounded-[2px]", barClassName)}
          style={{ height: `${heightPct}%` }}
        />
      ) : null}
    </div>
  );
}

export function DaysHoursHeatmap({ data, className }: DaysHoursHeatmapProps) {
  const [metric, setMetric] = React.useState<DaysHoursMetric>("roas");

  const rows = React.useMemo(() => buildRows(data), [data]);
  const everyRow = rows.find((row) => row.kind === "every");
  const maxValue = React.useMemo(
    () => maxMetricAcrossRows(rows, metric),
    [rows, metric],
  );
  const bestDay = React.useMemo(
    () => findBestDay(rows, metric),
    [rows, metric],
  );
  const bestHour = React.useMemo(
    () => findBestHour(everyRow, metric),
    [everyRow, metric],
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionLabel>Days & Hours</SectionLabel>
        <SegmentToggle
          aria-label="Days and hours metric"
          value={metric}
          onChange={setMetric}
          options={DAYS_HOURS_METRIC_OPTIONS}
        />
      </div>

      {data.hasData ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-4 py-3">
            <CalendarDays className="h-4 w-4 text-[var(--kenoo-blue)]" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Most popular day
              </p>
              <p className="mt-0.5 text-sm font-medium text-neutral-900">
                {bestDay
                  ? `${bestDay.label} · ${formatDaysHoursMetricValue(bestDay.value, metric)}`
                  : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-4 py-3">
            <Clock3 className="h-4 w-4 text-[#7a04eb]" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Most popular time of day
              </p>
              <p className="mt-0.5 text-sm font-medium text-neutral-900">
                {bestHour
                  ? `${bestHour.label} · ${formatDaysHoursMetricValue(bestHour.value, metric)}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!data.hasData ? (
        <p className="text-sm font-light text-neutral-400">
          Hourly performance will appear here after the next Meta sync.
        </p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[920px]">
            <div
              className="mb-1.5 grid gap-1"
              style={{
                gridTemplateColumns: `4.5rem repeat(24, minmax(0, 1fr)) 3.25rem`,
              }}
            >
              <div />
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="text-center text-[9px] font-light tabular-nums text-neutral-400"
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
              <div className="text-center text-[9px] font-medium uppercase tracking-wide text-neutral-500">
                Avg
              </div>
            </div>

            <div className="space-y-1">
              {rows.map((row) => {
                const avgValue = metricValueFromTotals(row.avg, metric);
                const barClassName =
                  row.kind === "every" ? "bg-[var(--kenoo-sky)]" : "bg-[#9b7cff]";

                return (
                  <div
                    key={row.key}
                    className="grid items-center gap-1"
                    style={{
                      gridTemplateColumns: `4.5rem repeat(24, minmax(0, 1fr)) 3.25rem`,
                    }}
                  >
                    <div
                      className={cn(
                        "truncate text-[11px] font-light text-neutral-600",
                        row.kind === "every" && "font-medium text-neutral-800",
                      )}
                    >
                      {row.label}
                    </div>
                    {row.cells.map((cell, hour) => (
                      <HeatCell
                        key={`${row.key}-${hour}`}
                        totals={cell}
                        metric={metric}
                        maxValue={maxValue}
                        barClassName={barClassName}
                      />
                    ))}
                    <div className="text-right text-[11px] font-medium tabular-nums text-neutral-700">
                      {formatDaysHoursMetricValue(avgValue, metric)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
