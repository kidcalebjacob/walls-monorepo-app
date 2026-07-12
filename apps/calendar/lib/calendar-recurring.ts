import { DateTime, Info } from "luxon";

/** Postgres / ISO timestamps may use a space before the offset; normalize for reliable parsing. */
export function normalizeCalendarTimestamp(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.includes("T") ? t : t.replace(" ", "T");
}

export function parseCalendarToDateTime(isoOrPostgres: string): DateTime {
  return DateTime.fromISO(normalizeCalendarTimestamp(isoOrPostgres), { setZone: true });
}

/**
 * Google Calendar `eid` (base64url) embeds the canonical instance UTC, e.g. …_20250812T143000Z.
 * When DB `start_time` drifted from Google (common off-by-one-hour sync issues), this matches
 * what Google Calendar shows (e.g. 10:30 AM Eastern for 14:30Z in summer).
 */
export function parseGoogleCalendarCanonicalStartUtc(
  htmlLink: string | null | undefined
): string | null {
  if (!htmlLink || !htmlLink.includes("google.com/calendar")) return null;
  try {
    const u = new URL(htmlLink);
    const eid = u.searchParams.get("eid");
    if (!eid) return null;
    let b64 = eid.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    if (typeof globalThis.atob !== "function") return null;
    const decoded = globalThis.atob(b64);
    const m = decoded.match(/_(\d{8})T(\d{6})Z?\b/i);
    if (!m) return null;
    const d = m[1]!;
    const t = m[2]!;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}.000Z`;
  } catch {
    return null;
  }
}

/** Prefer for display and filters so timestamptz strings parse consistently across browsers. */
export function parseCalendarToJsDate(isoOrPostgres: string): Date {
  const dt = parseCalendarToDateTime(isoOrPostgres);
  if (!dt.isValid) return new Date(isoOrPostgres);
  return dt.toJSDate();
}

/** UTC epoch ms for comparing calendar instants stored as timestamptz / ISO strings. */
export function calendarInstantUtcMs(isoOrPostgres: string): number | null {
  const dt = parseCalendarToDateTime(normalizeCalendarTimestamp(isoOrPostgres));
  if (!dt.isValid) return null;
  return dt.toUTC().toMillis();
}

/**
 * Google recurring instance ids end with `_20260703T150000Z` — the original series slot
 * that was overridden or materialized as its own row.
 */
export function parseGoogleRecurringInstanceOriginalStartUtc(
  eventId: string | null | undefined
): string | null {
  if (!eventId) return null;
  const m = eventId.match(/_(\d{8})T(\d{6})Z$/i);
  if (!m) return null;
  const d = m[1]!;
  const t = m[2]!;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}.000Z`;
}

export type RecurringExceptionType = "cancelled" | "modified";

export type RecurringInstanceOverrideRow = {
  id?: string;
  account_id: string;
  recurring_event_id: string;
  original_start_time: string | null;
  event_id?: string | null;
  exception_type?: string | null;
  status?: string | null;
};

function resolveRecurringExceptionSlotMs(row: RecurringInstanceOverrideRow): number | null {
  const fromColumn = row.original_start_time?.trim()
    ? calendarInstantUtcMs(row.original_start_time)
    : null;
  const fromEventId = parseGoogleRecurringInstanceOriginalStartUtc(row.event_id);
  const fromEventIdMs = fromEventId ? calendarInstantUtcMs(fromEventId) : null;
  return fromColumn ?? fromEventIdMs;
}

export function isCancelledRecurringException(row: RecurringInstanceOverrideRow): boolean {
  const type = row.exception_type?.trim().toLowerCase();
  if (type === "cancelled") return true;
  if (type === "modified") return false;
  return row.status?.trim().toLowerCase() === "cancelled";
}

export type RecurringExceptionMaps = {
  /** Series slots replaced or removed by exception rows (cancelled + modified). */
  suppressedSlotStartMsByParent: Map<string, Set<number>>;
  /** `calendar_events.id` values that should not appear in the UI. */
  hiddenEventIds: Set<string>;
  /** Google `event_id` values (stable across calendar_view / calendar_events). */
  hiddenGoogleEventIds: Set<string>;
};

export function buildRecurringExceptionMaps(
  rows: RecurringInstanceOverrideRow[]
): RecurringExceptionMaps {
  const suppressedSlotStartMsByParent = new Map<string, Set<number>>();
  const hiddenEventIds = new Set<string>();
  const hiddenGoogleEventIds = new Set<string>();

  for (const row of rows) {
    if (!row.recurring_event_id) continue;
    const key = `${row.account_id}|${row.recurring_event_id}`;
    const ms = resolveRecurringExceptionSlotMs(row);
    if (ms != null) {
      if (!suppressedSlotStartMsByParent.has(key)) {
        suppressedSlotStartMsByParent.set(key, new Set());
      }
      suppressedSlotStartMsByParent.get(key)!.add(ms);
    }
    if (isCancelledRecurringException(row)) {
      if (row.id) hiddenEventIds.add(row.id);
      if (row.event_id) hiddenGoogleEventIds.add(row.event_id);
    }
  }

  return { suppressedSlotStartMsByParent, hiddenEventIds, hiddenGoogleEventIds };
}

