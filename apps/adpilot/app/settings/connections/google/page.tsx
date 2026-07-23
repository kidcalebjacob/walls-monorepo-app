import { Suspense } from "react";

import { ConnectionDetailPage } from "@/components/settings/connection-detail-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-full px-6 py-8 md:px-10">
          <p className="text-sm font-light text-neutral-500">
            Loading connection…
          </p>
        </main>
      }
    >
      <ConnectionDetailPage providerKey="google" />
    </Suspense>
  );
}
