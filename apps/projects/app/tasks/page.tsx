import { Suspense } from "react";

import AgentsTaskKanban from "@/components/agents-projects/taskKanban/agents-task-kanban";

function BoardFallback() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-kenoo-white text-sm font-light text-neutral-400">
      Loading board…
    </div>
  );
}

export default function TasksPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <Suspense fallback={<BoardFallback />}>
        <AgentsTaskKanban analyticsData={null} />
      </Suspense>
    </div>
  );
}
