"use client";

import { useMemo, useEffect, useState, useRef } from 'react';
import { format, addMinutes } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Clock, MapPin, Users, VideoIcon, AlignLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { GuestTag } from '../guest-tag';
import { validateEmail } from "@/lib/utils";

interface ViewEventProps {
  eventData: {
    description: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees?: { email: string; displayName?: string; responseStatus?: string }[];
    guests?: string;
    googleEventId?: string;
    useGoogleMeet?: boolean;
  };
  isEditing?: boolean;
  onDataChange?: (updatedData: any) => void;
}

export function ViewEvent({ eventData, isEditing = true, onDataChange }: ViewEventProps) {
  // State for editable fields
  const [localEventData, setLocalEventData] = useState({
    description: eventData.description || '',
    startTime: eventData.startTime,
    endTime: eventData.endTime,
    location: eventData.location || '',
    useGoogleMeet: eventData.useGoogleMeet || false,
    guests: eventData.guests || '',
    attendees: eventData.attendees || []
  });
  
  // Current guest for input
  const [currentGuest, setCurrentGuest] = useState('');
  
  // Guest tags derived from attendees
  const [guestTags, setGuestTags] = useState<{email: string; id: string}[]>([]);
  
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
    console.log('ViewEvent received data:', {
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      description: eventData.description,
      location: eventData.location,
      attendees: eventData.attendees,
      guests: eventData.guests,
      hasValidStartTime: eventData.startTime instanceof Date,
      hasValidEndTime: eventData.endTime instanceof Date
    });
  }, [eventData]);
  
  // Add a ref to track if this is the initial render
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
      description: eventData.description || '',
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      location: eventData.location || '',
      useGoogleMeet: eventData.useGoogleMeet || false,
      guests: eventData.guests || '',
      attendees: eventData.attendees || []
    });
    
    // Initialize guest tags from attendees only when props change
    if (eventData.attendees && eventData.attendees.length > 0) {
      const tags = eventData.attendees.map(attendee => ({
        email: attendee.email,
        id: Math.random().toString(36).substr(2, 9)
      }));
      setGuestTags(tags);
    } else if (eventData.guests) {
      const tags = eventData.guests.split(',').map(email => ({
        email: email.trim(),
        id: Math.random().toString(36).substr(2, 9)
      }));
      setGuestTags(tags);
    }

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

  // Clean description (remove HTML tags if any)
  const cleanDescription = useMemo(() => {
    return localEventData.description ? localEventData.description.replace(/<[^>]*>?/gm, '') : '';
  }, [localEventData.description]);

  // Make sure we render something for description even if empty
  const displayDescription = cleanDescription || "No description provided";

  // Format location for display
  const formattedLocation = useMemo(() => {
    if (!localEventData.location) return 'No location provided';
    
    // Check if it's a Google Meet link
    if (localEventData.location.includes('meet.google.com')) {
      return 'Google Meet';
    }
    
    return localEventData.location;
  }, [localEventData.location]);

  // Process attendees from either attendees array or guests string
  const processedAttendees = useMemo(() => {
    if (localEventData.attendees && localEventData.attendees.length > 0) {
      return localEventData.attendees;
    }
    
    if (localEventData.guests) {
      return localEventData.guests.split(',').map(email => ({
        email: email.trim(),
        displayName: email.trim() // Use email as display name if no display name is provided
      }));
    }
    
    return [];
  }, [localEventData.attendees, localEventData.guests]);

  // Make sure we always render something for attendees
  const displayAttendees = useMemo(() => {
    if (processedAttendees.length > 0) {
      return processedAttendees;
    }
    
    // As a fallback for debugging
    console.log('No attendees found, creating a fallback attendee');
    return [{ 
      email: "guest@example.com", 
      displayName: "Guest (No email found in event)" 
    }];
  }, [processedAttendees]);

  // Check if using Google Meet
  const isGoogleMeet = localEventData.useGoogleMeet || 
    (localEventData.location && localEventData.location.includes('meet.google.com'));

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

  // Handle adding a guest from input
  const handleGuestAdd = (email: string) => {
    const trimmedEmail = email.trim().replace(',', '');
    
    if (trimmedEmail && validateEmail(trimmedEmail) && !guestTags.some(tag => tag.email === trimmedEmail)) {
      const newTags = [...guestTags, { 
        email: trimmedEmail, 
        id: Math.random().toString(36).substr(2, 9) 
      }];
      setGuestTags(newTags);
      setCurrentGuest('');
      
      // Update the guests string in eventData
      const guestsString = newTags.map(tag => tag.email).join(', ');
      setLocalEventData(prev => ({
        ...prev,
        guests: guestsString
      }));
    }
  };

  // Handle key press events for guest input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleGuestAdd(currentGuest);
    } else if (e.key === 'Backspace' && !currentGuest && guestTags.length > 0) {
      const newTags = guestTags.slice(0, -1);
      setGuestTags(newTags);
      
      // Update the guests string in eventData
      const guestsString = newTags.map(tag => tag.email).join(', ');
      setLocalEventData(prev => ({
        ...prev,
        guests: guestsString
      }));
    }
  };

  // Remove a guest tag
  const removeGuestTag = (id: string) => {
    const newTags = guestTags.filter(tag => tag.id !== id);
    setGuestTags(newTags);
    
    // Update the guests string in eventData
    const guestsString = newTags.map(tag => tag.email).join(', ');
    setLocalEventData(prev => ({
      ...prev,
      guests: guestsString
    }));
  };

  // Make the attendees section more prominent for debugging
  const attendeesSection = (
    <div className="py-1 border-0 border-b border-gray-200 bg-blue-50">
      <h3 className="text-sm font-medium mb-1">Attendees:</h3>
      <div className="flex flex-wrap gap-1 mb-2">
        {guestTags.map((tag) => (
          <GuestTag 
            key={tag.id} 
            tag={tag}
            onRemove={() => removeGuestTag(tag.id)} 
          />
        ))}
        <Input
          type="text"
          placeholder="Add guests"
          value={currentGuest}
          onChange={(e) => setCurrentGuest(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => currentGuest && handleGuestAdd(currentGuest)}
          className="flex-1 min-w-[150px] border-0 focus:ring-0 p-1 text-sm"
        />
      </div>
    </div>
  );

  return (
    <div data-event-type="event" className="event-content">
      <div className="flex gap-4">
        {/* Left column - Icons */}
        <div>
          {/* Time icon */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mb-6">
            <Clock className="w-4 h-4 text-gray-600" />
          </div>
          
          {/* Guests/Attendees icon - always show */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mb-6">
            <Users className="w-4 h-4 text-gray-600" />
          </div>
          
          {/* Google Meet icon */}
          {isGoogleMeet && (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mb-6">
              <VideoIcon className="w-4 h-4 text-gray-600" />
            </div>
          )}
          
          {/* Location icon - always show */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mb-6">
            <MapPin className="w-4 h-4 text-gray-600" />
          </div>
          
          {/* Description icon - always show */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mb-6">
            <AlignLeft className="w-4 h-4 text-gray-600" />
          </div>
        </div>
        
        {/* Right column - Display data */}
        <div className="flex-1 grid gap-6">
          {/* Time display */}
          <div className="flex border-0 border-b border-gray-200 py-1">
            <div className="flex gap-1 py-[2px]">
              {/* Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button 
                    className="text-sm text-gray-600 hover:underline focus:outline-none"
                  >
                    {format(displayStartTime, "EEEE, MMMM d, yyyy")}
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
              
              <span className="text-sm text-gray-600 mx-1">•</span>
              
              {/* Start Time Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button 
                    className="text-sm text-gray-600 hover:underline focus:outline-none"
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
          </div>
          
          {/* Attendees display - always show */}
          {attendeesSection}
          
          {/* Location display - with edit capability */}
          <div className="py-1 border-0 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Add location"
                value={localEventData.location}
                onChange={(e) => setLocalEventData({
                  ...localEventData,
                  location: e.target.value
                })}
                className="border-0 focus:ring-0 p-0 text-sm text-gray-600"
              />
              <div className="flex items-center">
                <Switch
                  id="google-meet"
                  checked={localEventData.useGoogleMeet}
                  onCheckedChange={(checked) => {
                    setLocalEventData({
                      ...localEventData,
                      useGoogleMeet: checked
                    });
                  }}
                  className="mr-2"
                />
                <label htmlFor="google-meet" className="text-sm text-gray-600">
                  Add Google Meet
                </label>
              </div>
            </div>
          </div>
          
          {/* Description display - with edit capability */}
          <div className="py-1 border-0 border-b border-gray-200">
            <Textarea
              placeholder="Add description"
              value={localEventData.description}
              onChange={(e) => setLocalEventData({
                ...localEventData,
                description: e.target.value
              })}
              className="min-h-[100px] border-0 focus:ring-0 p-0 text-sm text-gray-600 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 