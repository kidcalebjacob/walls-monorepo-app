"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Search,
  Users,
} from "lucide-react";

import { cn } from "@walls/utils";

import type {
  AudiencePerformanceRow,
  AudienceSortColumn,
  AudienceSortDirection,
  AudienceTypeOption,
} from "@/lib/audiences-server";
import {
  formatAudienceOriginLabel,
  formatAudienceTypeLabel,
  type AdAudienceType,
} from "@/lib/audience-types";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatRoas,
} from "@/lib/format-analytics";
import { formatCpaFromMicros } from "@/lib/entity-daily-progress";

import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import { useResizableColumns } from "@/components/campaigns/use-resizable-columns";
import { MetaIcon } from "@/components/settings/meta-icon";
import { META_PROVIDER } from "@/lib/connections";

const PAGE_SIZE = 25;
const COLUMN_WIDTHS_STORAGE_KEY = "adpilot-audiences-column-widths";

const AUDIENCE_COLUMN_IDS = [
  "name",
  "platform",
  "type",
  "origin",
  "spend",
  "roas",
  "costPerAddToCart",
  "costPerPurchase",
  "audienceSize",
  "adSets",
] as const satisfies readonly AudienceSortColumn[];

type AudienceColumnId = (typeof AUDIENCE_COLUMN_IDS)[number];

const DEFAULT_AUDIENCE_COLUMN_WIDTHS: Record<AudienceColumnId, number> = {
  name: 280,
  platform: 88,
  type: 150,
  origin: 130,
  spend: 120,
  roas: 96,
  costPerAddToCart: 148,
  costPerPurchase: 140,
  audienceSize: 120,
  adSets: 88,
};

const TIME_RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

type AudienceTimeRange = (typeof TIME_RANGE_OPTIONS)[number]["value"];

const COLUMN_LABELS: Record<AudienceColumnId, string> = {
  name: "Audience name",
  platform: "Platform",
  type: "Type",
  origin: "Origin",
  spend: "Amount spent",
  roas: "ROAS (All)",
  costPerAddToCart: "Cost per Add to Cart",
  costPerPurchase: "Cost per Purchase",
  audienceSize: "Audience size",
  adSets: "Ad sets",
};

const TEXT_SORT_COLUMNS = new Set<AudienceColumnId>([
  "name",
  "platform",
  "type",
  "origin",
]);

function PlatformCell({ provider }: { provider: string }) {
  if (provider === META_PROVIDER) {
    return (
      <span className="inline-flex items-center" title="Meta">
        <MetaIcon className="h-4 w-4 shrink-0" />
        <span className="sr-only">Meta</span>
      </span>
    );
  }

  return (
    <span className="text-xs font-light capitalize text-neutral-500">
      {provider || "-"}
    </span>
  );
}

function formatAudienceSize(lower: number | null, upper: number | null): string {
  if (upper != null && Number.isFinite(upper) && upper > 0) {
    return formatCompactNumber(upper);
  }
  if (lower != null && Number.isFinite(lower) && lower > 0) {
    return formatCompactNumber(lower);
  }
  return "-";
}

