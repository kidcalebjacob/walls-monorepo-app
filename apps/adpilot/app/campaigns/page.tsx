import { Suspense } from "react";

import { CampaignsPage } from "@/components/campaigns/campaigns-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CampaignsPage />
    </Suspense>
  );
}
