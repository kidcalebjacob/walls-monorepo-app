"use client";

import { OpportunitySignalsSection } from "./opportunity-signals-section";
import { RecentPartnershipsSection } from "./recent-partnerships-section";
import { HotTalentSection } from "./hot-talent-section";
import { HotCategoriesSection } from "./hot-categories-section";

export default function PartnerHubOverview({ analyticsData }: { analyticsData: any }) {
  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="flex-1 w-full flex flex-col min-h-0">
        <div className="flex-1 pb-12 pl-8 pr-4 md:pr-6">
          <OpportunitySignalsSection />
          <RecentPartnershipsSection />
          <HotTalentSection />
          <HotCategoriesSection />
        </div>
      </div>
    </div>
  );
}
