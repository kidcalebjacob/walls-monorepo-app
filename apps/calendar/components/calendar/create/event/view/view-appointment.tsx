"use client";

import { useMemo, useEffect, useState, useRef } from 'react';
import { format } from "date-fns";
import { Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MiniCalendar } from "@/components/ui/mini-calendar";

interface ViewAppointmentProps {
  eventData: {
    startTime: Date;
    endTime: Date;
  };
  isEditing?: boolean;
  onDataChange?: (updatedData: any) => void;
}

export function ViewAppointment({ eventData, isEditing = false, onDataChange }: ViewAppointmentProps) {
  // Local state for editable fields
  const [localEventData, setLocalEventData] = useState({
    startTime: eventData.startTime,
    endTime: eventData.endTime
  });

  // Generate time options in 15-minute intervals
  const timeOptions = useMemo(() => {
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
  }, []);
  
  // Debug output in development
  useEffect(() => {
    console.log('ViewAppointment received data:', {
      startTime: eventData.startTime,
      endTime: eventData.endTime
    });
  }, [eventData]);

  // Add refs to track if this is the initial render and if updates are coming from props
  const isInitialMount = useRef(true);
  const isUpdatingFromProps = useRef(false);

  // Update local state only when props change and not during our own updates
  useEffect(() => {
    // Skip the initial render since state is already initialized in useState
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Set flag to indicate we're updating due to prop changes
    isUpdatingFromProps.current = true;
    
    setLocalEventData({
      startTime: eventData.startTime,
      endTime: eventData.endTime
    });
    
    // Reset the flag after state updates
    setTimeout(() => {
      isUpdatingFromProps.current = false;
    }, 0);
  }, [eventData]);

  // Propagate changes to parent only when local changes happen (not from props)
  useEffect(() => {
    // Only propagate changes if not currently updating from props
    if (!isUpdatingFromProps.current && onDataChange && !isInitialMount.current) {
      onDataChange(localEventData);
    }
  }, [localEventData, onDataChange]);

  // Handle potential invalid dates
  const displayStartTime = useMemo(() => {
    try {
      return localEventData.startTime instanceof Date ? 
        localEventData.startTime : 
        new Date(localEventData.startTime);
    } catch (e) {
      console.error('Invalid start date:', localEventData.startTime);
      return new Date();
    }
  }, [localEventData.startTime]);

  const displayEndTime = useMemo(() => {
    try {
      return localEventData.endTime instanceof Date ? 
        localEventData.endTime : 
        new Date(localEventData.endTime);
    } catch (e) {
      console.error('Invalid end date:', localEventData.endTime);
      return new Date();
    }
  }, [localEventData.endTime]);

  return (
    <div data-event-type="appointmentSchedule" className="appointment-schedule-content">
      <div className="flex gap-4">
        {/* Left column - Icons */}
        <div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mb-6">
            <Clock className="w-4 h-4 text-gray-600" />
          </div>
        </div>
        
        {/* Right column - Display data */}
        <div className="flex-1 grid gap-6">
          {/* Time display */}
          <div className="flex items-center border-0 border-b border-gray-200">
            {isEditing ? (
              <div className="flex gap-1 py-[2px]">
                {/* Date Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      className="text-sm text-gray-600 hover:underline focus:outline-none"
                    >
                      {format(displayStartTime, "EEEE, MMMM d")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <MiniCalendar
                      selected={displayStartTime}
                      onSelect={(date) => {
                        if (!date) return;
                        
                        // Preserve the time when changing the date
                        const newStartDate = new Date(date);
                        newStartDate.setHours(
                          displayStartTime.getHours(),
                          displayStartTime.getMinutes(),
                          0, 0
                        );
                        
                        const newEndDate = new Date(date);
                        newEndDate.setHours(
                          displayEndTime.getHours(),
                          displayEndTime.getMinutes(),
                          0, 0
                        );
                        
                        setLocalEventData({
                          ...localEventData,
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
                      {format(displayStartTime, "h:mm a")}
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
                            const newStartTime = new Date(displayStartTime);
                            newStartTime.setHours(
                              option.value.getHours(),
                              option.value.getMinutes(),
                              0, 0
                            );
                            
                            // If new start time is after end time, adjust end time
                            let newEndTime = displayEndTime;
                            if (newStartTime >= displayEndTime) {
                              newEndTime = new Date(newStartTime);
                              newEndTime.setHours(
                                newStartTime.getHours() + 1,
                                newStartTime.getMinutes(),
                                0, 0
                              );
                            }
                            
                            setLocalEventData({
                              ...localEventData,
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
                      {format(displayEndTime, "h:mm a")}
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
                            const newEndTime = new Date(displayEndTime);
                            newEndTime.setHours(
                              option.value.getHours(),
                              option.value.getMinutes(),
                              0, 0
                            );
                            
                            // If new end time is before start time, don't allow it
                            if (newEndTime <= displayStartTime) {
                              return;
                            }
                            
                            setLocalEventData({
                              ...localEventData,
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
            ) : (
              <div className="flex gap-1 py-[2px]">
                <span className="text-sm text-gray-600">
                  {format(displayStartTime, "EEEE, MMMM d")}
                </span>
                
                <span className="text-sm text-gray-600 ml-1">
                  {format(displayStartTime, "h:mm a")}
                </span>
                
                <span className="text-sm text-gray-600 mx-1">-</span>
                
                <span className="text-sm text-gray-600">
                  {format(displayEndTime, "h:mm a")}
                </span>
              </div>
            )}
          </div>
          
          {/* Note about appointment scheduling */}
          <div className="py-1 border-0 border-b border-gray-200">
            <p className="text-sm text-gray-500">
              This appointment schedule is available for booking during this time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 