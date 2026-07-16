"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { motion, type Variants } from "framer-motion";
import { CalendarDays, Check, MapPin, Users } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { wallsToast } from "@/components/ui/walls-toast";
import { showTaskCompleteToast } from "@/components/agents-projects/ui/show-task-complete-toast";
import { createClient } from "@walls/supabase/client";
import { useAuth } from "@walls/auth";
import {
  getCalendarEventTheme,
  GOOGLE_MEET_ICON_URL,
  isCalendarTaskCompleted,
  isGoogleMeetLink,
} from "./calendar-event-theme";

export interface CalendarSidebarEvent {
  id: string;
  title: string;
  startTime: Date | { seconds: number } | string;
  endTime: Date | { seconds: number } | string;
  type?: "regular-event" | "scheduled-task" | "project-task";
  eventType?: string;
  projectName?: string;
  meetingLink?: string;
  attendees?: Array<{ email: string }>;
  location?: string;
  status?: string;
  projectTaskId?: string;
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
  return new Date(time as string);
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
  if (event.type === "project-task") {
    return event.projectName || "Task";
  }
  if (event.type === "scheduled-task") {
    return event.eventType === "deal" ? "Deal" : "Task";
  }
  return "Event";
}

function canMarkTaskComplete(event: CalendarSidebarEvent): boolean {
  if (isCalendarTaskCompleted(event)) return false;

  if (event.type === "project-task") {
    return !!event.projectTaskId;
  }

  if (event.type === "scheduled-task" && event.eventType === "task") {
    return !!event.legacyTaskId;
  }

  return false;
}

interface CalendarDaySidebarProps {
  selectedDate: Date;
  events: CalendarSidebarEvent[];
  onProjectTaskCompleted?: (taskId: string) => void;
  onLegacyTaskCompleted?: (taskId: string) => void;
  onProjectTaskClick?: (taskId: string) => void;
}

export function CalendarDaySidebar({
  selectedDate,
  events,
  onProjectTaskCompleted,
  onLegacyTaskCompleted,
  onProjectTaskClick,
}: CalendarDaySidebarProps) {
  const { user } = useAuth();
  const [completingTaskKey, setCompletingTaskKey] = useState<string | null>(null);

  const handleMarkComplete = useCallback(
    async (event: CalendarSidebarEvent) => {
      if (!canMarkTaskComplete(event) || completingTaskKey) return;

      setCompletingTaskKey(event.id);

      try {
        if (event.type === "project-task" && event.projectTaskId) {
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

  const formatSelectedDate = (date: Date) =>
    format(date, "EEEE, MMMM d").toUpperCase();

  return (
    <div className="w-72 shrink-0 flex flex-col overflow-hidden min-h-0 overscroll-none">
      <div className="mb-4">
        <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">
          {formatSelectedDate(selectedDate)}
        </h3>
        <p className="text-xs font-light text-neutral-400 mt-0.5">
          {selectedEvents.length > 0
            ? `${selectedEvents.length} item${selectedEvents.length !== 1 ? "s" : ""} scheduled`
            : "Nothing scheduled"}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 px-3 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {selectedEvents.length > 0 ? (
          selectedEvents.map((event) => {
            const theme = getCalendarEventTheme(event);
            const isGoogleMeet = isGoogleMeetLink(event.meetingLink);
            const hasMeetingLink = !!event.meetingLink;
            const attendees = event.attendees ?? [];
            const showMarkComplete = canMarkTaskComplete(event);
            const isCompleted = isCalendarTaskCompleted(event);
            const isProjectTask =
              event.type === "project-task" && !!event.projectTaskId;

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
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isCompleted ? (
                      <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200">
                        <Check className="w-3 h-3 text-neutral-500" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "shrink-0 w-2 h-2 rounded-full",
                          theme.dotColor
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-xs font-light truncate",
                        isCompleted ? "text-neutral-400" : "text-neutral-700"
                      )}
                    >
                      {isCompleted ? "Completed" : getEventLabel(event)}
                    </span>
                  </div>
                  <span className="text-xs font-light text-neutral-400 shrink-0">
                    {event.type === "project-task"
                      ? isCompleted
                        ? "Done"
                        : "Due"
                      : formatTime(event.startTime)}
                  </span>
                </div>

                <p
                  className={cn(
                    "text-sm font-light line-clamp-2 leading-snug mb-1.5",
                    isCompleted
                      ? "line-through text-neutral-400"
                      : "text-neutral-800"
                  )}
                >
                  {event.title}
                </p>

                {event.type !== "project-task" && (
                  <p className="text-[10px] text-neutral-400 font-light mb-1.5">
                    {formatDuration(event.startTime, event.endTime)}
                  </p>
                )}

                {event.location && (
                  <div className="flex items-center gap-1 mb-1.5">
                    <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                    <span className="text-[10px] text-neutral-500 truncate">
                      {event.location}
                    </span>
                  </div>
                )}

                {hasMeetingLink && (
                  <a
                    href={event.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-xl bg-neutral-100 border border-neutral-200/60 hover:bg-neutral-50 transition-colors group/link"
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
                        "font-light text-neutral-700 group-hover/link:text-neutral-900",
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
                      className="flex items-center gap-1 text-sm text-black font-light disabled:opacity-50 disabled:cursor-not-allowed hover:text-kenoo-sky"
                      aria-label="Mark as complete"
                    >
                      <Check className="w-4 h-4" />
                      Mark as complete
                    </button>
                  </motion.div>
                )}

                {attendees.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Users className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span className="text-[10px] text-neutral-400 font-light">
                        {attendees.length} attendee
                        {attendees.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {attendees.slice(0, 3).map((attendee, i) => (
                        <span
                          key={i}
                          className="text-[9px] text-black bg-kenoo-yellow/30 px-2 py-0.5 rounded-full truncate max-w-[120px]"
                          title={attendee.email}
                        >
                          {attendee.email}
                        </span>
                      ))}
                      {attendees.length > 3 && (
                        <span className="text-[9px] text-neutral-400 px-1 py-0.5">
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-neutral-200/80 flex items-center justify-center mb-3">
              <CalendarDays className="h-6 w-6 text-neutral-400" />
            </div>
            <p className="text-sm font-black text-neutral-600 uppercase tracking-wider">
              No items
            </p>
            <p className="text-xs font-light text-neutral-400 mt-1 leading-snug max-w-[180px]">
              Select a date to view events and tasks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
