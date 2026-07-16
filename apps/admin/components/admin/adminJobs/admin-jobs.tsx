"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseClient } from "@/lib/auth";
import { motion } from "framer-motion";
import {
  BriefcaseIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  MoreVertical,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Job = {
  id: string;
  created_at: string;
  processed_at: string | null;
  triggered_at: string | null;
  status: string;
  type: string;
  payload: Record<string, unknown> | null;
};

const STATUS_OPTIONS = ["all", "pending", "processing", "completed", "failed"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const ITEMS_PER_PAGE = 25;

const STATUS_DOT: Record<Exclude<StatusFilter, "all">, string> = {
  pending: "bg-amber-500",
  processing: "bg-blue-500",
  completed: "bg-lime-500",
  failed: "bg-rose-500",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeSearch, setTypeSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const [activeMenuJobId, setActiveMenuJobId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [metadataJob, setMetadataJob] = useState<Job | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!activeMenuJobId) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuJobId(null);
        setMenuPosition(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuJobId]);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    try {
      const { data, error: fetchError } = await supabase
        .from("jobs")
        .select("id, created_at, processed_at, triggered_at, status, type, payload")
        .order("created_at", { ascending: false })
        .limit(500);

      if (fetchError) {
        setError(fetchError.message);
        setJobs([]);
        return;
      }
      setJobs((data ?? []) as Job[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs");
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const retryJob = async (job: Job) => {
    setActiveMenuJobId(null);
    setMenuPosition(null);
    const supabase = getSupabaseClient();
    try {
      await supabase.from("jobs").insert({
        type: job.type,
        payload: job.payload,
        status: "pending",
      });
      await loadJobs();
    } catch (e) {
      console.error("Failed to retry job:", e);
    }
  };

  const openActionMenu = (event: React.MouseEvent<HTMLButtonElement>, jobId: string) => {
    if (activeMenuJobId === jobId) {
      setActiveMenuJobId(null);
      setMenuPosition(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, left: rect.right - 160 });
    setActiveMenuJobId(jobId);
  };

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  const typeSearchLower = typeSearch.trim().toLowerCase();
  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== "all" && job.status !== statusFilter) return false;
    if (typeSearchLower && !job.type.toLowerCase().includes(typeSearchLower)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ITEMS_PER_PAGE));
  const pagedJobs = filteredJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const pendingCount = jobs.filter((j) => j.status === "pending").length;

  const activeMenuJob = activeMenuJobId ? jobs.find((j) => j.id === activeMenuJobId) : null;

  const statusFilterLabel =
    statusFilter === "all"
      ? "All statuses"
      : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

  return (
    <>
      {headerEl &&
        createPortal(
          <div className="flex items-center gap-x-1.5">
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Admin</span>
            <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Jobs</span>
          </div>,
          headerEl
        )}

      <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-5 mt-4 flex-shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Search */}
            <div className="relative flex-1 max-w-sm min-w-0">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by job type…"
                value={typeSearch}
                onChange={(e) => {
                  setTypeSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                  typeSearch ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                  "focus:border-b-[var(--kenoo-sky)]"
                )}
              />
            </div>

            {/* Refresh */}
            <Button
              type="button"
              variant="ghost"
              className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
              onClick={() => void loadJobs()}
              disabled={isLoading}
              aria-label="Refresh jobs"
            >
              <div className="relative">
                <div
                  className={cn(
                    "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
                    "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95"
                  )}
                >
                  <RefreshCw className={cn("h-4 w-4 text-neutral-400", isLoading && "animate-spin")} />
                </div>
              </div>
            </Button>

            {/* Status filter */}
            <div className="relative flex-shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className={cn(
                  "inline-flex items-center gap-1.5 min-w-0 max-w-[min(100%,18rem)] rounded-none border-0 bg-transparent p-0 shadow-none",
                  "text-sm font-light uppercase tracking-wider text-neutral-700",
                  "hover:text-neutral-900 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                )}
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
                aria-label="Filter by status"
              >
                {statusFilter !== "all" ? (
                  <span
                    className={cn("h-2 w-2 rounded-full flex-shrink-0", STATUS_DOT[statusFilter as Exclude<StatusFilter, "all">])}
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{statusFilterLabel}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                    dropdownOpen && "rotate-180"
                  )}
                  strokeWidth={1.8}
                />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-white border border-neutral-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden"
                  role="listbox"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={statusFilter === "all"}
                    onClick={() => { setStatusFilter("all"); setCurrentPage(1); setDropdownOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                      statusFilter === "all"
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-700 hover:bg-neutral-50"
                    )}
                  >
                    <span className="w-2 flex justify-center flex-shrink-0" aria-hidden>
                      <span className="h-2 w-2 rounded-full bg-neutral-300" />
                    </span>
                    <span>All statuses</span>
                  </button>
                  <div className="border-t border-neutral-100 mt-1 pt-1">
                    {(["pending", "processing", "completed", "failed"] as const).map((s) => (
                      <button
                        type="button"
                        key={s}
                        role="option"
                        aria-selected={statusFilter === s}
                        onClick={() => { setStatusFilter(s); setCurrentPage(1); setDropdownOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                          statusFilter === s
                            ? "bg-neutral-100 text-neutral-900"
                            : "text-neutral-700 hover:bg-neutral-50"
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", STATUS_DOT[s])} aria-hidden />
                        <span className="capitalize">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Indicators */}
            {(failedCount > 0 || pendingCount > 0) && (
              <span className="text-xs font-light flex-shrink-0">
                {failedCount > 0 && (
                  <span className="text-rose-500">{failedCount} failed</span>
                )}
                {failedCount > 0 && pendingCount > 0 && (
                  <span className="text-neutral-400"> · </span>
                )}
                {pendingCount > 0 && (
                  <span className="text-amber-500">{pendingCount} pending</span>
                )}
              </span>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && filteredJobs.length > 0 && (
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable table */}
        <div ref={tableScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-auto overscroll-none pb-8">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
              <tr>
                {["Type", "Status", "Created", "Triggered", "Processed", "Payload", ""].map((h, i) => (
                  <th
                    key={i}
                    className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-4 pr-4">
                        <div className="h-4 rounded bg-neutral-100 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-rose-400 font-light text-xs">
                    {error}
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-neutral-400 font-light">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <BriefcaseIcon className="h-7 w-7 text-neutral-300" />
                      <span className="text-sm">
                        {jobs.length === 0 ? "No jobs yet." : "No jobs match the current filters."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedJobs.map((job, i) => (
                  <motion.tr
                    key={job.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                    className="border-b border-neutral-50 hover:bg-neutral-50/60 transition-colors"
                  >
                    <td className="py-4 pr-4 max-w-[180px]">
                      <p className="text-neutral-700 text-xs font-light truncate" title={job.type}>
                        {job.type}
                      </p>
                      <p className="text-[11px] font-mono text-neutral-400 truncate">
                        {job.id}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-xs whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full flex-shrink-0",
                            job.status === "failed"
                              ? "bg-rose-500"
                              : job.status === "completed"
                              ? "bg-lime-500"
                              : job.status === "pending"
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          )}
                        />
                        <span className="text-neutral-500 font-light capitalize">{job.status}</span>
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-neutral-400 whitespace-nowrap text-xs font-light">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="py-4 pr-4 text-neutral-400 whitespace-nowrap text-xs font-light">
                      {formatDate(job.triggered_at)}
                    </td>
                    <td className="py-4 pr-4 text-neutral-400 whitespace-nowrap text-xs font-light">
                      {formatDate(job.processed_at)}
                    </td>
                    <td className="py-4 pr-4 text-neutral-500 text-xs font-light max-w-[200px]">
                      {job.payload != null && Object.keys(job.payload).length > 0 ? (
                        <span className="truncate block">
                          {JSON.stringify(job.payload).slice(0, 60)}
                          {JSON.stringify(job.payload).length > 60 ? "…" : ""}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => openActionMenu(e, job.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none"
                        aria-label="Job actions"
                        aria-haspopup="menu"
                        aria-expanded={activeMenuJobId === job.id}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action menu portal */}
      {mounted && activeMenuJob && menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            className="fixed z-50 min-w-[160px] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => retryJob(activeMenuJob)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-neutral-50 font-light"
            >
              <RefreshCw className="h-3.5 w-3.5 text-neutral-400" />
              Retry job
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMetadataJob(activeMenuJob);
                setActiveMenuJobId(null);
                setMenuPosition(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-neutral-50 font-light"
            >
              <Info className="h-3.5 w-3.5 text-neutral-400" />
              View metadata
            </button>
          </div>,
          document.body
        )}

      {/* Metadata modal portal */}
      {mounted && metadataJob &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMetadataJob(null);
            }}
          >
            <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-neutral-200 p-6">
              <button
                type="button"
                onClick={() => setMetadataJob(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="text-xs font-medium text-neutral-400 mb-4 uppercase tracking-wider">Job Metadata</h2>
              <dl className="space-y-3">
                {(
                  [
                    {
                      label: "ID",
                      value: (
                        <span className="font-mono text-xs text-neutral-600 break-all">{metadataJob.id}</span>
                      ),
                    },
                    {
                      label: "Type",
                      value: <span className="text-neutral-700 font-light text-xs">{metadataJob.type}</span>,
                    },
                    {
                      label: "Status",
                      value: (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              STATUS_DOT[metadataJob.status as Exclude<StatusFilter, "all">] ?? "bg-neutral-300"
                            )}
                          />
                          <span className="text-neutral-700 font-light text-xs capitalize">{metadataJob.status}</span>
                        </span>
                      ),
                    },
                    {
                      label: "Created",
                      value: <span className="text-neutral-600 font-light text-xs">{formatDate(metadataJob.created_at)}</span>,
                    },
                    {
                      label: "Triggered",
                      value: <span className="text-neutral-600 font-light text-xs">{formatDate(metadataJob.triggered_at)}</span>,
                    },
                    {
                      label: "Processed",
                      value: <span className="text-neutral-600 font-light text-xs">{formatDate(metadataJob.processed_at)}</span>,
                    },
                  ] as { label: string; value: React.ReactNode }[]
                ).map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{label}</dt>
                    <dd className="mt-0.5">{value}</dd>
                  </div>
                ))}
                {metadataJob.payload != null && (
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Payload</dt>
                    <dd className="mt-1">
                      <pre className="max-h-60 overflow-auto rounded-lg bg-neutral-50 p-3 text-[11px] font-mono text-neutral-700 whitespace-pre-wrap break-all border border-neutral-200">
                        {JSON.stringify(metadataJob.payload, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
