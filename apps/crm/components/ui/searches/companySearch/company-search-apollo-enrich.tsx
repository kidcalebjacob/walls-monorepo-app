"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { wallsToast } from "@/components/ui/walls-toast";
import { cn } from "@/lib/utils";
import {
  getApolloCompanyPreview,
  runApolloCompanySync,
  type CompanySyncPreview,
} from "@/components/agentCRM/agentCompanies/lib/apollo-company-sync";

const fieldActionClass =
  "cursor-pointer px-0.5 text-[10px] font-light lowercase leading-none tracking-wide text-neutral-500 transition-colors hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40";

const underlineInputBaseClass =
  "w-full rounded-none border-0 border-b bg-transparent py-2 pl-0 text-sm font-light transition-colors placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none";

interface CompanySearchApolloEnrichProps {
  onSuccess?: (payload: { companyName?: string }) => void;
  /** Hide add UI and restore the dropdown search row (CompanySearch). */
  onClose?: () => void;
}

export function CompanySearchApolloEnrich({ onSuccess, onClose }: CompanySearchApolloEnrichProps) {
  const [enrichInput, setEnrichInput] = React.useState("");
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showParsedResult, setShowParsedResult] = React.useState(false);

  const preview: CompanySyncPreview | null = React.useMemo(
    () => getApolloCompanyPreview(enrichInput),
    [enrichInput]
  );

  React.useEffect(() => {
    if (preview) {
      setShowParsedResult(false);
      const t = setTimeout(() => setShowParsedResult(true), 420);
      return () => clearTimeout(t);
    }
    setShowParsedResult(false);
  }, [preview]);

  const sync = React.useCallback(async () => {
    if (!preview) {
      wallsToast.error("Please enter a valid Apollo URL or company domain");
      return;
    }
    setIsSyncing(true);
    try {
      const result = await runApolloCompanySync(enrichInput);
      if (result.ok === false) {
        wallsToast.error(result.error);
        return;
      }
      wallsToast.success(result.message, {
        description: result.companyName ?? undefined,
        duration: 3000,
      });
      setEnrichInput("");
      onSuccess?.({ companyName: result.companyName });
    } finally {
      setIsSyncing(false);
    }
  }, [enrichInput, preview, onSuccess]);

  const hasPaste = enrichInput.trim().length > 0;
  /** Empty: close + sync. With paste: clear + sync only (no close). */
  const padRight = hasPaste ? "pr-[4.75rem]" : "pr-[5rem]";

  const syncingSpinner = (
    <span
      role="status"
      aria-live="polite"
      aria-label="Syncing"
      className="pointer-events-none inline-flex h-[10px] w-[10px] shrink-0 items-center justify-center leading-none"
    >
      <span className="h-[10px] w-[10px] animate-spin rounded-full border-[1.5px] border-neutral-200 border-t-[var(--kenoo-sky)]" aria-hidden />
    </span>
  );

  const trailingActions = (
    <div className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2 leading-none">
      {onClose && !hasPaste ? (
        <button
          type="button"
          className={fieldActionClass}
          disabled={isSyncing}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          close
        </button>
      ) : null}
      {hasPaste && !isSyncing ? (
        <button type="button" className={fieldActionClass} onClick={() => setEnrichInput("")}>
          clear
        </button>
      ) : null}
      {isSyncing ? (
        syncingSpinner
      ) : (
        <button
          type="button"
          className={cn(fieldActionClass, "hover:text-[var(--kenoo-sky)]")}
          disabled={!preview}
          onClick={() => void sync()}
        >
          sync
        </button>
      )}
    </div>
  );

  return (
    <div onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="relative w-full">
        {preview ? (
          <div className={cn("relative min-h-[2.125rem] w-full border-b border-[var(--kenoo-sky)] py-2", padRight)}>
            <div className="flex min-h-[1.375rem] w-full items-center">
              {showParsedResult ? (
                <motion.div
                  key="parsed"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex w-full min-w-0 items-center"
                >
                  <span
                    className="min-w-0 flex-1 truncate text-sm font-light text-neutral-800"
                    title={preview.value}
                  >
                    {preview.value}
                  </span>
                </motion.div>
              ) : (
                <div className="flex w-full justify-center py-0.5">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-[var(--kenoo-sky)]" />
                </div>
              )}
            </div>
            {trailingActions}
          </div>
        ) : enrichInput.trim() ? (
          <div className={cn("relative min-h-[2.125rem] w-full border-b border-neutral-200 py-2", padRight)}>
            <p className="truncate text-sm font-light text-red-600">invalid — paste apollo url or domain</p>
            {trailingActions}
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={enrichInput}
              onChange={(e) => setEnrichInput(e.target.value)}
              placeholder="paste apollo url or domain"
              className={cn(
                underlineInputBaseClass,
                padRight,
                enrichInput.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && enrichInput.trim() && !isSyncing) void sync();
                else if (e.key === "Escape") {
                  if (!enrichInput.trim()) onClose?.();
                  else setEnrichInput("");
                }
              }}
              disabled={isSyncing}
              autoFocus={Boolean(onClose)}
            />
            {trailingActions}
          </div>
        )}
      </div>
    </div>
  );
}
