"use client";

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, isSameDay, startOfDay } from 'date-fns';
import { DateTime } from 'luxon';
import { isAllDayEvent, layoutAllDayEvents } from '@/lib/calendar-all-day';
import { parseCalendarToJsDate, resolveViewerFallbackZone } from '@/lib/calendar-recurring';
import {
  getCalendarEventDisplayLabel,
  getCalendarEventTheme,
  getCompletedTaskAccentClass,
  getCompletedTaskTitleClass,
  GOOGLE_MEET_ICON_URL,
  isCalendarTaskCompleted,
  isGoogleMeetLink,
  type CalendarEventTheme,
} from './calendar-event-theme';
import { ViewPopup } from './create/event/view/view-popup';
import Image from 'next/image';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MINUTES_PER_HOUR = 60;
const GRID_SNAP = 15; // 15-minute intervals
const DAY_VIEW_PIXELS_PER_HOUR = 60;
const WEEK_VIEW_PIXELS_PER_HOUR = 48;
const ALL_DAY_ROW_HEIGHT = 24;
const ALL_DAY_ROW_GAP = 2;
const ALL_DAY_MORE_ROW_HEIGHT = 16;
const MAX_VISIBLE_ALL_DAY_ROWS = 2;

function getTimedEventTheme(event: Event): CalendarEventTheme {
  const theme = getCalendarEventTheme(event);
  return {
    ...theme,
    container: 'transition-colors hover:bg-muted/40 duration-200',
  };
}

function getAllDayEventTheme(event: Event): CalendarEventTheme {
  return getCalendarEventTheme(event);
}

const EVENT_TITLE_LINE_HEIGHT_PX = 16;

function getEventTitleLineBudget(
  heightPx: number,
  isShortEvent: boolean,
  showTime: boolean
): { maxLines: number } {
  const verticalPaddingPx = isShortEvent ? 4 : 12;
  const reservedForTimePx = showTime ? 18 : 0;
  const availableTitleHeightPx = heightPx - verticalPaddingPx - reservedForTimePx;
  const maxLines = Math.max(
    1,
    Math.min(4, Math.floor(availableTitleHeightPx / EVENT_TITLE_LINE_HEIGHT_PX))
  );

  return { maxLines };
}

function getEventTitleTextClass(maxLines: number): string {
  if (maxLines <= 1) return 'truncate';
  if (maxLines === 2) return 'whitespace-normal break-words line-clamp-2';
  if (maxLines === 3) return 'whitespace-normal break-words line-clamp-3';
  return 'whitespace-normal break-words line-clamp-4';
}

interface ParsedTimedEvent {
  event: Event;
  dayOffset: number;
  startTime: DateTime;
  endTime: DateTime;
  topMinutes: number;
  durationMinutes: number;
  startMs: number;
  endMs: number;
}

interface PositionedTimedEvent extends ParsedTimedEvent {
  column: number;
  totalColumns: number;
}

