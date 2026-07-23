"use client";

import { useMemo } from "react";

import { FloatingLabelDatePicker } from "@/components/ui/floating-label-date-picker";

/** Date → YYYY-MM-DD using local date parts only (no timezone conversion) */
function toDateOnlyString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse YYYY-MM-DD to Date for calendar picker only - uses local midnight, no UTC */
function parseDateOnly(dateString: string | Date | null | undefined): Date | null {
  if (!dateString) return null;
  if (dateString instanceof Date) {
    return Number.isNaN(dateString.getTime()) ? null : dateString;
  }
  const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function CalendarForm({
  dob,
  setDob,
  existingDob,
}: {
  dob: string | Date | null;
  setDob: (value: string | null) => void;
  existingDob: string | null;
}) {
  const selectedDate = useMemo((): Date | null => {
    if (dob === null) return null;
    if (dob) {
      return dob instanceof Date ? dob : parseDateOnly(String(dob));
    }
    if (existingDob) return parseDateOnly(existingDob);
    return null;
  }, [dob, existingDob]);

  return (
    <FloatingLabelDatePicker
      label="Date of birth"
      value={selectedDate}
      displayFormat="MMMM d, yyyy"
      showClearButton
      clearLabel="Clear date"
      disabledDays={{ after: new Date() }}
      defaultMonth={
        selectedDate ?? new Date(new Date().getFullYear() - 25, 0, 1)
      }
      onChange={(date) => {
        setDob(date ? toDateOnlyString(date) : null);
      }}
    />
  );
}
