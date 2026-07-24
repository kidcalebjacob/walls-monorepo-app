import PartnerHubOverview from "@/components/overview/partnerhub-overview";

export default function PartnerHubHomePage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <div className="app-sidebar-pad h-full min-h-0">
        <PartnerHubOverview analyticsData={null} />
      </div>
    </div>
  );
}
