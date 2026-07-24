import PartnerHubCompaniesDetail from "@/components/companies/viewCompanies/partnerhub-companies-detail";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    categorySlug: string;
    subcategorySlug: string;
    companyId: string;
  }>;
};

export default async function CompaniesDetailPage({ params }: PageProps) {
  const { categorySlug, subcategorySlug, companyId } = await params;

  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <div className="app-sidebar-pad h-full min-h-0">
        <PartnerHubCompaniesDetail
          categorySlug={categorySlug}
          subcategorySlug={subcategorySlug}
          companyId={companyId}
        />
      </div>
    </div>
  );
}
