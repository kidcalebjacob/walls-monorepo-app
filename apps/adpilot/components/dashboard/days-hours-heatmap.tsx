"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";

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
const HOUR_TICK_SET = new Set([0, 6, 12, 18]);

/** Heat scale — peaks in hot red, not black. */
const HEAT_STOPS = [
  { t: 0, color: [253, 244, 236] }, // near-white peach
  { t: 0.28, color: [255, 196, 140] }, // soft amber
  { t: 0.55, color: [255, 140, 66] }, // orange
  { t: 0.78, color: [240, 78, 35] }, // hot coral
  { t: 1, color: [220, 38, 38] }, // vivid red
] as const;

type HeatStop = (typeof HEAT_STOPS)[number];

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

type HoveredCell = {
  rowKey: string;
  hour: number;
  dayLabel: string;
  value: number | null;
  intensity: number;
  isPeak: boolean;
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
      label: "Every day",
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
): { label: string; value: number; hour: number } | null {
  if (!everyRow) return null;
  let best: { label: string; value: number; hour: number } | null = null;
  for (let hour = 0; hour < everyRow.cells.length; hour += 1) {
    const cell = everyRow.cells[hour];
    if (!cell) continue;
    const value = metricValueFromTotals(cell, metric);
    if (value === null) continue;
    if (!best || value > best.value) {
      best = { label: formatHourLabel(hour), value, hour };
    }
  }
  return best;
}

