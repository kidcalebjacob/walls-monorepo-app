"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { parseCalendarToJsDate } from "@/lib/calendar-recurring";
import {
  getCalendarEventDisplayLabel,
  getCalendarEventTheme,
  getCompletedTaskAccentClass,
  getCompletedTaskTitleClass,
  isCalendarTaskCompleted,
} from "./calendar-event-theme";

function convertToDate(time: Date | { seconds: number } | string): Date {
  if (time instanceof Date) return new Date(time);
  if (typeof time === "object" && "seconds" in time) {
    return new Date((time as { seconds: number }).seconds * 1000);
  }
  return parseCalendarToJsDate(time as string);
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
  type?: "regular-event" | "scheduled-task" | "project-task" | "project-task-schedule";
  eventType?: string;
  projectName?: string;
  projectColor?: string | null;
  meetingLink?: string;
  attendees?: Array<{ email: string }>;
  location?: string;
  status?: string;
  projectTaskId?: string;
  scheduleId?: string;
}

interface AgentMonthGridProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  allEvents: CalendarEventItem[];
}

export function AgentMonthGrid({
  selectedDate,
  onDateSelect,
  allEvents,
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pt-2">
      <div className="mb-1 grid shrink-0 grid-cols-7">
        {DAYS.map((day) => (
          <div
            key={day}
            className="py-1 text-center font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-kenoo-muted"
          >
            {day}
          </div>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1 gap-px overflow-hidden rounded-[1.35rem] border border-white/50 bg-white/35"
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
                  "h-full min-h-0 bg-white/40",
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
                "relative flex h-full min-h-0 flex-col items-center overflow-hidden bg-white/70 p-2 pt-2 transition-all hover:bg-white/85",
                cornerClass,
                isSelected && "ring-1 ring-inset ring-kenoo-accent/50"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-kenoo-muted",
                  isToday && "bg-kenoo-accent text-white"
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
                    const displayLabel = getCalendarEventDisplayLabel(
                      event,
                      compactTime
                    );

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "flex min-w-0 items-center gap-1.5 px-1 py-0.5 text-xs leading-snug",
                          theme.container,
                          isCompleted && "opacity-60"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            isCompleted
                              ? getCompletedTaskAccentClass()
                              : theme.dotColor
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-0 truncate",
                            isCompleted
                              ? getCompletedTaskTitleClass()
                              : theme.title
                          )}
                        >
                          {displayLabel}
                        </span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <p className="px-1 text-[10px] font-normal text-kenoo-muted">
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
  );
}
