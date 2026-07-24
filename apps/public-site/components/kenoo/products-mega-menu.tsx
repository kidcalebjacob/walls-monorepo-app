"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PublicApp } from "@/lib/apps";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type ProductsMegaMenuProps = {
  open: boolean;
  apps: PublicApp[];
  loading?: boolean;
  onClose: () => void;
};

function AppIcon({ app, size = 40 }: { app: PublicApp; size?: number }) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-white to-kenoo-subtle shadow-[0_2px_6px_-2px_rgba(0,0,0,0.12)]",
        size >= 40 ? "h-12 w-12" : "h-10 w-10",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent"
      />
      <Image
        src={app.icon}
        alt=""
        width={size}
        height={size}
        className="relative object-contain"
      />
    </div>
  );
}

export function ProductsMegaMenu({
  open,
  apps,
  loading = false,
  onClose,
}: ProductsMegaMenuProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="products-mega"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease }}
          className="absolute inset-x-0 top-full hidden md:block"
          role="region"
          aria-label="Products menu"
        >
          <div className="border-b border-kenoo-border bg-kenoo-canvas/95 shadow-[0_24px_48px_-28px_rgba(17,17,17,0.35)] backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-6 py-7 lg:px-8">
              <div className="flex items-end justify-between gap-6">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
                    Apps
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.03em] text-kenoo-ink">
                    Everything in Kenoo
                  </h3>
                </div>
                <Link
                  href="/product"
                  onClick={onClose}
                  className="hidden shrink-0 items-center gap-1 text-sm text-kenoo-accent transition-colors hover:text-kenoo-accent-hover sm:inline-flex"
                >
                  Explore product
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>

              {loading && apps.length === 0 ? (
                <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[5.5rem] animate-pulse rounded-2xl bg-kenoo-subtle/80"
                    />
                  ))}
                </div>
              ) : (
                <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {apps.map((app) => (
                    <li key={app.id}>
                      <a
                        href={app.href}
                        onClick={onClose}
                        className="group flex h-full items-start gap-3 rounded-2xl border border-transparent px-3 py-3 transition-colors hover:border-kenoo-border hover:bg-kenoo-white"
                      >
                        <AppIcon app={app} />
                        <span className="min-w-0 pt-0.5">
                          <span className="block text-sm font-medium text-kenoo-ink">
                            {app.name}
                          </span>
                          {app.description ? (
                            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-kenoo-muted">
                              {app.description}
                            </span>
                          ) : null}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-kenoo-border">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5 lg:px-8">
                <p className="text-xs text-kenoo-muted">
                  One Business OS across every app.
                </p>
                <Link
                  href="/product"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-sm font-medium text-kenoo-ink transition-colors hover:text-kenoo-accent"
                >
                  Explore all products
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function MobileProductsList({
  apps,
  loading = false,
}: {
  apps: PublicApp[];
  loading?: boolean;
}) {
  if (loading && apps.length === 0) {
    return (
      <div className="mb-2 ml-2 space-y-1 border-l border-kenoo-border pl-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-xl bg-kenoo-subtle/80"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-2 ml-2 border-l border-kenoo-border pl-3">
      <Link
        href="/product"
        className="block rounded-xl px-3 py-2.5 text-sm text-kenoo-muted"
      >
        All products
      </Link>
      {apps.map((app) => (
        <a
          key={app.id}
          href={app.href}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-kenoo-ink"
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-white to-kenoo-subtle shadow-[0_1px_4px_-1px_rgba(0,0,0,0.12)]">
            <Image
              src={app.icon}
              alt=""
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          {app.name}
        </a>
      ))}
    </div>
  );
}