/** Drop cancelled materialized rows; match by UUID or Google event_id. */
export function filterMeetingsHidingRecurringExceptions<
  T extends { id: string; event_id?: string | null; status?: string | null },
>(meetings: T[], maps: RecurringExceptionMaps): T[] {
  return meetings.filter((meeting) => {
    if (meeting.status?.trim().toLowerCase() === "cancelled") return false;
    if (maps.hiddenEventIds.has(meeting.id)) return false;
    if (meeting.event_id && maps.hiddenGoogleEventIds.has(meeting.event_id)) {
      return false;
    }
    return true;
  });
}

/** @deprecated Use buildRecurringExceptionMaps */
export function buildRecurringOverrideStartMsByParent(
  rows: RecurringInstanceOverrideRow[]
): Map<string, Set<number>> {
  return buildRecurringExceptionMaps(rows).suppressedSlotStartMsByParent;
}

/** Profile / app setting timezone, else browser — for display formatting only. */
export function resolveViewerFallbackZone(profileTimezone: string | null | undefined): string {
  const t = profileTimezone?.trim();
  if (t && Info.isValidIANAZone(t)) return t;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Event IANA zone from sync (e.g. Europe/Lisbon); UTC when missing or invalid. */
export function resolveEventZone(startTimezone: string | null | undefined): string {
  const t = startTimezone?.trim();
  if (t && Info.isValidIANAZone(t)) return t;
  return "UTC";
}

/** Re-apply anchor wall clock on a calendar day in zone (stable across EST/EDT for recurring events). */
function zonedDateWithWallClock(
  day: DateTime,
  zone: string,
  wall: { hour: number; minute: number; second: number; millisecond: number }
): DateTime {
  return DateTime.fromObject(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: wall.hour,
      minute: wall.minute,
      second: wall.second,
      millisecond: wall.millisecond,
    },
    { zone }
  );
}

/** RRULE BYDAY → Luxon weekday (Monday = 1 … Sunday = 7). */
const RRULE_DAY_TO_LUXON: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

/** MONTHLY BYDAY like "1TU" (first Tuesday), "-1FR" (last Friday). */
type MonthlyNthByday = { ordinal: number; weekday: number };

function parseMonthlyNthByday(raw: string): MonthlyNthByday | null {
  const s = raw.trim().toUpperCase();
  const withOrd = s.match(/^(-?\d+)(MO|TU|WE|TH|FR|SA|SU)$/);
  if (withOrd) {
    const wd = RRULE_DAY_TO_LUXON[withOrd[2]!];
    if (!wd) return null;
    return { ordinal: parseInt(withOrd[1]!, 10), weekday: wd };
  }
  const dayOnly = s.match(/^(MO|TU|WE|TH|FR|SA|SU)$/);
  if (dayOnly) {
    const wd = RRULE_DAY_TO_LUXON[dayOnly[1]!];
    if (!wd) return null;
    return { ordinal: 1, weekday: wd };
  }
  return null;
}

function monthlyNthRulesFromByday(byday: string[] | null | undefined): MonthlyNthByday[] {
  if (!byday?.length) return [];
  const out: MonthlyNthByday[] = [];
  for (const d of byday) {
    const p = parseMonthlyNthByday(d);
    if (p) out.push(p);
  }
  return out;
}

/** Nth given weekday in a calendar month (Luxon zone). ordinal: 1 = first, -1 = last. */
function nthWeekdayInMonth(
  year: number,
  month: number,
  rule: MonthlyNthByday,
  zone: string
): DateTime | null {
  const { ordinal, weekday } = rule;
  if (ordinal > 0) {
    let first = DateTime.fromObject({ year, month, day: 1 }, { zone });
    const firstW = first.weekday;
    const daysToFirst = (weekday - firstW + 7) % 7;
    const firstOcc = first.plus({ days: daysToFirst });
    return firstOcc.plus({ weeks: ordinal - 1 });
  }
  if (ordinal === -1) {
    let d = DateTime.fromObject({ year, month, day: 1 }, { zone }).endOf("month").startOf("day");
    for (let i = 0; i < 7; i++) {
      if (d.weekday === weekday) return d;
      d = d.minus({ days: 1 });
    }
    return null;
  }
  return null;
}

