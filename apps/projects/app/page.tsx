import AgentsProjects from "@/components/agents-projects/agents-projects";

export default function HomePage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <AgentsProjects analyticsData={null} />
    </div>
  );
}
