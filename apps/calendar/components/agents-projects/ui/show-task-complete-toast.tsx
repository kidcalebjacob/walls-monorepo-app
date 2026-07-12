"use client";

import { wallsToast } from "@/components/ui/walls-toast";

export function showTaskCompleteToast(options?: {
  taskTitle?: string;
  count?: number;
}): void {
  const { taskTitle, count = 1 } = options ?? {};
  const title = count > 1 ? `${count} tasks completed` : "Task completed";
  wallsToast.success(title, count === 1 ? taskTitle : undefined);
}
