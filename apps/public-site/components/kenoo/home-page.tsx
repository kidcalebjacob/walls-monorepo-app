import { FinalCta } from "@/components/kenoo/final-cta";
import { Philosophy } from "@/components/kenoo/philosophy";
import { Reliability } from "@/components/kenoo/reliability";
import { SiteShell } from "@/components/kenoo/site-shell";
import { SuiteShowcase } from "@/components/kenoo/suite-showcase";

export default function HomePage() {
  return (
    <SiteShell>
      <SuiteShowcase />
      <Philosophy />
      <Reliability />
      <FinalCta />
    </SiteShell>
  );
}
