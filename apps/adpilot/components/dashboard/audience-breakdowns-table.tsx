"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Mars,
  Venus,
} from "lucide-react";
import { CircleFlag } from "react-circle-flags";

import { cn } from "@walls/utils";

import {
  AUDIENCE_BREAKDOWN_OPTIONS,
  formatAudienceBreakdownCpa,
  formatAudienceBreakdownCtr,
  formatAudienceBreakdownRoas,
  formatAudienceBreakdownSpend,
  type AudienceBreakdownRow,
  type AudienceBreakdownsAnalytics,
  type AudienceBreakdownType,
} from "@/lib/audience-breakdowns";
import {
  formatCompactNumber,
  formatResultCount,
} from "@/lib/format-analytics";

import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import { SegmentToggle } from "@/components/ui/segment-toggle";
import { SectionLabel, panelGlassClass } from "./dashboard-metrics";

const PAGE_SIZE = 10;

function normalizeGender(gender: string | null): "male" | "female" | null {
  const value = gender?.trim().toLowerCase();
  if (value === "male") return "male";
  if (value === "female") return "female";
  return null;
}

function isIsoCountryCode(country: string | null): country is string {
  return Boolean(country && /^[A-Za-z]{2}$/.test(country.trim()));
}

function SegmentCell({ row }: { row: AudienceBreakdownRow }) {
  const gender = normalizeGender(row.gender);
  const countryCode = isIsoCountryCode(row.country)
    ? row.country.trim().toLowerCase()
    : null;

  return (
    <span className="inline-flex items-center gap-2">
      {gender === "male" ? (
        <Mars
          className="h-3.5 w-3.5 shrink-0 text-sky-600"
          strokeWidth={2}
          aria-hidden
        />
      ) : null}
      {gender === "female" ? (
        <Venus
          className="h-3.5 w-3.5 shrink-0 text-rose-500"
          strokeWidth={2}
          aria-hidden
        />
      ) : null}
      {countryCode ? (
        <CircleFlag
          countryCode={countryCode}
          height="20"
          title={`${countryCode.toUpperCase()} flag`}
          className="h-5 w-5 shrink-0"
        />
      ) : null}
      <span>{row.label}</span>
    </span>
  );
}

const COLUMNS = [
  { id: "segment", label: "Segment", align: "left" as const },
  { id: "spend", label: "Spend", align: "right" as const },
  { id: "purchases", label: "Purchases", align: "right" as const },
  { id: "cpa", label: "CPA", align: "right" as const },
  { id: "ctr", label: "CTR", align: "right" as const },
  { id: "roas", label: "ROAS", align: "right" as const },
  { id: "impressions", label: "Impressions", align: "right" as const },
] as const;

type SortColumnId = (typeof COLUMNS)[number]["id"];
type SortDirection = "asc" | "desc";

type AudienceBreakdownsTableProps = {
  data: AudienceBreakdownsAnalytics;
  className?: string;
};

function sortValue(
  row: AudienceBreakdownRow,
  column: SortColumnId,
): string | number | null {
  switch (column) {
    case "segment":
      return row.label.toLowerCase();
    case "spend":
      return row.spendMicros;
    case "purchases":
      return row.websitePurchases;
    case "cpa":
      return row.cpaMicros;
    case "ctr":
      return row.ctr;
    case "roas":
      return row.roas;
    case "impressions":
      return row.impressions;
    default:
      return null;
  }
}

function compareRows(
  a: AudienceBreakdownRow,
  b: AudienceBreakdownRow,
  column: SortColumnId,
  direction: SortDirection,
): number {
  const aValue = sortValue(a, column);
  const bValue = sortValue(b, column);
  const nullRank = direction === "asc" ? 1 : -1;

  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return nullRank;
  if (bValue === null) return -nullRank;

  let result = 0;
  if (typeof aValue === "string" && typeof bValue === "string") {
    result = aValue.localeCompare(bValue);
  } else {
    result = Number(aValue) - Number(bValue);
  }

  if (result !== 0) {
    return direction === "asc" ? result : -result;
  }

  // Stable secondary sort by segment label.
  return a.label.localeCompare(b.label);
}

