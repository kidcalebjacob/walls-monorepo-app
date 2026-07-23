"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { isSameDay } from "date-fns";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  clearLabel = "Clear date",
  selected,
  onSelect,
  initialFocus,
  ...props
}: MiniCalendarProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border-0 bg-kenoo-white/95 p-3 outline-none ring-0",
        className,
      )}
    >
      <DayPicker
        {...props}
        mode="single"
        showOutsideDays={showOutsideDays}
        selected={selected}
        onSelect={onSelect}
        autoFocus={initialFocus}
        className="rounded-none border-0 p-0 outline-none ring-0"
        classNames={{
          root: "w-fit",
          months: "relative flex flex-col space-y-3",
          month: "space-y-2",
          month_caption:
            "relative mb-1 flex h-8 items-center justify-center px-0.5",
          caption_label:
            "select-none text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-neutral-500",
          nav: "absolute inset-x-0 top-0 flex items-center justify-between px-0.5",
          button_previous:
            "group z-10 flex size-7 cursor-pointer items-center justify-center border-none bg-transparent p-0",
          button_next:
            "group z-10 flex size-7 cursor-pointer items-center justify-center border-none bg-transparent p-0",
          month_grid: "w-full overflow-hidden rounded-2xl border-collapse",
          weekdays: "flex",
          weekday:
            "w-8 select-none py-1 text-center text-[0.55rem] font-medium uppercase tracking-wider text-neutral-400",
          week: "mt-0.5 flex w-full",
          day: cn(
            "relative h-8 w-8 p-0 text-center text-xs",
            "focus-within:relative focus-within:z-20",
          ),
          day_button: cn(
            "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full p-0 text-xs font-light",
            "transition-all duration-200 ease-in-out",
            "hover:scale-95 hover:bg-neutral-100 hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)]",
            "aria-selected:opacity-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1",
          ),
          selected:
            "[&>button]:rounded-full [&>button]:bg-neutral-900 [&>button]:font-light [&>button]:text-white [&>button]:shadow-sm [&>button]:hover:scale-95 [&>button]:hover:bg-neutral-900 [&>button]:hover:text-white",
          today:
            "[&>button]:rounded-full [&>button]:border [&>button]:border-neutral-300 [&>button]:font-light [&>button]:text-neutral-800 [&:not([aria-selected])>button]:bg-transparent",
          outside:
            "[&>button]:text-neutral-300 [&>button]:opacity-50 aria-selected:[&>button]:bg-neutral-900/10 aria-selected:[&>button]:text-neutral-400 aria-selected:[&>button]:opacity-40",
          disabled:
            "[&>button]:cursor-not-allowed [&>button]:text-neutral-300 [&>button]:opacity-40 [&>button]:hover:scale-100 [&>button]:hover:bg-transparent [&>button]:hover:shadow-none",
          hidden: "invisible",
        }}
        components={{
          Chevron: ({ orientation }) => (
            <div className="relative z-10 origin-center rounded-full p-1.5 transition-all duration-200 ease-in-out group-hover:scale-95 group-hover:bg-neutral-50 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]">
              {orientation === "left" ? (
                <ChevronLeft className="h-2.5 w-2.5 text-neutral-500" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5 text-neutral-500" />
              )}
            </div>
          ),
          DayButton: ({
            day,
            className: dayClassName,
            ...buttonProps
          }: DayButtonProps) => {
            const hasDeal = dealDates.some((dealDate) =>
              isSameDay(dealDate, day.date),
            );
            return (
              <button
                type="button"
                className={cn(dayClassName, "relative")}
                {...buttonProps}
              >
                <span className="font-light">{day.date.getDate()}</span>
                {hasDeal ? (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-kenoo-red shadow-[0_0_4px_rgba(255,0,0,0.4)]" />
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
            onClick={() => onSelect?.(undefined)}
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
