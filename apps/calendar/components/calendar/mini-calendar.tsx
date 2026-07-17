"use client";

import * as React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export type MiniCalendarProps = {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
  dealDates?: Date[];
  mode?: "single";
  showHeader?: boolean;
};

export function MiniCalendar({
  selected,
  onSelect,
  className,
  dealDates = [],
  showHeader = true,
}: MiniCalendarProps) {
  const [displayMonth, setDisplayMonth] = React.useState(
    () => startOfMonth(selected ?? new Date())
  );

  React.useEffect(() => {
    if (selected) {
      setDisplayMonth(startOfMonth(selected));
    }
  }, [selected]);

  const days = React.useMemo(() => {
    const monthStart = startOfMonth(displayMonth);
    const monthEnd = endOfMonth(displayMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [displayMonth]);

  return (
    <div className={cn("w-full select-none", className)}>
      {showHeader && (
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-medium tracking-tight text-kenoo-ink">
            {format(displayMonth, "MMMM yyyy")}
          </h2>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setDisplayMonth((m) => subMonths(m, 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-kenoo-muted transition-colors hover:bg-kenoo-subtle hover:text-kenoo-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setDisplayMonth((m) => addMonths(m, 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-kenoo-muted transition-colors hover:bg-kenoo-subtle hover:text-kenoo-ink"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-0.5 grid grid-cols-7">
        {WEEKDAYS.map((day, i) => (
          <div
            key={`${day}-${i}`}
            className="flex h-5 items-center justify-center text-[10px] font-medium text-kenoo-muted"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, displayMonth);
          const selectedDay = selected ? isSameDay(day, selected) : false;
          const today = isToday(day);
          const hasDeal = dealDates.some((d) => isSameDay(d, day));

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect?.(day)}
              className={cn(
                "relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition-colors",
                !inMonth && "text-kenoo-muted/40",
                inMonth &&
                  !selectedDay &&
                  !today &&
                  "text-kenoo-ink hover:bg-kenoo-yellow/40",
                // Today (not selected): soft neutral ring
                today &&
                  !selectedDay &&
                  "font-medium text-kenoo-ink ring-1 ring-inset ring-neutral-300",
                // Selected: vivid cool cyan-azure
                selectedDay &&
                  "bg-[#00A8E8] font-medium text-white hover:bg-[#0096D1]"
              )}
            >
              {format(day, "d")}
              {hasDeal && (
                <span
                  className={cn(
                    "absolute bottom-0 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full",
                    selectedDay ? "bg-white" : "bg-kenoo-red"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

MiniCalendar.displayName = "MiniCalendar";
