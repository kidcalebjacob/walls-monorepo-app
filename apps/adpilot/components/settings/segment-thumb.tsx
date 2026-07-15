"use client";

import { motion } from "framer-motion";

import { cn } from "@walls/utils";

type SegmentThumbVariant = "brand" | "glass";

/**
 * The sliding "thumb" of a segmented control. Render only inside the
 * active segment; the shared `layoutId` glides it to the selected option.
 *
 * - brand: walls-yellow gradient (presets / ROAS)
 * - glass: near-opaque white pill like wallie-mobile Work/Chat
 */
export function SegmentThumb({
  layoutId,
  variant = "brand",
}: {
  layoutId: string;
  variant?: SegmentThumbVariant;
}) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className={cn(
        "absolute inset-0 rounded-full",
        variant === "glass"
          ? "border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150"
          : "bg-gradient-to-b from-[#eafb87] to-[#d2ef3a] shadow-[0_1px_2px_rgba(0,0,0,0.18),0_2px_8px_-2px_rgba(120,140,0,0.35)] ring-1 ring-black/10",
      )}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
    />
  );
}
