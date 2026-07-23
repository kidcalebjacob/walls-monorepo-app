"use client";

import { FloatingLabelInput } from "@/components/ui/floating-label-input";

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
    <FloatingLabelInput
      type="date"
      label="Date of birth"
      value={value}
      max={max}
      autoFocus
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
