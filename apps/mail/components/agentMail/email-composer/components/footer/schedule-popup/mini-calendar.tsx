"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { isSameDay } from "date-fns";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  dealDates?: Date[];
};

function MiniCalendar({
  className,
  classNames,
  showOutsideDays = true,
  dealDates = [],
  ...props
}: CalendarProps) {
  const renderDayContent = (day: Date, modifiers: Record<string, boolean>) => {
    const hasDeal = dealDates.some(dealDate => isSameDay(dealDate, day));
    
    return (
      <div className="relative flex items-center justify-center h-full w-full">
        <div className="font-light">{day.getDate()}</div>
        {hasDeal && (
          <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-walls-red"></div>
        )}
      </div>
    );
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-2 sm:space-x-2 sm:space-y-0",
        month: "space-y-2",
        caption: "flex justify-between pt-1 relative items-center",
        caption_label: "text-xs font-medium text-left text-gray-500",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-6 w-6 p-0 text-muted-foreground hover:opacity-100"
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-7 font-normal text-[0.6rem]",
        row: "flex w-full mt-1",
        cell: "h-7 w-7 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 p-0 font-light text-xs aria-selected:opacity-100 rounded-full"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-blue-500 text-white rounded-full hover:bg-blue-500 hover:text-white focus:bg-blue-500 focus:text-white",
        day_today: "[&:not([aria-selected])]:bg-transparent border border-kenoo-sky text-foreground rounded-full [&[aria-selected]]:text-white",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-3 w-3" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-3 w-3" />,
        DayContent: ({ date, displayMonth }) => renderDayContent(date, {}),
      }}
      {...props}
    />
  );
}

MiniCalendar.displayName = "MiniCalendar";

export { MiniCalendar }; 