//components/agent-calendar/create/event/create-dropdown.tsx
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown } from "lucide-react";
import { CreatePopup, EventType } from "./create-popup";
import { Event } from "./event";
import { OutOfOffice } from "./out-of-office";
import { AppointmentSchedule } from "./appointment-schedule";

interface CreateDropdownProps {
  onEventTypeSelect?: (type: EventType) => void;
}

export function CreateDropdown({ onEventTypeSelect }: CreateDropdownProps) {
  const [selectedEventType, setSelectedEventType] = useState<EventType>('event');
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const handleEventTypeSelect = (type: EventType) => {
    setSelectedEventType(type);
    setIsPopupOpen(true);
    onEventTypeSelect?.(type);
  };

  const handleEventSubmit = (formData: any) => {
    // Handle the event creation here based on the type
    console.log('New item created:', formData);
    setIsPopupOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-[70%] h-[60px] mb-4 rounded-[20px] bg-slate-50/80 hover:bg-slate-50 shadow-[0_2px_8px_0_rgba(0,0,0,0.1)] hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.15)] border-2 transition-all duration-200 text-gray-600"
          >
            <Plus className="mr-2 h-4 w-4 text-gray-600" />
            Create
            <ChevronDown className="ml-2 h-4 w-4 text-gray-600" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px] bg-slate-50">
          <DropdownMenuItem 
            onClick={() => handleEventTypeSelect('event')}
            className="hover:bg-slate-100 text-gray-600 text-sm font-light py-3"
          >
            <span>Event</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleEventTypeSelect('outOfOffice')}
            className="hover:bg-slate-100 text-gray-600 text-sm font-light py-3"
          >
            <span>Out of Office</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleEventTypeSelect('appointmentSchedule')}
            className="hover:bg-slate-100 text-gray-600 text-sm font-light py-3"
          >
            <span>Appointment Schedule</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreatePopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        initialType={selectedEventType}
        onSubmit={handleEventSubmit}
        submitButtonText="Save"
        eventComponent={<Event />}
        outOfOfficeComponent={<OutOfOffice />}
        appointmentScheduleComponent={<AppointmentSchedule />}
      />
    </>
  );
} 