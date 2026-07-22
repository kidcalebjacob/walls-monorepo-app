import { Suspense } from "react";

import { AudiencesPage } from "@/components/audiences/audiences-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AudiencesPage />
    </Suspense>
  );
}
