"use client";

import { KenooWordmark } from "@walls/ui/kenoo-wordmark";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ChromeFrame } from "@/components/kenoo/chrome-frame";
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
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

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
    setHidden(false);
  }, [pathname]);

  const isHidden = hidden && !open;

  return (
    <motion.header
      initial={false}
      animate={{ y: isHidden ? "-100%" : "0%" }}
      transition={{ duration: 0.45, ease: headerEase }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-300",
        scrolled || open
          ? "border-b border-kenoo-border/80 bg-kenoo-canvas/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="relative flex h-16 w-full items-center justify-between px-5 md:h-[4.25rem] md:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="Kenoo home">
          <KenooWordmark priority className="h-6 md:h-7" />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 md:flex lg:gap-11">
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

      {open ? (
        <div className="border-t border-kenoo-border bg-kenoo-canvas px-5 pb-6 pt-4 md:hidden">
          <nav className="flex flex-col gap-1">
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
