// calendar-header.tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, ChevronDown } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreatePopup, EventType } from "./create/event/create-popup";
import { Event } from "./create/event/event";
import { OutOfOffice } from "./create/event/out-of-office";
import { AppointmentSchedule } from "./create/event/appointment-schedule";
import UserProfileButton from "@walls/ui/user-profile-button";
import { cn } from "@/lib/utils";

export type CalendarViewMode = "monthly" | "weekly" | "daily";

interface CalendarHeaderProps {
  selectedDate: Date;
  onTodayClick: () => void;
  onPrev: () => void;
  onNext: () => void;
  calendarView: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
  onCreateTask: () => void;
}

function getHeaderLabel(date: Date, view: CalendarViewMode): string {
  if (view === "monthly") {
    return format(date, "MMMM yyyy").toUpperCase();
  }
  if (view === "weekly") {
    const weekStart = startOfWeek(date);
    const weekEnd = addDays(weekStart, 6);
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${format(weekStart, "MMM d")} – ${format(weekEnd, "d, yyyy")}`.toUpperCase();
    }
    return `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`.toUpperCase();
  }
  return format(date, "EEE, MMM d yyyy").toUpperCase();
}

export function CalendarHeader({
  selectedDate,
  onTodayClick,
  onPrev,
  onNext,
  calendarView,
  onViewChange,
  onCreateTask,
}: CalendarHeaderProps) {
  const [selectedEventType, setSelectedEventType] = useState<EventType>("event");
  const [isEventPopupOpen, setIsEventPopupOpen] = useState(false);

  const headerLabel = getHeaderLabel(selectedDate, calendarView);

  const handleEventTypeSelect = (type: EventType) => {
    setSelectedEventType(type);
    setIsEventPopupOpen(true);
  };

  const VIEW_OPTIONS: { value: CalendarViewMode; label: string }[] = [
    { value: "daily", label: "Day" },
    { value: "weekly", label: "Week" },
    { value: "monthly", label: "Month" },
  ];

  return (
    <>
      <div className="px-8 pt-0 pb-2 flex items-center justify-between bg-transparent shrink-0">
        {/* Left: Create button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-walls-yellow text-neutral-900 text-xs font-medium uppercase tracking-wider hover:bg-walls-yellow/90 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Create
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[180px] bg-white rounded-xl">
            <DropdownMenuItem
              onClick={() => handleEventTypeSelect("event")}
              className="text-sm font-light text-neutral-700 py-2.5 cursor-pointer"
            >
              Event
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onCreateTask}
              className="text-sm font-light text-neutral-700 py-2.5 cursor-pointer"
            >
              Task
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleEventTypeSelect("outOfOffice")}
              className="text-sm font-light text-neutral-700 py-2.5 cursor-pointer"
            >
              Out of Office
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleEventTypeSelect("appointmentSchedule")}
              className="text-sm font-light text-neutral-700 py-2.5 cursor-pointer"
            >
              Appointment Schedule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Center: Title */}
        <div className="relative flex items-center justify-center min-h-[3.5rem]">
          <AnimatePresence mode="wait">
            <motion.h1
              key={headerLabel}
              className="text-4xl md:text-5xl font-black text-neutral-900 tracking-tight uppercase"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {headerLabel}
            </motion.h1>
          </AnimatePresence>
        </div>

        {/* Right: Navigation + View Toggle + Profile */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="p-0 bg-transparent border-none hover:bg-transparent flex items-center justify-center group cursor-pointer"
            onClick={onPrev}
          >
            <div className="relative z-10 p-3 rounded-full border border-transparent transition-all duration-300 ease-in-out group-hover:bg-neutral-50 group-hover:border-neutral-200 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)] group-hover:scale-95 origin-center">
              <ChevronLeft className="h-4 w-4 text-neutral-500" />
            </div>
          </button>
          <button
            type="button"
            className="p-0 bg-transparent border-none hover:bg-transparent flex items-center justify-center group cursor-pointer"
            onClick={onTodayClick}
          >
            <div className="relative z-10 flex items-center gap-2 px-3 min-h-[2.25rem] py-2.5 rounded-full border border-transparent transition-all duration-300 ease-in-out text-neutral-500 text-xs font-medium uppercase tracking-wider group-hover:bg-neutral-50 group-hover:border-neutral-200 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)] group-hover:scale-95 origin-center">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-walls-yellow" aria-hidden />
              Today
            </div>
          </button>
          <button
            type="button"
            className="p-0 bg-transparent border-none hover:bg-transparent flex items-center justify-center group cursor-pointer"
            onClick={onNext}
          >
            <div className="relative z-10 p-3 rounded-full border border-transparent transition-all duration-300 ease-in-out group-hover:bg-neutral-50 group-hover:border-neutral-200 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)] group-hover:scale-95 origin-center">
              <ChevronRight className="h-4 w-4 text-neutral-500" />
            </div>
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-neutral-100 rounded-xl p-0.5 ml-1">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onViewChange(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-[10px] text-[11px] font-medium uppercase tracking-wider transition-all duration-200 cursor-pointer",
                  calendarView === opt.value
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="ml-2">
            <UserProfileButton />
          </div>
        </div>
      </div>

      <CreatePopup
        isOpen={isEventPopupOpen}
        onClose={() => setIsEventPopupOpen(false)}
        initialType={selectedEventType}
        onSubmit={() => setIsEventPopupOpen(false)}
        submitButtonText="Save"
        eventComponent={<Event />}
        outOfOfficeComponent={<OutOfOffice />}
        appointmentScheduleComponent={<AppointmentSchedule />}
      />

    </>
  );
}
