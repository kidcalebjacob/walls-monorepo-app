import AgentsProjectsTimeline from "@/components/agents-projects/timeline/agents-projects-timeline";

export default function TimelinePage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <AgentsProjectsTimeline analyticsData={null} />
    </div>
  );
}
