"use client";

import { motion } from "framer-motion";

/**
 * The sliding white "thumb" of a segmented control. Render only inside the
 * active segment; the shared `layoutId` glides it to the selected option.
 */
export function SegmentThumb({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className="absolute inset-0 rounded-full bg-gradient-to-b from-[#eafb87] to-[#d2ef3a] shadow-[0_1px_2px_rgba(0,0,0,0.18),0_2px_8px_-2px_rgba(120,140,0,0.35)] ring-1 ring-black/10"
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
    />
  );
}