function ResizableHeader({
  columnId,
  label,
  width,
  indented,
  sortColumn,
  sortDirection,
  onSort,
  onResizeStart,
}: {
  columnId: AudienceColumnId;
  label: string;
  width: number;
  indented?: boolean;
  sortColumn: AudienceColumnId;
  sortDirection: AudienceSortDirection;
  onSort: (columnId: AudienceColumnId) => void;
  onResizeStart: (columnId: AudienceColumnId, startX: number) => void;
}) {
  const active = sortColumn === columnId;
  const SortIcon = !active
    ? ChevronsUpDown
    : sortDirection === "asc"
      ? ChevronUp
      : ChevronDown;

  return (
    <th
      className={cn(
        "relative bg-kenoo-white py-3 pr-4 text-left text-xs font-medium tracking-wide whitespace-nowrap text-neutral-400 uppercase select-none",
        indented && "pl-3",
      )}
      style={{ width }}
      aria-sort={
        active
          ? sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(columnId)}
        className={cn(
          "inline-flex max-w-full items-center gap-1 border-0 bg-transparent p-0 pr-3 font-medium tracking-wide uppercase transition-colors hover:text-neutral-700",
          active ? "text-neutral-700" : "text-neutral-400",
        )}
      >
        <span className="truncate">{label}</span>
        <SortIcon
          className={cn(
            "h-3 w-3 shrink-0",
            active ? "opacity-100" : "opacity-40",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      <button
        type="button"
        aria-label={`Resize ${label} column`}
        className="absolute top-1/2 right-0 z-20 h-4 w-3 -translate-y-1/2 cursor-col-resize touch-none border-none bg-transparent p-0 after:absolute after:top-1/2 after:right-1 after:h-3.5 after:w-px after:-translate-y-1/2 after:bg-neutral-200 hover:after:bg-neutral-400"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onResizeStart(columnId, event.clientX);
        }}
      />
    </th>
  );
}

