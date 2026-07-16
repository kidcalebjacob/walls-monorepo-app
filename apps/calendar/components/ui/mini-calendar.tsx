"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerSingleProps } from "react-day-picker";
import { cn } from "@/lib/utils";
import { isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";

export type MiniCalendarProps = Omit<DayPickerSingleProps, "mode"> & {
  dealDates?: Date[];
  showClearButton?: boolean;
  clearLabel?: string;
  initialFocus?: boolean;
  className?: string;
  classNames?: Record<string, string>;
  showOutsideDays?: boolean;
};

function hasSelectedDate(selected: Date | undefined): boolean {
  return selected instanceof Date && !Number.isNaN(selected.getTime());
}

function MiniCalendar({
  className,
  classNames,
  showOutsideDays = true,
  dealDates = [],
  showClearButton = false,
  clearLabel = "Set null",
  selected,
  onSelect,
  ...props
}: MiniCalendarProps) {
  const renderDayContent = (day: Date) => {
    const hasDeal = dealDates.some(dealDate => isSameDay(dealDate, day));

    return (
      <div className="relative flex items-center justify-center h-full w-full">
        <span className="font-light">{day.getDate()}</span>
        {hasDeal && (
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-kenoo-red shadow-[0_0_4px_rgba(255,0,0,0.4)]" />
        )}
      </div>
    );
  };

  const handleClear = () => {
    onSelect?.(undefined, selected ?? new Date(), {}, {} as React.MouseEvent);
  };

  return (
    <div className={cn("p-3 !rounded-3xl !border-0 !ring-0 !outline-none", className)}>
    <DayPicker
      {...props}
      mode="single"
      showOutsideDays={showOutsideDays}
      selected={selected}
      onSelect={onSelect}
      className={cn("!p-0 !rounded-none !border-0 !ring-0 !outline-none")}
      classNames={{
        months: "flex flex-col space-y-3",
        month: "space-y-2",
        caption: "flex justify-between items-center px-0.5 mb-1",
        caption_label:
          "text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-neutral-500 select-none",
        nav: "flex items-center gap-0.5",
        nav_button:
          "group p-0 bg-transparent border-none flex items-center justify-center cursor-pointer",
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse rounded-2xl overflow-hidden",
        head_row: "flex",
        head_cell:
          "text-neutral-400 w-8 text-center text-[0.55rem] font-medium uppercase tracking-wider py-1 select-none",
        row: "flex w-full mt-0.5",
        cell: cn(
          "h-8 w-8 text-center text-xs p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-full",
          "[&:has([aria-selected].day-outside)]:bg-kenoo-yellow/10",
          "[&:has([aria-selected])]:bg-kenoo-yellow/15",
          "first:[&:has([aria-selected])]:rounded-l-full",
          "last:[&:has([aria-selected])]:rounded-r-full",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          "h-8 w-8 p-0 font-light text-xs rounded-full",
          "transition-all duration-200 ease-in-out",
          "hover:bg-neutral-100 hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)] hover:scale-95",
          "aria-selected:opacity-100 flex items-center justify-center cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kenoo-yellow/40 focus-visible:ring-offset-1"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-kenoo-yellow text-neutral-900 font-light shadow-sm hover:bg-kenoo-yellow hover:text-neutral-900 hover:scale-95 focus:bg-kenoo-yellow focus:text-neutral-900 rounded-full",
        day_today:
          "font-light text-neutral-800 rounded-full border border-kenoo-sky [&:not([aria-selected])]:bg-transparent",
        day_outside:
          "day-outside text-neutral-300 opacity-50 aria-selected:bg-kenoo-yellow/10 aria-selected:text-neutral-400 aria-selected:opacity-40",
        day_disabled: "text-neutral-300 opacity-40 cursor-not-allowed hover:bg-transparent hover:scale-100 hover:shadow-none",
        day_range_middle:
          "aria-selected:bg-kenoo-yellow/15 aria-selected:text-neutral-700 rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => (
          <div className="relative z-10 p-1.5 rounded-full transition-all duration-200 ease-in-out group-hover:bg-neutral-50 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] group-hover:scale-95 origin-center">
            <ChevronLeft className="h-2.5 w-2.5 text-neutral-500" />
          </div>
        ),
        IconRight: () => (
          <div className="relative z-10 p-1.5 rounded-full transition-all duration-200 ease-in-out group-hover:bg-neutral-50 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] group-hover:scale-95 origin-center">
            <ChevronRight className="h-2.5 w-2.5 text-neutral-500" />
          </div>
        ),
        DayContent: ({ date }: { date: Date }) => renderDayContent(date),
      } as React.ComponentProps<typeof DayPicker>["components"]}
    />

    {showClearButton && hasSelectedDate(selected) && (
      <div className="mt-2 pt-2 border-t border-neutral-200/60">
        <Button
          type="button"
          variant="ghost"
          onClick={handleClear}
          className="w-full h-9 rounded-full text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
        >
          {clearLabel}
        </Button>
      </div>
    )}
    </div>
  );
}

MiniCalendar.displayName = "MiniCalendar";

export { MiniCalendar };
