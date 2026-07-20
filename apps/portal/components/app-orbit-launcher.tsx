"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

import { cn } from "@walls/ui/utils";
import type { PortalLauncherApp } from "@/lib/user-apps";
import {
  PortalAccountSwitcher,
  type PortalAccountOption,
} from "@/components/portal-account-switcher";

export type { PortalAccountOption };

export type AppOrbitLauncherProps = {
  firstName: string | null;
  avatarUrl: string | null;
  isLoadingUserData: boolean;
  apps: PortalLauncherApp[];
  appsLoading: boolean;
  /** When true, only show the greeting splash (deep-link redirect). */
  redirectMode?: boolean;
  accounts?: PortalAccountOption[];
  activeAccountId?: string | null;
  onAccountChange?: (accountId: string) => void | Promise<void>;
  accountsLoading?: boolean;
};

const easeOut = [0.22, 1, 0.36, 1] as const;

function Avatar({
  avatarUrl,
  isLoadingUserData,
  size = "lg",
}: {
  avatarUrl: string | null;
  isLoadingUserData: boolean;
  size?: "lg" | "md";
}) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const px = size === "lg" ? 128 : 72;

  React.useEffect(() => {
    setImageLoaded(false);
  }, [avatarUrl]);

  const showSkeleton =
    isLoadingUserData || (Boolean(avatarUrl) && !imageLoaded) || !avatarUrl;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-kenoo-surface ring-1 ring-kenoo-border"
      style={{ width: px, height: px }}
    >
      <div
        className={`absolute inset-0 bg-kenoo-subtle transition-opacity duration-300 ${
          showSkeleton ? "animate-pulse opacity-100" : "opacity-0"
        }`}
      />
      {avatarUrl && !isLoadingUserData && (
        <Image
          src={avatarUrl}
          alt=""
          width={px * 2}
          height={px * 2}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
          priority
        />
      )}
    </div>
  );
}

function AppTile({
  app,
  index,
}: {
  app: PortalLauncherApp;
  index: number;
}) {
  return (
    <motion.a
      href={app.href}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * Math.min(index, 12), duration: 0.35, ease: easeOut }}
      className="group flex w-[5.25rem] shrink-0 snap-center flex-col items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-kenoo-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-kenoo-canvas sm:w-[5.75rem]"
      aria-label={`Open ${app.name}`}
    >
      <div
        className={cn(
          "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-white to-neutral-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.15)] transition-all duration-200 sm:h-16 sm:w-16",
          "group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_18px_-6px_rgba(0,0,0,0.25)]",
          "group-active:translate-y-0 group-active:scale-[0.97]",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent"
        />
        <Image
          src={app.icon}
          alt=""
          width={48}
          height={48}
          className="relative h-10 w-10 object-contain sm:h-11 sm:w-11"
        />
      </div>
      <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight tracking-[-0.01em] text-neutral-700 transition-colors duration-200 group-hover:text-neutral-900 sm:text-xs">
        {app.name}
      </span>
    </motion.a>
  );
}

function AppSlider({ apps }: { apps: PortalLauncherApp[] }) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);

  const updateEdges = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const hasOverflow = max > 4;
    setOverflows(hasOverflow);
    setCanPrev(hasOverflow && el.scrollLeft > 4);
    setCanNext(hasOverflow && el.scrollLeft < max - 4);
  }, []);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateEdges())
        : null;
    resizeObserver?.observe(el);

    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
      resizeObserver?.disconnect();
    };
  }, [apps.length, updateEdges]);

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.min(280, el.clientWidth * 0.7),
      behavior: "smooth",
    });
  };

  return (
    <div className="relative w-full max-w-4xl px-2 sm:px-4">
      <div className="absolute -left-1 top-1/2 z-20 -translate-y-1/2 sm:-left-4">
        <AnimatePresence>
          {canPrev && (
            <motion.button
              key="prev"
              type="button"
              onClick={() => scrollByDir(-1)}
              aria-label="Previous apps"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22, ease: easeOut }}
              className="flex h-9 w-9 items-center justify-center text-kenoo-muted transition-colors hover:text-kenoo-ink"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="absolute -right-1 top-1/2 z-20 -translate-y-1/2 sm:-right-4">
        <AnimatePresence>
          {canNext && (
            <motion.button
              key="next"
              type="button"
              onClick={() => scrollByDir(1)}
              aria-label="Next apps"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.22, ease: easeOut }}
              className="flex h-9 w-9 items-center justify-center text-kenoo-muted transition-colors hover:text-kenoo-ink"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-2 z-10 w-10 bg-gradient-to-r from-kenoo-canvas to-transparent transition-opacity duration-200 sm:left-4",
          canPrev ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-2 z-10 w-10 bg-gradient-to-l from-kenoo-canvas to-transparent transition-opacity duration-200 sm:right-4",
          canNext ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        ref={scrollerRef}
        className={cn(
          "flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth py-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden",
          overflows
            ? "justify-start px-10 sm:px-14"
            : "justify-center px-4 sm:px-6",
        )}
      >
        {apps.map((app, index) => (
          <AppTile key={app.app_id} app={app} index={index} />
        ))}
      </div>
    </div>
  );
}

