import { Suspense } from "react";

import AgentsTaskKanban from "@/components/agents-projects/taskKanban/agents-task-kanban";

function BoardFallback() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-walls-white text-sm font-light text-neutral-400">
      Loading board…
    </div>
  );
}

export default function ProjectsBoardPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-walls-white">
      <Suspense fallback={<BoardFallback />}>
        <AgentsTaskKanban analyticsData={null} />
      </Suspense>
    </div>
  );
}
