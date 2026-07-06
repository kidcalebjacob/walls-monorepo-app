"use client";

import { useAuth, getSupabaseClient, logoutToPortal } from "@walls/auth";
import { Button } from "./button";
import {
  DropdownMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./dropdown-menu";
import { Skeleton } from "./skeleton";
import NotificationsPopup from "./notifications-popup";
import { cn } from "@walls/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLoadingCallback } from "react-loading-hook";
import {
  LogOut,
  ChevronRight,
  Menu,
  X,
  ChevronUp,
  ChevronDown,
  Bell,
  Settings,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Portal } from "@radix-ui/react-portal";

/** Shown under the profile photo on hover (before sliding the photo layer) */
const PROFILE_FALLBACK_ICON_URL =
  "https://assets.wallsentertainment.com/logo-variations/black-logo.png";

/** Same hover ring as people-table-toolbar filter/create + notification bell in this file */
const TOOLBAR_ICON_HOVER_RING =
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:scale-95 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]";

const AVATAR_SIZE_PX = 44;
/** Image request size — 2× the display size for retina sharpness. */
const AVATAR_REQUEST_PX = AVATAR_SIZE_PX * 2;

export interface UserProfileButtonProps {
  dashboardPath?: string;
  settingsPath?: string;
  documentationPath?: string;
  adminSettingsPath?: string;
}

