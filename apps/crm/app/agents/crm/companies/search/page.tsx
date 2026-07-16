import { Suspense } from "react";

import CompaniesSearch from "@/components/agentCRM/agentCompanies/search/companies-search";

export const dynamic = "force-dynamic";

export default function CompaniesSearchPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <Suspense fallback={null}>
        <CompaniesSearch analyticsData={null} />
      </Suspense>
    </div>
  );
}
