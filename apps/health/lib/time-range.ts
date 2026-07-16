export const TIME_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export type TimeRangeValue = (typeof TIME_RANGE_OPTIONS)[number]["value"];

export const RANGE_DAYS: Record<TimeRangeValue, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
};

export const DEFAULT_HEALTH_TIMEZONE = "America/New_York";

export function parseTimeRangeParam(value: string | null): TimeRangeValue {
  if (value && value in RANGE_DAYS) {
    return value as TimeRangeValue;
  }
  return "7d";
}

export function timeRangeToDays(value: TimeRangeValue): number {
  return RANGE_DAYS[value];
}

export function timeRangeLabel(value: TimeRangeValue): string {
  return (
    TIME_RANGE_OPTIONS.find((option) => option.value === value)?.label ??
    "Last 7 days"
  );
}

/** Calendar date `YYYY-MM-DD` in an IANA timezone (never UTC-by-accident). */
export function formatDateKey(
  date: Date,
  timeZone: string = DEFAULT_HEALTH_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayDateKey(
  timeZone: string = DEFAULT_HEALTH_TIMEZONE,
  now: Date = new Date(),
): string {
  return formatDateKey(now, timeZone);
}

/** Add calendar days to a `YYYY-MM-DD` key (timezone-agnostic date math). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

export function labelForDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return utc.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * UTC instant for local midnight (`dateKey` 00:00:00) in `timeZone`.
 * Used when querying timestamptz ranges for a calendar day in the user's zone.
 */
export function zonedStartOfDayUtc(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const partsOf = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? "0");
    return {
      year: get("year"),
      month: get("month"),
      day: get("day"),
      hour: get("hour"),
      minute: get("minute"),
      second: get("second"),
    };
  };

  let guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const local = partsOf(new Date(guess));
    const asUtcFromLocal = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const offset = asUtcFromLocal - guess;
    guess = Date.UTC(year, month - 1, day, 0, 0, 0) - offset;
  }

  return new Date(guess);
}

/** @deprecated Prefer date-key helpers; local server midnight is not user-local. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** @deprecated Prefer zonedStartOfDayUtc / todayDateKey. */
export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
