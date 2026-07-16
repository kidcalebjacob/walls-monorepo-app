import { Suspense } from "react";

import LeadsSearch from "@/components/agentCRM/agentPeople/search/leads-search";

export const dynamic = "force-dynamic";

export default function LeadsSearchPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <Suspense fallback={null}>
        <LeadsSearch analyticsData={null} />
      </Suspense>
    </div>
  );
}
