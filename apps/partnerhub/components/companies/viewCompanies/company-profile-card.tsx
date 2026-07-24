"use client";

import { cardSurfaceClass, CompanyLogo } from "../shared";
import { VIEW_COMPANIES_PROFILE_FALLBACK } from "./constants";
import { Facebook, Globe, Linkedin, Twitter } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CompanyDetail } from "./types";
import { FloatIconButton } from "./float-icon-button";
import { StatField } from "./stat-field";
import { buildWebsiteHref } from "./utils";

export function CompanyProfileCard({
  company,
  categoryName,
  subcategoryName,
}: {
  company: CompanyDetail;
  categoryName: string | null;
  subcategoryName: string | null;
}) {
  const websiteHref = useMemo(() => buildWebsiteHref(company.website), [company.website]);
  const locationLabel = [company.city, company.country].filter(Boolean).join(", ");

  return (
    <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-neutral-200/60 sm:h-20 sm:w-20">
            <CompanyLogo
              name={company.name}
              logoUrl={company.logoUrl}
              size={72}
              fallbackImageUrl={VIEW_COMPANIES_PROFILE_FALLBACK}
            />
          </div>
          <div className="min-w-0 pt-1">
            <h1 className="truncate text-2xl font-black text-neutral-900 sm:text-3xl">
              {company.name}
            </h1>
            {company.industry && (
              <p className="mt-1 text-[11px] font-light uppercase tracking-[0.14em] text-neutral-400">
                {company.industry}
              </p>
            )}
            {(categoryName || subcategoryName) && (
              <p className="mt-2 text-[10px] font-light uppercase tracking-[0.12em] text-neutral-300">
                {[categoryName, subcategoryName].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {(websiteHref || company.linkedin || company.twitter || company.facebook) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
            {websiteHref && (
              <FloatIconButton href={websiteHref} label="Visit website" icon={Globe} />
            )}
            {company.linkedin && (
              <FloatIconButton href={company.linkedin} label="LinkedIn" icon={Linkedin} />
            )}
            {company.twitter && (
              <FloatIconButton href={company.twitter} label="Twitter" icon={Twitter} />
            )}
            {company.facebook && (
              <FloatIconButton href={company.facebook} label="Facebook" icon={Facebook} />
            )}
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-3">
        <StatField label="Industry" value={company.industry} />
        <StatField
          label="Employees"
          value={company.employeeCount != null ? company.employeeCount.toLocaleString() : null}
        />
        <StatField
          label="Founded"
          value={company.foundingYear != null ? String(company.foundingYear) : null}
        />
        <StatField label="Location" value={locationLabel || null} />
        <StatField label="Phone" value={company.phone} />
        <StatField label="Annual revenue" value={company.annualRevenuePrinted} />
        <StatField label="Total funding" value={company.totalFundingPrinted} />
      </div>
    </div>
  );
}
