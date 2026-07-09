export const TIME_RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export type TimeRangeValue = (typeof TIME_RANGE_OPTIONS)[number]["value"];

export const RANGE_DAYS: Record<TimeRangeValue, number> = {
  "24h": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
};

export function parseTimeRangeParam(value: string | null): TimeRangeValue {
  if (value && value in RANGE_DAYS) {
    return value as TimeRangeValue;
  }
  return "30d";
}

export function timeRangeToDays(value: TimeRangeValue): number {
  return RANGE_DAYS[value];
}

export function timeRangeLabel(value: TimeRangeValue): string {
  return (
    TIME_RANGE_OPTIONS.find((option) => option.value === value)?.label ??
    "Last 30 days"
  );
}
