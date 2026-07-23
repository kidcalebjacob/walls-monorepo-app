"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@walls/utils";

import {
  TIME_RANGE_OPTIONS,
  timeRangeLabel,
  type TimeRangeValue,
} from "@/lib/time-range";

type DashboardTimeRangePickerProps = {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
};

export function DashboardTimeRangePicker({
  value,
  onChange,
}: DashboardTimeRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-none border-0 bg-transparent p-0 text-xs font-medium uppercase tracking-widest text-neutral-500 shadow-none transition-colors hover:text-neutral-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Dashboard time range"
      >
        <span>{timeRangeLabel(value)}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-neutral-400 transition-transform duration-200",
            open && "rotate-180",
          )}
          strokeWidth={1.8}
        />
      </button>

      {open ? (
        <div
          className="absolute top-full left-0 z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                value === option.value
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-700 hover:bg-neutral-50",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 flex-shrink-0 rounded-full",
                  value === option.value
                    ? "bg-[var(--kenoo-sky)]"
                    : "bg-neutral-200",
                )}
                aria-hidden
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