/** Profile photo with skeleton until the image has loaded (or failed). */
function ProfileAvatarCircle({
  avatarUrl,
  initials,
  avatarHover,
  onHoverStart,
  onHoverEnd,
}: {
  avatarUrl: string | null;
  initials?: string;
  avatarHover: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [avatarUrl]);

  const showImageSkeleton = Boolean(avatarUrl) && !imageLoaded && !imageError;
  const slideTransition = {
    type: "spring" as const,
    stiffness: 520,
    damping: 42,
    mass: 0.85,
  };

  return (
    <motion.div
      className="relative shrink-0"
      initial={false}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
    >
      <div
        className={cn(
          "relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-neutral-200",
          "transition-all duration-300 ease-in-out",
          "hover:bg-gray-50 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
        )}
      >
        {showImageSkeleton && (
          <Skeleton
            className="absolute inset-0 z-20 h-full w-full rounded-full bg-neutral-100"
            aria-hidden
          />
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Image
            src={PROFILE_FALLBACK_ICON_URL}
            alt=""
            width={48}
            height={48}
            className="h-6 w-6 object-contain"
          />
        </div>
        {avatarUrl && !imageError ? (
          <motion.div
            className="relative z-10 h-full w-full rounded-full"
            initial={false}
            animate={{ y: avatarHover ? "-112%" : 0 }}
            transition={slideTransition}
          >
            <Image
              src={avatarUrl}
              alt="Profile photo"
              width={AVATAR_REQUEST_PX}
              height={AVATAR_REQUEST_PX}
              priority
              className={cn(
                "rounded-full object-cover transition-opacity duration-200",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
              style={{
                width: `${AVATAR_SIZE_PX}px`,
                height: `${AVATAR_SIZE_PX}px`,
                minWidth: `${AVATAR_SIZE_PX}px`,
                minHeight: `${AVATAR_SIZE_PX}px`,
                maxWidth: `${AVATAR_SIZE_PX}px`,
                maxHeight: `${AVATAR_SIZE_PX}px`,
              }}
              onLoadingComplete={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-neutral-100"
            initial={false}
            animate={{ y: avatarHover ? "-112%" : 0 }}
            transition={slideTransition}
          >
            <span className="text-lg text-foreground">{initials}</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function ProfileToolbarSkeleton() {
  return (
    <>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-neutral-100" />
      <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-neutral-100" />
    </>
  );
}

/** Reserved slot matching the real profile trigger so headers never layout-shift. */
function ProfileButtonLoadingPlaceholder() {
  return (
    <>
      <div
        className="md:hidden h-10 w-10 shrink-0"
        aria-busy="true"
        aria-label="Loading profile"
      >
        <Skeleton className="h-10 w-10 rounded-lg bg-neutral-100" />
      </div>
      <div
        className="hidden md:flex h-14 min-w-[7.5rem] shrink-0 items-center gap-3 px-3"
        aria-busy="true"
        aria-label="Loading profile"
      >
        <ProfileToolbarSkeleton />
      </div>
    </>
  );
}

export default function UserProfileButton({
  dashboardPath = "/",
  settingsPath = "/settings",
  documentationPath = "/documentation",
  adminSettingsPath,
}: UserProfileButtonProps = {}) {
  const { user, profile, profileLoading, updateProfileApps, isLoading } =
    useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [currentMenuIndex, setCurrentMenuIndex] = useState(0);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [reorderMode, setReorderMode] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [avatarHover, setAvatarHover] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apps = profile?.userApps ?? [];
  const avatarUrl = profile?.avatarUrl ?? null;
  const initials = profile?.initials;
  const showProfileLoading = profileLoading && !profile;

  useEffect(() => {
    if (apps.length === 0) return;
    apps.forEach((app) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = app.icon;
      document.head.appendChild(link);
    });
  }, [apps]);

  useEffect(() => {
    if (!avatarUrl) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = avatarUrl;
    document.head.appendChild(link);
  }, [avatarUrl]);

  const refreshUnreadNotificationCount = useCallback(async () => {
    if (!user?.id) {
      setHasUnreadNotifications(false);
      return;
    }
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (!error) {
      setHasUnreadNotifications((count ?? 0) > 0);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshUnreadNotificationCount();
  }, [user?.id, isNotificationsOpen, refreshUnreadNotificationCount]);

  const navigate = useCallback(
    (route: "dashboard" | "settings" | "documentation" | "admin-settings") => {
      return () => {
        switch (route) {
          case "dashboard":
            router.push(dashboardPath);
            break;
          case "settings":
            router.push(settingsPath);
            break;
          case "documentation":
            router.push(documentationPath);
            break;
          case "admin-settings":
            if (adminSettingsPath) {
              router.push(adminSettingsPath);
            }
            break;
        }
      };
    },
    [
      router,
      dashboardPath,
      settingsPath,
      documentationPath,
      adminSettingsPath,
    ],
  );

  const [handleLogout] = useLoadingCallback(async () => {
    await logoutToPortal();
    router.refresh();
  });

  const handleMobileNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const handleMobileLogout = async () => {
    await handleLogout();
    setIsMobileMenuOpen(false);
  };

  const LONG_PRESS_MS = 500;
  const startLongPress = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      setReorderMode(true);
    }, LONG_PRESS_MS);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const saveAppOrder = useCallback(async () => {
    if (!user?.id || apps.length === 0) return;
    const supabase = getSupabaseClient();
    await Promise.all(
      apps.map((app, i) =>
        supabase
          .from("user_app_access")
          .update({ order_index: i })
          .eq("user_id", user.id)
          .eq("app_id", app.app_id),
      ),
    );
    setReorderMode(false);
    setDragIndex(null);
    setDragOverIndex(null);
  }, [user?.id, apps]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex || apps.length === 0)
      return;
    const next = [...apps];
    const [removed] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, removed);
    updateProfileApps(next);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  type MenuItem = {
    name: string;
    icon?: string;
    path: string;
    isLogout?: boolean;
  };

  const allMenuItems: MenuItem[] = [
    { name: "Dashboard", path: dashboardPath },
    ...apps,
    { name: "Logout", path: "logout", isLogout: true },
  ];

  const nextMenuItem = () => {
    setDirection("up");
    setShouldAnimate(true);
    requestAnimationFrame(() => {
      setCurrentMenuIndex((prev) => (prev + 1) % allMenuItems.length);
    });
  };

  const prevMenuItem = () => {
    setDirection("down");
    setShouldAnimate(true);
    requestAnimationFrame(() => {
      setCurrentMenuIndex(
        (prev) => (prev - 1 + allMenuItems.length) % allMenuItems.length,
      );
    });
  };

  const selectCurrentMenuItem = () => {
    const currentItem = allMenuItems[currentMenuIndex];
    if (currentItem.isLogout) {
      handleMobileLogout();
    } else {
      handleMobileNavigation(currentItem.path);
    }
  };

  if (isLoading) {
    return <ProfileButtonLoadingPlaceholder />;
  }

  if (!user) return null;

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-3 rounded-lg transition-colors"
        >
          <Menu className="h-7 w-7 text-foreground" />
        </button>
      </div>

      {/* Desktop Dropdown Menu */}
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative my-auto h-14 w-auto px-3 rounded-full bg-transparent border border-transparent shadow-none flex items-center gap-3 transition-colors duration-300 ease-in-out hover:bg-transparent hover:border-transparent hover:shadow-none hover:text-inherit focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-transparent data-[state=open]:border-transparent data-[state=open]:shadow-none"
            >
              {showProfileLoading ? (
                <ProfileToolbarSkeleton />
              ) : (
                <div className="flex items-center gap-3">
                  {/* Bell — stop propagation so the profile dropdown does not open */}
                  <div
                    role="button"
                    aria-label={
                      hasUnreadNotifications
                        ? "Open notifications (unread)"
                        : "Open notifications"
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsNotificationsOpen(true);
                    }}
                    className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
                  >
                    <div
                      className={`${TOOLBAR_ICON_HOVER_RING} flex items-center justify-center overflow-visible`}
                    >
                      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-visible">
                        <Bell className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                        {hasUnreadNotifications && (
                          <span
                            className="pointer-events-none absolute -right-0.5 -top-0.5 z-20 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
                            aria-hidden
                          />
                        )}
                      </span>
                    </div>
                  </div>

                  <ProfileAvatarCircle
                    avatarUrl={avatarUrl}
                    initials={initials}
                    avatarHover={avatarHover}
                    onHoverStart={() => setAvatarHover(true)}
                    onHoverEnd={() => setAvatarHover(false)}
                  />
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={12}
            className="w-[400px] border-0 p-4 rounded-[20px] bg-gray-50 shadow-xs outline-none ring-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 0.8,
              }}
            >
              {/* Dashboard Container */}
              <motion.div
                className="bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-[50px] mb-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.1,
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
              >
                <motion.div
                  whileHover="hover"
                  variants={{
                    hover: {},
                  }}
                >
                  <DropdownMenuItem
                    onClick={navigate("dashboard")}
                    className="flex items-center gap-3 p-2 pl-4 cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-transparent focus:bg-transparent rounded-[50px] w-full transition-all duration-300"
                  >
                    <div className="p-2 rounded-full bg-muted/10">
                      <Image
                        src="https://assets.wallsentertainment.com/walls-app-icons/dashboard.svg"
                        alt="Dashboard icon"
                        width={40}
                        height={40}
                        priority
                      />
                    </div>
                    <motion.span
                      className="text-walls-blue flex-1"
                      variants={{
                        hover: { x: 4 },
                      }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      Visit Your Dashboard
                    </motion.span>
                    <ChevronRight className="w-5 h-5 text-walls-blue mr-2" />
                  </DropdownMenuItem>
                </motion.div>
              </motion.div>

              {/* Apps Container */}
              <motion.div
                className="bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-3xl mb-4 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                {reorderMode && (
                  <p className="text-xs text-zinc-500 text-center pt-4 px-4 pb-2">
                    Drag to reorder • tap Done when finished
                  </p>
                )}
                <div
                  className={`grid grid-cols-3 gap-x-3 gap-y-4 [@media(max-height:750px)]:gap-x-2.5 [@media(max-height:750px)]:gap-y-3.5 ${apps.length > 6 ? "max-h-[min(392px,calc(100vh-376px))] [@media(max-height:750px)]:max-h-[min(304px,calc(100vh-416px))] overflow-y-auto" : "p-4 [@media(max-height:750px)]:p-3"}`}
                  style={
                    apps.length > 6
                      ? ({
                          scrollbarWidth: "thin",
                          scrollbarColor: "#d4d4d8 transparent",
                          paddingTop: "0.5rem",
                          paddingBottom: "0.5rem",
                          paddingLeft: "1rem",
                          paddingRight: "1rem",
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {apps.map((app, index) => (
                    <motion.div
                      key={app.app_id}
                      className="group"
                      draggable={reorderMode}
                      onDragStart={() => reorderMode && handleDragStart(index)}
                      onDragOver={(e) =>
                        reorderMode && handleDragOver(e, index)
                      }
                      onDragLeave={() => setDragOverIndex(null)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => reorderMode && handleDrop(e, index)}
                      onMouseDown={startLongPress}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                      onTouchStart={startLongPress}
                      onTouchEnd={cancelLongPress}
                      style={{
                        opacity:
                          dragOverIndex === index && dragIndex !== null
                            ? 0.6
                            : 1,
                      }}
                    >
                      <div className="w-full h-full">
                        <DropdownMenuItem
                          onClick={(e) => {
                            if (reorderMode) {
                              e.preventDefault();
                              return;
                            }
                            router.push(app.path);
                          }}
                          className="flex flex-col items-center justify-center gap-2 p-4 [@media(max-height:750px)]:p-3 cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-transparent focus:bg-transparent h-[120px] [@media(max-height:750px)]:h-[104px] rounded-2xl transition-all duration-300 select-none"
                        >
                          <motion.div
                            className="p-2 rounded-full bg-muted/10 pointer-events-none"
                            animate={
                              reorderMode
                                ? { rotate: [0, -5, 5, -5, 5, 0] }
                                : { rotate: 0 }
                            }
                            transition={
                              reorderMode
                                ? {
                                    repeat: Infinity,
                                    duration: 0.5,
                                    ease: "easeInOut",
                                  }
                                : {}
                            }
                          >
                            <Image
                              src={app.icon}
                              alt={`${app.name} icon`}
                              width={54}
                              height={54}
                              priority
                            />
                          </motion.div>
                          <span className="text-[13px] text-black/75 pointer-events-none">
                            {app.name}
                          </span>
                        </DropdownMenuItem>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {reorderMode && (
                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      onClick={saveAppOrder}
                      className="mt-3 w-full py-2 rounded-xl bg-walls-yellow/90 hover:bg-walls-yellow text-zinc-900 text-sm font-medium transition-colors"
                    >
                      Done
                    </button>
                  </div>
                )}
              </motion.div>

              {/* Documentation Container */}
              <motion.div
                className="bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-[50px] mb-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.12,
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
              >
                <motion.div
                  whileHover="hover"
                  variants={{
                    hover: {},
                  }}
                >
                  <DropdownMenuItem
                    onClick={navigate("documentation")}
                    className="flex items-center gap-3 p-1.5 pl-4 cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-transparent focus:bg-transparent rounded-[50px] w-full transition-all duration-300"
                  >
                    <div className="p-1.5 rounded-full bg-muted/10">
                      <BookOpen className="h-4 w-4 text-neutral-500" />
                    </div>
                    <motion.span
                      className="text-neutral-600 flex-1"
                      variants={{
                        hover: { x: 4 },
                      }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      Documentation
                    </motion.span>
                    <ChevronRight className="w-5 h-5 text-neutral-500 mr-2" />
                  </DropdownMenuItem>
                </motion.div>
              </motion.div>

              {/* Settings Container */}
              <motion.div
                className="bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-[50px] mb-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.13,
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
              >
                <motion.div
                  whileHover="hover"
                  variants={{
                    hover: {},
                  }}
                >
                  <DropdownMenuItem
                    onClick={navigate("settings")}
                    className="flex items-center gap-3 p-1.5 pl-4 cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-transparent focus:bg-transparent rounded-[50px] w-full transition-all duration-300"
                  >
                    <div className="p-1.5 rounded-full bg-muted/10">
                      <Settings className="h-4 w-4 text-neutral-500" />
                    </div>
                    <motion.span
                      className="text-neutral-600 flex-1"
                      variants={{
                        hover: { x: 4 },
                      }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      Settings
                    </motion.span>
                    <ChevronRight className="w-5 h-5 text-neutral-500 mr-2" />
                  </DropdownMenuItem>
                </motion.div>
              </motion.div>

              {/* Logout Container */}
              <div className="bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-[50px]">
                <motion.div
                  whileHover="hover"
                  variants={{
                    hover: {},
                  }}
                >
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-3 p-1.5 pl-4 cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-red-100 focus:bg-red-100 bg-red-50 text-red-600 hover:text-red-700 focus:text-red-700 rounded-[50px] w-full transition-all duration-300"
                  >
                    <div className="p-1.5 rounded-full bg-red-100">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <motion.span
                      className="text-red-600 flex-1"
                      variants={{
                        hover: { x: 4 },
                      }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      Logout
                    </motion.span>
                    <ChevronRight className="w-5 h-5 text-red-600 mr-2" />
                  </DropdownMenuItem>
                </motion.div>
              </div>
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Full-Screen Menu Overlay */}
      {isMobileMenuOpen && (
        <Portal>
          <div className="fixed inset-0 z-[9999] md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Content */}
            <div className="relative h-full w-full bg-white flex flex-col">
              {/* Close Button */}
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 z-10"
              >
                <X className="h-8 w-8" />
              </button>

              {/* Carousel Menu */}
              <div className="flex flex-col items-center justify-center flex-1 py-16 px-4">
                {/* Up Chevron Button */}
                <button onClick={prevMenuItem} className="mb-12 p-2 z-10">
                  <ChevronUp className="h-8 w-8 text-muted-foreground" />
                </button>

                {/* Animation Container */}
                <div className="relative h-[calc(6rem+3vw)] flex items-center justify-center overflow-hidden mb-12">
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentMenuIndex}
                      custom={direction}
                      variants={{
                        enter: (dir: "up" | "down") => ({
                          y: dir === "up" ? 150 : -150,
                          opacity: 0,
                          rotateX: dir === "up" ? 40 : -40,
                          scale: 0.95,
                          filter: "blur(6px)",
                        }),
                        center: {
                          y: 0,
                          opacity: 1,
                          rotateX: 0,
                          scale: 1,
                          filter: "blur(0px)",
                          transition: {
                            duration: 0.35,
                            ease: [0.22, 1, 0.36, 1],
                            type: "spring",
                            stiffness: 220,
                            damping: 18,
                          },
                        },
                        exit: (dir: "up" | "down") => ({
                          y: dir === "up" ? -150 : 150,
                          opacity: 0,
                          rotateX: dir === "up" ? -40 : 40,
                          scale: 0.9,
                          filter: "blur(6px)",
                          transition: { duration: 0.3 },
                        }),
                      }}
                      initial={shouldAnimate ? "enter" : "center"}
                      animate="center"
                      exit={shouldAnimate ? "exit" : "center"}
                      onClick={selectCurrentMenuItem}
                      className={`relative text-6xl font-extrabold tracking-tight cursor-pointer text-center select-none ${
                        allMenuItems[currentMenuIndex]?.isLogout
                          ? "text-red-600"
                          : "text-foreground"
                      }`}
                      style={{
                        perspective: 1000,
                        zIndex: 5,
                        pointerEvents: "auto",
                      }}
                    >
                      {allMenuItems[currentMenuIndex]?.name}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Down Chevron Button */}
                <button onClick={nextMenuItem} className="mt-4 p-2 z-10">
                  <ChevronDown className="h-8 w-8 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Notifications Sidebar Popup */}
      <NotificationsPopup
        open={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </>
  );
}
