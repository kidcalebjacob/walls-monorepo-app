import PartnerHubCompaniesSubcategory from "@/components/companies/partnerhub-companies-subcategory";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ categorySlug: string; subcategorySlug: string }>;
};

export default async function CompaniesSubcategoryPage({ params }: PageProps) {
  const { categorySlug, subcategorySlug } = await params;

  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <div className="app-sidebar-pad h-full min-h-0">
        <PartnerHubCompaniesSubcategory
          categorySlug={categorySlug}
          subcategorySlug={subcategorySlug}
        />
      </div>
    </div>
  );
}
