"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SuiteOrb } from "@/components/kenoo/suite-orb";
import { KENOO_SUITES } from "@/lib/suites";
import { KENOO_PORTAL_URL } from "@/lib/urls";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function SuiteShowcase() {
  const [suiteIndex, setSuiteIndex] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [capIndex, setCapIndex] = useState(0);

  const suite = KENOO_SUITES[suiteIndex]!;
  const feature = suite.features[featureIndex]!;
  const capabilities = feature.capabilities;
  const active = capabilities[capIndex]!;

  const prevCap =
    capabilities[(capIndex - 1 + capabilities.length) % capabilities.length]!;
  const nextCap = capabilities[(capIndex + 1) % capabilities.length]!;
  const farPrev =
    capabilities[(capIndex - 2 + capabilities.length) % capabilities.length]!;
  const farNext = capabilities[(capIndex + 2) % capabilities.length]!;

  useEffect(() => {
    setFeatureIndex(0);
    setCapIndex(0);
  }, [suiteIndex]);

  useEffect(() => {
    setCapIndex(0);
  }, [featureIndex]);

  function goPrev() {
    setCapIndex((i) => (i - 1 + capabilities.length) % capabilities.length);
  }

  function goNext() {
    setCapIndex((i) => (i + 1) % capabilities.length);
  }

  return (
    <section className="border-t border-kenoo-border bg-kenoo-canvas">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-16">
          <div className="max-w-md">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-kenoo-ink md:text-4xl">
              One OS.
              <br />
              Seven apps.
            </h2>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={KENOO_PORTAL_URL}
                className="inline-flex h-11 items-center justify-center rounded-full bg-kenoo-ink px-5 text-sm font-medium text-white transition-colors hover:bg-black"
              >
                Get started
              </a>
              <a
                href="/contact"
                className="inline-flex h-11 items-center justify-center rounded-full border border-kenoo-border bg-kenoo-surface px-5 text-sm font-medium text-kenoo-ink transition-colors hover:bg-kenoo-subtle"
              >
                Talk to us
              </a>
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={suite.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease }}
              className="max-w-sm text-base leading-relaxed text-kenoo-muted md:pt-10 md:text-right"
            >
              {suite.description}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-12 overflow-hidden rounded-[2rem] bg-[#ececeb] md:mt-14 md:rounded-[2.5rem]">
          <div className="flex items-center gap-1 overflow-x-auto px-4 pt-4 md:justify-center md:px-6 md:pt-5">
            {KENOO_SUITES.map((s, i) => {
              const selected = i === suiteIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSuiteIndex(i)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all",
                    selected
                      ? "bg-white text-kenoo-ink shadow-sm"
                      : "text-kenoo-muted hover:text-kenoo-ink",
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]"
                    style={{ backgroundColor: s.dot, color: s.dot }}
                    aria-hidden
                  />
                  {s.name}
                </button>
              );
            })}
          </div>

          <div className="relative px-2 pb-4 pt-8 md:px-6 md:pb-6 md:pt-12">
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={goPrev}
                className="relative z-30 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-kenoo-muted transition-colors hover:bg-white/60 hover:text-kenoo-ink md:flex"
                aria-label="Previous"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="relative flex h-[13rem] w-full max-w-2xl items-center justify-center md:h-[16rem]">
                {/* Far-left ghost */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-[-2%] top-1/2 z-0 hidden -translate-y-1/2 lg:block"
                >
                  <SuiteOrb capability={farPrev} size="xs" blurred />
                </div>

                {/* Left neighbor */}
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-[4%] top-1/2 z-10 -translate-y-1/2 transition-transform hover:scale-[1.03] sm:left-[6%] md:left-[8%]"
                  aria-label="Show previous capability"
                >
                  <SuiteOrb capability={prevCap} size="md" dimmed />
                </button>

                {/* Active center */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${suite.id}-${feature.id}-${active.id}`}
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -8 }}
                    transition={{ duration: 0.4, ease }}
                    className="relative z-20"
                  >
                    <SuiteOrb capability={active} size="lg" active />
                  </motion.div>
                </AnimatePresence>

                {/* Right neighbor */}
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-[4%] top-1/2 z-10 -translate-y-1/2 transition-transform hover:scale-[1.03] sm:right-[6%] md:right-[8%]"
                  aria-label="Show next capability"
                >
                  <SuiteOrb capability={nextCap} size="md" dimmed />
                </button>

                {/* Far-right ghost */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute right-[-2%] top-1/2 z-0 hidden -translate-y-1/2 lg:block"
                >
                  <SuiteOrb capability={farNext} size="xs" blurred />
                </div>
              </div>

              <button
                type="button"
                onClick={goNext}
                className="relative z-30 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-kenoo-muted transition-colors hover:bg-white/60 hover:text-kenoo-ink md:flex"
                aria-label="Next"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mx-auto mt-6 flex max-w-md items-start justify-center gap-4 md:mt-8">
              <button
                type="button"
                onClick={goPrev}
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-kenoo-muted transition-colors hover:text-kenoo-ink md:hidden"
                aria-label="Previous"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${suite.id}-${feature.id}-${active.id}-copy`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease }}
                  className="min-w-0 flex-1 text-center"
                >
                  <Link
                    href={active.href}
                    className="group inline-flex items-center gap-1.5 font-display text-xl font-semibold tracking-[-0.03em] text-kenoo-ink md:text-2xl"
                  >
                    {active.title}
                    <ArrowUpRight className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100" />
                  </Link>
                  <p className="mt-2 text-sm leading-relaxed text-kenoo-muted md:text-[0.95rem]">
                    {active.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              <button
                type="button"
                onClick={goNext}
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-kenoo-muted transition-colors hover:text-kenoo-ink md:hidden"
                aria-label="Next"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-black/[0.04] px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6 md:py-5">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {suite.features.map((f, i) => {
                const selected = i === featureIndex;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFeatureIndex(i)}
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-3.5 py-2 text-sm transition-all",
                      selected
                        ? "bg-white font-medium text-kenoo-ink shadow-sm"
                        : "text-kenoo-muted hover:text-kenoo-ink",
                    )}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
            <a
              href={KENOO_PORTAL_URL}
              className="inline-flex h-10 shrink-0 items-center justify-center self-end rounded-full bg-kenoo-ink px-5 text-sm font-medium text-white transition-colors hover:bg-black md:self-auto"
            >
              Get started
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