export function AppOrbitLauncher({
  firstName,
  avatarUrl,
  isLoadingUserData,
  apps,
  appsLoading,
  redirectMode = false,
  accounts = [],
  activeAccountId = null,
  onAccountChange,
  accountsLoading = false,
}: AppOrbitLauncherProps) {
  const [phase, setPhase] = React.useState<"greeting" | "launcher">("greeting");

  React.useEffect(() => {
    if (redirectMode || isLoadingUserData) return;
    const timer = window.setTimeout(() => setPhase("launcher"), 2100);
    return () => window.clearTimeout(timer);
  }, [redirectMode, isLoadingUserData]);

  const showGreeting =
    !isLoadingUserData && Boolean(firstName) && phase === "greeting";
  const showLauncher = !redirectMode && phase === "launcher" && !appsLoading;

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-2 py-4 sm:px-4">
      <AnimatePresence mode="wait">
        {showGreeting ? (
          <motion.div
            key="greeting"
            className="relative z-10 flex flex-col items-center gap-7 py-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: easeOut }}
          >
            <Avatar
              avatarUrl={avatarUrl}
              isLoadingUserData={isLoadingUserData}
              size="lg"
            />
            <h2 className="font-display text-[2rem] font-semibold tracking-[-0.04em] text-kenoo-ink sm:text-[2.35rem]">
              <motion.span
                className="inline-block text-kenoo-muted"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25, ease: easeOut }}
              >
                Hello,
              </motion.span>{" "}
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.85, ease: easeOut }}
              >
                {firstName}
              </motion.span>
            </h2>
          </motion.div>
        ) : showLauncher ? (
          <motion.div
            key="launcher"
            className="relative z-10 flex w-full flex-col items-center gap-8 sm:gap-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <div className="flex flex-col items-center gap-3">
              <Avatar
                avatarUrl={avatarUrl}
                isLoadingUserData={isLoadingUserData}
                size="md"
              />
              {firstName ? (
                <div className="text-center">
                  <p className="font-display text-[15px] font-semibold tracking-[-0.02em] text-kenoo-ink">
                    {firstName}
                  </p>
                  <p className="mt-0.5 text-[12px] font-normal tracking-[-0.01em] text-kenoo-muted">
                    Choose an app to continue
                  </p>
                </div>
              ) : null}
              {accounts.length > 1 && onAccountChange ? (
                <div className="mt-1">
                  <PortalAccountSwitcher
                    accounts={accounts}
                    activeAccountId={activeAccountId}
                    onAccountChange={onAccountChange}
                    loading={accountsLoading}
                    userAvatarUrl={avatarUrl}
                  />
                </div>
              ) : null}
            </div>

            {apps.length === 0 ? (
              <p className="text-sm text-kenoo-muted">No apps assigned yet</p>
            ) : (
              <AppSlider apps={apps} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            className="relative z-10 flex flex-col items-center gap-6 py-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Avatar
              avatarUrl={avatarUrl}
              isLoadingUserData={isLoadingUserData}
              size="lg"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
