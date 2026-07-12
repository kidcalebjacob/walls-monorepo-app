"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent as DialogContentPrimitive,
  DialogFooter,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Clock, MapPin, Users, Trash2, PencilIcon, ExternalLink, Save } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Event } from '../event';
import { OutOfOffice } from '../out-of-office';
import { AppointmentSchedule } from '../appointment-schedule';
import { Toaster } from "@/components/ui/toaster";
import { format } from "date-fns";
import { ViewEvent } from './view-event';
import { ViewOutOfOffice } from './view-out-of-office';
import { ViewAppointment } from './view-appointment';

// Custom DialogContent without overlay
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-gray-50 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-3xl",
        className
      )}
      {...props}
    >
      {/* Hidden title for accessibility */}
      <DialogPrimitive.Title className="sr-only">Event Details</DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">
        View or edit event details
      </DialogPrimitive.Description>
      
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <Cross2Icon className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

// Custom DialogContent with delete button
const DialogContentWithDelete = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    onDelete: () => void;
    isDeleting: boolean;
  }
>(({ className, children, onDelete, isDeleting, ...props }, ref) => (
  <DialogPortal>
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-gray-50 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-3xl",
        className
      )}
      {...props}
    >
      {/* Hidden title for accessibility */}
      <DialogPrimitive.Title className="sr-only">Event Details</DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">
        View or edit event details
      </DialogPrimitive.Description>
      
      {children}
      <div className="absolute right-4 top-4 flex items-center">
        <button
          type="button"
          className="text-red-500 hover:text-red-700 mr-4 focus:outline-none"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </button>
        <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <Cross2Icon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </div>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContentWithDelete.displayName = "DialogContentWithDelete";

// Helper function to convert various time formats to Date
function convertToDate(time: Date | { seconds: number } | string): Date {
  if (time instanceof Date) return new Date(time);
  if (typeof time === 'object' && 'seconds' in time) {
    return new Date(time.seconds * 1000);
  }
  return new Date(time);
}

// Helper function to extract attendees from Google Calendar event
const extractAttendeesFromEvent = (event: any): { email: string; displayName?: string; responseStatus?: string }[] => {
  const attendees: { email: string; displayName?: string; responseStatus?: string }[] = [];
  
  // Debug event structure
  console.log('Processing event for attendees:', {
    id: event.id,
    title: event.title || event.summary,
    hasRawAttendees: Boolean(event.attendees),
    hasGoogleDetails: Boolean(event.googleEventDetails)
  });

  // If we have google event details from our API, use that first
  if (event.googleEventDetails && event.googleEventDetails.attendees) {
    console.log('Using attendees from googleEventDetails:', event.googleEventDetails.attendees.length);
    return event.googleEventDetails.attendees.map((attendee: any) => ({
      email: attendee.email,
      displayName: attendee.displayName || attendee.email,
      responseStatus: attendee.responseStatus || 'needsAction'
    }));
  }

  // Check standard Google Calendar attendees array
  if (event.attendees && Array.isArray(event.attendees)) {
    console.log('Found attendees array with length:', event.attendees.length);
    
    // Filter out any invalid entries (must have email)
    const validAttendees = event.attendees.filter((a: any) => a && a.email);
    if (validAttendees.length > 0) {
      console.log('Valid attendees found:', validAttendees);
      attendees.push(...validAttendees);
      return attendees; // Return early if we found valid attendees
    }
  }
  
  // Extract organizer and creator
  if (event.organizer && typeof event.organizer === 'object' && event.organizer.email) {
    console.log('Adding organizer as attendee:', event.organizer);
    attendees.push({
      email: event.organizer.email,
      displayName: event.organizer.displayName || event.organizer.email,
      responseStatus: 'accepted'
    });
  }
  
  if (event.creator && typeof event.creator === 'object' && event.creator.email) {
    const creatorEmail = event.creator.email;
    // Only add creator if not the same as organizer
    if (!attendees.some(a => a.email === creatorEmail)) {
      console.log('Adding creator as attendee:', event.creator);
      attendees.push({
        email: creatorEmail,
        displayName: event.creator.displayName || creatorEmail,
        responseStatus: 'accepted'
      });
    }
  }
  
  // If we have guests
  if (event.guests) {
    console.log('Processing guests:', event.guests);
    if (typeof event.guests === 'string') {
      // Split comma-separated list of emails
      const guestEmails = event.guests.split(',').map((email: string) => email.trim());
      guestEmails.forEach((email: string) => {
        if (email && !attendees.some(a => a.email === email)) {
          attendees.push({
            email,
            displayName: email,
            responseStatus: 'needsAction'
          });
        }
      });
    } else if (Array.isArray(event.guests)) {
      // Handle array of emails or email objects
      event.guests.forEach((guest: string | { email: string; displayName?: string }) => {
        if (typeof guest === 'string') {
          if (!attendees.some(a => a.email === guest)) {
            attendees.push({
              email: guest,
              displayName: guest,
              responseStatus: 'needsAction'
            });
          }
        } else if (guest && guest.email) {
          if (!attendees.some(a => a.email === guest.email)) {
            attendees.push({
              email: guest.email,
              displayName: guest.displayName || guest.email,
              responseStatus: 'needsAction'
            });
          }
        }
      });
    }
  }
  
  // Extract email from title if it contains an email
  if (attendees.length === 0 && event.title && typeof event.title === 'string') {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = event.title.match(emailRegex);
    
    if (match && match[0]) {
      const emailFromTitle = match[0];
      console.log('Found email in title:', emailFromTitle);
      attendees.push({
        email: emailFromTitle,
        displayName: emailFromTitle,
        responseStatus: 'needsAction'
      });
    }
  }
  
  console.log('Final extracted attendees:', attendees);
  return attendees;
};

