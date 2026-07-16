import { FinalCta } from "@/components/kenoo/final-cta";
import { Hero } from "@/components/kenoo/hero";
import { Modules } from "@/components/kenoo/modules";
import { Philosophy } from "@/components/kenoo/philosophy";
import { Reliability } from "@/components/kenoo/reliability";
import { SiteShell } from "@/components/kenoo/site-shell";

export default function HomePage() {
  return (
    <SiteShell>
      <Hero />
      <Philosophy />
      <Modules />
      <Reliability />
      <FinalCta />
    </SiteShell>
  );
}
