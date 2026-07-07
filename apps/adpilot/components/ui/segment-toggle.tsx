"use client";

import * as React from "react";

import { cn } from "@walls/utils";

const SEGMENT_TOGGLE_INNER =
  "relative z-10 flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-3 text-xs font-light uppercase tracking-wider transition-all duration-300 ease-in-out";

const SEGMENT_TOGGLE_ACTIVE =
  "border-neutral-200 bg-neutral-50 text-neutral-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]";

const SEGMENT_TOGGLE_INACTIVE =
  "text-neutral-500 group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-neutral-50 group-hover:text-neutral-700 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]";

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
  return (
    <div
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border border-neutral-200/70 bg-neutral-50/50 p-0.5",
        equalWidth
          ? cn("grid gap-0.5", options.length === 3 ? "w-[22.5rem] grid-cols-3" : "w-[12.25rem] grid-cols-2")
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
              "group flex min-w-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent",
              equalWidth && "w-full",
            )}
          >
            <div
              className={cn(
                SEGMENT_TOGGLE_INNER,
                equalWidth && "w-full justify-center",
                active ? SEGMENT_TOGGLE_ACTIVE : SEGMENT_TOGGLE_INACTIVE,
              )}
            >
              {option.icon}
              {option.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
