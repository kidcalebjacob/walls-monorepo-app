"use client";

import { motion } from "framer-motion";

import { ChromeFrame } from "@/components/kenoo/chrome-frame";
import { ProductMock } from "@/components/kenoo/product-mock";
import { KENOO_PORTAL_URL } from "@/lib/urls";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 md:pt-[4.25rem]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(11,110,255,0.10), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(17,17,17,0.03), transparent 50%), linear-gradient(180deg, #fcfcfc 0%, #ffffff 55%, #fcfcfc 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-16 md:px-8 md:pb-12 md:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="font-display text-[2.65rem] font-semibold leading-[1.05] tracking-[-0.045em] text-kenoo-ink sm:text-5xl md:text-[3.75rem]">
            Powerful tools.
            <br />
            Simply designed.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-kenoo-muted md:text-lg">
            An AI-native business OS for CRM, projects, calendar, finance, and
            workflows. Built to stay capable without feeling complicated.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ChromeFrame className="w-full min-w-[10.5rem] sm:w-auto">
              <a
                href={KENOO_PORTAL_URL}
                className="inline-flex h-11 w-full min-w-[10.5rem] items-center justify-center rounded-[10.5px] bg-kenoo-white px-5 text-sm font-medium text-kenoo-ink transition-colors hover:bg-kenoo-subtle"
              >
                Get started
              </a>
            </ChromeFrame>
            <a
              href="/product"
              className="inline-flex h-11 items-center justify-center px-2 text-sm font-medium text-kenoo-muted transition-colors hover:text-kenoo-ink"
            >
              See the product →
            </a>
          </div>
        </motion.div>
      </div>

      <ProductMock />
    </section>
  );
}
