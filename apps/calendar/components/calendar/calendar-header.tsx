// calendar-header.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import UserProfileButton from "@walls/ui/user-profile-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CalendarViewMode = "monthly" | "weekly" | "daily";

interface CalendarHeaderProps {
  selectedDate: Date;
  onTodayClick: () => void;
  onPrev: () => void;
  onNext: () => void;
  calendarView: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
}

const VIEW_OPTIONS: { value: CalendarViewMode; label: string }[] = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

export function CalendarHeader({
  selectedDate,
  onTodayClick,
  onPrev,
  onNext,
  calendarView,
  onViewChange,
}: CalendarHeaderProps) {
  return (
    <div className="kenoo-glass-chrome flex shrink-0 items-center justify-between rounded-[1.25rem] border border-white/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTodayClick}
          className="h-10 shrink-0 rounded-full border border-neutral-300/90 bg-white/35 px-5 text-base font-medium text-kenoo-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-colors hover:bg-white/55"
        >
          Today
        </button>
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Previous"
            onClick={onPrev}
            className="flex h-7 w-7 items-center justify-center rounded-full text-kenoo-ink transition-colors hover:bg-white/45"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={onNext}
            className="flex h-7 w-7 items-center justify-center rounded-full text-kenoo-ink transition-colors hover:bg-white/45"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span className="truncate text-sm font-medium text-kenoo-ink">
          {format(selectedDate, "MMMM yyyy")}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Select
          value={calendarView}
          onValueChange={(value) => onViewChange(value as CalendarViewMode)}
        >
          <SelectTrigger
            aria-label="Calendar view"
            className="h-10 w-auto min-w-[6.5rem] gap-2 rounded-full border border-neutral-300/90 bg-white/35 px-3.5 text-base font-medium text-kenoo-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-offset-0 transition-colors hover:bg-white/55 focus:ring-0 focus:ring-offset-0 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:opacity-60"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            className="min-w-[7rem] border border-white/60 bg-white/90 text-kenoo-ink shadow-md backdrop-blur-xl"
          >
            {VIEW_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="cursor-pointer py-2 pl-3 pr-9 text-sm font-medium text-kenoo-ink hover:bg-kenoo-subtle focus:bg-kenoo-subtle"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-1.5">
          <UserProfileButton />
        </div>
      </div>
    </div>
  );
}
