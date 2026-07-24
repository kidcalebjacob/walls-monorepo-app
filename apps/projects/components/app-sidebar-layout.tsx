"use client";

import type { CSSProperties, ReactNode } from "react";
import { useAppHeaderVisible } from "@walls/ui/private-app-chrome";
import { cn } from "@walls/utils";

import { AppSidebar } from "./app-sidebar";
import { useAppSidebar } from "./app-sidebar-context";

type AppSidebarLayoutProps = {
  children: ReactNode;
  className?: string;
};

function AppSidebarContent({ children, className }: AppSidebarLayoutProps) {
  const { isCollapsed } = useAppSidebar();
  // Inset only when the rail is pinned open. Hover expansion overlays the
  // page so padded content isn't resized mid-transition.
  const isPinnedOpen = !isCollapsed;
  const headerVisible = useAppHeaderVisible();

  return (
    <>
      <AppSidebar headerVisible={headerVisible} />
      {/* Soft white veil at the page edge — content scrolls under the floating rail */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed left-0 z-30 hidden md:block",
          "w-20 bg-gradient-to-r from-kenoo-white via-kenoo-white/75 to-transparent",
          "transition-[top,height] duration-300 ease-in-out",
          headerVisible ? "top-16 h-[calc(100vh-4rem)]" : "top-0 h-screen",
        )}
      />
      <div
        className={cn(
          // Full-bleed canvas so the glass rail floats over content (no opaque left wall).
          "flex h-screen min-w-0 flex-col overflow-hidden bg-kenoo-white transition-[padding-top] duration-300",
          headerVisible ? "pt-16" : "pt-0",
          className,
        )}
        style={
          {
            "--app-sidebar-inset": isPinnedOpen ? "13.25rem" : "5.25rem",
          } as CSSProperties
        }
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

/** Floating glass rail over a full-bleed main column. */
export function AppSidebarLayout({ children, className }: AppSidebarLayoutProps) {
  return <AppSidebarContent className={className}>{children}</AppSidebarContent>;
}
