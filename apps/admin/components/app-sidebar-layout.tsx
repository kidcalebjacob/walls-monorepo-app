"use client";

import { useAppHeaderVisible } from "@walls/ui/private-app-chrome";
import { cn } from "@walls/utils";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { useAdminSidebar } from "@/components/admin/AdminSidebarContext";

type AppSidebarLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

function AppSidebarContent({ children, className }: AppSidebarLayoutProps) {
  const { isCollapsed, isHoverExpanded } = useAdminSidebar();
  const isExpanded = !isCollapsed || isHoverExpanded;
  const headerVisible = useAppHeaderVisible();

  return (
    <>
      <AdminSidebar headerVisible={headerVisible} />
      <div
        className={cn(
          "admin-shell flex min-h-screen min-w-0 flex-col transition-[margin-left,padding-top] duration-300",
          headerVisible ? "pt-16" : "pt-0",
          isExpanded ? "md:ml-52" : "md:ml-[4.5rem]",
          className,
        )}
      >
        <main
          data-app-scroll-container
          className="min-h-0 flex-1 overflow-y-auto overscroll-none px-4 pb-10 pt-4 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </>
  );
}

export function AppSidebarLayout({
  children,
  className,
}: AppSidebarLayoutProps) {
  return (
    <AppSidebarContent className={className}>{children}</AppSidebarContent>
  );
}