function applyWallTime(
  dt: DateTime,
  wall: { hour: number; minute: number; second: number; millisecond: number }
): DateTime {
  return dt.set({
    hour: wall.hour,
    minute: wall.minute,
    second: wall.second,
    millisecond: wall.millisecond,
  });
}

/** BYDAY values like "1TU" / "-1FR" imply MONTHLY; plain "MO" is used for WEEKLY. */
function looksLikeMonthlyNthByday(raw: string): boolean {
  return /^\s*-?\d/.test(raw);
}

function inferRecurrenceFreq(r: RecurrenceRule): string {
  const explicit = (r.freq || "").trim().toUpperCase();
  if (explicit) return explicit;
  if (r.byday?.some((d) => looksLikeMonthlyNthByday(d))) return "MONTHLY";
  return "WEEKLY";
}

export type RecurrenceRule = {
  freq: string;
  interval?: number | null;
  byday?: string[] | null;
  until?: string | null;
  count?: number | null;
};

export type RecurringParentEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  /** IANA zone the series was created in — anchors wall-clock time across DST. */
  start_timezone?: string | null;
  end_timezone?: string | null;
  meeting_link?: string | null;
  /** Google event page — used to recover true series UTC when DB times drift. */
  html_link?: string | null;
  /** From calendar_events when sync writes it; second fallback after html_link parse. */
  original_start_time?: string | null;
  calendar_event_attendees?: Array<{ email: string }>;
  location?: string | null;
  color_id?: string | null;
};

export type RecurringInstanceRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meeting_link: string | null;
  calendar_event_attendees: Array<{ email: string }>;
  location?: string | null;
  color_id?: string | null;
};

/**
 * Expands a recurring parent into future instances. Wall-clock time is taken from
 * `start_timezone` so occurrences stay at the same local time across DST changes.
 */
