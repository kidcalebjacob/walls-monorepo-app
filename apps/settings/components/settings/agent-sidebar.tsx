"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronFirst, ChevronLast } from "lucide-react";
import { useState } from "react";
import { useSidebar } from "./sidebar-context";

const navItems = [
  {
    id: "profile",
    name: "Edit Profile",
    href: "/",
  },
  {
    id: "wallie-settings",
    name: "WALLIE SETTINGS",
    href: "/wallie-settings",
  },
  {
    id: "payment",
    name: "Payout Information",
    href: "/payment",
  },
  {
    id: "connect",
    name: "Connect",
    href: "/connect",
  },
  {
    id: "security",
    name: "Security & Privacy",
    href: "/security",
  },
  {
    id: "organization",
    name: "Organization",
    href: "/organization",
  },
];

function isNavItemActive(pathname: string, item: (typeof navItems)[number]) {
  if (item.id === "profile") {
    return pathname === item.href || pathname === `${item.href}/`;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  isCollapsed,
  className,
}: {
  item: (typeof navItems)[number];
  pathname: string;
  isCollapsed: boolean;
  className?: string;
}) {
  const isActive = isNavItemActive(pathname, item);
  const [isHovered, setIsHovered] = useState(false);
  const showIndicator = !isCollapsed && (isActive || isHovered);

  return (
    <Link
      href={item.href}
      tabIndex={isCollapsed ? -1 : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative block text-[13px] font-normal uppercase tracking-[0.14em] text-black transition-colors leading-snug",
        !isActive && "hover:text-neutral-700",
        className
      )}
    >
      <motion.span
        className="absolute left-0 top-1/2 w-[2px] -translate-y-1/2 bg-[#6eadc0]"
        aria-hidden
        initial={false}
        animate={{
          height: showIndicator ? (isHovered && !isActive ? 24 : 16) : 0,
          opacity: showIndicator ? 1 : 0,
        }}
        transition={{
          height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.2, ease: "easeOut" },
        }}
      />
      {item.name}
    </Link>
  );
}

function MobileNavLink({
  item,
  pathname,
}: {
  item: (typeof navItems)[number];
  pathname: string;
}) {
  const isActive = isNavItemActive(pathname, item);
  const [isHovered, setIsHovered] = useState(false);
  const showIndicator = isActive || isHovered;

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative text-[12px] font-normal uppercase tracking-[0.14em] text-black transition-colors",
        !isActive && "hover:text-neutral-700"
      )}
    >
      <motion.span
        className="absolute -bottom-4 left-0 right-0 h-[2px] bg-[#6eadc0] origin-center"
        aria-hidden
        initial={false}
        animate={{
          scaleX: showIndicator ? 1 : 0,
          opacity: showIndicator ? 1 : 0,
        }}
        transition={{
          scaleX: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.2, ease: "easeOut" },
        }}
      />
      {item.name}
    </Link>
  );
}

export function AgentSidebar() {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-kenoo-white transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isCollapsed ? "w-14" : "w-52"
        )}
      >
        <motion.nav
          className="flex w-52 shrink-0 flex-1 flex-col px-8 pt-4"
          initial={false}
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ pointerEvents: isCollapsed ? "none" : "auto" }}
          aria-hidden={isCollapsed}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              pathname={pathname}
              isCollapsed={isCollapsed}
              className="py-4 pl-4"
            />
          ))}
        </motion.nav>

        <div
          className={cn(
            "shrink-0 border-t border-neutral-200 py-4 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            isCollapsed ? "px-2" : "px-8"
          )}
        >
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-2 text-[11px] font-normal uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-black",
              isCollapsed ? "w-full justify-center" : "text-left"
            )}
          >
            {isCollapsed ? (
              <ChevronLast className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            ) : (
              <>
                <ChevronFirst className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-6 overflow-x-auto border-b border-neutral-200 bg-kenoo-white px-6 py-4">
        {navItems.map((item) => (
          <MobileNavLink key={item.id} item={item} pathname={pathname} />
        ))}
      </nav>
    </>
  );
}
