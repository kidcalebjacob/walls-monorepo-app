"use client";

import { createContext, useRef, useState, useEffect, useContext } from "react";
import { motion, useInView } from "framer-motion";

import { cn } from "@walls/utils";

type ScrollRevealDirection = "up" | "down" | "left" | "right" | "none";

const directionOffsets: Record<ScrollRevealDirection, { x: number; y: number }> =
  {
    up: { x: 0, y: 24 },
    down: { x: 0, y: -24 },
    left: { x: 24, y: 0 },
    right: { x: -24, y: 0 },
    none: { x: 0, y: 0 },
  };

/** Smaller offsets for desktop to reduce animation intensity / glitching */
const directionOffsetsSubtle: Record<
  ScrollRevealDirection,
  { x: number; y: number }
> = {
  up: { x: 0, y: 10 },
  down: { x: 0, y: -10 },
  left: { x: 10, y: 0 },
  right: { x: -10, y: 0 },
  none: { x: 0, y: 0 },
};

interface ScrollRevealProps {
  children: React.ReactNode;
  /** Direction to slide from before revealing. Use "none" for fade-only. */
  direction?: ScrollRevealDirection;
  /** Delay in seconds before animation starts. */
  delay?: number;
  /** Animate only the first time in view (no repeat on scroll back). */
  once?: boolean;
  /** How much of the element must be visible (0–1). Default 0.15. */
  amount?: number;
  /** Extra class for the motion wrapper. */
  className?: string;
  /** Override reduced-motion (default: follows system prefers-reduced-motion). */
  reduceMotion?: boolean;
}

/** Shared context: one subscription per app for prefers-reduced-motion and pointer:fine. */
type ScrollRevealContextValue = {
  prefersReducedMotion: boolean;
  isDesktop: boolean;
};

const ScrollRevealContext = createContext<ScrollRevealContextValue | null>(null);

export function ScrollRevealProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqPointer = window.matchMedia("(pointer: fine)");
    setPrefersReducedMotion(mqReduced.matches);
    setIsDesktop(mqPointer.matches);

    const onReduced = () => setPrefersReducedMotion(mqReduced.matches);
    const onPointer = () => setIsDesktop(mqPointer.matches);
    mqReduced.addEventListener("change", onReduced);
    mqPointer.addEventListener("change", onPointer);
    return () => {
      mqReduced.removeEventListener("change", onReduced);
      mqPointer.removeEventListener("change", onPointer);
    };
  }, []);

  const value: ScrollRevealContextValue = { prefersReducedMotion, isDesktop };
  return (
    <ScrollRevealContext.Provider value={value}>
      {children}
    </ScrollRevealContext.Provider>
  );
}

const defaultTransition = {
  duration: 0.5,
  ease: [0.25, 0.4, 0.25, 1] as const,
};

const subtleTransition = {
  duration: 0.35,
  ease: [0.25, 0.4, 0.25, 1] as const,
};

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  once = true,
  amount = 0.15,
  className,
  reduceMotion,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount, once });
  const ctx = useContext(ScrollRevealContext);
  const systemPrefersReducedMotion = ctx?.prefersReducedMotion ?? false;
  const isDesktop = ctx?.isDesktop ?? false;
  const shouldReduceMotion = reduceMotion ?? systemPrefersReducedMotion;

  const offsets = isDesktop ? directionOffsetsSubtle : directionOffsets;
  const { x, y } = offsets[direction];
  const transition = isDesktop ? subtleTransition : defaultTransition;

  if (shouldReduceMotion) {
    return (
      <div className={cn(className)} ref={ref}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        x: x,
        y: y,
      }}
      animate={
        isInView
          ? {
              opacity: 1,
              x: 0,
              y: 0,
            }
          : undefined
      }
      transition={{
        ...transition,
        delay,
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
