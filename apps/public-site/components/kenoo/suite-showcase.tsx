"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SuiteOrb } from "@/components/kenoo/suite-orb";
import { KENOO_SUITES, type SuiteCapability } from "@/lib/suites";
import { KENOO_PORTAL_URL } from "@/lib/urls";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const orbSpring = {
  type: "spring" as const,
  stiffness: 210,
  damping: 30,
  mass: 0.85,
};

/** Slot-to-slot glide — a bit softer than the tab pill spring. */
const orbSlide = {
  type: "spring" as const,
  stiffness: 170,
  damping: 28,
  mass: 0.95,
};

const softEase = {
  duration: 0.42,
  ease,
};

const setSwapEase = {
  duration: 0.48,
  ease,
};

type SlotStyle = {
  left: string;
  scale: number;
  opacity: number;
  zIndex: number;
};

/** Visual slots by circular offset from the active capability. */
const SLOT: Record<number, SlotStyle> = {
  [-2]: { left: "6%", scale: 0.32, opacity: 0.3, zIndex: 0 },
  [-1]: { left: "22%", scale: 0.62, opacity: 0.75, zIndex: 10 },
  [0]: { left: "50%", scale: 1, opacity: 1, zIndex: 20 },
  [1]: { left: "78%", scale: 0.62, opacity: 0.75, zIndex: 10 },
  [2]: { left: "94%", scale: 0.32, opacity: 0.3, zIndex: 0 },
};

function circularOffset(index: number, active: number, length: number) {
  let offset = index - active;
  const maxPos = Math.floor(length / 2);
  const maxNeg = -Math.floor((length - 1) / 2);
  while (offset > maxPos) offset -= length;
  while (offset < maxNeg) offset += length;
  return offset;
}

function slotForOffset(offset: number): SlotStyle {
  if (Math.abs(offset) <= 2) return SLOT[offset]!;
  return {
    left: offset < 0 ? "-4%" : "104%",
    scale: 0.22,
    opacity: 0,
    zIndex: 0,
  };
}

const copyVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * 16,
    y: direction === 0 ? 6 : 0,
    filter: "blur(4px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * -12,
    y: direction === 0 ? -4 : 0,
    filter: "blur(3px)",
  }),
};

/** Whole-set crossfade when suite / feature toggles change. */
const setSwapVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * 36,
    scale: 0.9,
    filter: "blur(10px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * -28,
    scale: 0.94,
    filter: "blur(8px)",
  }),
};

