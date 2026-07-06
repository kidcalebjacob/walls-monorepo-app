"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Megaphone,
  Search,
  Shapes,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import { cn } from "@walls/utils";

import type {
  CampaignAccountOption,
  CampaignEntityType,
  EntityPerformanceRow,
} from "@/lib/campaigns-server";
import {
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatPercent,
  formatRoas,
} from "@/lib/format-analytics";

import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import { SectionLabel } from "@/components/dashboard/dashboard-metrics";

const PAGE_SIZE = 25;

const ENTITY_TABS: Array<{
  value: CampaignEntityType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "campaign", label: "Campaigns", icon: Megaphone },
  { value: "ad_group", label: "Ad sets", icon: Layers },
  { value: "ad", label: "Ads", icon: Shapes },
];

function formatStatus(status: string | null) {
  if (!status) return "—";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getColumns(entityType: CampaignEntityType) {
  const base = [
    "Name",
    entityType === "campaign" ? "Objective" : "Parent",
    "Account",
    "Status",
    "Spend",
    "Impressions",
    "Clicks",
    "CTR",
    "ROAS",
  ];
  return base;
}

export function CampaignsPage() {
  const [entityType, setEntityType] = React.useState<CampaignEntityType>("campaign");
  const [rows, setRows] = React.useState<EntityPerformanceRow[]>([]);
  const [accounts, setAccounts] = React.useState<CampaignAccountOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [accountFilter, setAccountFilter] = React.useState("");
  const [accountFilterOpen, setAccountFilterOpen] = React.useState(false);
  const accountFilterRef = React.useRef<HTMLDivElement>(null);

  const columns = getColumns(entityType);
  const colCount = columns.length;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: entityType,
        page: String(page),
      });
      if (search.trim()) params.set("search", search.trim());
      if (accountFilter) params.set("accountId", accountFilter);

      const response = await fetch(`/api/campaigns?${params.toString()}`);
      if (!response.ok) return;

      const payload = (await response.json()) as {
        rows?: EntityPerformanceRow[];
        totalCount?: number;
        accounts?: CampaignAccountOption[];
        syncing?: boolean;
      };

      setRows(payload.rows ?? []);
      setTotalCount(payload.totalCount ?? 0);
      setAccounts(payload.accounts ?? []);
      setSyncing(payload.syncing ?? false);
    } finally {
      setLoading(false);
    }
  }, [accountFilter, entityType, page, search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(0);
  }, [search, accountFilter, entityType]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountFilterRef.current &&
        !accountFilterRef.current.contains(event.target as Node)
      ) {
        setAccountFilterOpen(false);
      }
    }

    if (accountFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountFilterOpen]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedAccountLabel = accountFilter
    ? (accounts.find((account) => account.id === accountFilter)?.name ?? "Account")
    : "All accounts";

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <div className="flex flex-1 flex-col px-6 py-8 md:px-10 md:py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              Manage
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
              Campaigns
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-light text-neutral-500">
              {syncing
                ? "Syncing from Meta. New campaigns and ads will appear as data arrives."
                : "Browse campaign, ad set, and ad performance from your connected Meta accounts."}
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 self-start rounded-full font-light text-neutral-600 hover:bg-neutral-200/60 sm:self-auto"
          >
            <Link href="/settings">Manage connections</Link>
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {ENTITY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = entityType === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setEntityType(tab.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-light uppercase tracking-wider transition-colors",
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-200/70",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
            <div className="relative min-w-0 max-w-sm flex-1">
              <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by name, account, status…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={cn(
                  "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-3 text-sm font-light transition-colors placeholder:text-neutral-300 focus:outline-none",
                  search ? "border-b-[var(--walls-sky)]" : "border-neutral-200",
                  "focus:border-b-[var(--walls-sky)]",
                )}
              />
            </div>

            {accounts.length > 0 ? (
              <div className="relative flex-shrink-0" ref={accountFilterRef}>
                <button
                  type="button"
                  onClick={() => setAccountFilterOpen((open) => !open)}
                  className={cn(
                    "inline-flex max-w-[min(100%,18rem)] min-w-0 items-center gap-1.5 rounded-none border-0 bg-transparent p-0 text-sm font-light uppercase tracking-wider text-neutral-700 shadow-none transition-colors hover:text-neutral-900",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2",
                  )}
                  aria-expanded={accountFilterOpen}
                  aria-haspopup="listbox"
                >
                  {accountFilter ? (
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--walls-sky)]"
                      aria-hidden
                    />
                  ) : null}
                  <span className="truncate">{selectedAccountLabel}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                      accountFilterOpen && "rotate-180",
                    )}
                    strokeWidth={1.8}
                  />
                </button>

                {accountFilterOpen ? (
                  <div
                    className="absolute top-full left-0 z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
                    role="listbox"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={accountFilter === ""}
                      onClick={() => {
                        setAccountFilter("");
                        setAccountFilterOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                        accountFilter === ""
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-50",
                      )}
                    >
                      <span className="flex w-2 flex-shrink-0 justify-center" aria-hidden>
                        <span className="h-2 w-2 rounded-full bg-neutral-300" />
                      </span>
                      <span>All accounts</span>
                    </button>
                    <div className="mt-1 border-t border-neutral-100 pt-1">
                      {accounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          role="option"
                          aria-selected={accountFilter === account.id}
                          onClick={() => {
                            setAccountFilter(account.id);
                            setAccountFilterOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                            accountFilter === account.id
                              ? "bg-neutral-100 text-neutral-900"
                              : "text-neutral-700 hover:bg-neutral-50",
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 flex-shrink-0 rounded-full",
                              accountFilter === account.id
                                ? "bg-[var(--walls-sky)]"
                                : "bg-neutral-200",
                            )}
                            aria-hidden
                          />
                          <span className="truncate">{account.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
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

        <SectionLabel>Performance — Last 30 days</SectionLabel>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto pb-8">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="bg-gray-50 pr-4 pb-3 text-left text-xs font-medium tracking-wide whitespace-nowrap text-neutral-400 uppercase"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-neutral-50">
                    {Array.from({ length: colCount }).map((__, colIndex) => (
                      <td key={colIndex} className="py-4 pr-4">
                        <div className="h-4 animate-pulse rounded bg-neutral-200/80" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="py-16 text-center text-sm font-light text-neutral-400"
                  >
                    {accounts.length === 0
                      ? "Connect Meta in Settings to sync campaigns and ads."
                      : `No ${ENTITY_TABS.find((tab) => tab.value === entityType)?.label.toLowerCase()} found.`}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.015 }}
                    className="border-b border-neutral-50 transition-colors hover:bg-neutral-50/60"
                  >
                    <td className="max-w-[220px] py-4 pr-4">
                      <p className="truncate text-sm font-medium text-neutral-800">
                        {row.name}
                      </p>
                    </td>
                    <td className="max-w-[180px] py-4 pr-4 text-xs font-light text-neutral-500">
                      <span className="block truncate">
                        {entityType === "campaign"
                          ? (row.objective ?? "—")
                          : (row.parentName ?? "—")}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500">
                      {row.accountName}
                    </td>
                    <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500">
                      {formatStatus(row.status)}
                    </td>
                    <td className="py-4 pr-4 text-xs font-medium whitespace-nowrap text-neutral-800 tabular-nums">
                      <AnimatedMetricValue
                        value={formatCurrencyFromMicros(row.spendMicros)}
                      />
                    </td>
                    <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                      <AnimatedMetricValue
                        value={formatCompactNumber(row.impressions)}
                      />
                    </td>
                    <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                      <AnimatedMetricValue value={String(row.clicks)} />
                    </td>
                    <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                      <AnimatedMetricValue value={formatPercent(row.ctr)} />
                    </td>
                    <td className="py-4 pr-4 text-xs font-light whitespace-nowrap text-neutral-500 tabular-nums">
                      {formatRoas(row.roas)}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
