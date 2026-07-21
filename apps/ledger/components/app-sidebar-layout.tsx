"use client";

import { useAppHeaderVisible } from "@walls/ui/private-app-chrome";
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
  const headerVisible = useAppHeaderVisible();

  return (
    <>
      <AppSidebar headerVisible={headerVisible} />
      <div
        className={cn(
          "flex h-screen min-w-0 flex-col overflow-hidden bg-kenoo-white transition-[margin-left,padding-top] duration-300",
          headerVisible ? "pt-16" : "pt-0",
          isExpanded ? "md:ml-[13.25rem]" : "md:ml-[5.25rem]",
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

/** Fixed rail + margin-offset main column (matches other private WALLS apps). */
export function AppSidebarLayout({ children, className }: AppSidebarLayoutProps) {
  return <AppSidebarContent className={className}>{children}</AppSidebarContent>;
}
