"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from '@walls/auth';
import { getSupabaseClient } from '@walls/auth';
import { LedgerEntry, LedgerFilters } from "../index/types";
import { motion } from "framer-motion";
import {
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from '@walls/ui/button';
import { cn } from '@walls/utils';
import { LedgerHeader } from "../ledger-header";

const ITEMS_PER_PAGE = 25;
const EXPORT_BATCH_SIZE = 1000;
const SEARCH_DEBOUNCE_MS = 400;
const SESSION_KEY = "ledger-transactions-state";

type PersistedState = {
  currentPage: number;
  filters: LedgerFilters;
  signFilter: TransactionSignFilter;
  scrollTop: number;
  entriesCacheKey?: string;
  entries?: LedgerEntry[];
  totalCount?: number;
  totalPages?: number;
};

function buildTransactionsCacheKey(opts: {
  page: number;
  debouncedSearchTerm: string;
  signFilter: TransactionSignFilter;
  typeFilter: string;
  dateFrom: string;
  dateTo: string;
}): string {
  return JSON.stringify({
    page: opts.page,
    debouncedSearchTerm: opts.debouncedSearchTerm.trim(),
    signFilter: opts.signFilter,
    typeFilter: opts.typeFilter,
    dateFrom: opts.dateFrom.trim(),
    dateTo: opts.dateTo.trim(),
  });
}

function readSession(): Partial<PersistedState> {
  try {
    const raw =
      typeof window !== "undefined"
        ? sessionStorage.getItem(SESSION_KEY)
        : null;
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : {};
  } catch {
    return {};
  }
}

function writeSession(patch: Partial<PersistedState>) {
  try {
    const current = readSession();
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...current, ...patch })
    );
  } catch {}
}

function escapeIlike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

interface WiseTransactionRow {
  id: string;
  wise_transaction_id: string;
  type: string;
  amount: number;
  currency: string;
  merchant_name: string | null;
  wise_created_at: string;
  raw?: { referenceNumber?: string; details?: { description?: string } };
  usd_amount?: number | null;
}

