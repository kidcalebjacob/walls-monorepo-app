import { Suspense } from "react";

import AgentCompanies from "@/components/agentCRM/agentCompanies/index/agent-companies";

export const dynamic = "force-dynamic";

export default function CompaniesPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <Suspense fallback={null}>
        <AgentCompanies analyticsData={null} />
      </Suspense>
    </div>
  );
}
