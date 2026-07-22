"use client";

import {
  useAuth,
  getSupabaseClient,
  logoutToPortal,
  resolveAppHref,
  readActiveAccountIdFromDocumentCookie,
  writeActiveAccountIdToDocumentCookie,
  type UserProfileApp,
} from "@walls/auth";
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
  Menu,
  X,
  ChevronUp,
  ChevronDown,
  Bell,
  Settings,
  BookOpen,
  Building2,
  Check,
  UserRound,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Portal } from "@radix-ui/react-portal";

import profileButtonIcon from "../assets/logos/user-profile-button.png";

/** Notification bell hover — inset shadow + scale, no border ring */
const NOTIFICATION_BELL_HOVER =
  "relative z-10 rounded-full border-0 p-3 transition-all duration-300 ease-in-out group-hover:scale-95 group-hover:bg-neutral-50/80 group-hover:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)]";

const AVATAR_SIZE_PX = 44;
/** Image request size — 2× the display size for retina sharpness. */
const AVATAR_REQUEST_PX = AVATAR_SIZE_PX * 2;

const DEFAULT_SETTINGS_PATH =
  process.env.NEXT_PUBLIC_SETTINGS_URL?.replace(/\/$/, "") || "/settings";

const ADMIN_APP_SLUG = process.env.NEXT_PUBLIC_ADMIN_APP_SLUG ?? "admin";
const ADMIN_CONSOLE_PATH = resolveAppHref({
  slug: ADMIN_APP_SLUG,
  subdomain: ADMIN_APP_SLUG,
  platformBase: "",
});

function isAdminProfileApp(app: UserProfileApp): boolean {
  if (app.slug === ADMIN_APP_SLUG) return true;
  if (app.path?.startsWith(ADMIN_CONSOLE_PATH)) return true;
  const name = app.name?.toLowerCase();
  return name === "admin" || name === "admin console";
}

function partitionProfileApps(apps: UserProfileApp[]) {
  const adminApp = apps.find(isAdminProfileApp) ?? null;
  const regularApps = apps.filter((app) => !isAdminProfileApp(app));
  return { adminApp, regularApps };
}

type ProfileAccount = {
  id: string;
  name: string;
  accountType: "personal" | "organization";
  iconUrl: string | null;
  isDefault: boolean;
};

type AccountMembershipRow = {
  is_default: boolean;
  accounts:
    | {
        id: string;
        name: string;
        account_type: "personal" | "organization";
        icon_url: string | null;
      }
    | {
        id: string;
        name: string;
        account_type: "personal" | "organization";
        icon_url: string | null;
      }[]
    | null;
};

function navigateToPath(
  path: string,
  router: ReturnType<typeof useRouter>,
) {
  if (/^https?:\/\//i.test(path)) {
    window.location.assign(path);
    return;
  }
  router.push(path);
}

function mapAccountMembership(row: AccountMembershipRow): ProfileAccount | null {
  const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    accountType: account.account_type,
    iconUrl: account.icon_url,
    isDefault: Boolean(row.is_default),
  };
}

async function loadProfileAccounts(userId: string): Promise<{
  accounts: ProfileAccount[];
  activeAccountId: string | null;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("account_users")
    .select(
      `is_default, accounts!inner (
        id, name, account_type, icon_url
      )`,
    )
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) {
    console.error("[profile] list accounts:", error);
    return { accounts: [], activeAccountId: null };
  }

  const accounts = (data ?? [])
    .map((row) => mapAccountMembership(row as AccountMembershipRow))
    .filter((account): account is ProfileAccount => account !== null)
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  const preferred = readActiveAccountIdFromDocumentCookie();
  const activeAccountId =
    (preferred && accounts.some((account) => account.id === preferred)
      ? preferred
      : null) ??
    accounts.find((account) => account.isDefault)?.id ??
    accounts[0]?.id ??
    null;

  return { accounts, activeAccountId };
}

async function switchActiveAccount(accountId: string): Promise<void> {
  writeActiveAccountIdToDocumentCookie(accountId);

  // Best-effort: apps with `/api/accounts` also set local httpOnly cookies.
  try {
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
  } catch {
    // Shared cookie is enough for AuthProvider + middleware.
  }
}

