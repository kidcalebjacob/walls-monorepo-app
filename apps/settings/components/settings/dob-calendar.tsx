"use client";

import { CalendarIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LongRangeCalendar } from "@/components/ui/long-range-calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const FormSchema = z.object({
  date: z
    .date({
      required_error: "A date of birth is required.",
    })
    .nullable(),
});

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Format YYYY-MM-DD as "June 5, 2024" - no Date object, no timezone */
function formatDateOnly(dateString: string): string {
  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${MONTHS[m - 1]} ${d}, ${year}`;
}

/** Date → YYYY-MM-DD using local date parts only (no timezone conversion) */
function toDateOnlyString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD to Date for calendar picker only - uses local midnight, no UTC */
function parseDateOnly(dateString: string | Date): Date | null {
  if (!dateString) return null;
  if (dateString instanceof Date) return isNaN(dateString.getTime()) ? null : dateString;
  const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
}

export function CalendarForm({
  dob,
  setDob,
  existingDob,
}: {
  dob: any;
  setDob: any;
  existingDob: any;
}) {
  const [open, setOpen] = useState(false);

  // Convert existingDob string to Date if it exists (parse as local to avoid UTC shift)
  const selectedDate = useMemo((): Date | undefined => {
    if (dob === null) return undefined;
    if (dob) {
      const d = dob instanceof Date ? dob : parseDateOnly(String(dob));
      return d ?? undefined;
    }
    if (existingDob) {
      return parseDateOnly(existingDob) ?? undefined;
    }
    return undefined;
  }, [dob, existingDob]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      date: selectedDate ?? null,
    },
  });

  // Update form when existingDob or dob changes
  useEffect(() => {
    const currentValue = form.getValues("date");
    const currentTime = currentValue?.getTime();
    const newTime = selectedDate?.getTime();
    
    // Only update if the date actually changed
    if (currentTime !== newTime) {
      form.setValue("date", selectedDate ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  return (
    <Form {...form}>
      <form className="space-y-8">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      className={cn(
                        "w-full justify-start text-left font-light bg-transparent hover:bg-transparent border-0 border-b border-neutral-200 rounded-none px-0 py-2 h-auto focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-b-[var(--kenoo-sky)] shadow-none",
                        !dob && !existingDob && "text-neutral-300",
                        (dob || existingDob) && "text-neutral-900",
                      )}
                      variant="ghost"
                    >
                      {dob === null ? (
                        <span className="text-neutral-300">No date</span>
                      ) : dob ? (
                        formatDateOnly(dob instanceof Date ? toDateOnlyString(dob) : String(dob))
                      ) : (
                        <span className={existingDob ? "text-neutral-900" : "text-neutral-300"}>
                          {existingDob ? formatDateOnly(existingDob) : "Pick a date"}
                        </span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                >
                  <LongRangeCalendar
                    initialFocus
                    selected={field.value ?? selectedDate ?? undefined}
                    disableFuture
                    toYear={new Date().getFullYear()}
                    defaultMonth={
                      new Date(new Date().getFullYear() - 25, 0, 1)
                    }
                    onSelect={(date) => {
                      if (!date) {
                        field.onChange(null);
                        setDob(null);
                        setOpen(false);
                        return;
                      }
                      field.onChange(date);
                      setDob(toDateOnlyString(date));
                      setOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
