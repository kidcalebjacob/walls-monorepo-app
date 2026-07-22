"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { motion, type Variants } from "framer-motion";
import { CalendarDays, Check, ChevronDown, MapPin, Plus, Users } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { wallsToast } from "@/components/ui/walls-toast";
import { showTaskCompleteToast } from "@/components/agents-projects/ui/show-task-complete-toast";
import { createClient } from "@walls/supabase/client";
import { useAuth } from "@walls/auth";
import { MiniCalendar } from "@/components/calendar/mini-calendar";
import { ChromeFrame } from "@/components/ui/chrome-frame";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreatePopup, EventType } from "./create/event/create-popup";
import { Event } from "./create/event/event";
import { OutOfOffice } from "./create/event/out-of-office";
import { AppointmentSchedule } from "./create/event/appointment-schedule";
import {
  getCalendarEventTheme,
  GOOGLE_MEET_ICON_URL,
  isCalendarTaskCompleted,
  isGoogleMeetLink,
} from "./calendar-event-theme";
import { parseCalendarToJsDate } from "@/lib/calendar-recurring";

export interface CalendarSidebarEvent {
  id: string;
  title: string;
  startTime: Date | { seconds: number } | string;
  endTime: Date | { seconds: number } | string;
  type?: "regular-event" | "scheduled-task" | "project-task" | "project-task-schedule";
  eventType?: string;
  projectName?: string;
  projectColor?: string | null;
  meetingLink?: string;
  attendees?: Array<{ email: string }>;
  location?: string;
  status?: string;
  projectTaskId?: string;
  scheduleId?: string;
  legacyTaskId?: string;
}

const sidebarEventShadowRest =
  "shadow-[0_6px_20px_-8px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.12)]";
const sidebarEventShadowHover =
  "hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.07),0_3px_10px_-2px_rgba(0,0,0,0.14)]";
const sidebarEventCardClass = `bg-white/60 backdrop-blur-sm backdrop-saturate-150 ${sidebarEventShadowRest} ${sidebarEventShadowHover} transition-shadow`;

const sidebarCardVariants = {
  rest: {},
  hover: {},
};

const completeActionVariants: Variants = {
  rest: {
    height: 0,
    opacity: 0,
    marginTop: 0,
    transition: { duration: 0.15, ease: "easeIn" },
  },
  hover: {
    height: 24,
    opacity: 1,
    marginTop: 8,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

function convertToDate(time: Date | { seconds: number } | string): Date {
  if (time instanceof Date) return new Date(time);
  if (typeof time === "object" && "seconds" in time) {
    return new Date((time as { seconds: number }).seconds * 1000);
  }
  return parseCalendarToJsDate(time as string);
}

function formatTime(time: Date | { seconds: number } | string): string {
  try {
    return format(convertToDate(time), "h:mm a");
  } catch {
    return "";
  }
}

function formatDuration(
  start: Date | { seconds: number } | string,
  end: Date | { seconds: number } | string
): string {
  const startDate = convertToDate(start);
  const endDate = convertToDate(end);
  const diffMins = Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60)
  );
  if (diffMins < 60) return `${diffMins} min`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

function getEventLabel(event: CalendarSidebarEvent): string {
  if (event.type === "project-task" || event.type === "project-task-schedule") {
    return event.projectName || "Task";
  }
  if (event.type === "scheduled-task") {
    return event.eventType === "deal" ? "Deal" : "Task";
  }
  return "Event";
}

function canMarkTaskComplete(event: CalendarSidebarEvent): boolean {
  if (isCalendarTaskCompleted(event)) return false;

  if (
    (event.type === "project-task" || event.type === "project-task-schedule") &&
    event.projectTaskId
  ) {
    return true;
  }

  if (event.type === "scheduled-task" && event.eventType === "task") {
    return !!event.legacyTaskId;
  }

  return false;
}

interface CalendarDaySidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarSidebarEvent[];
  onCreateTask: () => void;
  onProjectTaskCompleted?: (taskId: string) => void;
  onLegacyTaskCompleted?: (taskId: string) => void;
  onProjectTaskClick?: (taskId: string) => void;
}

