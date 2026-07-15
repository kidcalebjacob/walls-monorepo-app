import AgentsProjectsTimeline from "@/components/agents-projects/timeline/agents-projects-timeline";

export default function ProjectsTimelinePage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-walls-white">
      <AgentsProjectsTimeline analyticsData={null} />
    </div>
  );
}
