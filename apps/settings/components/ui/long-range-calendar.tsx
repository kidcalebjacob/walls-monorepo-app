"use client";

interface LongRangeCalendarProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disableFuture?: boolean;
  toYear?: number;
  defaultMonth?: Date;
  initialFocus?: boolean;
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function LongRangeCalendar({
  selected,
  onSelect,
  disableFuture,
}: LongRangeCalendarProps) {
  const value = selected ? toDateInputValue(selected) : "";
  const max = disableFuture ? toDateInputValue(new Date()) : undefined;

  return (
    <input
      type="date"
      value={value}
      max={max}
      autoFocus
      className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-light"
      onChange={(event) => {
        const nextValue = event.target.value;
        if (!nextValue) {
          onSelect?.(undefined);
          return;
        }

        const [year, month, day] = nextValue.split("-").map(Number);
        onSelect?.(new Date(year, month - 1, day));
      }}
    />
  );
}
