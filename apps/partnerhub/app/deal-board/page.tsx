import { Suspense } from "react";

import PartnerHubPartnerships from "@/components/partnerships/partnerhub-partnerships";

export const dynamic = "force-dynamic";

export default function DealBoardPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <div className="app-sidebar-pad h-full min-h-0">
        <Suspense fallback={null}>
          <PartnerHubPartnerships analyticsData={null} />
        </Suspense>
      </div>
    </div>
  );
}
