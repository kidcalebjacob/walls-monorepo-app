"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

import { SelectComponent, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "./select";

interface CalendarOptions {
  translate?: "es" | "en";
}

export type CalendarProps = React.ComponentProps<typeof DayPicker> &
  CalendarOptions;

const montsLib: Record<"es" | "en", Record<number, string>> = {
  es: {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
  },
  en: {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December",
  },
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      disableNavigation
      className={cn("p-3 rounded-2xl", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 rounded-2xl",
        caption: "flex justify-center pt-1 relative items-center hidden",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-lg",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1 rounded-2xl",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative !bg-transparent [&_.rdp-day_selected]:!bg-transparent [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected]:not(.day_selected))]:bg-accent [&:has([aria-selected].day_selected)]:!bg-transparent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-lg hover:bg-kenoo-yellow/20",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "!bg-kenoo-yellow/80 !text-foreground hover:!bg-kenoo-yellow/60 focus:!bg-kenoo-yellow/80 rounded-lg z-20 relative [&]:!bg-kenoo-yellow/80 [&]:!shadow-none",
        day_today: "bg-transparent text-foreground rounded-full border-2 border-kenoo-yellow hover:bg-kenoo-yellow/20",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30 rounded-lg",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        // eslint-disable-next-line
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        // eslint-disable-next-line
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

function CalendarComponent({ translate, ...props }: CalendarProps) {
  const [date, setDate] = React.useState<Date>(new Date());

  return (
    <>
      <div className="flex space-x-6 px-6 pt-2">
        <Select
          value={(new Date(date).getMonth() + 1).toString()}
          onValueChange={(value) => {
            setDate(new Date(date.setMonth(parseInt(value) - 1)));
          }}
        >
          <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 focus:ring-0 focus:ring-offset-0 gap-1 justify-start w-auto [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[...(new Array(12) as number[])].map((_, index) => (
                <SelectItem key={index + 1} value={(index + 1).toString()}>
                  {montsLib[translate ?? "en"][index + 1]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={new Date(date).getFullYear().toString()}
          onValueChange={(value) => {
            setDate(new Date(date.setFullYear(parseInt(value))));
          }}
        >
          <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 focus:ring-0 focus:ring-offset-0 gap-1 justify-start w-auto [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[...(new Array(new Date().getFullYear()) as number[])]
                .map((_, index) => ({
                  label: (index + 1).toString(),
                  value: (index + 1).toString(),
                }))
                .slice(1900, new Date().getFullYear() + 1)
                .reverse()
                .map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Calendar {...props} month={date} />
    </>
  );
}

export { Calendar, CalendarComponent };
