"use client";

import { MiniDatePicker } from "@/components/ui/mini-date-picker";

interface DatePickerProps {
  date: Date;
  setDate: (date: Date) => void;
  className?: string;
  label?: string;
  format?: string;
}

/** @deprecated Prefer `MiniDatePicker` for nullable dates + clear support. */
export function DatePicker({
  date,
  setDate,
  className,
  label = "Start date:",
  format: dateFormat = "PPP",
}: DatePickerProps) {
  return (
    <MiniDatePicker
      value={date}
      onChange={(next) => {
        if (next) setDate(next);
      }}
      label={label}
      displayFormat={dateFormat}
      className={className}
      labelClassName="text-gray-500"
    />
  );
}
