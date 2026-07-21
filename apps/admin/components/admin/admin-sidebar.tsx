"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { cn } from "@walls/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  Award,
  ChevronDown,
  CreditCard,
  Home,
  LayoutGrid,
  Receipt,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { useActiveAccount } from "@/components/active-account-context";
import { ChromeFrame } from "@/components/ui/chrome-frame";

type NavChild = {
  name: string;
  href: string;
  Icon: typeof Users;
  match?: "exact" | "invite" | "payment";
};

type NavItem = {
  name: string;
  href: string;
  Icon: typeof Home;
  exact?: boolean;
  children?: NavChild[];
};

function AdminSidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeAccountId } = useActiveAccount();

  const menuItems: NavItem[] = [
    { name: "Home", href: "/", Icon: Home, exact: true },
    ...(activeAccountId
      ? [
          {
            name: "Apps",
            href: `/accounts/${activeAccountId}`,
            Icon: LayoutGrid,
          },
        ]
      : []),
    {
      name: "Users",
      href: "/users",
      Icon: Users,
      children: [
        { name: "All users", href: "/users", Icon: Users, match: "exact" },
        {
          name: "Add user",
          href: "/users?invite=1",
          Icon: UserPlus,
          match: "invite",
        },
      ],
    },
    {
      name: "Billing",
      href: "/billing",
      Icon: CreditCard,
      children: [
        {
          name: "Subscriptions",
          href: "/billing",
          Icon: Receipt,
          match: "exact",
        },
        {
          name: "Payment method",
          href: "/billing?section=payment",
          Icon: CreditCard,
          match: "payment",
        },
      ],
    },
    { name: "Account", href: "/account", Icon: Settings },
  ];

  const initiallyOpen = menuItems
    .filter((item) => item.children?.length)
    .filter((item) => {
      const base = item.href.split("?")[0];
      return pathname === base || pathname.startsWith(`${base}/`);
    })
    .map((item) => item.name);

  const [openSections, setOpenSections] = useState<string[]>(initiallyOpen);

  const toggleSection = (name: string) => {
    setOpenSections((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  };

  const isPathActive = (href: string, exact?: boolean) => {
    const base = href.split("?")[0];
    if (exact) return pathname === base;
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const isChildActive = (child: NavChild) => {
    const base = child.href.split("?")[0];
    if (pathname !== base) return false;
    if (child.match === "invite") return searchParams.get("invite") === "1";
    if (child.match === "payment")
      return searchParams.get("section") === "payment";
    return (
      !searchParams.get("invite") && searchParams.get("section") !== "payment"
    );
  };

  return (
    <nav className="space-y-0.5 px-2 pb-4 pt-3">
      {menuItems.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const isOpen = openSections.includes(item.name);
        const isActive =
          isPathActive(item.href, item.exact) ||
          (hasChildren && item.children!.some((child) => isChildActive(child)));

        if (!hasChildren) {
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-full px-3 text-sm transition-colors",
                isActive
                  ? "bg-[#e8f0fe] font-medium text-[#1967d2]"
                  : "font-normal text-[#3c4043] hover:bg-[#e8eaed]",
              )}
            >
              <item.Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 stroke-[1.5]",
                  isActive ? "text-[#1967d2]" : "text-[#5f6368]",
                )}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        }

        return (
          <div key={item.name} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleSection(item.name)}
              className={cn(
                "flex h-10 w-full items-center gap-1 rounded-full px-2 text-sm transition-colors",
                isActive
                  ? "bg-[#e8f0fe] font-medium text-[#1967d2]"
                  : "font-normal text-[#3c4043] hover:bg-[#e8eaed]",
              )}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[#5f6368] transition-transform",
                  !isOpen && "-rotate-90",
                  isActive && "text-[#1967d2]",
                )}
              />
              <item.Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 stroke-[1.5]",
                  isActive ? "text-[#1967d2]" : "text-[#5f6368]",
                )}
              />
              <span className="ml-2 truncate">{item.name}</span>
            </button>

            {isOpen && (
              <div className="ml-4 space-y-0.5 border-l border-[#e8eaed] pl-2">
                {item.children!.map((child) => {
                  const childActive = isChildActive(child);
                  return (
                    <Link
                      key={child.name}
                      href={child.href}
                      className={cn(
                        "flex h-9 items-center gap-3 rounded-full px-3 text-[13px] transition-colors",
                        childActive
                          ? "bg-[#e8f0fe]/70 font-medium text-[#1967d2]"
                          : "font-normal text-[#5f6368] hover:bg-[#e8eaed] hover:text-[#202124]",
                      )}
                    >
                      <child.Icon className="h-4 w-4 shrink-0 stroke-[1.5]" />
                      <span className="truncate">{child.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({
  headerVisible = true,
}: {
  headerVisible?: boolean;
}) {
  return (
    <aside
      className={cn(
        "fixed left-0 z-40 hidden w-60 bg-kenoo-white md:block",
        headerVisible ? "top-16 h-[calc(100vh-4rem)]" : "top-0 h-screen",
      )}
    >
      <div className="flex h-full flex-col">
        <ScrollArea className="flex-1">
          <Suspense fallback={<div className="h-40" />}>
            <AdminSidebarNav />
          </Suspense>
        </ScrollArea>

        <div className="border-t border-[#e8eaed] p-3">
          <ChromeFrame className="w-full" contentClassName="w-full">
            <Link
              href="/billing"
              className="inline-flex h-11 w-full items-center justify-between rounded-[10.5px] bg-kenoo-white px-4 text-sm font-medium text-[#111111] transition-colors hover:bg-[#efefef]"
            >
              <span className="flex items-center gap-2">
                <Award className="h-4 w-4 shrink-0 stroke-[1.75]" />
                Upgrade
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 stroke-[1.75] text-[#5f6368]" />
            </Link>
          </ChromeFrame>
        </div>
      </div>
    </aside>
  );
}
