"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { cn } from "@/lib/utils";
import { isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";

export type MiniCalendarProps = {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  dealDates?: Date[];
  showClearButton?: boolean;
  clearLabel?: string;
  initialFocus?: boolean;
  className?: string;
  showOutsideDays?: boolean;
  disabled?: React.ComponentProps<typeof DayPicker>["disabled"];
  defaultMonth?: Date;
  month?: Date;
  onMonthChange?: (month: Date) => void;
};

function hasSelectedDate(selected: Date | undefined): boolean {
  return selected instanceof Date && !Number.isNaN(selected.getTime());
}

function MiniCalendar({
  className,
  showOutsideDays = true,
  dealDates = [],
  showClearButton = false,
  clearLabel = "Set null",
  selected,
  onSelect,
  initialFocus,
  ...props
}: MiniCalendarProps) {
  const handleClear = () => {
    onSelect?.(undefined);
  };

  return (
    <div
      className={cn(
        "p-3 !rounded-3xl !border-0 !ring-0 !outline-none bg-white/95",
        className
      )}
    >
      <DayPicker
        {...props}
        mode="single"
        showOutsideDays={showOutsideDays}
        selected={selected}
        onSelect={onSelect}
        autoFocus={initialFocus}
        className="!p-0 !rounded-none !border-0 !ring-0 !outline-none"
        classNames={{
          root: "w-fit",
          months: "flex flex-col space-y-3 relative",
          month: "space-y-2",
          month_caption:
            "flex justify-center items-center px-0.5 mb-1 h-8 relative",
          caption_label:
            "text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-neutral-500 select-none",
          nav: "absolute inset-x-0 top-0 flex items-center justify-between px-0.5",
          button_previous:
            "group z-10 p-0 bg-transparent border-none flex items-center justify-center cursor-pointer size-7",
          button_next:
            "group z-10 p-0 bg-transparent border-none flex items-center justify-center cursor-pointer size-7",
          month_grid: "w-full border-collapse rounded-2xl overflow-hidden",
          weekdays: "flex",
          weekday:
            "text-neutral-400 w-8 text-center text-[0.55rem] font-medium uppercase tracking-wider py-1 select-none",
          week: "flex w-full mt-0.5",
          day: cn(
            "relative h-8 w-8 p-0 text-center text-xs",
            "focus-within:relative focus-within:z-20"
          ),
          day_button: cn(
            "h-8 w-8 p-0 font-light text-xs rounded-full",
            "transition-all duration-200 ease-in-out",
            "hover:bg-neutral-100 hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)] hover:scale-95",
            "aria-selected:opacity-100 flex items-center justify-center cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1"
          ),
          selected:
            "[&>button]:bg-neutral-900 [&>button]:text-white [&>button]:font-light [&>button]:shadow-sm [&>button]:hover:bg-neutral-900 [&>button]:hover:text-white [&>button]:hover:scale-95 [&>button]:rounded-full",
          today:
            "[&>button]:font-light [&>button]:text-neutral-800 [&>button]:rounded-full [&>button]:border [&>button]:border-neutral-300 [&:not([aria-selected])>button]:bg-transparent",
          outside:
            "[&>button]:text-neutral-300 [&>button]:opacity-50 aria-selected:[&>button]:bg-neutral-900/10 aria-selected:[&>button]:text-neutral-400 aria-selected:[&>button]:opacity-40",
          disabled:
            "[&>button]:text-neutral-300 [&>button]:opacity-40 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent [&>button]:hover:scale-100 [&>button]:hover:shadow-none",
          hidden: "invisible",
        }}
        components={{
          Chevron: ({ orientation }) => (
            <div className="relative z-10 p-1.5 rounded-full transition-all duration-200 ease-in-out group-hover:bg-neutral-50 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] group-hover:scale-95 origin-center">
              {orientation === "left" ? (
                <ChevronLeft className="h-2.5 w-2.5 text-neutral-500" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5 text-neutral-500" />
              )}
            </div>
          ),
          DayButton: ({ day, modifiers, className, ...buttonProps }: DayButtonProps) => {
            const hasDeal = dealDates.some((dealDate) =>
              isSameDay(dealDate, day.date)
            );
            return (
              <button
                type="button"
                className={cn(className, "relative")}
                {...buttonProps}
              >
                <span className="font-light">{day.date.getDate()}</span>
                {hasDeal ? (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-kenoo-red shadow-[0_0_4px_rgba(255,0,0,0.4)]" />
                ) : null}
              </button>
            );
          },
        }}
      />

      {showClearButton && hasSelectedDate(selected) ? (
        <div className="mt-2 border-t border-neutral-200/60 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            className="h-9 w-full rounded-full text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            {clearLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

MiniCalendar.displayName = "MiniCalendar";

export { MiniCalendar };
