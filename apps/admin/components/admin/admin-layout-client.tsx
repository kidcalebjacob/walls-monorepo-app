"use client";

import { usePathname } from "next/navigation";
import { AdminSidebarProvider, useAdminSidebar } from "@/components/admin/AdminSidebarContext";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import AdminHeaderBar from "@/components/admin/admin-header-bar";
import { cn } from "@/lib/utils";

/** Full-bleed admin pages (no sidebar / header), e.g. team create-member wizard */
function isChromelessAdminPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/teams/") &&
    pathname.endsWith("/create-member")
  );
}

function AdminContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chromeless = isChromelessAdminPath(pathname);
  const { isCollapsed, isHoverExpanded } = useAdminSidebar();
  const isExpanded = !isCollapsed || isHoverExpanded;

  if (chromeless) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <>
      <AdminSidebar />
      <div
        className={cn(
          "min-h-screen bg-gray-50",
          "transition-all duration-500 ease-in-out",
          isExpanded ? "ml-40" : "ml-16",
        )}
      >
        <AdminHeaderBar />
        <div className="px-8">{children}</div>
      </div>
    </>
  );
}

export function AdminLayoutClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminSidebarProvider>
      <AdminContent>{children}</AdminContent>
    </AdminSidebarProvider>
  );
}