function OrbCarousel({
  setKey,
  capabilities,
  capIndex,
  direction,
  onSelectOffset,
}: {
  setKey: string;
  capabilities: SuiteCapability[];
  capIndex: number;
  direction: number;
  onSelectOffset: (offset: -1 | 1) => void;
}) {
  return (
    <div className="relative flex h-[13rem] w-full max-w-2xl items-center justify-center overflow-visible md:h-[16rem]">
      <AnimatePresence mode="sync" custom={direction} initial={false}>
        <motion.div
          key={setKey}
          custom={direction}
          variants={setSwapVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={setSwapEase}
          className="absolute inset-0 will-change-transform"
        >
          {capabilities.map((cap, index) => {
            const offset = circularOffset(
              index,
              capIndex,
              capabilities.length,
            );
            const slot = slotForOffset(offset);
            const isActive = offset === 0;
            const isNeighbor = Math.abs(offset) === 1;
            const isGhost = Math.abs(offset) === 2;
            const isHidden = Math.abs(offset) > 2;

            return (
              <motion.div
                key={cap.id}
                className={cn(
                  "absolute top-1/2",
                  isGhost && "pointer-events-none max-lg:invisible",
                  isHidden && "pointer-events-none",
                  isActive && "pointer-events-none",
                  isNeighbor && "cursor-pointer",
                )}
                initial={false}
                animate={{
                  left: slot.left,
                  x: "-50%",
                  y: "-50%",
                  scale: slot.scale,
                  opacity: slot.opacity,
                  zIndex: slot.zIndex,
                }}
                transition={orbSlide}
                whileHover={
                  isNeighbor
                    ? {
                        scale: slot.scale * 1.05,
                        opacity: Math.min(1, slot.opacity + 0.12),
                      }
                    : undefined
                }
                whileTap={
                  isNeighbor ? { scale: slot.scale * 0.97 } : undefined
                }
                onClick={
                  isNeighbor
                    ? () => onSelectOffset(offset as -1 | 1)
                    : undefined
                }
                onKeyDown={
                  isNeighbor
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectOffset(offset as -1 | 1);
                        }
                      }
                    : undefined
                }
                role={isNeighbor ? "button" : undefined}
                tabIndex={isNeighbor ? 0 : undefined}
                aria-label={
                  isNeighbor
                    ? offset < 0
                      ? "Show previous capability"
                      : "Show next capability"
                    : undefined
                }
                aria-hidden={isGhost || isHidden || undefined}
              >
                <SuiteOrb
                  capability={cap}
                  size="lg"
                  active={isActive}
                  dimmed={isNeighbor}
                  blurred={isGhost || isHidden}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function SuiteShowcase() {
  const [suiteIndex, setSuiteIndex] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [capIndex, setCapIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const suite = KENOO_SUITES[suiteIndex]!;
  const feature = suite.features[featureIndex]!;
  const capabilities = feature.capabilities;
  const active = capabilities[capIndex]!;

  useEffect(() => {
    setDirection(0);
    setFeatureIndex(0);
    setCapIndex(0);
  }, [suiteIndex]);

  useEffect(() => {
    setDirection(0);
    setCapIndex(0);
  }, [featureIndex]);

  function goPrev() {
    setDirection(-1);
    setCapIndex((i) => (i - 1 + capabilities.length) % capabilities.length);
  }

  function goNext() {
    setDirection(1);
    setCapIndex((i) => (i + 1) % capabilities.length);
  }

  function selectSuite(i: number) {
    if (i === suiteIndex) return;
    setDirection(i > suiteIndex ? 1 : -1);
    setSuiteIndex(i);
  }

  function selectFeature(i: number) {
    if (i === featureIndex) return;
    setDirection(i > featureIndex ? 1 : -1);
    setFeatureIndex(i);
  }

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

      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8 md:pb-28 md:pt-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-16">
          <div className="max-w-md">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-kenoo-ink md:text-4xl">
              One OS.
              <br />
              Built for every angle.
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
          <div className="relative max-w-sm md:pt-10">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.p
                key={suite.id}
                custom={direction}
                variants={copyVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={softEase}
                className="text-base leading-relaxed text-kenoo-muted md:text-right"
              >
                {suite.description}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-12 overflow-hidden rounded-[2rem] border border-white/60 bg-[rgba(236,236,235,0.45)] shadow-[0_12px_48px_-16px_rgba(17,17,17,0.14),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl md:mt-14 md:rounded-[2.5rem]">
          <div className="flex items-center justify-center px-4 pt-4 md:px-6 md:pt-5">
            <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-white/50 bg-white/25 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl">
              {KENOO_SUITES.map((s, i) => {
                const selected = i === suiteIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSuite(i)}
                    className={cn(
                      "relative inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                      selected
                        ? "text-kenoo-ink"
                        : "text-kenoo-muted hover:text-kenoo-ink",
                    )}
                  >
                    {selected ? (
                      <motion.span
                        layoutId="suite-tab-pill"
                        className="absolute inset-0 rounded-full border border-white/70 bg-white/65 shadow-[0_4px_16px_-6px_rgba(17,17,17,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md"
                        transition={orbSpring}
                      />
                    ) : null}
                    <span
                      className="relative z-10 h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]"
                      style={{ backgroundColor: s.dot, color: s.dot }}
                      aria-hidden
                    />
                    <span className="relative z-10">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative px-2 pb-4 pt-8 md:px-6 md:pb-6 md:pt-12">
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={goPrev}
                className="relative z-30 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent text-kenoo-muted transition-colors hover:border-white/50 hover:bg-white/45 hover:text-kenoo-ink hover:backdrop-blur-md md:flex"
                aria-label="Previous"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <OrbCarousel
                setKey={`${suite.id}-${feature.id}`}
                capabilities={capabilities}
                capIndex={capIndex}
                direction={direction}
                onSelectOffset={(offset) => {
                  if (offset < 0) goPrev();
                  else goNext();
                }}
              />

              <button
                type="button"
                onClick={goNext}
                className="relative z-30 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent text-kenoo-muted transition-colors hover:border-white/50 hover:bg-white/45 hover:text-kenoo-ink hover:backdrop-blur-md md:flex"
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

              <div className="relative min-h-[5.5rem] min-w-0 flex-1 overflow-hidden md:min-h-[5.75rem]">
                <AnimatePresence
                  mode="popLayout"
                  initial={false}
                  custom={direction}
                >
                  <motion.div
                    key={`${suite.id}-${feature.id}-${active.id}-copy`}
                    custom={direction}
                    variants={copyVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={softEase}
                    className="w-full text-center"
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
              </div>

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

          <div className="flex flex-col gap-4 border-t border-white/40 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6 md:py-5">
            <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-white/50 bg-white/25 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl">
              {suite.features.map((f, i) => {
                const selected = i === featureIndex;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => selectFeature(i)}
                    className={cn(
                      "relative inline-flex shrink-0 items-center rounded-full px-3.5 py-2 text-sm transition-colors",
                      selected
                        ? "font-medium text-kenoo-ink"
                        : "text-kenoo-muted hover:text-kenoo-ink",
                    )}
                  >
                    {selected ? (
                      <motion.span
                        layoutId="feature-tab-pill"
                        className="absolute inset-0 rounded-full border border-white/70 bg-white/65 shadow-[0_4px_16px_-6px_rgba(17,17,17,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md"
                        transition={orbSpring}
                      />
                    ) : null}
                    <span className="relative z-10">{f.name}</span>
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