interface ViewPopupProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    title: string;
    description?: string;
    startTime: Date | { seconds: number } | string;
    endTime: Date | { seconds: number } | string;
    location?: string;
    attendees?: { email: string; displayName?: string; responseStatus?: string }[];
    googleEventId?: string;
    type?: string;
    colorId?: string;
    eventType?: string;
    declineMeetings?: boolean;
    googleEventDetails?: any;
  };
  onEventDeleted?: (eventId: string) => void;
  onEventUpdated?: (eventId: string, updatedData: any) => void;
}

export function ViewPopup({ isOpen, onClose, event, onEventDeleted, onEventUpdated }: ViewPopupProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [eventData, setEventData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Detect loading state from title
  useEffect(() => {
    if (event.title && event.title.includes('(Loading details...)')) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [event.title]);
  
  // Convert date strings to Date objects if needed
  const startTime = useMemo(() => convertToDate(event.startTime), [event.startTime]);
  const endTime = useMemo(() => convertToDate(event.endTime), [event.endTime]);
  
  // Clean description (remove HTML tags if any)
  const cleanDescription = useMemo(() => 
    event.description ? event.description.replace(/<[^>]*>?/gm, '') : '',
    [event.description]
  );

  // Determine event type
  const eventType = useMemo(() => {
    if (event.type === 'outOfOffice' || event.eventType === 'outOfOffice') {
      return 'outOfOffice';
    } else if (event.type === 'appointmentSchedule' || event.eventType === 'appointmentSchedule') {
      return 'appointmentSchedule';
    }
    return 'event';
  }, [event.type, event.eventType]);

  // Set up initial data when event changes
  useEffect(() => {
    // Get title from either Google Calendar summary or event title
    setTitle(event.googleEventDetails?.summary || event.title);
    
    // Log the raw event object
    console.log('Event object for initialization:', {
      id: event.id,
      title: event.title,
      googleEventDetails: event.googleEventDetails ? 'present' : 'not present',
      attendeesCount: event.attendees?.length || 0,
      hasLocation: Boolean(event.location),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
    
    // Extract attendees using our utility function
    const extractedAttendees = extractAttendeesFromEvent(event);
    console.log('Extracted attendees count:', extractedAttendees.length);
    
    // Ensure we always have at least one attendee for debugging
    const finalAttendees = extractedAttendees.length > 0 
      ? extractedAttendees 
      : [{ email: 'default@example.com', displayName: 'Default Attendee' }];
    
    // Process the guest string based on extracted attendees
    const guestsString = finalAttendees.map(a => a.email).join(', ');
    
    // Determine if this is a Google Meet event
    const locationStr = event.googleEventDetails?.location || event.location || '';
    const useGoogleMeet = locationStr.includes('meet.google.com');
    
    // Get the event description
    const description = event.googleEventDetails?.description || event.description || '';
    
    // Initialize eventData with event properties
    const initialData = {
      description,
      startTime,
      endTime,
      location: locationStr,
      guests: guestsString,
      attendees: finalAttendees,
      declineMeetings: event.declineMeetings || false,
      useGoogleMeet,
      // Use Google Calendar event ID if available
      googleEventId: event.googleEventDetails?.id || event.googleEventId || event.id
    };
    
    console.log('Event data initialized with:', {
      eventType,
      title: event.title,
      description: description.substring(0, 50) + (description.length > 50 ? '...' : ''),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      location: locationStr,
      attendeesCount: finalAttendees.length,
      useGoogleMeet
    });
    
    setEventData(initialData);
  }, [
    event,
    startTime,
    endTime,
    eventType
  ]);

  // Render the appropriate view component based on event type - memoize to prevent re-renders
  const eventViewComponent = useMemo(() => {
    // Only render components if we have data
    if (!eventData || !eventData.startTime || !eventData.endTime) {
      return <div className="p-4 text-center">Loading event data...</div>;
    }
    
    // Include the debug information in a details section
    const debugSection = (
      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-blue-500">Debug information</summary>
        <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
          {JSON.stringify({
            eventType,
            eventData: {
              ...eventData,
              startTime: eventData.startTime instanceof Date ? eventData.startTime.toISOString() : eventData.startTime,
              endTime: eventData.endTime instanceof Date ? eventData.endTime.toISOString() : eventData.endTime
            }
          }, null, 2)}
        </pre>
      </details>
    );
    
    // Handle data updates from view components
    const handleDataChange = (updatedData: any) => {
      setEventData((prevData: Record<string, unknown>) => ({
        ...prevData,
        ...updatedData
      }));
    };
    
    // Render the appropriate component based on event type
    switch(eventType) {
      case 'event':
        return (
          <>
            <ViewEvent 
              eventData={eventData} 
              onDataChange={handleDataChange}
            />
            {debugSection}
          </>
        );
      case 'outOfOffice':
        return (
          <>
            <ViewOutOfOffice 
              eventData={eventData} 
              isEditing={true}
              onDataChange={handleDataChange}
            />
            {debugSection}
          </>
        );
      case 'appointmentSchedule':
        return (
          <>
            <ViewAppointment 
              eventData={eventData} 
              isEditing={true}
              onDataChange={handleDataChange}
            />
            {debugSection}
          </>
        );
      default:
        return (
          <>
            <div className="p-4 border rounded-md">
              <p>Unknown event type: {eventType}</p>
            </div>
            {debugSection}
          </>
        );
    }
  }, [eventData, eventType]);
  
  // Handle event deletion
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event?")) {
      return;
    }
    
    // Ensure we have the correct Google Event ID
    const googleEventId = event.googleEventDetails?.id || event.googleEventId;
    
    setIsDeleting(true);
    
    try {
      // If no Google Calendar event ID, simply notify parent about deletion without API call
      if (!googleEventId) {
        wallsToast.negative("Event Deleted", "The local event has been removed");
        
        // Notify parent about deletion
        if (onEventDeleted) {
          onEventDeleted(event.id);
        }
        
        onClose();
        return;
      }
      
      // Step 1: Get access token from API
      const tokenResponse = await fetch('/api/auth/calendar/tokens', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!tokenResponse.ok) {
        const tokenError = await tokenResponse.json();
        
        if (tokenError.requiresGoogleAuth) {
          wallsToast.error("Google Account Required", "Please connect your Google account to delete events.");
          return;
        }
        
        throw new Error(`Failed to get tokens: ${tokenResponse.status}`);
      }

      const { accessToken } = await tokenResponse.json();
      
      // Step 2: Call API to delete the event
      const response = await fetch(`/api/calendar/delete-event?eventId=${googleEventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.details || `Failed to delete event (Status: ${response.status})`);
      }
      
      wallsToast.negative("Event Deleted", "The event has been deleted from your calendar");
      
      // Notify parent about deletion
      if (onEventDeleted) {
        onEventDeleted(event.id);
      }
      
      onClose();
    } catch (error) {
      // Provide more helpful error messages based on common issues
      let errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      if (errorMessage.includes('404')) {
        errorMessage = 'The event could not be found in Google Calendar. It may have been deleted already.';
      } else if (errorMessage.includes('403')) {
        errorMessage = 'You do not have permission to delete this event in Google Calendar.';
      } else if (errorMessage.includes('401')) {
        errorMessage = 'Your Google Calendar authorization has expired. Please sign in again.';
      }
      
      wallsToast.error("Error Deleting Event", errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle form submission for editing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      wallsToast.error("Title Required", "Please add a title for your event");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // If has Google Calendar integration, update there first
      if (event.googleEventId) {
        // Get access token
        const tokenResponse = await fetch('/api/auth/calendar/tokens', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
  
        if (!tokenResponse.ok) {
          const tokenError = await tokenResponse.json();
          throw new Error(`Failed to get tokens: ${tokenResponse.status}`);
        }
  
        const { accessToken } = await tokenResponse.json();
        
        // Update Google Calendar event
        // This is a placeholder - you would need to implement the update API endpoint
        const response = await fetch(`/api/calendar/update-event`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            eventId: event.googleEventId,
            eventData: {
              summary: title,
              description: eventData.description,
              location: eventData.location,
              start: {
                dateTime: eventData.startTime.toISOString()
              },
              end: {
                dateTime: eventData.endTime.toISOString()
              }
            }
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || 'Failed to update Google Calendar event');
        }
      }
      
      // Notify parent component about the update
      if (onEventUpdated) {
        const updatedData = {
          id: event.id,
          title,
          type: eventType,
          ...eventData
        };
        
        onEventUpdated(event.id, updatedData);
      }
      
      // Exit edit mode and close the popup
      wallsToast.success("Event Updated", "Your changes have been saved");
      onClose();
    } catch (error) {
      console.error('Error updating event:', error);
      wallsToast.error("Error Updating Event", error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Open event in Google Calendar
  const openInGoogleCalendar = () => {
    if (event.googleEventId) {
      window.open(`https://calendar.google.com/calendar/event?eid=${event.googleEventId}`, '_blank');
    } else {
      wallsToast.error("Cannot Open Event", "This event doesn't have a Google Calendar ID");
    }
  };

  // Modify title for the form based on event type
  const getViewTitle = () => {
    if (eventType === 'event') {
      return 'Edit Event';
    } else if (eventType === 'outOfOffice') {
      return 'Edit Out of Office';
    } else if (eventType === 'appointmentSchedule') {
      return 'Edit Appointment Schedule';
    }
    return 'Edit Event';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContentWithDelete 
        className="sm:max-w-[600px] min-h-[500px]" 
        onInteractOutside={(e) => e.preventDefault()}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex gap-4">
            {/* Left column - Icons */}
            <div className="pt-[6.4rem]">
              {/* No icons needed here */}
            </div>

            {/* Right column - Main content */}
            <div className="flex-1 grid gap-4 py-4">
              <div className="grid gap-2">
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add title"
                  required
                  className="border-0 border-b-2 border-blue-500 rounded-none bg-transparent focus:ring-0 focus-visible:ring-0 focus:border-blue-600 px-0"
                />
                <div className="flex gap-4 mt-2 text-sm">
                  <div
                    className={`px-4 py-2 rounded-[15px] transition-all duration-200 ${
                      eventType === 'event' 
                        ? 'text-gray-600 bg-walls-light/30 font-medium'
                        : eventType === 'outOfOffice'
                          ? 'text-gray-600 bg-walls-light/30 font-medium'
                          : eventType === 'appointmentSchedule'
                            ? 'text-gray-600 bg-walls-light/30 font-medium'
                            : 'text-gray-600'
                    }`}
                  >
                    {eventType === 'event' ? 'Event' : 
                     eventType === 'outOfOffice' ? 'Out of Office' : 'Appointment Schedule'}
                  </div>
                  
                  {isLoading && (
                    <div className="flex items-center text-blue-500 gap-2 ml-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span>Loading details...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Render the appropriate view component */}
              <div className="event-type-container">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                    <p className="text-gray-600">Fetching complete event details from Google Calendar...</p>
                  </div>
                ) : (
                  eventViewComponent
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 flex justify-end">
            <div className="flex gap-2">
              {event.googleEventId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openInGoogleCalendar}
                  className="gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Google Calendar
                </Button>
              )}
              
              <Button 
                type="submit" 
                className="bg-blue-500 hover:bg-blue-500/80 text-white rounded-[50px] px-8 py-2 h-auto"
                disabled={isSubmitting || isLoading}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContentWithDelete>
      <Toaster />
    </Dialog>
  );
} 