"use client";

import { usePathname } from "next/navigation";
import { AppHeaderVisibilityProvider } from "@walls/ui/private-app-chrome";

/**
 * Kanban columns own their own scroll, so auto-hiding the chrome header on
 * /tasks feels jumpy. Keep the hide-on-scroll behavior everywhere else.
 */
export function ProjectsHeaderVisibility({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const autoHideOnScroll = !pathname.startsWith("/tasks");

  return (
    <AppHeaderVisibilityProvider autoHideOnScroll={autoHideOnScroll}>
      {children}
    </AppHeaderVisibilityProvider>
  );
}