export function AudiencesPage() {
  const [rows, setRows] = React.useState<AudiencePerformanceRow[]>([]);
  const [types, setTypes] = React.useState<AudienceTypeOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<AdAudienceType | "">("");
  const [typeFilterOpen, setTypeFilterOpen] = React.useState(false);
  const typeFilterRef = React.useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = React.useState<AudienceTimeRange>("7d");
  const [timeRangeOpen, setTimeRangeOpen] = React.useState(false);
  const timeRangeRef = React.useRef<HTMLDivElement>(null);
  const [sortColumn, setSortColumn] =
    React.useState<AudienceColumnId>("spend");
  const [sortDirection, setSortDirection] =
    React.useState<AudienceSortDirection>("desc");
  const { widths, startResize, tableMinWidth } = useResizableColumns(
    DEFAULT_AUDIENCE_COLUMN_WIDTHS,
    COLUMN_WIDTHS_STORAGE_KEY,
  );

  const colCount = AUDIENCE_COLUMN_IDS.length;

  const handleSort = (columnId: AudienceColumnId) => {
    if (sortColumn === columnId) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(columnId);
    setSortDirection(TEXT_SORT_COLUMNS.has(columnId) ? "asc" : "desc");
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        range: timeRange,
        sort: sortColumn,
        dir: sortDirection,
      });
      if (search.trim()) params.set("search", search.trim());
      if (typeFilter) params.set("type", typeFilter);

      const response = await fetch(`/api/audiences?${params.toString()}`);
      if (!response.ok) return;

      const payload = (await response.json()) as {
        rows?: AudiencePerformanceRow[];
        totalCount?: number;
        types?: AudienceTypeOption[];
      };

      setRows(payload.rows ?? []);
      setTotalCount(payload.totalCount ?? 0);
      setTypes(payload.types ?? []);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortColumn, sortDirection, timeRange, typeFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(0);
  }, [search, typeFilter, timeRange, sortColumn, sortDirection]);

  React.useEffect(() => {
    if (typeFilter && !types.some((type) => type.value === typeFilter)) {
      setTypeFilter("");
    }
  }, [typeFilter, types]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        typeFilterRef.current &&
        !typeFilterRef.current.contains(event.target as Node)
      ) {
        setTypeFilterOpen(false);
      }
      if (
        timeRangeRef.current &&
        !timeRangeRef.current.contains(event.target as Node)
      ) {
        setTimeRangeOpen(false);
      }
    }

    if (typeFilterOpen || timeRangeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeFilterOpen, timeRangeOpen]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedTypeLabel = typeFilter
    ? (types.find((type) => type.value === typeFilter)?.label ??
      formatAudienceTypeLabel(typeFilter))
    : "All types";
  const selectedTimeRangeLabel =
    TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.label ??
    "Last 7 days";

  return (
    <div className="flex h-full min-h-0 flex-col bg-kenoo-white">
      <div className="flex min-h-0 flex-1 flex-col px-6 pt-8 pb-6 md:px-10 md:pt-10">
        <div className="mb-6 shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-neutral-400" strokeWidth={1.5} />
            <h1 className="text-xl font-light tracking-tight text-neutral-900">
              Audiences
            </h1>
          </div>
          <p className="mt-1.5 text-sm font-light text-neutral-500">
            Explore Meta lookalikes, interests, and custom audiences by performance.
          </p>
        </div>

        <div className="mb-5 flex shrink-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
            <div className="relative min-w-0 max-w-sm flex-1">
              <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by audience name"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={cn(
                  "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-3 text-sm font-light transition-colors placeholder:text-neutral-300 focus:outline-none",
                  search ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                  "focus:border-b-[var(--kenoo-sky)]",
                )}
              />
            </div>

            <div className="relative flex-shrink-0" ref={typeFilterRef}>
              <button
                type="button"
                onClick={() => setTypeFilterOpen((open) => !open)}
                className={cn(
                  "inline-flex max-w-[min(100%,18rem)] min-w-0 items-center gap-1.5 rounded-none border-0 bg-transparent p-0 text-sm font-light uppercase tracking-wider text-neutral-700 shadow-none transition-colors hover:text-neutral-900",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2",
                )}
                aria-expanded={typeFilterOpen}
                aria-haspopup="listbox"
              >
                {typeFilter ? (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--kenoo-sky)]"
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{selectedTypeLabel}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                    typeFilterOpen && "rotate-180",
                  )}
                  strokeWidth={1.8}
                />
              </button>

              {typeFilterOpen ? (
                <div
                  className="absolute top-full left-0 z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
                  role="listbox"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={typeFilter === ""}
                    onClick={() => {
                      setTypeFilter("");
                      setTypeFilterOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                      typeFilter === ""
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-700 hover:bg-neutral-50",
                    )}
                  >
                    <span className="flex w-2 flex-shrink-0 justify-center" aria-hidden>
                      <span className="h-2 w-2 rounded-full bg-neutral-300" />
                    </span>
                    <span>All types</span>
                  </button>
                  {types.length > 0 ? (
                    <div className="mt-1 border-t border-neutral-100 pt-1">
                      {types.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          role="option"
                          aria-selected={typeFilter === type.value}
                          onClick={() => {
                            setTypeFilter(type.value);
                            setTypeFilterOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                            typeFilter === type.value
                              ? "bg-neutral-100 text-neutral-900"
                              : "text-neutral-700 hover:bg-neutral-50",
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 flex-shrink-0 rounded-full",
                              typeFilter === type.value
                                ? "bg-[var(--kenoo-sky)]"
                                : "bg-neutral-200",
                            )}
                            aria-hidden
                          />
                          <span className="truncate">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="relative flex-shrink-0" ref={timeRangeRef}>
              <button
                type="button"
                onClick={() => setTimeRangeOpen((open) => !open)}
                className={cn(
                  "inline-flex max-w-[min(100%,18rem)] min-w-0 items-center gap-1.5 rounded-none border-0 bg-transparent p-0 text-sm font-light uppercase tracking-wider text-neutral-700 shadow-none transition-colors hover:text-neutral-900",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2",
                )}
                aria-expanded={timeRangeOpen}
                aria-haspopup="listbox"
              >
                <span className="truncate">{selectedTimeRangeLabel}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                    timeRangeOpen && "rotate-180",
                  )}
                  strokeWidth={1.8}
                />
              </button>

              {timeRangeOpen ? (
                <div
                  className="absolute top-full left-0 z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
                  role="listbox"
                >
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={timeRange === option.value}
                      onClick={() => {
                        setTimeRange(option.value);
                        setTimeRangeOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                        timeRange === option.value
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-50",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 flex-shrink-0 rounded-full",
                          timeRange === option.value
                            ? "bg-[var(--kenoo-sky)]"
                            : "bg-neutral-200",
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {!loading && totalCount > 0 ? (
            <div className="ml-auto flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
                aria-label="Previous page"
                className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[7.5rem] text-center text-xs font-light whitespace-nowrap text-neutral-400 tabular-nums">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages - 1, current + 1))
                }
                disabled={page >= totalPages - 1}
                aria-label="Next page"
                className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            <table
              className="table-fixed text-sm"
              style={{ width: tableMinWidth }}
            >
              <colgroup>
                {AUDIENCE_COLUMN_IDS.map((columnId) => (
                  <col key={columnId} style={{ width: widths[columnId] }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-kenoo-white">
                <tr>
                  {AUDIENCE_COLUMN_IDS.map((columnId) => (
                    <ResizableHeader
                      key={columnId}
                      columnId={columnId}
                      label={COLUMN_LABELS[columnId]}
                      width={widths[columnId]}
                      indented={columnId === "name"}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      onResizeStart={startResize}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={colCount}
                      className="px-3 py-16 text-center text-sm font-light text-neutral-400"
                    >
                      Loading audiences…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colCount}
                      className="px-3 py-16 text-center text-sm font-light text-neutral-400"
                    >
                      No audiences yet. Connect Meta and run a sync to pull lookalikes,
                      interests, and custom audiences from ad set targeting.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.22,
                        delay: Math.min(index * 0.02, 0.2),
                        ease: "easeOut",
                      }}
                      className="border-b border-neutral-100 transition-colors hover:bg-neutral-50/80"
                    >
                      <td className="overflow-hidden py-3 pr-4 pl-3 align-middle">
                        <div className="min-w-0">
                          <Link
                            href={`/audiences/${row.id}`}
                            className="block truncate text-sm font-medium text-neutral-800 transition-colors hover:text-[var(--kenoo-sky)]"
                          >
                            {row.name}
                          </Link>
                          {row.status ? (
                            <span className="mt-0.5 block truncate text-xs font-light text-neutral-400">
                              {row.isReady ? (
                                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--kenoo-sky)] align-middle" />
                              ) : null}
                              {row.status}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4 pl-3 align-middle">
                        <PlatformCell provider={row.provider} />
                      </td>
                      <td className="overflow-hidden py-3 pr-4 align-middle">
                        <span className="truncate text-sm font-light text-neutral-600">
                          {formatAudienceTypeLabel(row.audienceType)}
                        </span>
                      </td>
                      <td className="overflow-hidden py-3 pr-4 align-middle">
                        <span className="truncate text-sm font-light text-neutral-600">
                          {formatAudienceOriginLabel(row.originType)}
                        </span>
                      </td>
                      <td className="overflow-hidden py-3 pr-4 align-middle tabular-nums">
                        <AnimatedMetricValue
                          value={formatCurrencyFromMicros(row.spendMicros)}
                          className="text-sm font-light text-neutral-800"
                        />
                      </td>
                      <td className="overflow-hidden py-3 pr-4 align-middle tabular-nums">
                        <span className="text-sm font-light text-neutral-800">
                          {formatRoas(row.roas)}
                        </span>
                      </td>
                      <td className="overflow-hidden py-3 pr-4 align-middle tabular-nums">
                        <span className="text-sm font-light text-neutral-800">
                          {row.costPerAddToCartMicros != null
                            ? formatCurrencyFromMicros(row.costPerAddToCartMicros)
                            : "-"}
                        </span>
                      </td>
                      <td className="overflow-hidden py-3 pr-4 align-middle tabular-nums">
                        <span className="text-sm font-light text-neutral-800">
                          {row.costPerPurchaseMicros != null
                            ? formatCurrencyFromMicros(row.costPerPurchaseMicros)
                            : formatCpaFromMicros(
                                row.spendMicros,
                                row.websitePurchases,
                              )}
                        </span>
                      </td>
                      <td className="overflow-hidden py-3 pr-4 align-middle tabular-nums">
                        <span className="text-sm font-light text-neutral-800">
                          {formatAudienceSize(
                            row.approximateSizeLower,
                            row.approximateSizeUpper,
                          )}
                        </span>
                      </td>
                      <td className="overflow-hidden py-3 pr-4 align-middle tabular-nums">
                        <span className="text-sm font-light text-neutral-600">
                          {row.adSetCount > 0 ? row.adSetCount : "-"}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
