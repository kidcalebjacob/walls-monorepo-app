"use client";

import { cn } from "@walls/utils";

import { AppSidebar } from "./app-sidebar";
import { useAppSidebar } from "./app-sidebar-context";

type AppSidebarLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

function AppSidebarContent({ children, className }: AppSidebarLayoutProps) {
  const { isCollapsed, isHoverExpanded } = useAppSidebar();
  const isExpanded = !isCollapsed || isHoverExpanded;

  return (
    <>
      <AppSidebar headerVisible={false} />
      <div
        className={cn(
          "flex h-screen min-w-0 flex-col overflow-hidden bg-walls-white transition-[margin-left] duration-300",
          isExpanded ? "md:ml-40" : "md:ml-16",
          className,
        )}
      >
        <main
          data-app-scroll-container
          className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-none"
        >
          {children}
        </main>
      </div>
    </>
  );
}

/** Mirrors walls-app `CRMSidebarWrapper` — fixed rail + margin-offset main column. */
export function AppSidebarLayout({ children, className }: AppSidebarLayoutProps) {
  return <AppSidebarContent className={className}>{children}</AppSidebarContent>;
}