function layoutTimedEventsForWeek(
  events: Event[],
  weekStart: Date,
  numDays: number,
  viewerZone: string
): PositionedTimedEvent[] {
  const weekStartDt = DateTime.fromJSDate(weekStart).setZone(viewerZone).startOf('day');

  const parsed = events
    .map((event): ParsedTimedEvent | null => {
      const startTime = toEventDateTime(event.startTime, viewerZone);
      const endTime = toEventDateTime(event.endTime, viewerZone);
      if (!startTime.isValid || !endTime.isValid) return null;

      const dayOffset = Math.floor(startTime.startOf('day').diff(weekStartDt, 'days').days);
      if (dayOffset < 0 || dayOffset >= numDays) return null;

      const topMinutes = startTime.hour * 60 + startTime.minute;
      const durationMinutes = Math.max(endTime.diff(startTime, 'minutes').minutes, 15);

      return {
        event,
        dayOffset,
        startTime,
        endTime,
        topMinutes,
        durationMinutes,
        startMs: startTime.toMillis(),
        endMs: endTime.toMillis(),
      };
    })
    .filter((event): event is ParsedTimedEvent => event !== null);

  const byDay = new Map<number, ParsedTimedEvent[]>();
  for (const event of parsed) {
    const dayEvents = byDay.get(event.dayOffset) ?? [];
    dayEvents.push(event);
    byDay.set(event.dayOffset, dayEvents);
  }

  const positioned: PositionedTimedEvent[] = [];

  byDay.forEach((dayEvents) => {
    const sorted = [...dayEvents].sort((a, b) => a.startMs - b.startMs);
    const columnEnds: number[] = [];
    const assignments: Array<{ parsed: ParsedTimedEvent; column: number }> = [];

    for (const event of sorted) {
      let column = columnEnds.findIndex((endMs) => endMs <= event.startMs);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(event.endMs);
      } else {
        columnEnds[column] = event.endMs;
      }
      assignments.push({ parsed: event, column });
    }

    const totalColumns = Math.max(columnEnds.length, 1);

    for (const { parsed: event, column } of assignments) {
      positioned.push({
        ...event,
        column,
        totalColumns,
      });
    }
  });

  return positioned;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: Date | { seconds: number } | string;
  endTime: Date | { seconds: number } | string;
  type?: 'regular-event' | 'scheduled-task' | 'project-task';
  isAllDay?: boolean;
  colorId?: string;
  location?: string;
  eventType?: string;
  projectName?: string;
  projectColor?: string | null;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  meetingLink?: string;
  status?: string;
  projectTaskId?: string;
}

interface CalendarGridProps {
  selectedDate: Date;
  onDateSelect?: (date: Date) => void;
  allEvents: Event[];
  onTaskDrop: (taskId: string, startTime: Date) => void;
  onEventDeleted?: (eventId: string) => void;
  onEventUpdated?: (eventId: string, updatedData: any) => void;
  onProjectTaskClick?: (taskId: string) => void;
  userTimezone?: string | null;
  viewMode?: 'week' | 'day';
}

function toEventDateTime(
  time: Date | { seconds: number } | string,
  viewerZone: string
): DateTime {
  let js: Date;
  if (time instanceof Date) {
    js = time;
  } else if (typeof time === 'object' && 'seconds' in time) {
    js = new Date(time.seconds * 1000);
  } else {
    js = parseCalendarToJsDate(time);
  }

  return DateTime.fromJSDate(js, { zone: 'utc' }).setZone(viewerZone);
}

function formatEventTime(dateTime: DateTime): string {
  return dateTime.toFormat('h:mm a');
}

function formatCompactEventTime(dateTime: DateTime): string {
  return dateTime.toFormat('h a').replace(' ', '');
}

// Helper function to round minutes to nearest interval
function roundToNearestInterval(minutes: number, interval: number): number {
  return Math.round(minutes / interval) * interval;
}

// Helper function to convert pixels to time
function pixelsToTime(pixels: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(pixels / (MINUTES_PER_HOUR / GRID_SNAP)) * GRID_SNAP;
  return {
    hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR
  };
}

// Add TimeIndicator component
const TimeIndicator = ({ weekDates, pixelsPerMinute }: { weekDates: Date[], pixelsPerMinute: number }) => {
  // `null` until mounted so SSR and first client render match (avoids a
  // hydration mismatch on the time-dependent `top` position).
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const numDays = weekDates.length;

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, []);

  if (!currentTime) return null;

  // Find which column index (if any) corresponds to today
  const todayColIndex = weekDates.findIndex(
    (d) => d.getFullYear() === currentTime.getFullYear() &&
            d.getMonth() === currentTime.getMonth() &&
            d.getDate() === currentTime.getDate()
  );
  const isVisible = todayColIndex >= 0;
  const topPx = (currentTime.getHours() * 60 + currentTime.getMinutes()) * pixelsPerMinute;
  const leftPct = todayColIndex * (100 / numDays);

  return (
    <div className="flex items-center pointer-events-none">
      <div
        className={`absolute w-3 h-3 rounded-full bg-red-500 z-10 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{
          left: `calc(${leftPct}%)`,
          top: `${topPx}px`,
          transform: 'translate(-50%, -40%)'
        }}
      />
      <div
        className={`absolute border-t-2 border-red-500 z-10 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{
          left: `calc(${leftPct}%)`,
          top: `${topPx}px`,
          width: `${100 / numDays}%`
        }}
      />
    </div>
  );
};

