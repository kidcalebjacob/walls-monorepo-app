"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { cardSurfaceClass, CompaniesPageShell } from "../shared";
import { CompanyDetailTabs } from "./company-detail-tabs";
import { CompanyFinanceTab } from "./company-finance-tab";
import { CompanyOverviewTab } from "./company-overview-tab";
import { CompanyProfileCard } from "./company-profile-card";
import { CompanyTeamTab } from "./company-team-tab";
import { CompanyTechnologyTab } from "./company-technology-tab";
import type { CompanyDetailTabId } from "./types";
import { useCompanyDetail } from "./use-company-detail";

export default function PartnerHubCompaniesDetail({
  categorySlug,
  subcategorySlug,
  companyId,
}: {
  categorySlug: string;
  subcategorySlug: string;
  companyId: string;
}) {
  const { loading, company, categoryName, subcategoryName } = useCompanyDetail({
    categorySlug,
    subcategorySlug,
    companyId,
  });
  const [activeTab, setActiveTab] = useState<CompanyDetailTabId>("overview");

  const departmentEntries = useMemo(() => {
    if (!company) return [];
    return Object.entries(company.departmentalHeadCount).sort(([, a], [, b]) => b - a);
  }, [company]);

  const maxDepartmentCount = departmentEntries[0]?.[1] ?? 0;

  const technologiesByCategory = useMemo(() => {
    if (!company) return [];
    const groups = new Map<string, string[]>();
    for (const tech of company.technologies) {
      const key = tech.category || "Other";
      const list = groups.get(key) || [];
      list.push(tech.name);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [company]);

  const backHref = `/companies/${categorySlug}/${subcategorySlug}`;

  if (loading) {
    return (
      <CompaniesPageShell>
        <div className="pt-6 pb-4">
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className={cn(cardSurfaceClass, "h-64 animate-pulse bg-neutral-100/80")} />
      </CompaniesPageShell>
    );
  }

  if (!company) {
    return (
      <CompaniesPageShell>
        <div className="pt-6 pb-6">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-xs font-light uppercase tracking-wider text-neutral-400 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-3 w-3" />
            {subcategoryName || "Back"}
          </Link>
        </div>
        <p className="text-sm font-light text-neutral-400">Company not found.</p>
      </CompaniesPageShell>
    );
  }

  return (
    <CompaniesPageShell>
      <div className="pt-6 pb-4">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-xs font-light uppercase tracking-wider text-neutral-400 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="h-3 w-3" />
          {subcategoryName || "Subcategory"}
        </Link>
      </div>

      <CompanyProfileCard
        company={company}
        categoryName={categoryName}
        subcategoryName={subcategoryName}
      />

      <CompanyDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mb-12 mt-6 pr-2">
        {activeTab === "overview" && <CompanyOverviewTab company={company} />}
        {activeTab === "finance" && <CompanyFinanceTab company={company} />}
        {activeTab === "team" && (
          <CompanyTeamTab
            employeeCount={company.employeeCount}
            departmentEntries={departmentEntries}
            maxDepartmentCount={maxDepartmentCount}
          />
        )}
        {activeTab === "technology" && (
          <CompanyTechnologyTab technologiesByCategory={technologiesByCategory} />
        )}
      </div>
    </CompaniesPageShell>
  );
}
