import { Suspense } from "react";

import AgentLeads from "@/components/agentCRM/agentPeople/index/agent-people";

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <Suspense fallback={null}>
        <AgentLeads analyticsData={null} />
      </Suspense>
    </div>
  );
}