export function CalendarDaySidebar({
  selectedDate,
  onDateSelect,
  events,
  onCreateTask,
  onProjectTaskCompleted,
  onLegacyTaskCompleted,
  onProjectTaskClick,
}: CalendarDaySidebarProps) {
  const { user } = useAuth();
  const [completingTaskKey, setCompletingTaskKey] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<EventType>("event");
  const [isEventPopupOpen, setIsEventPopupOpen] = useState(false);

  const handleEventTypeSelect = (type: EventType) => {
    setSelectedEventType(type);
    setIsEventPopupOpen(true);
  };

  const handleMarkComplete = useCallback(
    async (event: CalendarSidebarEvent) => {
      if (!canMarkTaskComplete(event) || completingTaskKey) return;

      setCompletingTaskKey(event.id);

      try {
        if (
          (event.type === "project-task" ||
            event.type === "project-task-schedule") &&
          event.projectTaskId
        ) {
          const res = await fetch("/api/project-tasks/mark-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskIds: [event.projectTaskId] }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              (data as { error?: string }).error || "Failed to mark task complete"
            );
          }

          onProjectTaskCompleted?.(event.projectTaskId);
          showTaskCompleteToast({ taskTitle: event.title });
          return;
        }

        if (
          event.type === "scheduled-task" &&
          event.legacyTaskId &&
          user?.id
        ) {
          const supabase = createClient();
          const { error } = await supabase
            .from("tasks")
            .update({ status: "complete" })
            .eq("id", event.legacyTaskId)
            .eq("assignee", user.id);

          if (error) {
            throw new Error(error.message || "Failed to mark task complete");
          }

          onLegacyTaskCompleted?.(event.legacyTaskId);
          wallsToast.success("Task Completed", event.title);
        }
      } catch (error) {
        console.error("Error marking task complete:", error);
        wallsToast.error(
          error instanceof Error ? error.message : "Failed to mark task complete"
        );
      } finally {
        setCompletingTaskKey(null);
      }
    },
    [
      completingTaskKey,
      onLegacyTaskCompleted,
      onProjectTaskCompleted,
      user?.id,
    ]
  );

  const selectedEvents = useMemo(() => {
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    return events
      .filter((event) => {
        try {
          const date = convertToDate(event.startTime);
          if (Number.isNaN(date.getTime())) return false;
          return format(date, "yyyy-MM-dd") === selectedDateStr;
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const aTime = convertToDate(a.startTime).getTime();
        const bTime = convertToDate(b.startTime).getTime();
        return aTime - bTime;
      });
  }, [events, selectedDate]);

  return (
    <>
      <aside className="kenoo-glass-chrome flex h-full min-h-0 w-[19rem] shrink-0 flex-col self-stretch rounded-[1.75rem] border border-white/40 overscroll-none">
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]">
          <div className="shrink-0 space-y-4 px-4 pb-3 pt-4">
          <ChromeFrame className="w-full" contentClassName="w-full">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10.5px] bg-kenoo-white px-4 text-base font-medium text-kenoo-ink transition-colors hover:bg-kenoo-subtle"
                >
                  <Plus className="h-4 w-4" />
                  Create
                  <ChevronDown className="h-3.5 w-3.5 text-kenoo-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[180px] rounded-xl border-kenoo-border bg-kenoo-surface"
              >
                <DropdownMenuItem
                  onClick={() => handleEventTypeSelect("event")}
                  className="cursor-pointer py-2.5 text-sm text-kenoo-ink"
                >
                  Event
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onCreateTask}
                  className="cursor-pointer py-2.5 text-sm text-kenoo-ink"
                >
                  Task
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleEventTypeSelect("outOfOffice")}
                  className="cursor-pointer py-2.5 text-sm text-kenoo-ink"
                >
                  Out of Office
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleEventTypeSelect("appointmentSchedule")}
                  className="cursor-pointer py-2.5 text-sm text-kenoo-ink"
                >
                  Appointment Schedule
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ChromeFrame>

          <MiniCalendar
            selected={selectedDate}
            onSelect={(date) => date && onDateSelect(date)}
          />
        </div>

        <div className="mx-4 border-t border-white/50" />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4">
          <div className="mb-3 shrink-0">
            <h3 className="font-display text-base font-semibold tracking-[-0.03em] text-kenoo-ink">
              {format(selectedDate, "EEEE, MMM d")}
            </h3>
            <p className="mt-0.5 text-xs text-kenoo-muted">
              {selectedEvents.length > 0
                ? `${selectedEvents.length} item${selectedEvents.length !== 1 ? "s" : ""} scheduled`
                : "Nothing scheduled"}
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-0.5 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {selectedEvents.length > 0 ? (
              selectedEvents.map((event) => {
                const theme = getCalendarEventTheme(event);
                const isGoogleMeet = isGoogleMeetLink(event.meetingLink);
                const hasMeetingLink = !!event.meetingLink;
                const attendees = event.attendees ?? [];
                const showMarkComplete = canMarkTaskComplete(event);
                const isCompleted = isCalendarTaskCompleted(event);
                const isProjectTask =
                  (event.type === "project-task" ||
                    event.type === "project-task-schedule") &&
                  !!event.projectTaskId;

                const CardWrapper = showMarkComplete ? motion.div : "div";

                return (
                  <CardWrapper
                    key={event.id}
                    {...(showMarkComplete
                      ? {
                          variants: sidebarCardVariants,
                          initial: "rest",
                          whileHover: "hover",
                        }
                      : {})}
                    role={isProjectTask && onProjectTaskClick ? "button" : undefined}
                    tabIndex={isProjectTask && onProjectTaskClick ? 0 : undefined}
                    onClick={
                      isProjectTask && onProjectTaskClick
                        ? () => onProjectTaskClick(event.projectTaskId!)
                        : undefined
                    }
                    onKeyDown={
                      isProjectTask && onProjectTaskClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onProjectTaskClick(event.projectTaskId!);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "rounded-2xl p-3.5",
                      sidebarEventCardClass,
                      isCompleted && "opacity-70",
                      isProjectTask &&
                        onProjectTaskClick &&
                        "cursor-pointer hover:bg-white/80"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {isCompleted ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kenoo-subtle">
                            <Check className="h-3 w-3 text-kenoo-muted" />
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              theme.dotColor
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            "truncate text-xs",
                            isCompleted ? "text-kenoo-muted" : "text-kenoo-ink/80"
                          )}
                        >
                          {isCompleted ? "Completed" : getEventLabel(event)}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-kenoo-muted">
                        {event.type === "project-task"
                          ? isCompleted
                            ? "Done"
                            : "Due"
                          : formatTime(event.startTime)}
                      </span>
                    </div>

                    <p
                      className={cn(
                        "mb-1.5 line-clamp-2 text-sm leading-snug",
                        isCompleted
                          ? "text-kenoo-muted line-through"
                          : "text-kenoo-ink"
                      )}
                    >
                      {event.title}
                    </p>

                    {event.type !== "project-task" && (
                      <p className="mb-1.5 text-[10px] text-kenoo-muted">
                        {formatDuration(event.startTime, event.endTime)}
                      </p>
                    )}

                    {event.location && (
                      <div className="mb-1.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0 text-kenoo-muted" />
                        <span className="truncate text-[10px] text-kenoo-muted">
                          {event.location}
                        </span>
                      </div>
                    )}

                    {hasMeetingLink && (
                      <a
                        href={event.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/link mt-2 flex items-center gap-1.5 rounded-xl border border-white/50 bg-white/45 px-2.5 py-1.5 transition-colors hover:bg-white/70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isGoogleMeet && (
                          <Image
                            src={GOOGLE_MEET_ICON_URL}
                            alt="Google Meet"
                            width={20}
                            height={20}
                            className="shrink-0"
                          />
                        )}
                        <span
                          className={cn(
                            "text-kenoo-ink group-hover/link:text-kenoo-ink",
                            isGoogleMeet ? "text-sm" : "text-xs"
                          )}
                        >
                          Join meeting
                        </span>
                      </a>
                    )}

                    {showMarkComplete && (
                      <motion.div
                        variants={completeActionVariants}
                        className="overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkComplete(event);
                          }}
                          disabled={completingTaskKey === event.id}
                          className="flex items-center gap-1 text-sm text-kenoo-ink hover:text-kenoo-accent disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Mark as complete"
                        >
                          <Check className="h-4 w-4" />
                          Mark as complete
                        </button>
                      </motion.div>
                    )}

                    {attendees.length > 0 && (
                      <div className="mt-2">
                        <div className="mb-1 flex items-center gap-1">
                          <Users className="h-3 w-3 shrink-0 text-kenoo-muted" />
                          <span className="text-[10px] text-kenoo-muted">
                            {attendees.length} attendee
                            {attendees.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {attendees.slice(0, 3).map((attendee, i) => (
                            <span
                              key={i}
                              className="max-w-[120px] truncate rounded-full bg-kenoo-yellow/30 px-2 py-0.5 text-[9px] text-kenoo-ink"
                              title={attendee.email}
                            >
                              {attendee.email}
                            </span>
                          ))}
                          {attendees.length > 3 && (
                            <span className="px-1 py-0.5 text-[9px] text-kenoo-muted">
                              +{attendees.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardWrapper>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="mb-3 h-6 w-6 text-kenoo-muted" />
                <p className="font-display text-sm font-semibold tracking-[-0.02em] text-kenoo-ink">
                  No items
                </p>
                <p className="mt-1 max-w-[180px] text-xs leading-snug text-kenoo-muted">
                  Select a date to view events and tasks
                </p>
              </div>
            )}
          </div>
        </div>
        </div>
      </aside>

      <CreatePopup
        isOpen={isEventPopupOpen}
        onClose={() => setIsEventPopupOpen(false)}
        initialType={selectedEventType}
        onSubmit={() => setIsEventPopupOpen(false)}
        submitButtonText="Save"
        eventComponent={<Event />}
        outOfOfficeComponent={<OutOfOffice />}
        appointmentScheduleComponent={<AppointmentSchedule />}
      />
    </>
  );
}