export function generateRecurringCalendarInstances(
  event: RecurringParentEvent,
  recurrence: RecurrenceRule,
  options: {
    maxInstances?: number;
    horizonDays?: number;
    /** Original series slot times (UTC ms) handled by exception rows (cancelled or modified). */
    suppressedSlotStartMs?: Set<number>;
  } = {}
): RecurringInstanceRow[] {
  const maxInstances = options.maxInstances ?? 3;
  const horizonDays = options.horizonDays ?? 90;
  const suppressedSlotStartMs = options.suppressedSlotStartMs;
  const zone = resolveEventZone(event.start_timezone);
  const freq = inferRecurrenceFreq(recurrence);

  const instances: RecurringInstanceRow[] = [];
  const now = DateTime.now();

  const anchorStartRaw =
    parseGoogleCalendarCanonicalStartUtc(event.html_link) ??
    (event.original_start_time?.trim()
      ? normalizeCalendarTimestamp(event.original_start_time)
      : null) ??
    normalizeCalendarTimestamp(event.start_time);

  const startUtc = parseCalendarToDateTime(anchorStartRaw);
  const endUtcDb = parseCalendarToDateTime(event.end_time);
  const startUtcDb = parseCalendarToDateTime(event.start_time);
  if (!startUtc.isValid || !endUtcDb.isValid || !startUtcDb.isValid) return [];

  const durationMs = endUtcDb.toMillis() - startUtcDb.toMillis();
  let current: DateTime = startUtc.setZone(zone);
  const anchorWall = {
    hour: current.hour,
    minute: current.minute,
    second: current.second,
    millisecond: current.millisecond,
  };

  if (recurrence.until) {
    const untilDt = parseCalendarToDateTime(recurrence.until);
    if (untilDt.isValid && untilDt < now) return [];
  }

  const targetWeekdays =
    recurrence.byday?.length && freq === "WEEKLY"
      ? [
          ...recurrence.byday
            .map((d) => RRULE_DAY_TO_LUXON[d.trim().toUpperCase()])
            .filter((wd): wd is number => wd != null),
        ].sort((a, b) => a - b)
      : [];

  const monthlyNthRules =
    freq === "MONTHLY" ? monthlyNthRulesFromByday(recurrence.byday) : [];

  if (current < now) {
    switch (freq) {
      case "DAILY": {
        const interval = recurrence.interval || 1;
        const daysDiff = Math.ceil(now.diff(current, "days").days);
        const daysToAdd = Math.ceil(daysDiff / interval) * interval;
        current = current.plus({ days: daysToAdd });
        break;
      }
      case "WEEKLY": {
        const weekInterval = recurrence.interval || 1;
        const weeksDiff = Math.ceil(now.diff(current, "weeks").weeks);
        const weeksToAdd = Math.ceil(weeksDiff / weekInterval) * weekInterval;
        current = current.plus({ weeks: weeksToAdd });

        if (targetWeekdays.length > 0) {
          let found = false;
          let attempts = 0;
          while (!found && attempts < 14) {
            const wd = current.weekday;
            if (targetWeekdays.includes(wd)) {
              found = true;
            } else {
              const nextDay =
                targetWeekdays.find((d) => d > wd) ?? targetWeekdays[0];
              const daysUntilNext =
                nextDay > wd ? nextDay - wd : 7 - wd + nextDay;
              current = current.plus({ days: daysUntilNext });
            }
            attempts++;
          }
          current = zonedDateWithWallClock(current, zone, anchorWall);
        } else {
          current = zonedDateWithWallClock(current, zone, anchorWall);
        }
        break;
      }
      case "MONTHLY": {
        const monthInterval = recurrence.interval || 1;
        if (monthlyNthRules.length === 0) {
          const monthsDiff = Math.ceil(now.diff(current, "months").months);
          const monthsToAdd = Math.ceil(monthsDiff / monthInterval) * monthInterval;
          current = current.plus({ months: monthsToAdd });
        } else {
          const rule = monthlyNthRules[0]!;
          let cursor = DateTime.fromObject(
            { year: current.year, month: current.month, day: 1 },
            { zone }
          );
          let day = nthWeekdayInMonth(cursor.year, cursor.month, rule, zone);
          if (!day) {
            current = now;
            break;
          }
          let candidate = applyWallTime(day, anchorWall);
          let safety = 0;
          while (candidate < now && safety < 500) {
            cursor = cursor.plus({ months: monthInterval });
            day = nthWeekdayInMonth(cursor.year, cursor.month, rule, zone);
            if (!day) {
              safety++;
              continue;
            }
            candidate = applyWallTime(day, anchorWall);
            safety++;
          }
          current = candidate;
        }
        break;
      }
    }
  }

  const untilDate = recurrence.until ? parseCalendarToDateTime(recurrence.until) : null;
  const recurrenceCount = recurrence.count;
  let instanceCount = 0;
  const maxDate = now.plus({ days: horizonDays });

  while (instanceCount < maxInstances && current <= maxDate) {
    if (untilDate?.isValid && current > untilDate) break;
    if (recurrenceCount != null && instanceCount >= recurrenceCount) break;

    const instanceEnd = current.plus({ milliseconds: durationMs });
    const slotStartMs = current.toUTC().toMillis();
    const isSuppressed = suppressedSlotStartMs?.has(slotStartMs) ?? false;

    if (!isSuppressed) {
      instances.push({
        id: `${event.id}-${instanceCount}`,
        title: event.title,
        start_time: current.toUTC().toISO()!,
        end_time: instanceEnd.toUTC().toISO()!,
        meeting_link: event.meeting_link ?? null,
        calendar_event_attendees: event.calendar_event_attendees || [],
        location: event.location ?? undefined,
        color_id: event.color_id ?? undefined,
      });

      instanceCount++;
    }

    switch (freq) {
      case "DAILY": {
        const dailyInterval = recurrence.interval || 1;
        current = current.plus({ days: dailyInterval });
        break;
      }
      case "WEEKLY": {
        const weeklyInterval = recurrence.interval || 1;
        if (targetWeekdays.length > 0) {
          const wd = current.weekday;
          const nextDayIndex = targetWeekdays.findIndex((d) => d > wd);
          if (nextDayIndex !== -1) {
            const daysUntilNext = targetWeekdays[nextDayIndex]! - wd;
            current = current.plus({ days: daysUntilNext });
          } else {
            const daysUntilNextWeek =
              7 - wd + targetWeekdays[0]! + (weeklyInterval - 1) * 7;
            current = current.plus({ days: daysUntilNextWeek });
          }
          current = zonedDateWithWallClock(current, zone, anchorWall);
        } else {
          current = zonedDateWithWallClock(
            current.plus({ weeks: weeklyInterval }),
            zone,
            anchorWall
          );
        }
        break;
      }
      case "MONTHLY": {
        const monthlyInterval = recurrence.interval || 1;
        if (monthlyNthRules.length === 0) {
          current = current.plus({ months: monthlyInterval });
        } else {
          const rule = monthlyNthRules[0]!;
          const cursor = DateTime.fromObject(
            { year: current.year, month: current.month, day: 1 },
            { zone }
          ).plus({ months: monthlyInterval });
          const nextDay = nthWeekdayInMonth(cursor.year, cursor.month, rule, zone);
          current = nextDay
            ? applyWallTime(nextDay, anchorWall)
            : current.plus({ months: monthlyInterval });
        }
        break;
      }
      default:
        current = current.plus({ weeks: 1 });
    }
  }

  return instances;
}
