"use client";

import { motion } from "framer-motion";

import { cn } from "@walls/utils";

const STAGGER = 0.035;

const containerVariants = {
  initial: {},
  hovered: {},
};

const topLetterVariants = {
  initial: { y: 0 },
  hovered: { y: "-100%" },
};

const bottomLetterVariants = {
  initial: { y: "100%" },
  hovered: { y: 0 },
};

export function TextRoll({
  children,
  className,
  center = false,
  alignCenter = false,
  lineHeight = 0.85,
}: {
  children: string;
  className?: string;
  center?: boolean;
  alignCenter?: boolean;
  lineHeight?: number;
}) {
  const letters = children.split("");
  const rowClass = alignCenter ? "flex justify-center" : undefined;

  return (
    <motion.span
      variants={containerVariants}
      initial="initial"
      whileHover="hovered"
      whileTap="hovered"
      className={cn(
        "relative max-w-full whitespace-nowrap",
        alignCenter ? "inline-flex flex-col items-center" : "inline-block",
        className,
      )}
    >
      <span
        className="relative block overflow-x-visible overflow-y-clip px-5"
        style={{ lineHeight }}
      >
        <motion.div variants={containerVariants} className={rowClass}>
          {letters.map((letter, i) => {
            const delay = center
              ? STAGGER * Math.abs(i - (letters.length - 1) / 2)
              : STAGGER * i;

            return (
              <motion.span
                key={`top-${i}-${letter}`}
                variants={topLetterVariants}
                transition={{ ease: "easeInOut", delay }}
                className="inline-block"
              >
                {letter === " " ? "\u00A0" : letter}
              </motion.span>
            );
          })}
        </motion.div>

        <motion.div
          variants={containerVariants}
          className={cn(
            "pointer-events-none absolute top-0 whitespace-nowrap",
            alignCenter ? "inset-x-0 flex justify-center" : "left-0",
          )}
          aria-hidden
        >
          {letters.map((letter, i) => {
            const delay = center
              ? STAGGER * Math.abs(i - (letters.length - 1) / 2)
              : STAGGER * i;

            return (
              <motion.span
                key={`bottom-${i}-${letter}`}
                variants={bottomLetterVariants}
                transition={{ ease: "easeInOut", delay }}
                className="inline-block"
              >
                {letter === " " ? "\u00A0" : letter}
              </motion.span>
            );
          })}
        </motion.div>
      </span>
    </motion.span>
  );
}
