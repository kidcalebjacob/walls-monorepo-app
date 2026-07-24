"use client";

import { cn } from "@/lib/utils";
import { cardSurfaceClass } from "../shared";
import { PartnershipCardItem } from "./partnership-card-item";
import { useCompanyPartnerships } from "./use-company-partnerships";

export function CompanyPartnershipsSection({ companyId }: { companyId: string }) {
  const { loading, partnerships } = useCompanyPartnerships(companyId);

  if (!loading && partnerships.length === 0) {
    return null;
  }

  return (
    <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
      <p className="mb-6 text-xs font-medium uppercase tracking-widest text-neutral-500">
        Partners
      </p>

      {loading ? (
        <div className="-mx-6 overflow-x-auto overscroll-x-contain scrollbar-hide sm:-mx-8">
          <div className="flex w-max gap-4 px-6 pb-1 sm:px-8">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={cn(cardSurfaceClass, "h-56 w-[240px] shrink-0 animate-pulse bg-neutral-100/80")}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="-mx-6 overflow-x-auto overscroll-x-contain scrollbar-hide sm:-mx-8">
          <div className="flex w-max gap-4 px-6 pb-1 snap-x snap-mandatory sm:px-8">
            {partnerships.map((partnership) => (
              <div key={partnership.id} className="w-[240px] shrink-0 snap-start">
                <PartnershipCardItem partnership={partnership} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
