import { extractDomain, cardSurfaceClass } from "../shared";
import { cn } from "@/lib/utils";
import { CompanyAudienceSection } from "./company-audience-section";
import { CompanyPartnershipsSection } from "./company-partnerships-section";
import { CompanyPeopleSection } from "./company-people-section";
import type { CompanyDetail } from "./types";
import { MetricRow } from "./metric-row";

export function CompanyOverviewTab({ company }: { company: CompanyDetail }) {
  return (
    <div className="space-y-6">
      {company.overview && (
        <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
            About
          </p>
          <p className="text-sm font-light leading-relaxed text-neutral-600">
            {company.overview}
          </p>
        </div>
      )}

      <CompanyPeopleSection companyId={company.id} />

      <CompanyAudienceSection companyId={company.id} />

      <CompanyPartnershipsSection companyId={company.id} />

      {company.suborganizations.length > 0 && (
        <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Sub-organizations
          </p>
          <div className="space-y-0">
            {company.suborganizations.map((suborg) => (
              <MetricRow
                key={suborg.id}
                label={suborg.name}
                value={suborg.website ? extractDomain(suborg.website) : "—"}
                accent="bg-neutral-400"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
