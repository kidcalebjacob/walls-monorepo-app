"use client";

import { useAuth } from "@walls/auth";
import { Button } from "@walls/ui/button";
import { ScrollArea } from "@walls/ui/scroll-area";
import { cn } from "@walls/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronLeft,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppSidebar } from "./app-sidebar-context";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Target },
  { href: "/creatives", label: "Creatives", icon: ImageIcon },
  { href: "/reports", label: "Reports", icon: BarChart3 },
] as const;

export function AppSidebar() {
  const { isLoading } = useAuth();
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed, isHoverExpanded, setIsHoverExpanded } =
    useAppSidebar();
  const isExpanded = !isCollapsed || isHoverExpanded;

  if (pathname === "/") return null;
  if (isLoading) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 z-40 hidden h-screen bg-transparent transition-all duration-500 ease-in-out md:block",
        isExpanded ? "w-40" : "w-16",
      )}
      onMouseEnter={() => setIsHoverExpanded(true)}
      onMouseLeave={() => setIsHoverExpanded(false)}
    >
      <div className="relative flex h-full flex-col">
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2 pt-48">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "group relative w-full justify-start text-slate-600 transition-all duration-500 ease-in-out hover:bg-transparent",
                !isExpanded ? "px-2" : "",
              )}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <div
                className={cn(
                  "relative z-10 flex items-center",
                  !isExpanded ? "justify-center" : "",
                )}
              >
                <div className="group relative">
                  <div className="relative z-10 rounded-full border border-transparent p-3 transition-all duration-300 ease-in-out group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-gray-50 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]">
                    <div className="relative flex h-[18px] w-[18px] items-center justify-center">
                      <AnimatePresence mode="wait" initial={false}>
                        {!isCollapsed ? (
                          <motion.div
                            key="lock"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <Lock className="h-[18px] w-[18px] stroke-[1.5] text-slate-600" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="chevron"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{
                              opacity: 1,
                              scale: 1,
                              rotate: isExpanded ? 0 : 180,
                            }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{
                              opacity: { duration: 0.2, ease: "easeInOut" },
                              scale: { duration: 0.2, ease: "easeInOut" },
                              rotate: { duration: 0.5, ease: "easeInOut" },
                            }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <ChevronLeft className="h-[18px] w-[18px] stroke-[1.5] text-slate-600" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
                <motion.div
                  className="flex items-center overflow-hidden"
                  initial={false}
                  animate={{
                    width: isExpanded ? 80 : 0,
                    opacity: isExpanded ? 1 : 0,
                    marginLeft: isExpanded ? 12 : 0,
                  }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                  <motion.div
                    className="overflow-hidden"
                    initial={false}
                    animate={{
                      opacity: !isCollapsed ? 1 : 0,
                      x: !isCollapsed ? 0 : -8,
                    }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <span className="whitespace-nowrap font-light">Locked</span>
                  </motion.div>
                </motion.div>
              </div>
            </Button>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  className={cn(
                    "group relative w-full justify-start text-slate-600 transition-all duration-500 ease-in-out hover:bg-transparent",
                    !isExpanded ? "px-2" : "",
                    isActive && "text-black",
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    <div
                      className={cn(
                        "relative z-10 flex items-center",
                        !isExpanded ? "justify-center" : "",
                      )}
                    >
                      <div className="group relative">
                        <div
                          className={cn(
                            "relative z-10 rounded-full border border-transparent p-3 transition-all duration-300 ease-in-out group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-gray-50",
                            isActive
                              ? [
                                  "shadow-[0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)]",
                                  "group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)]",
                                ]
                              : "group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
                          )}
                        >
                          <Icon className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                        </div>
                      </div>
                      <motion.div
                        className="flex items-center overflow-hidden"
                        initial={false}
                        animate={{
                          width: isExpanded ? 80 : 0,
                          opacity: isExpanded ? 1 : 0,
                          marginLeft: isExpanded ? 12 : 0,
                        }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                      >
                        <span className="whitespace-nowrap font-light">
                          {item.label}
                        </span>
                      </motion.div>
                    </div>
                  </Link>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