function wiseTransactionToLedgerEntry(row: WiseTransactionRow): LedgerEntry {
  const amount = Number(row.amount);
  const wiseType = (row.type || "").toUpperCase();
  let type: LedgerEntry["type"] = "payment";
  if (amount > 0) type = "income";
  else if (wiseType === "TRANSFER") type = "payout";
  else if (wiseType === "CARD") type = "payment";
  else if (wiseType === "CONVERSION" || wiseType.includes("FEE")) type = "fee";
  else type = "payout";

  const description =
    row.merchant_name ||
    (row.raw?.details?.description as string | undefined) ||
    `${row.type || "Transaction"} ${row.currency}`;
  const recipientOrPayer = row.merchant_name || "—";

  return {
    id: row.id,
    date: row.wise_created_at,
    type,
    description,
    recipientOrPayer,
    amount,
    currency: row.currency || "USD",
    status: "completed",
    source: "wise",
    reference: row.raw?.referenceNumber,
    createdAt: row.wise_created_at,
    sourceType: row.type ?? undefined,
    usd_amount: row.usd_amount ?? undefined,
  };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSourceType(sourceType?: string) {
  if (!sourceType) return "Transaction";
  return sourceType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Wise row `amount`: positive = inflow, negative = outflow */
type TransactionSignFilter = "" | "income" | "expenses";

const SIGN_FILTER_OPTIONS: { value: TransactionSignFilter; label: string }[] =
  [
    { value: "", label: "All transactions" },
    { value: "income", label: "Income" },
    { value: "expenses", label: "Expenses" },
  ];

const SIGN_FILTER_DOT: Record<Exclude<TransactionSignFilter, "">, string> = {
  income: "bg-lime-500",
  expenses: "bg-rose-500",
};

const WISE_TX_SELECT =
  "id, wise_transaction_id, type, amount, currency, merchant_name, wise_created_at, raw, usd_amount";

function buildFilteredWiseTransactionsQuery(
  supabase: ReturnType<typeof getSupabaseClient>,
  opts: {
    debouncedSearchTerm: string;
    signFilter: TransactionSignFilter;
    typeFilter: string;
    dateFrom: string;
    dateTo: string;
    withExactCount: boolean;
  }
) {
  const searchTerm = opts.debouncedSearchTerm.trim().toLowerCase();
  const dateFrom = opts.dateFrom.trim();
  const dateTo = opts.dateTo.trim();

  let query = supabase
    .from("wise_transactions")
    .select(WISE_TX_SELECT, opts.withExactCount ? { count: "exact" } : undefined)
    .order("wise_created_at", { ascending: false });

  if (searchTerm) {
    const pattern = `%${escapeIlike(searchTerm)}%`;
    query = query.ilike("merchant_name", pattern);
  }
  if (opts.signFilter === "income") query = query.gt("amount", 0);
  else if (opts.signFilter === "expenses") query = query.lt("amount", 0);

  const typeFilter = opts.typeFilter;
  if (typeFilter) {
    if (typeFilter === "income") query = query.gt("amount", 0);
    else if (typeFilter === "payout") query = query.eq("type", "TRANSFER");
    else if (typeFilter === "payment") query = query.eq("type", "CARD");
    else if (typeFilter === "fee")
      query = query.or("type.ilike.%FEE%,type.ilike.%CONVERSION%");
    else
      query = query.eq("type", typeFilter.toUpperCase().replace(/\s/g, "_"));
  }
  if (dateFrom)
    query = query.gte("wise_created_at", new Date(dateFrom).toISOString());
  if (dateTo)
    query = query.lte("wise_created_at", new Date(dateTo).toISOString());

  return query;
}

interface AgentsLedgerTransactionsProps {
  analyticsData?: unknown;
}

function AgentsLedgerTransactionsContent({
  analyticsData: _analyticsData,
}: AgentsLedgerTransactionsProps) {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;

  const [persisted] = useState<Partial<PersistedState>>(() => readSession());
  const initialCacheKey = buildTransactionsCacheKey({
    page: persisted.currentPage ?? 1,
    debouncedSearchTerm: persisted.filters?.searchTerm?.trim() ?? "",
    signFilter: persisted.signFilter ?? "",
    typeFilter: persisted.filters?.type ?? "",
    dateFrom: persisted.filters?.dateFrom ?? "",
    dateTo: persisted.filters?.dateTo ?? "",
  });
  const hasValidEntryCache =
    persisted.entriesCacheKey === initialCacheKey &&
    Array.isArray(persisted.entries);

  const [entries, setEntries] = useState<LedgerEntry[]>(
    hasValidEntryCache ? persisted.entries! : []
  );
  const [currentPage, setCurrentPage] = useState(persisted.currentPage ?? 1);
  const [totalPages, setTotalPages] = useState(
    hasValidEntryCache ? (persisted.totalPages ?? 1) : 1
  );
  const [loading, setLoading] = useState(!hasValidEntryCache);
  const [filters, setFilters] = useState<LedgerFilters>(
    persisted.filters ?? {
      searchTerm: "",
      type: "",
      status: "",
      source: "",
      dateFrom: "",
      dateTo: "",
    }
  );

  const [totalCount, setTotalCount] = useState(
    hasValidEntryCache ? (persisted.totalCount ?? 0) : 0
  );
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(
    persisted.filters?.searchTerm?.trim() ?? ""
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [signFilter, setSignFilter] = useState<TransactionSignFilter>(
    persisted.signFilter ?? ""
  );
  const [signFilterOpen, setSignFilterOpen] = useState(false);
  const signFilterRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const exportInFlightRef = useRef(false);
  const lastRefreshTriggerRef = useRef(0);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchTerm((prev) => {
        const next = filters.searchTerm.trim();
        return next !== prev ? next : prev;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters.searchTerm]);

  // Persist navigation state so it survives tab switches (component unmount/remount)
  useEffect(() => {
    writeSession({ currentPage, filters, signFilter });
  }, [currentPage, filters, signFilter]);

  // Save scroll position when leaving the page
  useEffect(() => {
    return () => {
      if (tableScrollRef.current) {
        writeSession({ scrollTop: tableScrollRef.current.scrollTop });
      }
    };
  }, []);

  // Restore scroll position after the first data load completes
  useEffect(() => {
    if (
      !loading &&
      !scrollRestoredRef.current &&
      persisted.scrollTop != null &&
      tableScrollRef.current
    ) {
      scrollRestoredRef.current = true;
      tableScrollRef.current.scrollTop = persisted.scrollTop;
    }
  }, [loading, persisted.scrollTop]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        signFilterRef.current &&
        !signFilterRef.current.contains(e.target as Node)
      ) {
        setSignFilterOpen(false);
      }
    }
    if (signFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [signFilterOpen]);

  const fetchPage = useCallback(
    async (page: number) => {
      if (!userId) return;
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const query = buildFilteredWiseTransactionsQuery(supabase, {
          debouncedSearchTerm,
          signFilter,
          typeFilter: filters.type,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          withExactCount: true,
        });

        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        const { data: rows, error, count } = await query.range(from, to);

        if (error) throw new Error(error.message);
        const list = (Array.isArray(rows) ? rows : []) as WiseTransactionRow[];
        const mapped = list.map(wiseTransactionToLedgerEntry);
        const nextTotalCount = count ?? 0;
        const nextTotalPages = Math.max(
          1,
          Math.ceil(nextTotalCount / ITEMS_PER_PAGE)
        );
        setEntries(mapped);
        setTotalCount(nextTotalCount);
        setTotalPages(nextTotalPages);
        writeSession({
          entriesCacheKey: buildTransactionsCacheKey({
            page,
            debouncedSearchTerm,
            signFilter,
            typeFilter: filters.type,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
          }),
          entries: mapped,
          totalCount: nextTotalCount,
          totalPages: nextTotalPages,
        });
      } catch {
        setEntries([]);
        setTotalCount(0);
        setTotalPages(1);
        writeSession({
          entriesCacheKey: undefined,
          entries: [],
          totalCount: 0,
          totalPages: 1,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      userId,
      debouncedSearchTerm,
      signFilter,
      filters.type,
      filters.dateFrom,
      filters.dateTo,
    ]
  );

  useEffect(() => {
    // Auth resolves asynchronously; avoid clearing cached rows or skipping
    // re-hydration while userId is still unknown.
    if (authLoading) return;

    if (!userId) {
      setEntries([]);
      setTotalCount(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    const cacheKey = buildTransactionsCacheKey({
      page: currentPage,
      debouncedSearchTerm,
      signFilter,
      typeFilter: filters.type,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    const isManualRefresh = refreshTrigger !== lastRefreshTriggerRef.current;
    lastRefreshTriggerRef.current = refreshTrigger;

    const session = readSession();
    if (
      !isManualRefresh &&
      session.entriesCacheKey === cacheKey &&
      Array.isArray(session.entries)
    ) {
      setEntries(session.entries);
      setTotalCount(session.totalCount ?? 0);
      setTotalPages(session.totalPages ?? 1);
      setLoading(false);
      return;
    }

    void fetchPage(currentPage);
  }, [
    authLoading,
    userId,
    currentPage,
    debouncedSearchTerm,
    filters.type,
    filters.dateFrom,
    filters.dateTo,
    signFilter,
    refreshTrigger,
    fetchPage,
  ]);

  const handleFilterChange = (key: keyof LedgerFilters, value: string) => {
    scrollRestoredRef.current = true; // don't restore scroll when user changes filters
    writeSession({ scrollTop: 0 });
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const selectSignFilter = (s: TransactionSignFilter) => {
    scrollRestoredRef.current = true;
    writeSession({ scrollTop: 0 });
    setSignFilter(s);
    setCurrentPage(1);
    setSignFilterOpen(false);
  };

  const signFilterTriggerLabel =
    SIGN_FILTER_OPTIONS.find((o) => o.value === signFilter)?.label ??
    "All transactions";

  const handleExportXlsx = useCallback(async () => {
    if (!userId || exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    setExporting(true);
    try {
      const supabase = getSupabaseClient();
      const allRows: WiseTransactionRow[] = [];
      let offset = 0;
      for (;;) {
        const query = buildFilteredWiseTransactionsQuery(supabase, {
          debouncedSearchTerm,
          signFilter,
          typeFilter: filters.type,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          withExactCount: false,
        });
        const { data: rows, error } = await query.range(
          offset,
          offset + EXPORT_BATCH_SIZE - 1
        );
        if (error) throw new Error(error.message);
        const batch = (Array.isArray(rows) ? rows : []) as WiseTransactionRow[];
        allRows.push(...batch);
        if (batch.length < EXPORT_BATCH_SIZE) break;
        offset += EXPORT_BATCH_SIZE;
      }

      const sheetRows = allRows.map((row) => {
        const e = wiseTransactionToLedgerEntry(row);
        return {
          Time: formatDateTime(e.date),
          Type: formatSourceType(e.sourceType),
          Category: e.type,
          "Recipient / Merchant": e.recipientOrPayer || "",
          Description: e.description || "",
          Amount: Number(e.amount),
          Currency: e.currency,
          "USD amount": e.usd_amount != null ? Number(e.usd_amount) : "",
          Reference: e.reference || "",
          "Wise transaction id": row.wise_transaction_id,
        };
      });

      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `walls-transactions-${stamp}.xlsx`);
    } catch (err) {
      console.error("[agents-ledger-transactions] export failed", err);
    } finally {
      exportInFlightRef.current = false;
      setExporting(false);
    }
  }, [
    userId,
    debouncedSearchTerm,
    signFilter,
    filters.type,
    filters.dateFrom,
    filters.dateTo,
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 w-full flex flex-col min-h-0">
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden pl-8 pr-4 md:pr-6">
          <div className="flex-shrink-0">
            <LedgerHeader />
          </div>

          <div className="flex flex-1 flex-col min-h-0">
            {/* Toolbar — stays above the scroll area */}
            <div className="flex flex-wrap items-center gap-3 mb-5 mt-4 flex-shrink-0">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="relative flex-1 max-w-sm min-w-0">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by merchant or recipient…"
                    value={filters.searchTerm}
                    onChange={(e) =>
                      handleFilterChange("searchTerm", e.target.value)
                    }
                    className={cn(
                      "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                      filters.searchTerm
                        ? "border-b-[var(--kenoo-sky)]"
                        : "border-neutral-200",
                      "focus:border-b-[var(--kenoo-sky)]"
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={!userId || exporting}
                  className={cn(
                    "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0",
                    exporting && "opacity-50"
                  )}
                  aria-label="Export transactions to spreadsheet"
                  aria-busy={exporting}
                  onClick={() => void handleExportXlsx()}
                >
                  <div className="relative">
                    <div
                      className={cn(
                        "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
                        "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95"
                      )}
                    >
                      <Download className="h-4 w-4 text-neutral-400" />
                    </div>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
                  onClick={() => setRefreshTrigger((r) => r + 1)}
                  aria-label="Refresh transactions"
                >
                  <div className="relative">
                    <div
                      className={cn(
                        "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
                        "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95"
                      )}
                    >
                      <RefreshCw className="h-4 w-4 text-neutral-400" />
                    </div>
                  </div>
                </Button>

                {/* Amount sign filter — same pattern as invoice status dropdown */}
                <div className="relative flex-shrink-0" ref={signFilterRef}>
                  <button
                    type="button"
                    onClick={() => setSignFilterOpen((o) => !o)}
                    className={cn(
                      "inline-flex items-center gap-1.5 min-w-0 max-w-[min(100%,18rem)] rounded-none border-0 bg-transparent p-0 shadow-none",
                      "text-sm font-light uppercase tracking-wider text-neutral-700",
                      "hover:text-neutral-900 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    )}
                    aria-expanded={signFilterOpen}
                    aria-haspopup="listbox"
                    aria-label="Filter by transaction direction"
                  >
                    {signFilter !== "" ? (
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full flex-shrink-0",
                          SIGN_FILTER_DOT[signFilter]
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <span className="truncate">{signFilterTriggerLabel}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                        signFilterOpen && "rotate-180"
                      )}
                      strokeWidth={1.8}
                    />
                  </button>

                  {signFilterOpen && (
                    <div
                      className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-white border border-neutral-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden"
                      role="listbox"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={signFilter === ""}
                        onClick={() => selectSignFilter("")}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                          signFilter === ""
                            ? "bg-neutral-100 text-neutral-900"
                            : "text-neutral-700 hover:bg-neutral-50"
                        )}
                      >
                        <span
                          className="w-2 flex justify-center flex-shrink-0"
                          aria-hidden
                        >
                          <span className="h-2 w-2 rounded-full bg-neutral-300" />
                        </span>
                        <span>All transactions</span>
                      </button>
                      <div className="border-t border-neutral-100 mt-1 pt-1">
                        {(
                          [
                            { value: "income" as const, label: "Income" },
                            { value: "expenses" as const, label: "Expenses" },
                          ] as const
                        ).map(({ value, label }) => (
                          <button
                            type="button"
                            key={value}
                            role="option"
                            aria-selected={signFilter === value}
                            onClick={() => selectSignFilter(value)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                              signFilter === value
                                ? "bg-neutral-100 text-neutral-900"
                                : "text-neutral-700 hover:bg-neutral-50"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full flex-shrink-0",
                                SIGN_FILTER_DOT[value]
                              )}
                              aria-hidden
                            />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!loading && totalCount > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-neutral-400 font-light whitespace-nowrap tabular-nums min-w-[7.5rem] text-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                    aria-label="Next page"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Table body scrolls; thead sticks within this region */}
            <div ref={tableScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-auto overscroll-none pb-8">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
                  <tr>
                    {[
                      "Time",
                      "Type",
                      "Recipient / Merchant",
                      "Description",
                      "Amount",
                      "Reference",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-neutral-50">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="py-4 pr-4">
                            <div className="h-4 rounded bg-neutral-100 animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-16 text-center text-neutral-400 font-light"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Banknote className="h-7 w-7 text-neutral-300" />
                          <span>No transactions found.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, i) => (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.015 }}
                        className="border-b border-neutral-50 hover:bg-neutral-50/60 transition-colors"
                      >
                        <td className="py-4 pr-4 text-neutral-400 whitespace-nowrap text-xs font-light">
                          {formatDateTime(entry.date)}
                        </td>
                        <td className="py-4 pr-4 text-xs">
                          <span className="text-neutral-500 text-xs font-light">
                            {formatSourceType(entry.sourceType)}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-neutral-600 text-xs max-w-[200px] truncate font-light">
                          {entry.recipientOrPayer || (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-neutral-500 text-xs max-w-[240px] truncate font-light">
                          {entry.description || (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-xs whitespace-nowrap">
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              entry.amount < 0
                                ? "text-neutral-700"
                                : "text-lime-500"
                            )}
                          >
                            {entry.amount < 0 ? "-" : "+"}
                            {Math.abs(Number(entry.amount)).toFixed(2)}{" "}
                            <span className="text-neutral-400 font-light">
                              {entry.currency}
                            </span>
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-neutral-400 text-xs max-w-[160px] truncate font-light">
                          {entry.reference || (
                            <span className="text-neutral-300">—</span>
                          )}
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
    </div>
  );
}

export default function AgentsLedgerTransactions(
  props: AgentsLedgerTransactionsProps
) {
  return <AgentsLedgerTransactionsContent {...props} />;
}