export function AudienceBreakdownsTable({
  data,
  className,
}: AudienceBreakdownsTableProps) {
  const [breakdownType, setBreakdownType] =
    React.useState<AudienceBreakdownType>("age");
  const [page, setPage] = React.useState(0);
  const [sortColumn, setSortColumn] = React.useState<SortColumnId>("roas");
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>("desc");

  React.useEffect(() => {
    setPage(0);
  }, [breakdownType, sortColumn, sortDirection]);

  const rows = React.useMemo(() => {
    const source = data.byType[breakdownType] ?? [];
    return [...source].sort((a, b) =>
      compareRows(a, b, sortColumn, sortDirection),
    );
  }, [data.byType, breakdownType, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const handleSort = (column: SortColumnId) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    // Metrics default high→low; segment defaults A→Z.
    setSortDirection(column === "segment" ? "asc" : "desc");
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel>Audience breakdowns</SectionLabel>
        </div>
        <SegmentToggle
          aria-label="Audience breakdown dimension"
          value={breakdownType}
          onChange={setBreakdownType}
          options={AUDIENCE_BREAKDOWN_OPTIONS}
        />
      </div>

      {!data.hasData || rows.length === 0 ? (
        <p
          className={cn(
            "rounded-xl px-4 py-10 text-center text-sm font-light text-neutral-400",
            panelGlassClass,
          )}
        >
          No demographic data yet. If you just synced and Meta hit a rate
          limit, wait a few minutes and sync again — age, gender, and country
          now pull first.
        </p>
      ) : (
        <>
          <div
            className={cn("overflow-x-auto rounded-xl", panelGlassClass)}
          >
            <table className="w-full min-w-[44rem] border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/70 bg-white/40">
                  {COLUMNS.map((column) => {
                    const active = sortColumn === column.id;
                    const SortIcon = !active
                      ? ChevronsUpDown
                      : sortDirection === "asc"
                        ? ChevronUp
                        : ChevronDown;

                    return (
                      <th
                        key={column.id}
                        scope="col"
                        aria-sort={
                          active
                            ? sortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={cn(
                          "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500",
                          column.align === "right" ? "text-right" : "text-left",
                          column.id === "segment" && "pl-4",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(column.id)}
                          className={cn(
                            "inline-flex items-center gap-1 border-0 bg-transparent p-0 font-medium uppercase tracking-wider transition-colors hover:text-neutral-800",
                            column.align === "right" && "flex-row-reverse",
                            active ? "text-neutral-800" : "text-neutral-500",
                          )}
                        >
                          <span>{column.label}</span>
                          <SortIcon
                            className={cn(
                              "h-3 w-3 shrink-0",
                              active ? "opacity-100" : "opacity-40",
                            )}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, index) => (
                  <motion.tr
                    key={row.key}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-neutral-100/80 last:border-b-0"
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-neutral-900">
                      <SegmentCell row={row} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-light tabular-nums text-neutral-700">
                      <AnimatedMetricValue
                        value={formatAudienceBreakdownSpend(row.spendMicros)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-light tabular-nums text-neutral-700">
                      <AnimatedMetricValue
                        value={formatResultCount(row.websitePurchases)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-light tabular-nums text-neutral-700">
                      <AnimatedMetricValue
                        value={formatAudienceBreakdownCpa(
                          row.spendMicros,
                          row.websitePurchases,
                        )}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-light tabular-nums text-neutral-700">
                      <AnimatedMetricValue
                        value={formatAudienceBreakdownCtr(row.ctr)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-neutral-900">
                      <AnimatedMetricValue
                        value={formatAudienceBreakdownRoas(row.roas)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-light tabular-nums text-neutral-700">
                      <AnimatedMetricValue
                        value={formatCompactNumber(row.impressions)}
                      />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > PAGE_SIZE ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
                className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[7rem] text-center text-xs font-light text-neutral-400 tabular-nums">
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages - 1, current + 1))
                }
                disabled={safePage >= totalPages - 1}
                aria-label="Next page"
                className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
