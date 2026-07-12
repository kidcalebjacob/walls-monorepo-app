"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date;
  setDate: (date: Date) => void;
  className?: string;
  label?: string;
  format?: string;
}

export function DatePicker({ 
  date, 
  setDate, 
  className, 
  label = "Start date:", 
  format: dateFormat = "PPP" 
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"ghost"}
          className={cn(
            "border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 w-full justify-start",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{label}</span>
            {date ? (
              <span>{format(date, dateFormat)}</span>
            ) : (
              <span>Select date</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]" align="start">
        <MiniCalendar
          selected={date}
          onSelect={(newDate) => newDate && setDate(newDate)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}