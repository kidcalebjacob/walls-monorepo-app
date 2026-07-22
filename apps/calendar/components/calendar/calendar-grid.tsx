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
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

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

function getEventAccentStyle(event: Event): React.CSSProperties | undefined {
  if (
    (event.type === 'project-task' || event.type === 'project-task-schedule') &&
    event.projectColor
  ) {
    return { backgroundColor: event.projectColor };
  }
  return undefined;
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
  type?: 'regular-event' | 'scheduled-task' | 'project-task' | 'project-task-schedule';
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
  scheduleId?: string;
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

const EVENT_TOOLTIP_EDGE_PAD = 140;

function TimedEventBlock({
  event,
  left,
  top,
  width,
  height,
  durationMinutes,
  startTime,
  endTime,
  onClick,
}: {
  event: Event;
  left: string;
  top: number;
  width: string;
  height: number;
  durationMinutes: number;
  startTime: DateTime;
  endTime: DateTime;
  onClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeBelow: boolean;
  } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const updateCoords = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Flip below when near the top of the viewport so the portal tooltip
      // isn't clipped by the calendar header / all-day section.
      const placeBelow = rect.top < EVENT_TOOLTIP_EDGE_PAD;
      setCoords({
        top: placeBelow ? rect.bottom + 6 : rect.top - 6,
        left: rect.left + rect.width / 2,
        placeBelow,
      });
    };

    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open]);

  const isShortEvent = durationMinutes < 45;
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
      ref={anchorRef}
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
      onClick={onClick}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="relative h-full flex min-w-0 overflow-hidden">
        <span
          className={cn(
            'w-[3px] shrink-0 self-stretch',
            isCompleted
              ? getCompletedTaskAccentClass()
              : !event.projectColor && theme.accentColor
          )}
          style={isCompleted ? undefined : getEventAccentStyle(event)}
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

      {typeof document !== 'undefined' &&
        createPortal(
          open && coords ? (
            <div
              className="pointer-events-none fixed z-[9999] max-w-[220px] whitespace-nowrap rounded-xl bg-gray-900/95 p-2.5 text-white shadow-xl backdrop-blur-sm"
              style={{
                top: coords.top,
                left: coords.left,
                transform: coords.placeBelow
                  ? 'translate(-50%, 0)'
                  : 'translate(-50%, -100%)',
              }}
            >
              <div className="mb-1 text-sm font-normal">{event.title}</div>
              <div className="text-xs font-normal text-white/80">
                {formatEventTime(startTime)} – {formatEventTime(endTime)}
              </div>
              {event.location && (
                <div className="mt-1 text-[11px] text-white/70">{event.location}</div>
              )}
            </div>
          ) : null,
          document.body
        )}
    </div>
  );
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

function formatRelativeMinutes(minutes: number): string {
  const mins = Math.max(1, Math.round(minutes));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return hours === 1 ? '1 hr' : `${hours} hrs`;
  return `${hours}h ${rem}m`;
}

type NowGlance =
  | { kind: 'current'; title: string; endsInMinutes: number; extraCount: number }
  | { kind: 'next'; title: string; inMinutes: number; atLabel: string }
  | { kind: 'clear' };

function getNowGlance(
  now: DateTime,
  events: Array<{ title: string; start: DateTime; end: DateTime }>
): NowGlance {
  const active = events
    .filter((event) => event.start <= now && now < event.end)
    .sort((a, b) => a.end.toMillis() - b.end.toMillis());

  if (active.length > 0) {
    const current = active[0];
    return {
      kind: 'current',
      title: current.title || 'Untitled',
      endsInMinutes: current.end.diff(now, 'minutes').minutes,
      extraCount: active.length - 1,
    };
  }

  const upcoming = events
    .filter((event) => event.start > now)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  if (upcoming.length > 0) {
    const next = upcoming[0];
    return {
      kind: 'next',
      title: next.title || 'Untitled',
      inMinutes: next.start.diff(now, 'minutes').minutes,
      atLabel: formatEventTime(next.start),
    };
  }

  return { kind: 'clear' };
}

