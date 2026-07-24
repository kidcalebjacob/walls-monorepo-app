import { ExternalLink } from "lucide-react";
import { cardSurfaceClass } from "../shared";
import { cn } from "@/lib/utils";
import type { CompanyDetail } from "./types";
import { formatFundingAmount, formatFundingDate } from "./utils";

export function CompanyFinanceTab({ company }: { company: CompanyDetail }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
          <p className="text-[10px] font-light uppercase tracking-[0.14em] text-neutral-400">
            Annual revenue
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-neutral-900">
            {company.annualRevenuePrinted || "—"}
          </p>
        </div>
        <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
          <p className="text-[10px] font-light uppercase tracking-[0.14em] text-neutral-400">
            Total funding
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-neutral-900">
            {company.totalFundingPrinted || "—"}
          </p>
        </div>
      </div>

      {company.fundingEvents.length > 0 ? (
        <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Funding history
          </p>
          <div className="space-y-0">
            {company.fundingEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-1 border-b border-neutral-200/50 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">
                    {event.type || "Funding round"}
                  </p>
                  {event.investors && (
                    <p className="mt-0.5 truncate text-xs font-light text-neutral-500">
                      {event.investors}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm font-semibold tabular-nums text-neutral-900">
                    {formatFundingAmount(event.amount, event.currency)}
                  </span>
                  <span className="text-xs font-light text-neutral-400">
                    {formatFundingDate(event.date)}
                  </span>
                  {event.newsUrl && (
                    <a
                      href={event.newsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-neutral-900"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm font-light text-neutral-400">No funding events on record.</p>
      )}
    </div>
  );
}