export function CalendarGrid({ selectedDate, onDateSelect, allEvents, onTaskDrop, onEventDeleted, onEventUpdated, onProjectTaskClick, userTimezone, viewMode = 'week' }: CalendarGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewerZone = resolveViewerFallbackZone(userTimezone);
  const isDayView = viewMode === 'day';
  const pixelsPerHour = isDayView ? DAY_VIEW_PIXELS_PER_HOUR : WEEK_VIEW_PIXELS_PER_HOUR;
  const pixelsPerMinute = pixelsPerHour / MINUTES_PER_HOUR;
  const gridHeight = HOURS.length * pixelsPerHour;
  const startOfCurrentWeek = isDayView ? selectedDate : startOfWeek(selectedDate);
  const weekDates = isDayView
    ? [selectedDate]
    : DAYS_OF_WEEK.map((_, index) => addDays(startOfCurrentWeek, index));
  const numDays = weekDates.length;

  const { timedEvents, allDayLayouts } = useMemo(() => {
    const allDay = allEvents.filter((event) => isAllDayEvent(event));
    const timed = allEvents.filter((event) => !isAllDayEvent(event));
    const layouts = layoutAllDayEvents(allDay, startOfDay(startOfCurrentWeek), numDays);
    return {
      timedEvents: timed,
      allDayLayouts: layouts,
    };
  }, [allEvents, startOfCurrentWeek, numDays]);

  const positionedTimedEvents = useMemo(
    () => layoutTimedEventsForWeek(timedEvents, startOfCurrentWeek, numDays, viewerZone),
    [timedEvents, startOfCurrentWeek, numDays, viewerZone]
  );

  const [isAllDayExpanded, setIsAllDayExpanded] = useState(false);

  const eventsCountByDay = useMemo(() => {
    const counts = Array.from({ length: numDays }, () => 0);
    for (const layout of allDayLayouts) {
      for (let day = layout.startDayIndex; day < layout.startDayIndex + layout.spanDays; day++) {
        counts[day] += 1;
      }
    }
    return counts;
  }, [allDayLayouts, numDays]);

  const maxAllDayRow = allDayLayouts.length > 0
    ? Math.max(...allDayLayouts.map((layout) => layout.row))
    : -1;

  const hasAllDayOverflow = eventsCountByDay.some(
    (count) => count > MAX_VISIBLE_ALL_DAY_ROWS
  );

  const visibleAllDayLayouts = isAllDayExpanded
    ? allDayLayouts
    : allDayLayouts.filter((layout) => layout.row < MAX_VISIBLE_ALL_DAY_ROWS);

  const allDaySectionHeight = useMemo(() => {
    if (allDayLayouts.length === 0) return 0;

    if (isAllDayExpanded) {
      return (maxAllDayRow + 1) * (ALL_DAY_ROW_HEIGHT + ALL_DAY_ROW_GAP) + 8;
    }

    const visibleEventRows = Math.min(maxAllDayRow + 1, MAX_VISIBLE_ALL_DAY_ROWS);
    return (
      visibleEventRows * (ALL_DAY_ROW_HEIGHT + ALL_DAY_ROW_GAP) +
      (hasAllDayOverflow ? ALL_DAY_MORE_ROW_HEIGHT : 0) +
      8
    );
  }, [allDayLayouts.length, isAllDayExpanded, maxAllDayRow, hasAllDayOverflow]);
  
  // State for drag preview
  const [dragPreview, setDragPreview] = useState<{
    visible: boolean;
    dayIndex: number;
    time: Date;
    height: number;
    taskId: string;
    title: string;
    eventType: string;
  } | null>(null);

  // Add state for regular events popup
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isViewPopupOpen, setIsViewPopupOpen] = useState(false);
  
  // Add state for current time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Add useEffect for time updates
  useEffect(() => {
    // Update time immediately
    setCurrentTime(new Date());

    // Set up interval to update every 15 seconds
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // 15000 milliseconds = 15 seconds

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Handle event click
  const handleEventClick = (event: Event) => {
    if (event.type === 'project-task') {
      const taskId = event.projectTaskId ?? event.id.replace('project-task-', '');
      onProjectTaskClick?.(taskId);
      return;
    }

    setSelectedEvent(event);
    setIsViewPopupOpen(true);
  };
  
  // Handle event deletion
  const handleEventDeleted = (eventId: string) => {
    if (onEventDeleted) {
      onEventDeleted(eventId);
    }
  };
  
  // Handle event updates
  const handleEventUpdated = (eventId: string, updatedData: any) => {
    if (onEventUpdated) {
      onEventUpdated(eventId, updatedData);
    }
  };

  // Handle drag over to show preview
  const handleDragOver = (e: React.DragEvent, dayIndex: number, hour: number, minute: number = 0) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    
    if (!taskId) return;
    
    // Round to nearest 15-minute interval
    const roundedMinute = Math.round(minute / GRID_SNAP) * GRID_SNAP;
    
    // Create the time at the drop location
    const dropDate = addDays(startOfCurrentWeek, dayIndex);
    dropDate.setHours(hour, roundedMinute, 0, 0);
    
    // Try to get additional task data from dataTransfer
    let taskData: { id: string; title: string; eventType: string; duration: string } | null = null;
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        taskData = JSON.parse(jsonData);
      }
    } catch (err) {
      console.error('Error parsing task data:', err);
    }
    
    if (taskData) {
      // Use the task data to create a preview
      let duration = 30; // Default 30 minutes
      
      if (taskData.duration) {
        if (taskData.duration === 'reminder') {
          duration = 15;
        } else {
          const parsedDuration = parseInt(taskData.duration);
          if (!isNaN(parsedDuration) && parsedDuration > 0) {
            duration = parsedDuration;
          }
        }
      }
      
      setDragPreview({
        visible: true,
        dayIndex,
        time: dropDate,
        height: duration, // Height in minutes based on task duration
        taskId,
        title: taskData.title,
        eventType: taskData.eventType || 'task'
      });
    } else {
      // Fallback to searching existing events if dataTransfer doesn't have the data
      const taskEvent = allEvents.find(event => 
        event.type === 'scheduled-task' && event.id.replace('scheduled-', '') === taskId
      );
      
      if (taskEvent) {
        const startDate = toEventDateTime(taskEvent.startTime, viewerZone);
        const endDate = toEventDateTime(taskEvent.endTime, viewerZone);
        const taskDuration = endDate.diff(startDate, 'minutes').minutes;
        const heightInMinutes = taskDuration;
        
        setDragPreview({
          visible: true,
          dayIndex,
          time: dropDate,
          height: heightInMinutes,
          taskId,
          title: taskEvent.title,
          eventType: taskEvent.eventType || 'task'
        });
      } else {
        // Default to a 30-minute task if not found
        setDragPreview({
          visible: true,
          dayIndex,
          time: dropDate,
          height: 30, // 30 minutes default
          taskId,
          title: 'New Task',
          eventType: 'task'
        });
      }
    }
  };
  
  // Handle drop with snapping to 15-minute intervals
  const handleDrop = (e: React.DragEvent, dayIndex: number, hour: number, minute: number = 0) => {
    e.preventDefault();
    
    // Get the task ID from the drag data
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    
    // Round to nearest 15-minute interval
    const roundedMinute = Math.round(minute / GRID_SNAP) * GRID_SNAP;
    
    // Calculate the drop time based on day, hour, and rounded minute
    const dropDate = addDays(startOfCurrentWeek, dayIndex);
    dropDate.setHours(hour, roundedMinute, 0, 0);
    
    // Call the parent component's onTaskDrop method
    onTaskDrop(taskId, dropDate);
    
    // Hide preview
    setDragPreview(null);
  };
  
  // Handle drag leave to hide preview
  const handleDragLeave = (e: React.DragEvent) => {
    // Only hide if we're leaving the main grid area, not just moving between cells
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragPreview(null);
    }
  };

  React.useEffect(() => {
    const viewport = viewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const scrollPosition = (currentMinutes * pixelsPerMinute) - ((viewport as HTMLElement).clientHeight * 0.15);
      
      setTimeout(() => {
        (viewport as HTMLElement).scrollTop = Math.max(0, scrollPosition);
      }, 0);
    }
  }, [pixelsPerMinute]);

  return (
    <>
      <div
        className={cn(
          'flex-1 flex flex-col bg-white overflow-hidden min-h-0 overscroll-none',
          viewMode === 'day' && 'border rounded-[30px] shadow-sm'
        )}
      >
        <div className="flex bg-white pt-2">
          <div className="w-12" />
          {weekDates.map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());

            return (
              <div key={index} className="flex-1 px-1">
                <button
                  type="button"
                  onClick={() => onDateSelect?.(date)}
                  className={cn(
                    "w-full flex flex-col items-center rounded-xl transition-colors",
                    onDateSelect && "hover:bg-neutral-50"
                  )}
                >
                  <span className="text-xs font-light text-neutral-500">
                    {format(date, 'EEE')}
                  </span>
                  <span className={cn(
                    "flex items-center justify-center w-10 h-10 mt-1 rounded-full text-lg font-medium",
                    isToday && "bg-walls-yellow/60 text-black font-semibold",
                    isSelected && !isToday && "text-neutral-900 font-semibold"
                  )}>
                    {format(date, 'd')}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {allDayLayouts.length > 0 && (
          <div
            className={cn(
              'flex border-b border-slate-200 bg-white transition-[min-height] duration-150',
              isAllDayExpanded && 'relative z-20 shadow-sm'
            )}
            style={{ minHeight: `${allDaySectionHeight}px` }}
            onMouseEnter={() => hasAllDayOverflow && setIsAllDayExpanded(true)}
            onMouseLeave={() => setIsAllDayExpanded(false)}
          >
            <div className="w-12 shrink-0 flex items-start justify-end pr-1.5 pt-1.5">
              <span className="text-[9px] leading-none text-muted-foreground">all-day</span>
            </div>
            <div className="flex-1 relative py-1 pr-1">
              <div className="absolute inset-0 flex pointer-events-none">
                {weekDates.map((_, dayIndex) => (
                  <div
                    key={`all-day-col-${dayIndex}`}
                    className="flex-1 border-r border-slate-200 last:border-r-0"
                  />
                ))}
              </div>
              {visibleAllDayLayouts.map(({ event, startDayIndex, spanDays, row }) => {
                const theme = getAllDayEventTheme(event);
                const isCompleted = isCalendarTaskCompleted(event);
                const showGoogleMeetIcon =
                  event.type === 'regular-event' && isGoogleMeetLink(event.meetingLink);
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={cn(
                      'absolute text-left transition-all',
                      theme.container,
                      isCompleted && 'opacity-60'
                    )}
                    style={{
                      left: `${(startDayIndex / numDays) * 100}%`,
                      width: `calc(${(spanDays / numDays) * 100}% - 4px)`,
                      top: `${row * (ALL_DAY_ROW_HEIGHT + ALL_DAY_ROW_GAP) + 4}px`,
                      height: `${ALL_DAY_ROW_HEIGHT}px`,
                    }}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="relative h-full flex min-w-0 overflow-hidden">
                      <span
                        className={cn(
                          'w-[3px] shrink-0 self-stretch',
                          isCompleted ? getCompletedTaskAccentClass() : theme.accentColor
                        )}
                      />
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-2 pr-2">
                        {showGoogleMeetIcon && (
                          <Image
                            src={GOOGLE_MEET_ICON_URL}
                            alt="Google Meet"
                            width={14}
                            height={14}
                            className="shrink-0"
                          />
                        )}
                        <span
                          className={cn(
                            'truncate text-xs min-w-0 flex-1',
                            isCompleted ? getCompletedTaskTitleClass() : theme.title
                          )}
                        >
                          {event.title}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!isAllDayExpanded && hasAllDayOverflow && weekDates.map((_, dayIndex) => {
                const extraCount = eventsCountByDay[dayIndex] - MAX_VISIBLE_ALL_DAY_ROWS;
                if (extraCount <= 0) return null;

                return (
                  <span
                    key={`all-day-more-${dayIndex}`}
                    className="absolute px-1 text-[10px] font-medium text-muted-foreground pointer-events-none"
                    style={{
                      left: `${(dayIndex / numDays) * 100}%`,
                      width: `calc(${(1 / numDays) * 100}% - 4px)`,
                      top: `${MAX_VISIBLE_ALL_DAY_ROWS * (ALL_DAY_ROW_HEIGHT + ALL_DAY_ROW_GAP) + 4}px`,
                      height: `${ALL_DAY_MORE_ROW_HEIGHT}px`,
                      lineHeight: `${ALL_DAY_MORE_ROW_HEIGHT}px`,
                    }}
                  >
                    {extraCount} more
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <ScrollArea ref={viewportRef} className="flex-1 min-h-0 overscroll-contain">
          <div 
            className="relative" 
            style={{ height: `${gridHeight}px` }}
            onDragLeave={handleDragLeave}
          >
            {/* Time column */}
            <div className="absolute top-0 left-0 w-12 h-full border-r bg-white">
              {HOURS.map((hour) => (
                <div key={hour} className="relative border-b border-slate-100" style={{ height: `${pixelsPerHour}px` }}>
                  {hour !== 0 && (
                    <span className="absolute top-[-10px] right-2 text-[10px] text-walls-sky">
                      {format(new Date().setHours(hour, 0), 'ha')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Events grid */}
            <div className="absolute left-12 right-0 top-0 h-full">
              {/* Current time indicator */}
              <TimeIndicator weekDates={weekDates} pixelsPerMinute={pixelsPerMinute} />

              {/* Hour grid with 15-minute intervals */}
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: `${pixelsPerHour}px` }}>
                  <div className="absolute top-0 left-0 right-0 border-t border-slate-100" />
                  <div className="flex h-full">
                    {weekDates.map((_, dayIndex) => (
                      <div key={dayIndex} className="flex-1 border-r border-slate-200 h-full relative">
                        {/* Four 15-minute interval sections per hour */}
                        {[0, 15, 30, 45].map(minute => (
                          <div
                            key={`${hour}-${minute}-${dayIndex}`}
                            className="absolute w-full border-t border-slate-100 border-dashed"
                            style={{
                              top: `${minute * pixelsPerMinute}px`,
                              height: `${GRID_SNAP * pixelsPerMinute}px`,
                              opacity: minute === 0 ? 0 : 0.5 // Make the non-hour lines lighter
                            }}
                            onDragOver={(e) => handleDragOver(e, dayIndex, hour, minute)}
                            onDrop={(e) => handleDrop(e, dayIndex, hour, minute)}
                          ></div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Drag preview */}
              {dragPreview && dragPreview.visible && (
                <div
                  className={cn(
                    'absolute rounded-md border-2 border-dashed border-walls-yellow bg-walls-yellow/5 opacity-90'
                  )}
                  style={{
                    left: `${(dragPreview.dayIndex * (100 / numDays))}%`,
                    top: `${(dragPreview.time.getHours() * 60 + dragPreview.time.getMinutes()) * pixelsPerMinute}px`,
                    width: `${100 / numDays - 2}%`,
                    height: `${dragPreview.height * pixelsPerMinute}px`,
                    zIndex: 5,
                  }}
                >
                  <div className="flex h-full min-w-0">
                    <span className="w-[3px] shrink-0 self-stretch bg-walls-yellow" />
                    <div className="min-w-0 flex-1 p-2 pl-2">
                      <div className="text-xs font-normal truncate">{dragPreview.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {format(dragPreview.time, 'h:mm a')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Events */}
              {positionedTimedEvents.map(({
                event,
                dayOffset,
                column,
                totalColumns,
                startTime,
                endTime,
                topMinutes,
                durationMinutes,
              }) => {
                const dayWidthPct = 100 / numDays;
                const columnWidthPct = dayWidthPct / totalColumns;
                const left = `${dayOffset * dayWidthPct + column * columnWidthPct}%`;
                const width = `calc(${columnWidthPct}% - 4px)`;
                const top = topMinutes * pixelsPerMinute;
                const height = durationMinutes * pixelsPerMinute;

                const isShortEvent = durationMinutes < 45;
                const isNearTop = top < 100;
                const tooltipPosition = isNearTop ? {
                  top: '100%',
                  marginTop: '5px'
                } : {
                  bottom: '100%',
                  marginBottom: '5px'
                };

                const theme = getTimedEventTheme(event);
                const isCompleted = isCalendarTaskCompleted(event);
                const isMeeting = event.type === 'regular-event';
                const isGoogleMeet = isMeeting && isGoogleMeetLink(event.meetingLink);
                const showTime = !isMeeting && durationMinutes >= 25 && height >= 36;
                const { maxLines: maxTitleLines } = getEventTitleLineBudget(
                  height,
                  isShortEvent,
                  showTime
                );
                const displayLabel = getCalendarEventDisplayLabel(
                  event,
                  formatCompactEventTime(startTime)
                );

                return (
                  <div
                    key={event.id}
                    className={cn(
                      'absolute cursor-pointer group hover:z-20',
                      theme.container,
                      isCompleted && 'opacity-60'
                    )}
                    style={{
                      left,
                      top: `${top}px`,
                      width,
                      height: `${height}px`,
                    }}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="relative h-full flex min-w-0 overflow-hidden">
                      <span
                        className={cn(
                          'w-[3px] shrink-0 self-stretch',
                          isCompleted ? getCompletedTaskAccentClass() : theme.accentColor
                        )}
                      />
                      <div
                        className={cn(
                          'min-w-0 flex-1 flex flex-col overflow-hidden',
                          isShortEvent ? 'justify-center px-2 py-0.5' : 'px-2.5 py-1.5'
                        )}
                      >
                        <div className="min-w-0 overflow-hidden">
                          {isGoogleMeet && (
                            <Image
                              src={GOOGLE_MEET_ICON_URL}
                              alt="Google Meet"
                              width={14}
                              height={14}
                              className="float-left mr-1.5 shrink-0"
                            />
                          )}
                          <span
                            className={cn(
                              'block leading-snug text-xs',
                              getEventTitleTextClass(maxTitleLines),
                              isCompleted ? getCompletedTaskTitleClass() : theme.title
                            )}
                          >
                            {displayLabel}
                          </span>
                        </div>
                        {showTime && (
                          <span className={cn('text-xs mt-0.5', theme.time)}>
                            {formatEventTime(startTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 bg-gray-900/95 text-white p-2.5 rounded-xl shadow-xl whitespace-nowrap pointer-events-none backdrop-blur-sm"
                      style={{
                        left: '50%',
                        transform: 'translateX(-50%)',
                        maxWidth: '220px',
                        ...tooltipPosition,
                      }}
                    >
                      <div className="font-normal text-sm mb-1">{event.title}</div>
                      <div className="text-xs font-normal text-white/80">
                        {formatEventTime(startTime)} – {formatEventTime(endTime)}
                      </div>
                      {event.location && (
                        <div className="text-[11px] text-white/70 mt-1">{event.location}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>
      
      {/* View Popup */}
      {selectedEvent && (
        <ViewPopup
          isOpen={isViewPopupOpen}
          onClose={() => setIsViewPopupOpen(false)}
          event={selectedEvent}
          onEventDeleted={handleEventDeleted}
          onEventUpdated={handleEventUpdated}
        />
      )}
    </>
  );
}