const TimeIndicator = ({
  weekDates,
  pixelsPerMinute,
  timedEvents,
  viewerZone,
}: {
  weekDates: Date[];
  pixelsPerMinute: number;
  timedEvents: Event[];
  viewerZone: string;
}) => {
  // `null` until mounted so SSR and first client render match (avoids a
  // hydration mismatch on the time-dependent `top` position).
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const numDays = weekDates.length;

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;

    const updateCoords = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCoords({ top: rect.top, left: rect.left });
    };

    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open]);

  if (!currentTime) return null;

  const todayColIndex = weekDates.findIndex(
    (d) => d.getFullYear() === currentTime.getFullYear() &&
            d.getMonth() === currentTime.getMonth() &&
            d.getDate() === currentTime.getDate()
  );
  if (todayColIndex < 0) return null;

  const now = DateTime.fromJSDate(currentTime).setZone(viewerZone);
  const todayStart = now.startOf('day');
  const todayEnd = todayStart.endOf('day');

  const todayEvents = timedEvents
    .map((event) => {
      const start = toEventDateTime(event.startTime, viewerZone);
      const end = toEventDateTime(event.endTime, viewerZone);
      if (!start.isValid || !end.isValid) return null;
      if (end <= todayStart || start > todayEnd) return null;
      return { title: event.title, start, end };
    })
    .filter((event): event is { title: string; start: DateTime; end: DateTime } => event !== null);

  const glance = getNowGlance(now, todayEvents);
  const topPx = (currentTime.getHours() * 60 + currentTime.getMinutes()) * pixelsPerMinute;
  const leftPct = todayColIndex * (100 / numDays);
  const widthPct = 100 / numDays;
  const clock = format(currentTime, 'h:mm');
  const meridiem = format(currentTime, 'a');

  return (
    <div
      ref={anchorRef}
      className="absolute z-20"
      style={{
        left: `${leftPct}%`,
        top: `${topPx}px`,
        width: `${widthPct}%`,
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 cursor-default"
        aria-hidden
      >
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-[var(--kenoo-accent)] pointer-events-none"
          style={{
            maskImage: 'linear-gradient(90deg, black 0%, black 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(90deg, black 0%, black 55%, transparent 100%)',
          }}
        />
        <div className="absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--kenoo-accent)] pointer-events-none" />
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                key="now-glance"
                initial={{ opacity: 0, y: 'calc(-100% + 8px)', scale: 0.96, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: '-100%', scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 'calc(-100% + 6px)', scale: 0.97, filter: 'blur(4px)' }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-none fixed z-[9999] w-[220px] origin-bottom-left overflow-hidden rounded-2xl border border-white/60 bg-white/92 text-left text-kenoo-ink shadow-[0_16px_40px_rgba(17,17,17,0.12)] backdrop-blur-xl"
                style={{
                  top: coords.top - 12,
                  left: coords.left,
                }}
              >
                <div className="relative px-3.5 pb-3 pt-3">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(11,110,255,0.14),transparent_60%)]"
                  />
                  <div className="relative flex items-center gap-2">
                    <span className="relative flex size-1.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-[var(--kenoo-accent)]/40" />
                      <span className="relative size-1.5 rounded-full bg-[var(--kenoo-accent)]" />
                    </span>
                    <p className="font-display text-[22px] font-semibold leading-none tracking-tight text-kenoo-ink">
                      {clock}
                      <span className="ml-1.5 align-middle text-[11px] font-medium uppercase tracking-[0.14em] text-kenoo-muted">
                        {meridiem}
                      </span>
                    </p>
                  </div>

                  <div className="relative mt-3 rounded-xl bg-[#f6f8fc] px-3 py-2.5">
                    {glance.kind === 'current' && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--kenoo-accent)]">
                          Happening now
                        </p>
                        <p className="mt-1 truncate text-[13px] font-medium leading-snug text-kenoo-ink">
                          {glance.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-kenoo-muted">
                          Ends in {formatRelativeMinutes(glance.endsInMinutes)}
                          {glance.extraCount > 0 ? ` · +${glance.extraCount} more` : null}
                        </p>
                      </>
                    )}
                    {glance.kind === 'next' && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-kenoo-muted">
                          Up next
                        </p>
                        <p className="mt-1 truncate text-[13px] font-medium leading-snug text-kenoo-ink">
                          {glance.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-kenoo-muted">
                          in {formatRelativeMinutes(glance.inMinutes)}
                          <span className="mx-1.5 text-kenoo-border">·</span>
                          {glance.atLabel}
                        </p>
                      </>
                    )}
                    {glance.kind === 'clear' && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-kenoo-muted">
                          Schedule
                        </p>
                        <p className="mt-1 text-[13px] font-medium leading-snug text-kenoo-ink">
                          Nothing left today
                        </p>
                        <p className="mt-0.5 text-[11px] text-kenoo-muted">
                          Clear for the rest of the day
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
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
    if (event.type === 'project-task' || event.type === 'project-task-schedule') {
      if (event.projectTaskId) {
        onProjectTaskClick?.(event.projectTaskId);
      }
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
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden overscroll-none bg-transparent">
        <div className="flex shrink-0 bg-transparent pb-1 pt-1">
          <div className="w-12" />
          {weekDates.map((date, index) => {
            const isToday = isSameDay(date, new Date());

            return (
              <div key={index} className="flex-1 px-1">
                <button
                  type="button"
                  onClick={() => onDateSelect?.(date)}
                  className={cn(
                    "flex w-full flex-col items-center gap-0.5 rounded-xl py-0.5 transition-colors",
                    onDateSelect && "hover:bg-kenoo-subtle"
                  )}
                >
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-kenoo-muted">
                    {format(date, 'EEE')}
                  </span>
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium text-kenoo-ink",
                    isToday && "bg-[#00A8E8] text-white"
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
              'flex shrink-0 border-b border-white/40 bg-white/55 transition-[min-height] duration-150',
              isAllDayExpanded && 'relative z-20'
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
                    className="flex-1 border-r border-kenoo-border last:border-r-0"
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
                          isCompleted
                            ? getCompletedTaskAccentClass()
                            : !event.projectColor && theme.accentColor
                        )}
                        style={
                          isCompleted ? undefined : getEventAccentStyle(event)
                        }
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

        <ScrollArea ref={viewportRef} className="h-full min-h-0 flex-1 overscroll-contain">
          <div 
            className="relative" 
            style={{ height: `${gridHeight}px` }}
            onDragLeave={handleDragLeave}
          >
            {/* Time column */}
            <div className="absolute top-0 left-0 w-12 h-full border-r border-white/40 bg-transparent">
              {HOURS.map((hour) => (
                <div key={hour} className="relative border-b border-slate-100" style={{ height: `${pixelsPerHour}px` }}>
                  {hour !== 0 && (
                    <span className="absolute top-[-10px] right-2 text-[10px] text-kenoo-sky">
                      {format(new Date().setHours(hour, 0), 'ha')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Events grid */}
            <div className="absolute left-12 right-0 top-0 h-full">
              {/* Current time indicator */}
              <TimeIndicator
                weekDates={weekDates}
                pixelsPerMinute={pixelsPerMinute}
                timedEvents={timedEvents}
                viewerZone={viewerZone}
              />

              {/* Hour grid with 15-minute intervals */}
              {HOURS.map((hour) => (
                <div key={hour} className="relative" style={{ height: `${pixelsPerHour}px` }}>
                  <div className="absolute top-0 left-0 right-0 border-t border-slate-100" />
                  <div className="flex h-full">
                    {weekDates.map((_, dayIndex) => (
                      <div key={dayIndex} className="relative h-full flex-1 border-r border-kenoo-border last:border-r-0">
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
                    'absolute rounded-md border-2 border-dashed border-kenoo-yellow bg-kenoo-yellow/5 opacity-90'
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
                    <span className="w-[3px] shrink-0 self-stretch bg-kenoo-yellow" />
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

                return (
                  <TimedEventBlock
                    key={event.id}
                    event={event}
                    left={left}
                    top={top}
                    width={width}
                    height={height}
                    durationMinutes={durationMinutes}
                    startTime={startTime}
                    endTime={endTime}
                    onClick={() => handleEventClick(event)}
                  />
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