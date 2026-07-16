import AgentsProjectList from "@/components/agents-projects/projectList/agents-project-list";

export default function ProjectsPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <AgentsProjectList analyticsData={null} />
    </div>
  );
}
