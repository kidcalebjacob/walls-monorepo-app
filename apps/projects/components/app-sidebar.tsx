"use client";

import { useAuth } from "@walls/auth";
import { Button } from "@walls/ui/button";
import { cn } from "@walls/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  FolderKanban,
  GanttChartSquare,
  LayoutDashboard,
  LayoutList,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppSidebar } from "./app-sidebar-context";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: FolderKanban },
  { href: "/timeline", label: "Timeline", icon: GanttChartSquare },
  { href: "/projects", label: "Projects", icon: LayoutList },
] as const;

export function AppSidebar({ headerVisible = true }: { headerVisible?: boolean }) {
  const { isLoading } = useAuth();
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed, isHoverExpanded, setIsHoverExpanded, isExpanded } =
    useAppSidebar();

  if (isLoading) return null;

  return (
    <div
      className={cn(
        "fixed left-0 z-40 hidden bg-kenoo-white md:block",
        "transition-all duration-300 ease-in-out",
        headerVisible ? "top-16 h-[calc(100vh-4rem)]" : "top-0 h-screen",
        isExpanded ? "w-40" : "w-16",
      )}
      onMouseEnter={() => setIsHoverExpanded(true)}
      onMouseLeave={() => setIsHoverExpanded(false)}
    >
      <div className="relative flex h-full flex-col overflow-y-auto pr-6 -mr-6">
        <div className="space-y-4 p-2 pt-32">
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
                <div className="relative z-10 rounded-full border border-transparent p-3 transition-all duration-300 ease-in-out group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-kenoo-white group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]">
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
            </div>
          </Button>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
                          "relative z-10 rounded-full border border-transparent p-3 transition-all duration-300 ease-in-out group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-kenoo-white",
                          isActive
                            ? [
                                "border-white/70 bg-white/45 backdrop-blur-md",
                                "shadow-[0_4px_14px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.65)]",
                                "group-hover:border-white/70 group-hover:bg-white/60",
                                "group-hover:shadow-[0_6px_18px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.7)]",
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
      </div>
    </div>
  );
}
