"use client";

import { useAppHeaderVisible } from "@walls/ui/private-app-chrome";
import { cn } from "@walls/utils";

import { AdminSidebar } from "@/components/admin/admin-sidebar";

type AppSidebarLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

function AppSidebarContent({ children, className }: AppSidebarLayoutProps) {
  const headerVisible = useAppHeaderVisible();

  return (
    <>
      <AdminSidebar headerVisible={headerVisible} />
      <div
        className={cn(
          "admin-shell flex h-screen min-w-0 flex-col overflow-hidden transition-[padding-top] duration-300",
          headerVisible ? "pt-16" : "pt-0",
          "md:ml-60",
          className,
        )}
      >
        <main
          data-app-scroll-container
          className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-none bg-kenoo-white px-4 pb-10 pt-4 sm:px-6 lg:px-8"
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
