"use client";

import { useAppHeaderVisible } from "@walls/ui/private-app-chrome";
import { cn } from "@walls/utils";

import { ConsoleSidebar } from "@/components/console/console-sidebar";
import { useConsoleSidebar } from "@/components/console/ConsoleSidebarContext";

type AppSidebarLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

function AppSidebarContent({ children, className }: AppSidebarLayoutProps) {
  const { isCollapsed, isHoverExpanded } = useConsoleSidebar();
  const isExpanded = !isCollapsed || isHoverExpanded;
  const headerVisible = useAppHeaderVisible();

  return (
    <>
      <ConsoleSidebar headerVisible={headerVisible} />
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col bg-gray-50 transition-[margin-left,padding-top] duration-300",
          headerVisible ? "pt-16" : "pt-0",
          isExpanded ? "md:ml-40" : "md:ml-16",
          className,
        )}
      >
        <main
          data-app-scroll-container
          className="min-h-0 flex-1 overflow-y-auto overscroll-none px-8 pb-8"
        >
          {children}
        </main>
      </div>
    </>
  );
}

export function AppSidebarLayout({ children, className }: AppSidebarLayoutProps) {
  return <AppSidebarContent className={className}>{children}</AppSidebarContent>;
}
