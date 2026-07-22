"use client";

import { useAuth } from "@walls/auth";
import { cn } from "@walls/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  LayoutDashboard,
  Lock,
  Settings,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppSidebar } from "./app-sidebar-context";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Target },
  { href: "/audiences", label: "Audiences", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar({ headerVisible = true }: { headerVisible?: boolean }) {
  const { isLoading } = useAuth();
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed, setIsHoverExpanded, isExpanded } =
    useAppSidebar();

  if (isLoading) return null;

  return (
    <div
      className={cn(
        "fixed left-0 z-40 hidden md:flex",
        "pointer-events-none items-center justify-start pl-3",
        "transition-[padding-top] duration-300 ease-in-out",
        headerVisible ? "top-16 h-[calc(100vh-4rem)]" : "top-0 h-screen",
      )}
      onMouseEnter={() => setIsHoverExpanded(true)}
      onMouseLeave={() => setIsHoverExpanded(false)}
    >
      <nav
        className={cn(
          "pointer-events-auto flex flex-col items-stretch gap-1 overflow-hidden",
          "rounded-[2rem] bg-white/85 p-2 backdrop-blur-md",
          "shadow-[0_10px_32px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04)]",
          "transition-[width] duration-300 ease-in-out",
          isExpanded ? "w-[11.5rem]" : "w-14",
        )}
        aria-label="AdPilot navigation"
      >
        <button
          type="button"
          title={isCollapsed ? "Expand sidebar" : "Lock sidebar open"}
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="group flex h-10 w-full items-center justify-start rounded-full transition-colors duration-200 hover:bg-neutral-100/90"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition group-hover:bg-neutral-200/80 group-hover:text-neutral-700">
            <span className="relative flex h-[18px] w-[18px] items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                {!isCollapsed ? (
                  <motion.span
                    key="lock"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Lock className="h-[18px] w-[18px] stroke-[1.5]" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="chevron"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      rotate: isExpanded ? 0 : 180,
                    }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{
                      opacity: { duration: 0.18, ease: "easeInOut" },
                      scale: { duration: 0.18, ease: "easeInOut" },
                      rotate: { duration: 0.4, ease: "easeInOut" },
                    }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <ChevronLeft className="h-[18px] w-[18px] stroke-[1.5]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </span>
          <motion.span
            className="overflow-hidden whitespace-nowrap text-[13px] font-medium text-neutral-400"
            initial={false}
            animate={{
              width: isExpanded ? 88 : 0,
              opacity: isExpanded ? 1 : 0,
              marginLeft: isExpanded ? 10 : 0,
            }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
          >
            {isCollapsed ? "Expand" : "Pinned"}
          </motion.span>
        </button>

        <div className="my-1 ml-2 h-px w-6 bg-neutral-200/90" />

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group flex h-10 w-full items-center justify-start rounded-full transition-colors duration-200",
                isActive ? "bg-neutral-100/90" : "hover:bg-neutral-100/70",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                  isActive
                    ? [
                        "bg-white text-neutral-800",
                        "shadow-[0_4px_14px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]",
                        "ring-1 ring-black/[0.04]",
                      ]
                    : "bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200/70 group-hover:text-neutral-700",
                )}
              >
                <Icon className="h-[18px] w-[18px] stroke-[1.5]" />
              </span>
              <motion.span
                className={cn(
                  "overflow-hidden whitespace-nowrap text-[13px] font-medium",
                  isActive ? "text-neutral-900" : "text-neutral-500 group-hover:text-neutral-700",
                )}
                initial={false}
                animate={{
                  width: isExpanded ? 88 : 0,
                  opacity: isExpanded ? 1 : 0,
                  marginLeft: isExpanded ? 10 : 0,
                }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
              >
                {item.label}
              </motion.span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
