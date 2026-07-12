"use client";

import { useState, useEffect, useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { Clock } from "lucide-react";

interface AppointmentScheduleProps {
  onDataChange?: (data: AppointmentScheduleData) => void;
}

export interface AppointmentScheduleData {
  startTime: Date;
  endTime: Date;
}

// Generate time options in 15-minute intervals
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = new Date();
      time.setHours(hour, minute, 0, 0);
      options.push({
        label: format(time, 'h:mm a'),
        value: time
      });
    }
  }
  return options;
};

export function AppointmentSchedule({ onDataChange }: AppointmentScheduleProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<AppointmentScheduleData>({
    startTime: new Date(),
    endTime: new Date(new Date().setHours(new Date().getHours() + 1)),
  });

  // Time options for dropdowns
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  // Update parent component when data changes
  useEffect(() => {
    onDataChange?.(scheduleData);
  }, [scheduleData, onDataChange]);

  return (
    <div data-event-type="appointmentSchedule" className="appointment-schedule-content">
      <div className="flex gap-4">
        {/* Left column - Icons */}
        <div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mt-1">
            <Clock className="w-4 h-4 text-gray-600" />
          </div>
        </div>
        
        {/* Right column - Form inputs */}
        <div className="flex-1 grid gap-6">
          <div className="flex items-center border-0 border-b border-gray-200">
            <div className="flex gap-1 py-[2px]">
              {/* Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button 
                    className="text-sm text-gray-600 hover:underline focus:outline-none"
                  >
                    {format(scheduleData.startTime, "EEEE, MMMM d")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <MiniCalendar
                    selected={scheduleData.startTime}
                    onSelect={(date) => {
                      if (!date) return;
                      
                      // Preserve the time when changing the date
                      const newStartDate = new Date(date);
                      newStartDate.setHours(
                        scheduleData.startTime.getHours(),
                        scheduleData.startTime.getMinutes(),
                        0, 0
                      );
                      
                      const newEndDate = new Date(date);
                      newEndDate.setHours(
                        scheduleData.endTime.getHours(),
                        scheduleData.endTime.getMinutes(),
                        0, 0
                      );
                      
                      setScheduleData({
                        ...scheduleData,
                        startTime: newStartDate,
                        endTime: newEndDate
                      });
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              {/* Start Time Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button 
                    className="text-sm text-gray-600 hover:underline focus:outline-none ml-1"
                  >
                    {format(scheduleData.startTime, "h:mm a")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 max-h-60 overflow-y-auto py-2" align="start">
                  <div className="flex flex-col">
                    {timeOptions.map((option, index) => (
                      <button
                        key={index}
                        className="text-sm text-left px-2 py-1 hover:bg-gray-100 text-gray-700"
                        onClick={() => {
                          // Set new start time while preserving the date
                          const newStartTime = new Date(scheduleData.startTime);
                          newStartTime.setHours(
                            option.value.getHours(),
                            option.value.getMinutes(),
                            0, 0
                          );
                          
                          // If new start time is after end time, adjust end time
                          let newEndTime = scheduleData.endTime;
                          if (newStartTime >= scheduleData.endTime) {
                            newEndTime = new Date(newStartTime);
                            newEndTime.setHours(
                              newStartTime.getHours() + 1,
                              newStartTime.getMinutes(),
                              0, 0
                            );
                          }
                          
                          setScheduleData({
                            ...scheduleData,
                            startTime: newStartTime,
                            endTime: newEndTime
                          });
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              <span className="text-sm text-gray-600 mx-1">-</span>
              
              {/* End Time Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button 
                    className="text-sm text-gray-600 hover:underline focus:outline-none"
                  >
                    {format(scheduleData.endTime, "h:mm a")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 max-h-60 overflow-y-auto py-2" align="start">
                  <div className="flex flex-col">
                    {timeOptions.map((option, index) => (
                      <button
                        key={index}
                        className="text-sm text-left px-2 py-1 hover:bg-gray-100 text-gray-700"
                        onClick={() => {
                          // Set new end time while preserving the date
                          const newEndTime = new Date(scheduleData.endTime);
                          newEndTime.setHours(
                            option.value.getHours(),
                            option.value.getMinutes(),
                            0, 0
                          );
                          
                          // If new end time is before start time, don't allow it
                          if (newEndTime <= scheduleData.startTime) {
                            return;
                          }
                          
                          setScheduleData({
                            ...scheduleData,
                            endTime: newEndTime
                          });
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 