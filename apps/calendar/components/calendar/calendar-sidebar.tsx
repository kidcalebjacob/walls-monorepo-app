// calendar-sidebar.tsx
"use client";

import { MiniCalendar } from "@/components/calendar/mini-calendar";
import { CreateDropdown } from "./create/event/create-dropdown";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { TaskData, ScheduledTask } from "@/types/calendar.types";
import { startOfDay } from "date-fns";

// Custom checkbox without checkmark
const ColorOnlyCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="hidden">
      {/* No checkmark */}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
ColorOnlyCheckbox.displayName = "ColorOnlyCheckbox";

interface CalendarSidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  filters: {
    events: boolean;
    tasks: boolean;
    deals: boolean;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    events: boolean;
    tasks: boolean;
    deals: boolean;
  }>>;
  tasks?: TaskData[];
  scheduledTasks?: ScheduledTask[];
}

export function CalendarSidebar({ 
  selectedDate, 
  onDateSelect, 
  filters, 
  setFilters,
  tasks = [],
  scheduledTasks = []
}: CalendarSidebarProps) {
  const handleFilterChange = (filterType: 'events' | 'tasks' | 'deals') => {
    setFilters(prev => ({
      ...prev,
      [filterType]: !prev[filterType]
    }));
  };

  const dealDates = React.useMemo(() => {
    const dealTaskIds = tasks
      .filter(task => task.eventType === 'deal')
      .map(task => task.id);
    
    return scheduledTasks
      .filter(scheduledTask => dealTaskIds.includes(scheduledTask.taskId))
      .map(scheduledTask => {
        return startOfDay(
          scheduledTask.startTime instanceof Date 
            ? scheduledTask.startTime 
            : new Date(scheduledTask.startTime)
        );
      });
  }, [tasks, scheduledTasks]);

  return (
    <div className="w-64 border p-4 bg-slate-50 rounded-[30px] shadow">
      <CreateDropdown onEventTypeSelect={(type) => {
        console.log('Selected event type:', type);
      }} />

      <div className="aspect-square">
        <MiniCalendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onDateSelect(date)}
          className="rounded-md"
          dealDates={dealDates}
        />
      </div>
      
      <div className="mt-4">
        <h3 className="text-sm text-gray-500 mb-2">My calendar</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <ColorOnlyCheckbox 
              id="events" 
              checked={filters.events}
              onCheckedChange={() => handleFilterChange('events')}
              className="data-[state=checked]:bg-walls-light data-[state=checked]:border-walls-light" 
            />
            <Label htmlFor="events" className="text-sm">Events</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <ColorOnlyCheckbox 
              id="tasks" 
              checked={filters.tasks}
              onCheckedChange={() => handleFilterChange('tasks')}
              className="data-[state=checked]:bg-walls-lime data-[state=checked]:border-walls-lime" 
            />
            <Label htmlFor="tasks" className="text-sm">Tasks</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <ColorOnlyCheckbox 
              id="deals" 
              checked={filters.deals}
              onCheckedChange={() => handleFilterChange('deals')}
              className="data-[state=checked]:bg-walls-red data-[state=checked]:border-walls-red"
            />
            <Label htmlFor="deals" className="text-sm">Deals</Label>
          </div>
        </div>
      </div>
    </div>
  );
}