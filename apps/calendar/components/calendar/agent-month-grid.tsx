"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { TaskData, ScheduledTask } from "@/types/calendar.types";
import {
  getCalendarEventDisplayLabel,
  getCalendarEventTheme,
  getCompletedTaskAccentClass,
  getCompletedTaskTitleClass,
  isCalendarTaskCompleted,
} from "./calendar-event-theme";
import { CalendarDaySidebar } from "./calendar-day-sidebar";

function convertToDate(time: Date | { seconds: number } | string): Date {
  if (time instanceof Date) return new Date(time);
  if (typeof time === "object" && "seconds" in time) {
    return new Date((time as { seconds: number }).seconds * 1000);
  }
  return new Date(time as string);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatCompactTime(time: Date | { seconds: number } | string): string {
  try {
    return format(convertToDate(time), "h a").replace(" ", "");
  } catch {
    return "";
  }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/** Match parent `rounded-[2rem]` so inset rings and cell edges follow the calendar curve. */
function gridCellCornerClass(index: number, totalCells: number) {
  const row = Math.floor(index / 7);
  const col = index % 7;
  const numRows = Math.ceil(totalCells / 7);
  return cn(
    index === 0 && "rounded-tl-[2rem]",
    col === 6 && row === 0 && "rounded-tr-[2rem]",
    col === 0 && row === numRows - 1 && "rounded-bl-[2rem]",
    index === totalCells - 1 && "rounded-br-[2rem]"
  );
}

interface CalendarEventItem {
  id: string;
  title: string;
  startTime: Date | { seconds: number } | string;
  endTime: Date | { seconds: number } | string;
  type?: "regular-event" | "scheduled-task" | "project-task";
  eventType?: string;
  projectName?: string;
  projectColor?: string | null;
  meetingLink?: string;
  attendees?: Array<{ email: string }>;
  location?: string;
  status?: string;
}

interface AgentMonthGridProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  allEvents: CalendarEventItem[];
  tasks: TaskData[];
  scheduledTasks: ScheduledTask[];
  onProjectTaskCompleted?: (taskId: string) => void;
  onLegacyTaskCompleted?: (taskId: string) => void;
  onProjectTaskClick?: (taskId: string) => void;
}

export function AgentMonthGrid({
  selectedDate,
  onDateSelect,
  allEvents,
  tasks,
  scheduledTasks,
  onProjectTaskCompleted,
  onLegacyTaskCompleted,
  onProjectTaskClick,
}: AgentMonthGridProps) {
  const today = new Date();
  // Use local-date strings throughout so events align with grid cells correctly
  const todayStr = format(today, "yyyy-MM-dd");
  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    allEvents.forEach((event) => {
      try {
        const date = convertToDate(event.startTime);
        if (isNaN(date.getTime())) return;
        // Use local date string so events land on the correct calendar cell
        const key = format(date, "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(event);
      } catch {}
    });
    return map;
  }, [allEvents]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const { calendarCells, rowCount } = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const rows = Math.ceil(cells.length / 7);
    while (cells.length < rows * 7) cells.push(null);

    return { calendarCells: cells, rowCount: rows };
  }, [currentYear, currentMonth, daysInMonth, firstDay]);

  const formatDateStr = (day: number) => {
    const m = String(currentMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${currentYear}-${m}-${d}`;
  };

  const handleDayClick = (day: number) => {
    const [y, m, d] = formatDateStr(day).split("-").map(Number);
    onDateSelect(new Date(y, m - 1, d));
  };

  return (
    <div className="flex flex-1 gap-5 min-h-0 overflow-hidden">
      {/* Monthly grid */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1 shrink-0">
          {DAYS.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-medium text-neutral-400 uppercase tracking-widest py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div
          className="flex-1 min-h-0 grid grid-cols-7 gap-px bg-neutral-200/60 rounded-[2rem] overflow-hidden border border-neutral-200/60 shadow-inner"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
          {calendarCells.map((day, index) => {
            const cornerClass = gridCellCornerClass(
              index,
              calendarCells.length
            );
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className={cn(
                    "bg-neutral-50/50 min-h-0 h-full",
                    cornerClass
                  )}
                />
              );
            }

            const dateStr = formatDateStr(day);
            const dayEvents = eventsByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDateStr;

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDayClick(day)}
                className={cn(
                  "bg-white min-h-0 h-full p-2 pt-2 flex flex-col items-center transition-all relative hover:bg-neutral-50 overflow-hidden",
                  cornerClass,
                  isSelected && "ring-1 ring-inset ring-kenoo-sky/60"
                )}
              >
                <span
                  className={cn(
                    "shrink-0 text-xs font-light text-neutral-500 inline-flex items-center justify-center w-6 h-6 rounded-full",
                    isToday && "bg-kenoo-yellow/60"
                  )}
                >
                  {day}
                </span>

                {dayEvents.length > 0 && (
                  <div className="mt-1 w-full space-y-0.5 self-stretch">
                    {dayEvents.slice(0, 2).map((event) => {
                      const theme = getCalendarEventTheme(event);
                      const isCompleted = isCalendarTaskCompleted(event);
                      const compactTime = formatCompactTime(event.startTime);
                      const displayLabel = getCalendarEventDisplayLabel(event, compactTime);

                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "flex items-center gap-1.5 px-1 py-0.5 min-w-0 leading-snug text-xs",
                            theme.container,
                            isCompleted && "opacity-60"
                          )}
                        >
                          <span
                            className={cn(
                              'shrink-0 w-1.5 h-1.5 rounded-full',
                              isCompleted ? getCompletedTaskAccentClass() : theme.dotColor
                            )}
                          />
                          <span
                            className={cn(
                              'truncate min-w-0',
                              isCompleted ? getCompletedTaskTitleClass() : theme.title
                            )}
                          >
                            {displayLabel}
                          </span>
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <p className="text-[10px] text-neutral-400 px-1 font-normal">
                        +{dayEvents.length - 2} more
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <CalendarDaySidebar
        selectedDate={selectedDate}
        events={allEvents}
        onProjectTaskCompleted={onProjectTaskCompleted}
        onLegacyTaskCompleted={onLegacyTaskCompleted}
        onProjectTaskClick={onProjectTaskClick}
      />
    </div>
  );
}
