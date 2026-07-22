"use client";

import { wallsToast } from "@/components/ui/walls-toast";
import { useEffect } from "react";

import type { Project, ProjectTask, TaskStatus } from "./types";

export interface CreateTasksPopupProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projects: Project[];
  defaultStatus?: TaskStatus;
  threadId?: string | null;
  defaultProjectId?: string | null;
  existing?: ProjectTask | null;
}

/** Temporary stub until Projects task creation is shared into Mail. */
export function CreateTasksPopup({ open, onClose }: CreateTasksPopupProps) {
  useEffect(() => {
    if (!open) return;
    wallsToast.warning(
      "Task creation from Mail isn’t wired yet — use the Projects app for now.",
    );
    onClose();
  }, [open, onClose]);

  return null;
}
