"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@walls/utils";

export type SegmentToggleOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

type SegmentToggleProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentToggleOption<T>[];
  "aria-label": string;
  equalWidth?: boolean;
  className?: string;
};

export function SegmentToggle<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  equalWidth,
  className,
}: SegmentToggleProps<T>) {
  const layoutId = React.useId();

  return (
    <div
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full p-1",
        "border border-white/70 bg-white/55 backdrop-blur-xl",
        "shadow-[0_8px_28px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.95)]",
        equalWidth
          ? cn(
              "grid gap-0.5",
              options.length === 3 ? "w-[22.5rem] grid-cols-3" : "w-[12.25rem] grid-cols-2",
            )
          : "flex w-max items-center gap-0.5",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "group relative flex min-w-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent",
              equalWidth && "w-full",
            )}
          >
            {active ? (
              <motion.div
                layoutId={`segment-toggle-pill-${layoutId}`}
                className="absolute inset-0 rounded-full bg-white/90 shadow-[0_4px_14px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] ring-1 ring-black/[0.04]"
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 34,
                  mass: 0.8,
                }}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-medium uppercase tracking-wider transition-colors duration-200",
                equalWidth && "w-full justify-center",
                active
                  ? "text-neutral-900"
                  : "text-neutral-500 group-hover:text-neutral-700",
              )}
            >
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
