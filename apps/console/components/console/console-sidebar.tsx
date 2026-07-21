'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  ChevronLeft,
  UserCircle,
  Users,
  LayoutGrid,
  ListTodo,
} from "lucide-react";
import { useConsoleSidebar } from "./ConsoleSidebarContext";

const menuItems = [
  { name: "Users", href: "/users", Icon: UserCircle },
  { name: "Apps", href: "/apps", Icon: LayoutGrid },
  { name: "Jobs", href: "/jobs", Icon: ListTodo },
  { name: "Teams", href: "/teams", Icon: Users },
];

export function ConsoleSidebar({
  headerVisible = true,
}: {
  headerVisible?: boolean;
}) {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed, isHoverExpanded, setIsHoverExpanded } = useConsoleSidebar();
  const isExpanded = !isCollapsed || isHoverExpanded;

  return (
    <div
      className={cn(
        "fixed left-0 z-40 hidden bg-gray-50 md:block",
        "transition-all duration-500 ease-in-out",
        headerVisible ? "top-16 h-[calc(100vh-4rem)]" : "top-0 h-screen",
        isExpanded ? "w-40" : "w-16"
      )}
      onMouseEnter={() => setIsHoverExpanded(true)}
      onMouseLeave={() => setIsHoverExpanded(false)}
    >
      <div className="flex h-full flex-col relative overflow-y-auto">
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2 pt-44">
            {/* Collapse Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-full justify-start text-slate-600 transition-all duration-500 ease-in-out",
                "relative group hover:bg-transparent",
                !isExpanded ? "px-2" : ""
              )}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <div className={cn(
                "flex items-center relative z-10",
                !isExpanded ? "justify-center" : ""
              )}>
                <div className="relative group">
                  <div className="
                    relative z-10 p-3
                    rounded-full
                    border border-transparent
                    transition-all duration-300 ease-in-out
                    group-hover:bg-gray-50 group-hover:border-neutral-200
                    group-hover:scale-95
                    group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]
                  ">
                    <div className="h-[18px] w-[18px] relative flex items-center justify-center">
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
                  className="overflow-hidden flex items-center"
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
                    <span className="font-light whitespace-nowrap">
                      Locked
                    </span>
                  </motion.div>
                </motion.div>
              </div>
            </Button>

            {/* Navigation Items */}
            {menuItems.map(({ name, href, Icon }) => {
              const isActive =
                pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Button
                  key={name}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-slate-600 transition-all duration-500 ease-in-out",
                    "relative group hover:bg-transparent",
                    !isExpanded ? "px-2" : "",
                    isActive ? "text-black" : ""
                  )}
                  asChild
                >
                  <Link href={href}>
                    <div className={cn(
                      "flex items-center relative z-10",
                      !isExpanded ? "justify-center" : ""
                    )}>
                      <div className="relative group">
                        <div className={cn(
                          "relative z-10 p-3 rounded-full border border-transparent transition-all duration-300 ease-in-out",
                          "group-hover:bg-gray-50 group-hover:border-neutral-200",
                          "group-hover:scale-95",
                          isActive
                            ? [
                                "shadow-[0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)]",
                                "group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)]",
                              ]
                            : "group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]"
                        )}>
                          <Icon className={cn(
                            "h-[18px] w-[18px] stroke-[1.5]",
                            "text-neutral-500"
                          )} />
                        </div>
                      </div>
                      <motion.div
                        className="overflow-hidden flex items-center"
                        initial={false}
                        animate={{
                          width: isExpanded ? 80 : 0,
                          opacity: isExpanded ? 1 : 0,
                          marginLeft: isExpanded ? 12 : 0,
                        }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                      >
                        <span className="font-light whitespace-nowrap">
                          {name}
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
