import PartnerHubCompaniesIndex from "@/components/companies/partnerhub-companies-index";

export const dynamic = "force-dynamic";

export default function CompaniesPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <div className="app-sidebar-pad h-full min-h-0">
        <PartnerHubCompaniesIndex />
      </div>
    </div>
  );
}
