"use client";

import { ScrollRevealProvider } from "@walls/ui/scroll-reveal";
import { WallsToaster } from "@walls/ui/walls-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ScrollRevealProvider>
      {children}
      <WallsToaster />
    </ScrollRevealProvider>
  );
}
