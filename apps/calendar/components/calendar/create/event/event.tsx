"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect, useMemo, useRef } from 'react';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format, addMinutes, parse } from "date-fns";
import { EventType } from './create-popup';
import { Switch } from "@/components/ui/switch";
import { VideoIcon, Users, MapPin, AlignLeft, Clock } from "lucide-react";
import { GuestTag } from './guest-tag';
import { GuestSearch } from './guest-search';
import { validateEmail } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { Toaster } from "@/components/ui/toaster";
import { GoogleCalendarEvent } from '@/lib/services/googleCalendar';

interface GuestTag {
  email: string;
  id: string;
}

interface EventProps {
  onDataChange?: (data: EventData) => void;
}

export interface EventData {
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  guests?: string;
  useGoogleMeet: boolean;
  googleEventId?: string;
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

export function Event({ onDataChange }: EventProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);

  // Function to get the next 30-minute mark
  const getNextThirtyMinuteMark = (date: Date) => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 30) * 30;
    const newDate = new Date(date);
    newDate.setMinutes(roundedMinutes);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    return newDate;
  };

  // Calculate suggested time range
  const suggestedTimeRange = useMemo(() => {
    const startTime = getNextThirtyMinuteMark(new Date());
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    return {
      start: startTime,
      end: endTime
    };
  }, []);

  const [eventData, setEventData] = useState<EventData>({
    description: '',
    startTime: suggestedTimeRange.start,
    endTime: suggestedTimeRange.end,
    location: '',
    guests: '',
    useGoogleMeet: false
  });

  const [guestTags, setGuestTags] = useState<GuestTag[]>([]);
  const [currentGuest, setCurrentGuest] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Handle adding a guest from input field
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
      setEventData(prev => ({
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
      setEventData(prev => ({
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
    setEventData(prev => ({
      ...prev,
      guests: guestsString
    }));
  };

  // Update parent component when data changes
  useEffect(() => {
    onDataChange?.(eventData);
  }, [eventData, onDataChange]);

  // Handle Google Calendar event creation
  const createGoogleEvent = async (title: string): Promise<string | null> => {
    console.log("Creating Google Calendar event:", title);
    try {
      setIsSubmitting(true);

      // Step 1: Get access token from API
      console.log("Fetching Google tokens");
      const tokenResponse = await fetch('/api/auth/calendar/tokens', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!tokenResponse.ok) {
        const tokenError = await tokenResponse.json();
        console.error("Token fetch error:", tokenError);
        
        if (tokenError.requiresGoogleAuth) {
          wallsToast.error("Google Account Required", "Please connect your Google account to create events with Google Meet.");
          // Redirect to Gmail connection page (adjust as needed)
          if (confirm("You need to connect your Google account. Connect now?")) {
            window.location.href = "/connect-gmail";
          }
          return null;
        }
        
        throw new Error(`Failed to get tokens: ${tokenResponse.status}`);
      }

      const { accessToken } = await tokenResponse.json();
      console.log("Got access token");

      // Format attendees from guests string
      const attendees = eventData.guests
        ? eventData.guests.split(',').map(email => ({ email: email.trim() }))
        : [];

      // Create Google Calendar event data
      const googleEventData: GoogleCalendarEvent = {
        summary: title,
        description: eventData.description,
        location: eventData.location,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        attendees,
        conferenceData: eventData.useGoogleMeet,
      };

      console.log("Creating event with data:", googleEventData);
      
      // Call API to create event using the access token
      const response = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          eventData: googleEventData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Event creation error:", errorData);
        
        if (errorData.requiresReauth) {
          wallsToast.error("Authentication Error", "Your Google session has expired. Please reconnect your account.");
          return null;
        }
        
        throw new Error(errorData.details || 'Failed to create Google Calendar event');
      }

      const data = await response.json();
      console.log("Event created successfully:", data);
      
      wallsToast.success("Event Created", "Event has been added to your Google Calendar");

      return data.eventId;
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      wallsToast.error("Error Creating Event", error instanceof Error ? error.message : 'An unknown error occurred');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Expose the create function to parent component
  useEffect(() => {
    // Add the createGoogleEvent function to the event data
    const updatedEventData = {
      ...eventData,
      createGoogleEvent,
    };
    onDataChange?.(updatedEventData);
  }, [eventData]);

  // Time options for dropdowns
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  return (
    <div data-event-type="event" className="event-content">
      <div className="flex gap-4">
        {/* Left column - Icons */}
        <div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 mb-6">
            <Clock className="w-4 h-4 text-gray-600" />
          </div>
          
          <div className="space-y-6 mt-[2px]">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
              <Users className="w-4 h-4 text-gray-600" />
            </div>
            
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
              <VideoIcon className="w-4 h-4 text-gray-600" />
            </div>
            
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
              <MapPin className="w-4 h-4 text-gray-600" />
            </div>
            
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
              <AlignLeft className="w-4 h-4 text-gray-600" />
            </div>
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
                    {format(eventData.startTime, "EEEE, MMMM d")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <MiniCalendar
                    selected={eventData.startTime}
                    onSelect={(date) => {
                      if (!date) return;
                      
                      // Preserve the time when changing the date
                      const newStartDate = new Date(date);
                      newStartDate.setHours(
                        eventData.startTime.getHours(),
                        eventData.startTime.getMinutes(),
                        0, 0
                      );
                      
                      const newEndDate = new Date(date);
                      newEndDate.setHours(
                        eventData.endTime.getHours(),
                        eventData.endTime.getMinutes(),
                        0, 0
                      );
                      
                      setEventData({
                        ...eventData,
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
                    {format(eventData.startTime, "h:mm a")}
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
                          const newStartTime = new Date(eventData.startTime);
                          newStartTime.setHours(
                            option.value.getHours(),
                            option.value.getMinutes(),
                            0, 0
                          );
                          
                          // If new start time is after end time, adjust end time
                          let newEndTime = eventData.endTime;
                          if (newStartTime >= eventData.endTime) {
                            newEndTime = new Date(newStartTime);
                            newEndTime.setHours(
                              newStartTime.getHours() + 1,
                              newStartTime.getMinutes(),
                              0, 0
                            );
                          }
                          
                          setEventData({
                            ...eventData,
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
                    {format(eventData.endTime, "h:mm a")}
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
                          const newEndTime = new Date(eventData.endTime);
                          newEndTime.setHours(
                            option.value.getHours(),
                            option.value.getMinutes(),
                            0, 0
                          );
                          
                          // If new end time is before start time, don't allow it
                          if (newEndTime <= eventData.startTime) {
                            return;
                          }
                          
                          setEventData({
                            ...eventData,
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
          
          <div className="relative flex items-center mt-0">
            <div className={`flex flex-wrap items-center gap-2 border-0 border-b ${focusedField === 'guests' ? 'border-blue-500' : 'border-gray-200'} py-[2px] px-0 w-full transition-colors duration-200`}>
              {guestTags.map(tag => (
                <GuestTag
                  key={tag.id}
                  tag={tag}
                  onRemove={() => removeGuestTag(tag.id)}
                />
              ))}
              <Input
                id="guests"
                value={currentGuest}
                onChange={(e) => setCurrentGuest(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  handleGuestAdd(currentGuest);
                  setFocusedField(null);
                }}
                onFocus={() => setFocusedField('guests')}
                placeholder={guestTags.length ? '' : "Add guests"}
                className="border-0 rounded-none bg-transparent focus:ring-0 focus-visible:ring-0 focus-visible:outline-none shadow-none flex-1 min-w-[200px] px-0 h-7"
              />
            </div>
            <GuestSearch
              onSelect={(email) => {
                handleGuestAdd(email);
              }}
              currentInput={currentGuest}
            />
          </div>
          
          <div className={`flex items-center justify-between border-0 border-b ${focusedField === 'google-meet' ? 'border-blue-500' : 'border-gray-200'} py-[2px] mt-0 transition-colors duration-200`}>
            <span className="text-sm font-normal text-gray-500">Add Google Meet video conferencing</span>
            <Switch
              id="google-meet"
              checked={eventData.useGoogleMeet}
              onCheckedChange={(checked) => setEventData({ ...eventData, useGoogleMeet: checked })}
              onFocus={() => setFocusedField('google-meet')}
              onBlur={() => setFocusedField(null)}
              className="data-[state=checked]:bg-kenoo-light"
            />
          </div>
          
          <div className="flex items-center mt-0">
            <Input
              id="location"
              value={eventData.location}
              onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
              placeholder="Add location"
              className={`border-0 border-b ${focusedField === 'location' ? 'border-blue-500' : 'border-gray-200'} rounded-none bg-transparent focus:ring-0 focus-visible:ring-0 focus-visible:outline-none px-0 py-[2px] h-7 w-full transition-colors duration-200`}
              onFocus={() => setFocusedField('location')}
              onBlur={() => setFocusedField(null)}
            />
          </div>
          
          <div className="flex items-start mt-0">
            <div
              ref={descriptionRef}
              contentEditable
              className={`min-h-[36px] max-h-none border-0 border-b ${focusedField === 'description' ? 'border-blue-500' : 'border-gray-200'} rounded-none bg-transparent outline-none px-0 py-0 w-full overflow-hidden transition-colors duration-200 empty:before:content-['Add_description'] empty:before:text-gray-500 empty:before:pointer-events-none text-sm font-normal`}
              onFocus={() => setFocusedField('description')}
              onBlur={(e) => {
                setFocusedField(null);
                // Update the description in the event data
                setEventData({ ...eventData, description: e.currentTarget.textContent || '' });
              }}
              onInput={(e) => {
                // Update the description in the event data
                setEventData({ ...eventData, description: e.currentTarget.textContent || '' });
              }}
              dangerouslySetInnerHTML={{ __html: eventData.description }}
              style={{ minHeight: '28px', lineHeight: '28px', fontSize: '14px' }}
            />
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
} 