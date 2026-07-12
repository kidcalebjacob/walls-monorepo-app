import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { parseCalendarToJsDate } from '@/lib/calendar-recurring';

type CalendarTime = Date | { seconds: number } | string;

export function convertCalendarTime(time: CalendarTime): Date {
  if (time instanceof Date) return new Date(time);
  if (typeof time === 'object' && 'seconds' in time) {
    return new Date(time.seconds * 1000);
  }
  return parseCalendarToJsDate(time);
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMidnight(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
}

function isEndOfDay(date: Date): boolean {
  return date.getHours() === 23 && date.getMinutes() === 59;
}

export function isAllDayEvent(event: {
  startTime: CalendarTime;
  endTime: CalendarTime;
  isAllDay?: boolean;
  type?: string;
}): boolean {
  if (event.isAllDay) return true;
  if (event.type === 'project-task') return true;

  if (typeof event.startTime === 'string' && isDateOnlyString(event.startTime)) {
    return true;
  }

  const start = convertCalendarTime(event.startTime);
  const end = convertCalendarTime(event.endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  const calendarDaySpan = differenceInCalendarDays(startOfDay(end), startOfDay(start));

  if (isMidnight(start) && isMidnight(end) && calendarDaySpan >= 1) {
    return true;
  }

  if (isMidnight(start) && isEndOfDay(end) && calendarDaySpan === 0) {
    return true;
  }

  const durationMs = end.getTime() - start.getTime();
  if (isMidnight(start) && durationMs >= 24 * 60 * 60 * 1000 - 1000) {
    return true;
  }

  return false;
}

export function getAllDayEventWeekLayout(
  startTime: CalendarTime,
  endTime: CalendarTime,
  weekStart: Date,
  numDays: number
): { startDayIndex: number; spanDays: number } | null {
  const start = startOfDay(convertCalendarTime(startTime));
  let end = startOfDay(convertCalendarTime(endTime));

  const rawEnd = convertCalendarTime(endTime);
  if (
    isMidnight(rawEnd) &&
    differenceInCalendarDays(rawEnd, start) > 0
  ) {
    end = addDays(end, -1);
  }

  const weekEnd = addDays(startOfDay(weekStart), numDays - 1);
  const visibleStart = start < weekStart ? startOfDay(weekStart) : start;
  const visibleEnd = end > weekEnd ? weekEnd : end;

  if (visibleStart > visibleEnd) return null;

  const startDayIndex = differenceInCalendarDays(visibleStart, startOfDay(weekStart));
  const spanDays = differenceInCalendarDays(visibleEnd, visibleStart) + 1;

  return { startDayIndex, spanDays };
}

export interface AllDayEventLayout<T> {
  event: T;
  startDayIndex: number;
  spanDays: number;
  row: number;
}

export function layoutAllDayEvents<T extends { startTime: CalendarTime; endTime: CalendarTime }>(
  events: T[],
  weekStart: Date,
  numDays: number
): AllDayEventLayout<T>[] {
  const layouts: AllDayEventLayout<T>[] = [];
  const rowRanges: Array<Array<{ startCol: number; endCol: number }>> = [];

  const sortedEvents = [...events].sort((a, b) => {
    const aStart = convertCalendarTime(a.startTime).getTime();
    const bStart = convertCalendarTime(b.startTime).getTime();
    return aStart - bStart;
  });

  for (const event of sortedEvents) {
    const layout = getAllDayEventWeekLayout(
      event.startTime,
      event.endTime,
      weekStart,
      numDays
    );
    if (!layout) continue;

    const startCol = layout.startDayIndex;
    const endCol = layout.startDayIndex + layout.spanDays - 1;

    let row = 0;
    while (true) {
      const ranges = rowRanges[row] ?? [];
      const conflicts = ranges.some(
        (range) => !(endCol < range.startCol || startCol > range.endCol)
      );
      if (!conflicts) {
        if (!rowRanges[row]) rowRanges[row] = [];
        rowRanges[row].push({ startCol, endCol });
        layouts.push({ event, ...layout, row });
        break;
      }
      row += 1;
    }
  }

  return layouts;
}
