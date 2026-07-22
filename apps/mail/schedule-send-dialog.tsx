"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, parse, isValid, addMonths, subMonths } from "date-fns";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface ScheduleSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (date: Date, time: string) => Promise<void>;
  sending: boolean;
}

export function ScheduleSendDialog({
  open,
  onOpenChange,
  onSchedule,
  sending
}: ScheduleSendDialogProps) {
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [timeInput, setTimeInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [isTimeValid, setIsTimeValid] = useState(true);
  const [isDateValid, setIsDateValid] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Update date input when calendar selection changes
  useEffect(() => {
    if (scheduledDate) {
      setDateInput(format(scheduledDate, "MMM d, yyyy"));
    }
  }, [scheduledDate]);

  const validateAndParseTime = (input: string): Date | null => {
    try {
      const formats = [
        "h:mm a",
        "h:mma",
        "h:mm A",
        "h:mmA",
        "hh:mm a",
        "hh:mma",
        "hh:mm A",
        "hh:mmA",
        "h a",
        "ha",
        "h A",
        "hA",
      ];

      for (const formatStr of formats) {
        const parsed = parse(input, formatStr, new Date());
        if (isValid(parsed)) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleTimeInput = (value: string) => {
    setTimeInput(value);
    const parsedTime = validateAndParseTime(value);
    setIsTimeValid(!!parsedTime);
  };

  const handleDateInput = (value: string) => {
    setDateInput(value);
    try {
      const parsed = parse(value, "MMM d, yyyy", new Date());
      if (isValid(parsed)) {
        setScheduledDate(parsed);
        setIsDateValid(true);
      } else {
        setIsDateValid(false);
      }
    } catch {
      setIsDateValid(false);
    }
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleSchedule = async () => {
    if (!scheduledDate || !timeInput) return;

    const parsedTime = validateAndParseTime(timeInput);
    if (!parsedTime) return;

    const scheduledDateTime = new Date(scheduledDate);
    scheduledDateTime.setHours(parsedTime.getHours());
    scheduledDateTime.setMinutes(parsedTime.getMinutes());

    if (scheduledDateTime <= new Date()) {
      setIsTimeValid(false);
      return;
    }

    await onSchedule(scheduledDateTime, format(parsedTime, "HH:mm"));
    setScheduledDate(undefined);
    setTimeInput("");
    setDateInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Pick date & time</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePreviousMonth}
                    disabled={currentMonth <= new Date()}
                    className="hover:bg-transparent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium">
                    {format(currentMonth, "MMMM yyyy")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    className="hover:bg-transparent"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  disabled={(date) => date < new Date()}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="border-none"
                  showOutsideDays
                  fixedWeeks
                />
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <Input
                value={dateInput}
                onChange={(e) => handleDateInput(e.target.value)}
                placeholder="Dec 30, 2024"
                className={`h-14 text-lg px-4 border-black ${
                  !isDateValid ? "border-red-500" : ""
                }`}
              />
              <Input
                value={timeInput}
                onChange={(e) => handleTimeInput(e.target.value)}
                placeholder="8:00 PM"
                className={`h-14 text-lg px-4 border-black ${
                  !isTimeValid ? "border-red-500" : ""
                }`}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!scheduledDate || !timeInput || !isTimeValid || !isDateValid || sending}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              'Schedule send'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 