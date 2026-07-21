"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@walls/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Settings,
} from "lucide-react";
import { useActiveAccount } from "@/components/active-account-context";
import { useAdminSidebar } from "./AdminSidebarContext";

export function AdminSidebar({
  headerVisible = true,
}: {
  headerVisible?: boolean;
}) {
  const pathname = usePathname();
  const { activeAccount, activeAccountId } = useActiveAccount();
  const { isCollapsed, setIsCollapsed, isHoverExpanded, setIsHoverExpanded } =
    useAdminSidebar();
  const isExpanded = !isCollapsed || isHoverExpanded;

  const settingsLabel =
    activeAccount?.accountType === "organization"
      ? "Organization"
      : "Account";

  const menuItems = [
    { name: "Overview", href: "/", Icon: LayoutDashboard, exact: true },
    { name: settingsLabel, href: "/organizations", Icon: Settings },
    ...(activeAccountId
      ? [
          {
            name: "App access",
            href: `/accounts/${activeAccountId}`,
            Icon: LayoutGrid,
            exact: false,
          },
        ]
      : []),
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 z-40 hidden border-r border-neutral-200/80 bg-white/80 backdrop-blur-xl md:block",
        "transition-all duration-300 ease-out",
        headerVisible ? "top-16 h-[calc(100vh-4rem)]" : "top-0 h-screen",
        isExpanded ? "w-52" : "w-[4.5rem]",
      )}
      onMouseEnter={() => setIsHoverExpanded(true)}
      onMouseLeave={() => setIsHoverExpanded(false)}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            "flex items-center border-b border-neutral-100 px-3 py-4",
            isExpanded ? "justify-between" : "justify-center",
          )}
        >
          {isExpanded && (
            <div className="min-w-0 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Kenoo
              </p>
              <p className="truncate text-sm font-bold text-neutral-900">
                Admin
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronLeft className="h-4 w-4 rotate-180" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <nav className="space-y-1 p-2 pt-3">
            {isExpanded && (
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                {activeAccount?.name ?? "Workspace"}
              </p>
            )}
            {menuItems.map(({ name, href, Icon, exact }) => {
              const isActive = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Button
                  key={name}
                  variant="ghost"
                  className={cn(
                    "h-10 w-full justify-start gap-0 rounded-xl px-2 font-normal transition-colors",
                    isActive
                      ? "bg-kenoo-blue/8 text-kenoo-blue hover:bg-kenoo-blue/10 hover:text-kenoo-blue"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                    !isExpanded && "justify-center px-0",
                  )}
                  asChild
                >
                  <Link href={href} title={!isExpanded ? name : undefined}>
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        isActive ? "bg-kenoo-blue/12" : "bg-transparent",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] stroke-[1.75]" />
                    </span>
                    {isExpanded && (
                      <span className="ml-2 truncate text-sm">{name}</span>
                    )}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        {isExpanded && (
          <div className="border-t border-neutral-100 p-3">
            <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Scoped view
              </p>
              <p className="mt-1 text-xs font-light leading-relaxed text-neutral-500">
                All pages reflect the account selected in the header.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
