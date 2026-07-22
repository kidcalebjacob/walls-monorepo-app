// app/components/agent-mail/email-composer/components/footer/schedule-dialog.tsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { MiniCalendar } from "@/components/agentMail/email-composer/components/footer/schedule-popup/mini-calendar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/agentMail/email-composer/components/footer/schedule-popup/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/agentMail/email-composer/components/footer/schedule-popup/select";
import { Input } from "@/components/ui/input";
import { Loader2, X, CalendarClock } from "lucide-react";
import { useAuth } from "@/app/auth/AuthContext";
import { getFirestore, doc, getDoc, Timestamp } from 'firebase/firestore';
import { format, addDays, nextMonday, setHours, setMinutes, parse } from 'date-fns';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (timestamp: Timestamp, timezone: string) => Promise<void>;
  sending: boolean;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  onSchedule,
  sending
}: ScheduleDialogProps) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1);
    // Round to nearest 5 minutes
    const minutes = Math.ceil(nextHour.getMinutes() / 5) * 5;
    nextHour.setMinutes(minutes);
    return format(nextHour, 'h:mm a');
  });

  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    const fetchUserTimezone = async () => {
      if (user?.id) {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserTimezone(userData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
      }
    };
    fetchUserTimezone();
  }, [user]);

  // Generate time slots every 5 minutes
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const now = new Date();
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const formattedHour = hour % 12 || 12;
        const period = hour < 12 ? 'AM' : 'PM';
        const formattedMinute = minute.toString().padStart(2, '0');
        slots.push(`${formattedHour}:${formattedMinute} ${period}`);
      }
    }
    return slots;
  };

  const formatSelectedDate = (date: Date | undefined) => {
    if (!date) return 'Select date';
    return format(date, 'EEE, MMM d');
  };

  const formatSelectedTime = (time: string | undefined) => {
    if (!time) return 'Select time';
    return time;
  };

  const formatDateAndTime = (date: Date, time: string) => {
    return format(date, "MMM d, ") + time;
  };

  const handleQuickOption = async (option: string) => {
    let scheduleDate: Date;
    let scheduleTime: string;
    const tomorrow = addDays(new Date(), 1);
    const monday = nextMonday(new Date());

    switch (option) {
      case 'tomorrow-morning':
        scheduleDate = tomorrow;
        scheduleTime = '9:00 AM';
        break;
      case 'tomorrow-afternoon':
        scheduleDate = tomorrow;
        scheduleTime = '1:00 PM';
        break;
      case 'monday-morning':
        scheduleDate = monday;
        scheduleTime = '9:00 AM';
        break;
      default:
        return;
    }

    try {
      const timestamp = createFirestoreTimestamp(scheduleDate, scheduleTime);
      await onSchedule(timestamp, userTimezone);
      onOpenChange(false);
    } catch (error) {
      console.error('Error in quick option scheduling:', error);
    }
  };

  const createFirestoreTimestamp = (date: Date, time: string): Timestamp => {
    // Parse the time string (assuming format like "9:00 AM")
    const [timeStr, period] = time.split(' ');
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Create a new date object with the selected date
    const scheduledDateTime = new Date(date);
    
    // Convert 12-hour format to 24-hour
    let hour24 = hours;
    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hour24 += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hour24 = 0;
    }
    
    // Set the time components
    scheduledDateTime.setHours(hour24, minutes, 0, 0);
    
    // Create Firestore timestamp
    return Timestamp.fromDate(scheduledDateTime);
  };

  const handleCustomSchedule = async () => {
    if (!selectedDate || !selectedTime) return;
    
    try {
      const timestamp = createFirestoreTimestamp(selectedDate, selectedTime);
      await onSchedule(timestamp, userTimezone);
      
      // Reset the form and close the dialog
      setSelectedTime(() => {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1);
        const minutes = Math.ceil(nextHour.getMinutes() / 5) * 5;
        nextHour.setMinutes(minutes);
        return format(nextHour, 'h:mm a');
      });
      
      setSelectedDate(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error in custom scheduling:', error);
      // Keep the dialog open on error
    }
  };

  const formatTimeInput = (input: string, shouldRound: boolean = false): string | null => {
    // Remove any non-alphanumeric characters except colon
    let cleaned = input.replace(/[^0-9:APMapm\s]/g, '').trim().toUpperCase();
    
    try {
      // Try to parse the time
      const parsedTime = parse(cleaned, 'h:mm a', new Date());
      if (isNaN(parsedTime.getTime())) return null;
      
      if (shouldRound) {
        // Round to nearest 5 minutes
        const minutes = parsedTime.getMinutes();
        const roundedMinutes = Math.round(minutes / 5) * 5;
        parsedTime.setMinutes(roundedMinutes);
      }
      
      // Format the time
      return format(parsedTime, 'h:mm a');
    } catch {
      return null;
    }
  };

  const handleTimeChange = (value: string) => {
    const formattedTime = formatTimeInput(value, false);
    if (formattedTime) {
      setSelectedTime(formattedTime);
    }
  };

  const handleTimeBlur = (value: string) => {
    const formattedTime = formatTimeInput(value, true);
    if (formattedTime) {
      setSelectedTime(formattedTime);
    }
  };

  const tomorrow = addDays(new Date(), 1);
  const monday = nextMonday(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95 data-[state=open]:bg-background/95 before:bg-background/5 !rounded-[50px] overflow-hidden px-8 py-2"
        aria-describedby="schedule-dialog-description"
      >
        <DialogHeader className="relative">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-48">
                <DialogTitle>Schedule Send</DialogTitle>
                <button
                  onClick={() => onOpenChange(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <DialogDescription id="schedule-dialog-description" className="text-sm text-muted-foreground mt-1">
                {userTimezone}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        {!showCustomPicker ? (
          <div className="flex flex-col gap-1 py-4 -mx-8">
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-200/80 dark:hover:bg-gray-800/50 px-8 rounded-none"
              onClick={() => handleQuickOption('tomorrow-morning')}
            >
              <div className="flex w-full justify-between">
                <span>Tomorrow Morning</span>
                <span>{formatDateAndTime(tomorrow, '9:00 AM')}</span>
              </div>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-200/80 dark:hover:bg-gray-800/50 px-8 rounded-none"
              onClick={() => handleQuickOption('tomorrow-afternoon')}
            >
              <div className="flex w-full justify-between">
                <span>Tomorrow Afternoon</span>
                <span>{formatDateAndTime(tomorrow, '1:00 PM')}</span>
              </div>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-200/80 dark:hover:bg-gray-800/50 px-8 rounded-none"
              onClick={() => handleQuickOption('monday-morning')}
            >
              <div className="flex w-full justify-between">
                <span>Monday Morning</span>
                <span>{formatDateAndTime(monday, '9:00 AM')}</span>
              </div>
            </Button>
            <div className="px-8">
              <Separator className="my-2" />
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-200/80 dark:hover:bg-gray-800/50 px-8 rounded-none"
              onClick={() => setShowCustomPicker(true)}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Pick a date & time
            </Button>
          </div>
        ) : (
          <>
            <div className="py-2">
              <div className="flex items-start justify-between">
                <MiniCalendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(day) => { if (day) setSelectedDate(day); }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const compareDate = new Date(date);
                    compareDate.setHours(0, 0, 0, 0);
                    return compareDate < today;
                  }}
                  className="w-auto scale-90 origin-top-left"
                />
                <div className="flex flex-col gap-3 min-w-[130px]">
                  <Select 
                    value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined}
                    onValueChange={(value) => {
                      // This is a placeholder as the date will be handled by the calendar
                    }}
                  >
                    <SelectTrigger className="w-full bg-background/95 border-black text-foreground [&>svg]:hidden">
                      <SelectValue placeholder="Select date">
                        {selectedDate ? format(selectedDate, 'EEE, MMM d') : 'Select date'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {selectedDate && (
                        <SelectItem value={format(selectedDate, 'yyyy-MM-dd')}>
                          {format(selectedDate, 'EEE, MMM d')}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  <Input
                    type="text"
                    value={selectedTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    onBlur={(e) => handleTimeBlur(e.target.value)}
                    placeholder="9:00 AM"
                    className="w-full bg-background/95 border-black text-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pb-3">
              <Button
                variant="ghost"
                onClick={() => setShowCustomPicker(false)}
                className="text-blue-500 hover:text-blue-500/80 hover:bg-transparent"
              >
                Back
              </Button>
              <Button
                onClick={handleCustomSchedule}
                disabled={!selectedDate || !selectedTime || sending}
                className="rounded-[50px] min-w-[120px] h-11 bg-blue-500 hover:bg-blue-600"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule Send'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}