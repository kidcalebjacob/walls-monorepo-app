"use client";

import { cn } from "@walls/utils";

import { AppSidebar } from "./app-sidebar";
import { useAppSidebar } from "./app-sidebar-context";

type AppSidebarLayoutProps = {
  children: React.ReactNode;
  className?: string;
  /** Top-right overlay (profile, etc.) — pinned to this column, not the scrolling main. */
  chrome?: React.ReactNode;
};

function AppSidebarContent({
  children,
  className,
  chrome,
}: AppSidebarLayoutProps) {
  const { isCollapsed, isHoverExpanded } = useAppSidebar();
  const isExpanded = !isCollapsed || isHoverExpanded;

  return (
    <>
      <AppSidebar />
      <div
        className={cn(
          "relative flex h-screen min-w-0 flex-col overflow-hidden bg-walls-white",
          "transition-all duration-500 ease-in-out",
          isExpanded ? "md:ml-40" : "md:ml-16",
          className,
        )}
      >
        {chrome ? (
          <div className="pointer-events-none absolute top-0 right-0 z-50 flex items-center p-4 pr-6">
            <div className="pointer-events-auto">{chrome}</div>
          </div>
        ) : null}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-none">
          {children}
        </main>
      </div>
    </>
  );
}

/** Mirrors walls-app `CRMSidebarWrapper` — fixed rail + margin-offset main column. */
export function AppSidebarLayout({
  children,
  className,
  chrome,
}: AppSidebarLayoutProps) {
  return (
    <AppSidebarContent className={className} chrome={chrome}>
      {children}
    </AppSidebarContent>
  );
}