function findPeakCell(
  rows: GridRow[],
  metric: DaysHoursMetric,
): { rowKey: string; hour: number } | null {
  let best: { rowKey: string; hour: number; value: number } | null = null;
  for (const row of rows) {
    if (row.kind !== "day") continue;
    for (let hour = 0; hour < row.cells.length; hour += 1) {
      const cell = row.cells[hour];
      if (!cell) continue;
      const value = metricValueFromTotals(cell, metric);
      if (value === null) continue;
      if (!best || value > best.value) {
        best = { rowKey: row.key, hour, value };
      }
    }
  }
  return best ? { rowKey: best.rowKey, hour: best.hour } : null;
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

function heatIntensity(value: number | null, maxValue: number): number {
  if (value === null || maxValue <= 0) return 0;
  const t = Math.min(1, Math.max(0, value / maxValue));
  return Math.pow(t, 0.72);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function heatBackground(intensity: number): string {
  if (intensity <= 0) return "rgb(245 245 245)";

  let lower: HeatStop = HEAT_STOPS[0];
  let upper: HeatStop = HEAT_STOPS[HEAT_STOPS.length - 1];
  for (let i = 0; i < HEAT_STOPS.length - 1; i += 1) {
    if (intensity >= HEAT_STOPS[i].t && intensity <= HEAT_STOPS[i + 1].t) {
      lower = HEAT_STOPS[i];
      upper = HEAT_STOPS[i + 1];
      break;
    }
  }

  const span = upper.t - lower.t || 1;
  const local = (intensity - lower.t) / span;
  const r = Math.round(lerp(lower.color[0], upper.color[0], local));
  const g = Math.round(lerp(lower.color[1], upper.color[1], local));
  const b = Math.round(lerp(lower.color[2], upper.color[2], local));
  return `rgb(${r} ${g} ${b})`;
}

function formatHourTick(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

function InsightPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium tracking-tight text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function HeatCell({
  totals,
  metric,
  maxValue,
  isPeak,
  isHovered,
  onHover,
  onLeave,
}: {
  totals: MetricTotals | null;
  metric: DaysHoursMetric;
  maxValue: number;
  isPeak: boolean;
  isHovered: boolean;
  onHover: (intensity: number, value: number | null) => void;
  onLeave: () => void;
}) {
  const value = totals ? metricValueFromTotals(totals, metric) : null;
  const intensity = heatIntensity(value, maxValue);
  const hasData = intensity > 0;

  return (
    <button
      type="button"
      tabIndex={hasData ? 0 : -1}
      aria-label={
        value !== null
          ? formatDaysHoursMetricValue(value, metric)
          : "No data"
      }
      onMouseEnter={() => onHover(intensity, value)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(intensity, value)}
      onBlur={onLeave}
      className={cn(
        "relative h-4 w-full rounded-full transition-[transform,filter,opacity] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/45 focus-visible:ring-offset-1",
        hasData ? "cursor-pointer" : "cursor-default opacity-70",
        isHovered && hasData && "z-10 scale-y-[1.45]",
      )}
      style={{
        background: heatBackground(intensity),
        filter: isHovered && hasData ? "saturate(1.15) brightness(1.05)" : undefined,
      }}
    >
      {isPeak ? (
        <Crown
          className="pointer-events-none absolute inset-0 m-auto h-2.5 w-2.5 text-white/55 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]"
          strokeWidth={2.5}
          aria-hidden
        />
      ) : null}
    </button>
  );
}

export function DaysHoursHeatmap({ data, className }: DaysHoursHeatmapProps) {
  const [metric, setMetric] = React.useState<DaysHoursMetric>("roas");
  const [hovered, setHovered] = React.useState<HoveredCell | null>(null);

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
  const peakCell = React.useMemo(
    () => findPeakCell(rows, metric),
    [rows, metric],
  );

  const metricLabel =
    DAYS_HOURS_METRIC_OPTIONS.find((option) => option.value === metric)?.label ??
    metric.toUpperCase();

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel>Days & Hours</SectionLabel>
          <p className="-mt-2 text-sm font-light text-neutral-500">
            When {metricLabel} tends to peak across the week
          </p>
        </div>
        <SegmentToggle
          aria-label="Days and hours metric"
          value={metric}
          onChange={(next) => {
            setHovered(null);
            setMetric(next);
          }}
          options={DAYS_HOURS_METRIC_OPTIONS}
        />
      </div>

      {!data.hasData ? (
        <p className="text-sm font-light text-neutral-400">
          Hourly performance will appear here after the next Meta sync.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 border-y border-neutral-200/70 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <InsightPill
              label="Strongest day"
              value={
                bestDay
                  ? `${bestDay.label} · ${formatDaysHoursMetricValue(bestDay.value, metric)}`
                  : "—"
              }
            />
            <div className="hidden h-8 w-px bg-neutral-200/80 sm:block" />
            <InsightPill
              label="Strongest hour"
              value={
                bestHour
                  ? `${bestHour.label} · ${formatDaysHoursMetricValue(bestHour.value, metric)}`
                  : "—"
              }
            />
            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Low
              </span>
              <div
                className="h-2 w-28 overflow-hidden rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #fdf4ec, #ffc48c, #ff8c42, #f04e23, #dc2626)",
                }}
              />
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                High
              </span>
            </div>
          </div>

          <div className="relative overflow-x-auto pb-1">
            <AnimatePresence>
              {hovered ? (
                <motion.div
                  key={`${hovered.rowKey}-${hovered.hour}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 2 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none absolute right-0 top-0 z-20 hidden rounded-lg border border-neutral-500/80 bg-neutral-700 px-3 py-2.5 shadow-lg sm:block"
                >
                  <p className="text-xs font-light text-neutral-300">
                    {hovered.dayLabel} · {formatHourLabel(hovered.hour)}
                  </p>
                  <p className="mt-1 text-sm font-medium tabular-nums text-white">
                    {formatDaysHoursMetricValue(hovered.value, metric)}
                    <span className="ml-1.5 text-xs font-light text-neutral-400">
                      {metricLabel}
                    </span>
                  </p>
                  {hovered.isPeak ? (
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-orange-300">
                      Peak slot
                    </p>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <motion.div
              key={metric}
              initial={{ opacity: 0.55 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.28 }}
              className="min-w-[720px]"
            >
              <div
                className="mb-2.5 grid items-end gap-1.5"
                style={{
                  gridTemplateColumns: `3.75rem repeat(24, minmax(0, 1fr)) 3.5rem`,
                }}
              >
                <div />
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="text-center text-[9px] font-light tabular-nums text-neutral-400"
                  >
                    {HOUR_TICK_SET.has(hour) ? formatHourTick(hour) : ""}
                  </div>
                ))}
                <div className="pb-0.5 text-right text-[9px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                  Avg
                </div>
              </div>

              <div className="space-y-2.5">
                {rows.map((row, rowIndex) => {
                  const avgValue = metricValueFromTotals(row.avg, metric);

                  return (
                    <motion.div
                      key={row.key}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: rowIndex * 0.03, duration: 0.28 }}
                      className={cn(
                        "grid items-center gap-1.5",
                        row.kind === "every" && "mb-1.5 pb-3",
                      )}
                      style={{
                        gridTemplateColumns: `3.75rem repeat(24, minmax(0, 1fr)) 3.5rem`,
                      }}
                    >
                      <div
                        className={cn(
                          "truncate text-[11px] font-light text-neutral-500",
                          row.kind === "every" && "font-medium text-neutral-800",
                        )}
                      >
                        {row.label}
                      </div>
                      {row.cells.map((cell, hour) => {
                        const isPeak =
                          peakCell?.rowKey === row.key && peakCell.hour === hour;
                        const isHovered =
                          hovered?.rowKey === row.key && hovered.hour === hour;

                        return (
                          <HeatCell
                            key={`${row.key}-${hour}`}
                            totals={cell}
                            metric={metric}
                            maxValue={maxValue}
                            isPeak={isPeak}
                            isHovered={isHovered}
                            onHover={(intensity, value) =>
                              setHovered({
                                rowKey: row.key,
                                hour,
                                dayLabel: row.label,
                                value,
                                intensity,
                                isPeak,
                              })
                            }
                            onLeave={() => setHovered(null)}
                          />
                        );
                      })}
                      <div
                        className={cn(
                          "text-right text-[11px] tabular-nums",
                          row.kind === "every"
                            ? "font-semibold text-neutral-900"
                            : "font-medium text-neutral-600",
                        )}
                      >
                        {formatDaysHoursMetricValue(avgValue, metric)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
