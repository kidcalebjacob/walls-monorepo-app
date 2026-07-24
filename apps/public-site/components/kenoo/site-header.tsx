"use client";

import { KenooWordmark } from "@walls/ui/kenoo-wordmark";
import { createClient } from "@walls/supabase/client";
import { motion } from "framer-motion";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ChromeFrame } from "@/components/kenoo/chrome-frame";
import {
  MobileProductsList,
  ProductsMegaMenu,
} from "@/components/kenoo/products-mega-menu";
import {
  mapAppsRows,
  PUBLIC_APPS_SELECT,
  type PublicApp,
} from "@/lib/apps";
import { KENOO_PORTAL_URL } from "@/lib/urls";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/solutions", label: "Solutions" },
  { href: "/resources", label: "Resources" },
  { href: "/enterprise", label: "Enterprise" },
];

const headerEase = [0.22, 1, 0.36, 1] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [apps, setApps] = useState<PublicApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openProducts = () => {
    clearCloseTimer();
    setProductsOpen(true);
  };

  const scheduleCloseProducts = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setProductsOpen(false), 140);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadApps() {
      setAppsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("apps")
          .select(PUBLIC_APPS_SELECT)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (cancelled) return;
        if (error) {
          console.error("[public-site] Failed to load apps:", error.message);
          setApps([]);
          return;
        }

        setApps(mapAppsRows(data ?? []));
      } catch (error) {
        if (!cancelled) {
          console.error("[public-site] Failed to load apps:", error);
          setApps([]);
        }
      } finally {
        if (!cancelled) setAppsLoading(false);
      }
    }

    void loadApps();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;

      setScrolled(y > 8);

      // Always show near the top; hide on downward scroll, reveal on upward.
      if (y < 24) {
        setHidden(false);
      } else if (delta > 6) {
        setHidden(true);
        setProductsOpen(false);
      } else if (delta < -6) {
        setHidden(false);
      }

      lastY = y;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setProductsOpen(false);
    setMobileProductsOpen(false);
    setHidden(false);
  }, [pathname]);

  useEffect(() => {
    if (!productsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProductsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [productsOpen]);

  useEffect(() => () => clearCloseTimer(), []);

  const isHidden = hidden && !open;
  const productsActive = pathname === "/product" || productsOpen;

  return (
    <motion.header
      initial={false}
      animate={{ y: isHidden ? "-100%" : "0%" }}
      transition={{ duration: 0.45, ease: headerEase }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-300",
        scrolled || open || productsOpen
          ? "border-b border-kenoo-border/80 bg-kenoo-canvas/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="relative" onMouseLeave={scheduleCloseProducts}>
        <div className="relative flex h-16 w-full items-center justify-between px-5 md:h-[4.25rem] md:px-6 lg:px-8">
          <Link href="/" className="flex items-center" aria-label="Kenoo home">
            <KenooWordmark priority className="h-6 md:h-7" />
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 md:flex lg:gap-11">
            <div onMouseEnter={openProducts}>
              <Link
                href="/product"
                aria-expanded={productsOpen}
                aria-haspopup="true"
                className={cn(
                  "inline-flex items-center gap-1 whitespace-nowrap text-base transition-colors",
                  productsActive
                    ? "text-kenoo-ink"
                    : "text-kenoo-muted hover:text-kenoo-ink",
                )}
                onFocus={openProducts}
              >
                Products
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    productsOpen && "rotate-180",
                  )}
                />
              </Link>
            </div>

            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap text-base transition-colors",
                  pathname === item.href
                    ? "text-kenoo-ink"
                    : "text-kenoo-muted hover:text-kenoo-ink",
                )}
                onMouseEnter={scheduleCloseProducts}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href={KENOO_PORTAL_URL}
              className="rounded-xl px-3.5 py-2 text-base text-kenoo-muted transition-colors hover:text-kenoo-ink"
            >
              Sign in
            </a>
            <ChromeFrame>
              <a
                href={KENOO_PORTAL_URL}
                className="inline-flex items-center justify-center rounded-[10.5px] bg-kenoo-white px-4 py-2 text-base font-medium text-kenoo-ink transition-colors hover:bg-kenoo-subtle"
              >
                Get started
              </a>
            </ChromeFrame>
          </div>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            className="rounded-xl p-2 text-kenoo-ink md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <div onMouseEnter={openProducts}>
          <ProductsMegaMenu
            open={productsOpen}
            apps={apps}
            loading={appsLoading}
            onClose={() => setProductsOpen(false)}
          />
        </div>
      </div>

      {open ? (
        <div className="border-t border-kenoo-border bg-kenoo-canvas px-5 pb-6 pt-4 md:hidden">
          <nav className="flex flex-col gap-1">
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-base text-kenoo-ink"
                aria-expanded={mobileProductsOpen}
                onClick={() => setMobileProductsOpen((v) => !v)}
              >
                Products
                <ChevronDown
                  className={cn(
                    "size-4 text-kenoo-muted transition-transform duration-200",
                    mobileProductsOpen && "rotate-180",
                  )}
                />
              </button>
              {mobileProductsOpen ? (
                <MobileProductsList apps={apps} loading={appsLoading} />
              ) : null}
            </div>

            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-3 text-base text-kenoo-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={KENOO_PORTAL_URL}
              className="rounded-xl border border-kenoo-border px-4 py-3 text-center text-sm text-kenoo-ink"
            >
              Sign in
            </a>
            <ChromeFrame className="w-full">
              <a
                href={KENOO_PORTAL_URL}
                className="inline-flex w-full items-center justify-center rounded-[10.5px] bg-kenoo-white px-4 py-3 text-center text-sm font-medium text-kenoo-ink transition-colors hover:bg-kenoo-subtle"
              >
                Get started
              </a>
            </ChromeFrame>
          </div>
        </div>
      ) : null}
    </motion.header>
  );
}