function ProfileAccountAvatar({
  account,
  userAvatarUrl,
  size = "sm",
}: {
  account: ProfileAccount;
  userAvatarUrl?: string | null;
  size?: "sm" | "xs";
}) {
  const boxClass = size === "sm" ? "h-7 w-7 rounded-md" : "h-5 w-5 rounded";
  const imageUrl =
    account.iconUrl ??
    (account.accountType === "personal" ? (userAvatarUrl ?? null) : null);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote account icons
      <img
        src={imageUrl}
        alt=""
        className={cn(boxClass, "shrink-0 object-cover")}
      />
    );
  }

  const Icon = account.accountType === "organization" ? Building2 : UserRound;
  const initial = account.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        boxClass,
        account.accountType === "organization"
          ? "bg-white/15 text-white/90"
          : "bg-white/10 text-white/80",
      )}
    >
      {account.accountType === "organization" ? (
        <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      ) : (
        <span className={size === "sm" ? "text-[11px] font-semibold" : "text-[9px] font-semibold"}>
          {initial}
        </span>
      )}
    </span>
  );
}

/** Subtle active-account chip + expandable switcher inside the profile menu. */
function ProfileAccountSwitcher({
  accounts,
  activeAccountId,
  userAvatarUrl,
  switching,
  onSwitch,
}: {
  accounts: ProfileAccount[];
  activeAccountId: string | null;
  userAvatarUrl?: string | null;
  switching: boolean;
  onSwitch: (accountId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0];

  if (!activeAccount) return null;

  const accountKindLabel =
    activeAccount.accountType === "organization" ? "Organization" : "Account";

  // Single linked account: show the account chip without an expand control.
  if (accounts.length < 2) {
    return (
      <div className="mt-3">
        <div
          className="flex w-full items-center gap-2 rounded-xl bg-white/[0.06] px-2.5 py-2"
          aria-label={`Current account: ${activeAccount.name}`}
        >
          <ProfileAccountAvatar
            account={activeAccount}
            userAvatarUrl={userAvatarUrl}
            size="xs"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-white/45">
              {accountKindLabel}
            </span>
            <span className="block truncate text-xs font-medium text-white/90">
              {activeAccount.name}
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={switching}
        aria-expanded={expanded}
        aria-label={`Switch account. Current: ${activeAccount.name}`}
        onClick={() => setExpanded((open) => !open)}
        className="group flex w-full items-center gap-2 rounded-xl bg-white/[0.06] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.1] disabled:opacity-60"
      >
        <ProfileAccountAvatar
          account={activeAccount}
          userAvatarUrl={userAvatarUrl}
          size="xs"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-white/45">
            {accountKindLabel}
          </span>
          <span className="block truncate text-xs font-medium text-white/90">
            {activeAccount.name}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-white/45 transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 space-y-0.5 rounded-xl bg-white/[0.04] p-1">
              {accounts.map((account) => {
                const isActive = account.id === activeAccount.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    disabled={switching || isActive}
                    onClick={() => onSwitch(account.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                      isActive
                        ? "bg-white/10"
                        : "hover:bg-white/[0.07] disabled:opacity-60",
                    )}
                  >
                    <ProfileAccountAvatar
                      account={account}
                      userAvatarUrl={userAvatarUrl}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-xs text-white",
                          isActive ? "font-semibold" : "font-medium text-white/85",
                        )}
                      >
                        {account.name}
                      </span>
                      <span className="block text-[10px] text-white/45">
                        {account.accountType === "organization"
                          ? "Organization"
                          : "Account"}
                      </span>
                    </span>
                    {isActive ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-white/80"
                        strokeWidth={2.75}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

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
            src={profileButtonIcon}
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
            <span className="font-initials text-xl font-medium leading-none tracking-wide text-neutral-500">
              {initials}
            </span>
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
  settingsPath = DEFAULT_SETTINGS_PATH,
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
  const [accounts, setAccounts] = useState<ProfileAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apps = profile?.userApps ?? [];
  const { adminApp, regularApps } = partitionProfileApps(apps);
  // Only show when the active account has an Admin app grant.
  const showAdminConsole = adminApp != null;
  const adminConsolePath = adminApp?.path ?? ADMIN_CONSOLE_PATH;
  const avatarUrl = profile?.avatarUrl ?? null;
  const initials = profile?.initials;
  const showProfileLoading = profileLoading && !profile;

  useEffect(() => {
    if (regularApps.length === 0) return;
    regularApps.forEach((app) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = app.icon;
      document.head.appendChild(link);
    });
  }, [regularApps]);

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

  useEffect(() => {
    if (!user?.id) {
      setAccounts([]);
      setActiveAccountId(null);
      setAccountsLoading(false);
      return;
    }

    let cancelled = false;
    setAccountsLoading(true);
    void (async () => {
      const result = await loadProfileAccounts(user.id);
      if (cancelled) return;
      setAccounts(result.accounts);
      setActiveAccountId(result.activeAccountId);
      setAccountsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSwitchAccount = useCallback(
    async (accountId: string) => {
      if (accountId === activeAccountId || switchingAccount) return;
      setSwitchingAccount(true);
      try {
        await switchActiveAccount(accountId);
        setActiveAccountId(accountId);
        // Apps list + scoped data are account-bound; reload drops stale state.
        window.location.reload();
      } catch {
        setSwitchingAccount(false);
      }
    },
    [activeAccountId, switchingAccount],
  );

  const navigate = useCallback(
    (route: "dashboard" | "settings" | "documentation" | "admin-settings") => {
      return () => {
        switch (route) {
          case "dashboard":
            navigateToPath(dashboardPath, router);
            break;
          case "settings":
            navigateToPath(settingsPath, router);
            break;
          case "documentation":
            navigateToPath(documentationPath, router);
            break;
          case "admin-settings":
            if (adminSettingsPath) {
              navigateToPath(adminSettingsPath, router);
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
    navigateToPath(path, router);
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
    if (!user?.id || regularApps.length === 0) return;
    const supabase = getSupabaseClient();
    await Promise.all(
      regularApps.map((app, i) =>
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
  }, [user?.id, regularApps]);

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
    if (dragIndex === null || dragIndex === dropIndex || regularApps.length === 0)
      return;
    const nextRegular = [...regularApps];
    const [removed] = nextRegular.splice(dragIndex, 1);
    nextRegular.splice(dropIndex, 0, removed);
    updateProfileApps(nextRegular);
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
    ...regularApps,
    ...(showAdminConsole
      ? [{ name: "Admin console", path: adminConsolePath }]
      : []),
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
                    className="group relative flex h-10 w-10 flex-shrink-0 items-center justify-center border-0 p-0 text-slate-600 shadow-none outline-none ring-0 hover:bg-transparent focus:outline-none focus-visible:ring-0"
                  >
                    <div
                      className={`${NOTIFICATION_BELL_HOVER} flex items-center justify-center overflow-visible`}
                    >
                      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-visible">
                        <Bell className="h-[18px] w-[18px] stroke-[1.75] text-neutral-600 transition-colors duration-300 group-hover:text-neutral-800" />
                        {hasUnreadNotifications && (
                          <span
                            className="pointer-events-none absolute -right-px -top-px z-20 h-1.5 w-1.5 rounded-full bg-[var(--kenoo-light)] ring-[1.5px] ring-white"
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
            className="z-[110] w-[min(100vw-2rem,384px)] overflow-hidden rounded-3xl border-0 bg-kenoo-white p-0 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] outline-none ring-0"
          >
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {/* Branded header band */}
              <div className="relative overflow-hidden bg-neutral-950 px-4 pb-5 pt-4 text-kenoo-white">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-kenoo-blue/40 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-kenoo-yellow/20 blur-3xl"
                />
                <div className="relative flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/30">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt=""
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-initials flex h-full w-full items-center justify-center text-lg font-medium leading-none tracking-wide text-white">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {profile?.userFullName || "Your account"}
                      </p>
                      {showAdminConsole ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigateToPath(adminConsolePath, router);
                          }}
                          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          Admin console
                        </button>
                      ) : null}
                    </div>
                    {user.email ? (
                      <p className="truncate text-xs text-white/60">
                        {user.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                {!accountsLoading && accounts.length > 1 ? (
                  <ProfileAccountSwitcher
                    accounts={accounts}
                    activeAccountId={activeAccountId}
                    userAvatarUrl={avatarUrl}
                    switching={switchingAccount}
                    onSwitch={handleSwitchAccount}
                  />
                ) : null}
              </div>

              {/* Body */}
              <div className="p-3">
                {/* Apps */}
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Your apps
                  </p>
                  {reorderMode ? (
                    <button
                      type="button"
                      onClick={saveAppOrder}
                      className="text-[11px] font-semibold text-kenoo-blue hover:underline"
                    >
                      Done
                    </button>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "grid grid-cols-3 gap-1.5",
                    regularApps.length > 6 &&
                      "max-h-[min(300px,calc(100vh-360px))] overflow-y-auto pr-0.5",
                  )}
                  style={
                    regularApps.length > 6
                      ? ({
                          scrollbarWidth: "thin",
                          scrollbarColor: "#d4d4d8 transparent",
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {regularApps.map((app, index) => (
                    <div
                      key={app.app_id}
                      draggable={reorderMode}
                      onDragStart={() => reorderMode && handleDragStart(index)}
                      onDragOver={(e) => reorderMode && handleDragOver(e, index)}
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
                            ? 0.55
                            : 1,
                      }}
                    >
                      <DropdownMenuItem
                        onClick={(e) => {
                          if (reorderMode) {
                            e.preventDefault();
                            return;
                          }
                          navigateToPath(app.path, router);
                        }}
                        className="group flex h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl p-2.5 transition-all hover:bg-neutral-50 focus:bg-neutral-50"
                      >
                        <div
                          className={cn(
                            "pointer-events-none relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-white to-neutral-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.15)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_18px_-6px_rgba(0,0,0,0.25)]",
                            reorderMode && "animate-pulse",
                          )}
                        >
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent"
                          />
                          <Image
                            src={app.icon}
                            alt=""
                            width={40}
                            height={40}
                            priority
                          />
                        </div>
                        <span className="pointer-events-none line-clamp-2 text-center text-[11px] font-medium leading-tight text-neutral-700">
                          {app.name}
                        </span>
                      </DropdownMenuItem>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-neutral-100 pt-3">
                  <DropdownMenuItem
                    onClick={navigate("documentation")}
                    className="group/qa flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 outline-none transition-colors focus:bg-transparent"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-all duration-200 group-hover/qa:bg-neutral-700 group-hover/qa:text-white group-focus/qa:bg-neutral-700 group-focus/qa:text-white">
                      <BookOpen className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[11px] font-medium text-neutral-500 transition-colors group-hover/qa:text-neutral-700 group-focus/qa:text-neutral-700">
                      Docs
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={navigate("settings")}
                    className="group/qa flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 outline-none transition-colors focus:bg-transparent"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-all duration-200 group-hover/qa:bg-neutral-700 group-hover/qa:text-white group-focus/qa:bg-neutral-700 group-focus/qa:text-white">
                      <Settings className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[11px] font-medium text-neutral-500 transition-colors group-hover/qa:text-neutral-700 group-focus/qa:text-neutral-700">
                      Settings
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="group/qa flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 outline-none transition-colors focus:bg-transparent"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 transition-all duration-200 group-hover/qa:bg-red-600 group-hover/qa:text-white group-focus/qa:bg-red-600 group-focus/qa:text-white">
                      <LogOut className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[11px] font-medium text-red-500 transition-colors group-hover/qa:text-red-600 group-focus/qa:text-red-600">
                      Log out
                    </span>
                  </DropdownMenuItem>
                </div>
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

              {!accountsLoading && accounts.length > 1 ? (
                <div className="shrink-0 border-b border-neutral-100 px-4 pb-3 pt-16">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Switch account
                  </p>
                  <div className="space-y-1">
                    {accounts.map((account) => {
                      const isActive = account.id === activeAccountId;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          disabled={switchingAccount || isActive}
                          onClick={() => void handleSwitchAccount(account.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                            isActive
                              ? "bg-neutral-100"
                              : "hover:bg-neutral-50 disabled:opacity-60",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg",
                              account.accountType === "organization"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-neutral-100 text-neutral-600",
                            )}
                          >
                            {account.iconUrl ||
                            (account.accountType === "personal" && avatarUrl) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={
                                  account.iconUrl ??
                                  (avatarUrl as string)
                                }
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : account.accountType === "organization" ? (
                              <Building2 className="h-4 w-4" />
                            ) : (
                              <span className="text-sm font-semibold">
                                {account.name.trim().charAt(0).toUpperCase() ||
                                  "?"}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-sm text-foreground",
                                isActive ? "font-semibold" : "font-medium",
                              )}
                            >
                              {account.name}
                            </span>
                            <span className="block text-xs text-neutral-500">
                              {account.accountType === "organization"
                                ? "Organization"
                                : "Account"}
                            </span>
                          </span>
                          {isActive ? (
                            <Check
                              className="h-4 w-4 shrink-0 text-foreground"
                              strokeWidth={2.75}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

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
