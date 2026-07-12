"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, ReactNode } from 'react';
import {
  Dialog,
  DialogContent as DialogContentPrimitive,
  DialogHeader,
  DialogFooter,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Clock } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Event } from './event';
import { OutOfOffice } from './out-of-office';
import { AppointmentSchedule } from './appointment-schedule';
import { Toaster } from "@/components/ui/toaster";

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
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <Cross2Icon className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export type EventType = 'event' | 'outOfOffice' | 'appointmentSchedule';

interface CreatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: EventType;
  initialTitle?: string;
  onSubmit: (formData: any) => void;
  submitButtonText?: string;
  
  // Use proper types for components
  eventComponent?: React.ReactElement<React.ComponentProps<typeof Event>>;
  outOfOfficeComponent?: React.ReactElement<React.ComponentProps<typeof OutOfOffice>>;
  appointmentScheduleComponent?: React.ReactElement<React.ComponentProps<typeof AppointmentSchedule>>;
}

export function CreatePopup({ 
  isOpen, 
  onClose, 
  initialType = 'event',
  initialTitle = '',
  eventComponent,
  outOfOfficeComponent,
  appointmentScheduleComponent,
  onSubmit,
  submitButtonText = 'Save'
}: CreatePopupProps) {
  const [title, setTitle] = useState(initialTitle);
  const [selectedType, setSelectedType] = useState<EventType>(initialType);
  const [eventData, setEventData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      wallsToast.error("Title Required", "Please add a title for your event");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // For events with Google Meet, create in Google Calendar
      if (selectedType === 'event' && eventData.useGoogleMeet) {
        // Check if we received the createGoogleEvent function from the Event component
        if (typeof eventData.createGoogleEvent === 'function') {
          const googleEventId = await eventData.createGoogleEvent(title);
          
          if (googleEventId) {
            // Add the Google event ID to the form data
            const formDataWithGoogleId = {
              title,
              type: selectedType,
              ...eventData,
              googleEventId
            };
            
            // Pass the updated form data to the parent component
            onSubmit(formDataWithGoogleId);
            onClose();
          } else {
            // Don't close the form if Google Calendar event creation failed
            setIsSubmitting(false);
          }
        } else {
          // If Google Meet is enabled but we can't create Google events,
          // show a warning but still submit the form
          wallsToast.error("Warning", "Google Meet was enabled but couldn't be created. The event will be saved without video conferencing.");
          
          // Submit without Google Calendar integration
          onSubmit({ title, type: selectedType, ...eventData });
          onClose();
        }
      } else {
        // For all other event types, submit normally
        onSubmit({ title, type: selectedType, ...eventData });
        onClose();
      }
    } catch (error) {
      console.error('Error creating event:', error);
      wallsToast.error("Error", error instanceof Error ? error.message : "An error occurred while creating the event");
      setIsSubmitting(false);
    }
  };

  // Render the appropriate component based on the selected type
  const renderActiveComponent = () => {
    switch(selectedType) {
      case 'event':
        return eventComponent 
          ? React.cloneElement(eventComponent, { onDataChange: setEventData as any })
          : null;
      case 'outOfOffice':
        return outOfOfficeComponent 
          ? React.cloneElement(outOfOfficeComponent, { onDataChange: setEventData as any })
          : null;
      case 'appointmentSchedule':
        return appointmentScheduleComponent 
          ? React.cloneElement(appointmentScheduleComponent, { onDataChange: setEventData as any })
          : null;
      default:
        return null;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] min-h-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-4">
            {/* Left column - Icons */}
            <div className="pt-[6.4rem]">
              {/* Clock icon removed */}
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
                  <button
                    type="button"
                    onClick={() => setSelectedType('event')}
                    className={`px-4 py-2 rounded-[15px] transition-all duration-200 ${
                      selectedType === 'event' 
                        ? 'text-gray-600 bg-walls-light/30 font-medium'
                        : 'text-gray-600'
                    }`}
                  >
                    Event
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType('outOfOffice')}
                    className={`px-4 py-2 rounded-[15px] transition-all duration-200 ${
                      selectedType === 'outOfOffice' 
                        ? 'text-gray-600 bg-walls-light/30 font-medium'
                        : 'text-gray-600'
                    }`}
                  >
                    Out of Office
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType('appointmentSchedule')}
                    className={`px-4 py-2 rounded-[13px] transition-all duration-200 ${
                      selectedType === 'appointmentSchedule' 
                        ? 'text-gray-600 bg-walls-light/30 font-medium'
                        : 'text-gray-600'
                    }`}
                  >
                    Appointment Schedule
                  </button>
                </div>
              </div>

              {/* Render only the active component */}
              <div className="event-type-container">
                {renderActiveComponent()}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button 
              type="submit" 
              className="bg-blue-500 hover:bg-blue-500/80 text-white rounded-[50px] px-8 py-3 h-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : submitButtonText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Toaster />
    </Dialog>
  );
} 