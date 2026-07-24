import PartnerHubCompaniesCategory from "@/components/companies/partnerhub-companies-category";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ categorySlug: string }>;
};

export default async function CompaniesCategoryPage({ params }: PageProps) {
  const { categorySlug } = await params;

  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <div className="app-sidebar-pad h-full min-h-0">
        <PartnerHubCompaniesCategory categorySlug={categorySlug} />
      </div>
    </div>
  );
}
