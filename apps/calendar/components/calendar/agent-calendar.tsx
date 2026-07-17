//components/agent-calendar/agent-calendar.tsx
"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect, useRef } from 'react';
import { CalendarHeader, CalendarViewMode } from './calendar-header';
import { AgentMonthGrid } from './agent-month-grid';
import { CalendarGrid } from './calendar-grid';
import { CalendarDaySidebar } from './calendar-day-sidebar';
import { CalendarEvent, TaskData, ScheduledTask } from "@/types/calendar.types";
import { useAuth } from "@walls/auth";
import { createClient } from "@walls/supabase/client";
import { Toaster } from "@/components/ui/toaster";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMemo } from 'react';
import { addDays, addMonths, subMonths, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { TimezoneAlert } from './timezone-popp/timezone-alert';
import {
  buildRecurringExceptionMaps,
  filterMeetingsHidingRecurringExceptions,
  generateRecurringCalendarInstances,
  parseCalendarToJsDate,
  type RecurrenceRule,
  type RecurringInstanceOverrideRow,
} from '@/lib/calendar-recurring';
import { filterTasksVisibleToUser } from '@/components/agents-projects/task-visibility';
import { isAllDayEvent } from '@/lib/calendar-all-day';
import { CreateTasksPopup } from '@/components/agents-projects/create-tasks-popup';
import {
  ACCESSIBLE_PROJECT_SELECT,
  loadAccessibleProjects,
} from '@/components/agents-projects/load-accessible-projects';
import type { Project, ProjectTask, ProjectTaskSchedule } from '@/components/agents-projects/types';

const PROJECT_TASK_SELECT =
  'id, title, description, status, start_date, due_date, priority, project_id, assignee_id, assigned_by, is_private, created_at, updated_at, completed_at, parent_task_id, position, estimated_minutes, actual_minutes, metadata, projects(id, name, color)';

const PROJECT_TASK_SCHEDULE_SELECT =
  'id, created_at, updated_at, task_id, start_time, end_time, position, notes, created_by, is_blocking';

function mapRowToProjectTask(row: Record<string, unknown>): ProjectTask {
  const projects = row.projects as { id: string; name: string; color: string | null } | null;
  const schedulesRaw = row.project_task_schedules;
  const schedules = Array.isArray(schedulesRaw)
    ? (schedulesRaw as NonNullable<ProjectTask['schedules']>)
    : [];
  return {
    id: row.id as string,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
    project_id: row.project_id as string,
    parent_task_id: (row.parent_task_id as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    status: row.status as ProjectTask['status'],
    start_date: (row.start_date as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    position: (row.position as number | null) ?? null,
    priority: (row.priority as number | null) ?? null,
    assignee_id: (row.assignee_id as string | null) ?? null,
    assigned_by: (row.assigned_by as string | null) ?? null,
    is_private: (row.is_private as boolean) ?? false,
    estimated_minutes: (row.estimated_minutes as number | null) ?? null,
    actual_minutes: (row.actual_minutes as number | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    schedules,
    project: projects
      ? { id: projects.id, name: projects.name, color: projects.color }
      : undefined,
  };
}

async function loadProjectTasksWithSchedules(
  supabase: ReturnType<typeof createClient>,
  viewerUserId: string
): Promise<ProjectTask[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select(PROJECT_TASK_SELECT)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching project tasks:', error);
    throw error;
  }

  const mapped = (data ?? []).map((row) =>
    mapRowToProjectTask(row as Record<string, unknown>)
  );
  const visible = filterTasksVisibleToUser(mapped, viewerUserId);
  if (visible.length === 0) return visible;

  const taskIds = visible.map((task) => task.id);
  const { data: scheduleRows, error: scheduleError } = await supabase
    .from('project_task_schedules')
    .select(PROJECT_TASK_SCHEDULE_SELECT)
    .in('task_id', taskIds)
    .order('position', { ascending: true })
    .order('start_time', { ascending: true });

  if (scheduleError) {
    console.error('Error fetching project task schedules:', scheduleError);
    return visible.map((task) => ({ ...task, schedules: task.schedules ?? [] }));
  }

  const schedulesByTask = new Map<string, ProjectTaskSchedule[]>();
  for (const row of scheduleRows ?? []) {
    const schedule = row as ProjectTaskSchedule;
    const list = schedulesByTask.get(schedule.task_id) ?? [];
    list.push(schedule);
    schedulesByTask.set(schedule.task_id, list);
  }

  return visible.map((task) => ({
    ...task,
    schedules: schedulesByTask.get(task.id) ?? [],
  }));
}

interface AgentCalendarProps {
  calendarData: {
    email: string;
    accessToken?: string;
  } | null;
}

function AgentCalendarContent({ calendarData }: AgentCalendarProps) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('weekly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [regularEvents, setRegularEvents] = useState<CalendarEvent[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [userTimezone, setUserTimezone] = useState<string | null>(null);
  const [showTimezoneAlert, setShowTimezoneAlert] = useState(false);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editProjectTask, setEditProjectTask] = useState<ProjectTask | null>(null);
  const [filters] = useState({
    events: true,
    tasks: true,
    deals: true
  });

  const isInitialRender = useRef(true);

  // Calculate all events by combining regular events, scheduled tasks, and project tasks
  const allEvents = useMemo(() => {
    const formattedRegularEvents = regularEvents.map(event => ({
      id: event.id || `regular-${new Date().getTime()}`,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      colorId: event.colorId,
      type: 'regular-event' as const,
      meetingLink: event.meetingLink,
      attendees: event.attendees,
      isAllDay: isAllDayEvent({
        startTime: event.startTime,
        endTime: event.endTime,
      }),
    }));

    const formattedTaskEvents = scheduledTasks.map(task => {
      const taskData = tasks.find(t => t.id === task.taskId);
      return {
        id: `scheduled-${task.taskId}`,
        title: taskData?.name || 'Scheduled Task',
        description: taskData?.description || '',
        startTime: task.startTime,
        endTime: task.endTime,
        type: 'scheduled-task' as const,
        eventType: taskData?.eventType || 'task',
        status: taskData?.status,
        legacyTaskId: task.taskId,
      };
    });

    const formattedProjectTaskEvents = projectTasks
      // All-day due/start markers — scheduling is separate timed blocks below
      .filter(task => task.due_date || task.start_date)
      .map(task => {
        const date = task.due_date || task.start_date;
        return {
          id: `project-task-${task.id}`,
          title: task.title,
          startTime: `${date}T00:00:00`,
          endTime: `${date}T23:59:59`,
          type: 'project-task' as const,
          isAllDay: true,
          status: task.status,
          projectTaskId: task.id,
          projectName: task.project?.name || '',
          projectColor: task.project?.color || null,
        };
      });

    const formattedProjectScheduleEvents = projectTasks.flatMap((task) =>
      (task.schedules ?? [])
        .filter((schedule) => schedule.start_time && schedule.end_time)
        .map((schedule) => ({
          id: `project-task-schedule-${schedule.id}`,
          title: task.title,
          description: task.description ?? '',
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          type: 'project-task-schedule' as const,
          isAllDay: false,
          status: task.status,
          projectTaskId: task.id,
          scheduleId: schedule.id,
          projectName: task.project?.name || '',
          projectColor: task.project?.color || null,
        }))
    );

    const filteredEvents = [];

    if (filters.events) {
      filteredEvents.push(...formattedRegularEvents);
    }

    formattedTaskEvents.forEach(event => {
      if (event.eventType === 'deal' && filters.deals) {
        filteredEvents.push(event);
      } else if (event.eventType === 'task' && filters.tasks) {
        filteredEvents.push(event);
      }
    });

    if (filters.tasks) {
      filteredEvents.push(...formattedProjectTaskEvents);
      filteredEvents.push(...formattedProjectScheduleEvents);
    }

    return filteredEvents;
  }, [regularEvents, scheduledTasks, tasks, projectTasks, filters]);

  // Legacy standalone "tasks" table does not exist in this monorepo; the
  // calendar surfaces work items via `project_tasks` (fetched below). Keep the
  // scheduled-task state empty so downstream memos stay stable.
  useEffect(() => {
    if (!user) return;
    setTasks([]);
    setScheduledTasks([]);
  }, [user]);

  // Fetch calendar events from database
  useEffect(() => {
    const fetchCalendarEvents = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        const visibleRangeStart =
          calendarView === 'monthly'
            ? startOfMonth(selectedDate)
            : calendarView === 'daily'
              ? startOfDay(selectedDate)
              : startOfWeek(selectedDate);
        const visibleRangeEnd =
          calendarView === 'monthly'
            ? endOfMonth(selectedDate)
            : calendarView === 'daily'
              ? endOfDay(selectedDate)
              : endOfWeek(selectedDate);
        const rangeStartIso = visibleRangeStart.toISOString();
        const rangeEndIso = visibleRangeEnd.toISOString();
        const horizonDays = Math.min(
          365,
          Math.max(14, Math.ceil((visibleRangeEnd.getTime() - Date.now()) / 86400000) + 14)
        );

        const { data: meetingsData, error: meetingsError } = await supabase
          .from('calendar_view')
          .select('id, title, start_time, end_time, meeting_link, event_id, account_id, user_id, is_recurring_parent, location, html_link, status')
          .eq('user_id', user.id)
          .eq('is_recurring_parent', false)
          .gte('end_time', rangeStartIso)
          .lte('start_time', rangeEndIso)
          .order('start_time', { ascending: true });

        if (meetingsError) {
          console.error('Error fetching meetings:', meetingsError);
        }

        const exceptionSelectWithType =
          'id, account_id, event_id, recurring_event_id, original_start_time, exception_type, status';
        const exceptionSelectFallback =
          'id, account_id, event_id, recurring_event_id, original_start_time, status';

        let exceptionRows: RecurringInstanceOverrideRow[] | null = null;
        const exceptionWithType = await supabase
          .from('calendar_events')
          .select(exceptionSelectWithType)
          .eq('user_id', user.id)
          .not('recurring_event_id', 'is', null);

        if (!exceptionWithType.error) {
          exceptionRows = (exceptionWithType.data || []) as RecurringInstanceOverrideRow[];
        } else {
          const exceptionFallback = await supabase
            .from('calendar_events')
            .select(exceptionSelectFallback)
            .eq('user_id', user.id)
            .not('recurring_event_id', 'is', null);

          if (exceptionFallback.error) {
            console.error('Error fetching recurring exceptions:', exceptionFallback.error);
          } else {
            exceptionRows = (exceptionFallback.data || []) as RecurringInstanceOverrideRow[];
          }
        }

        const exceptionMaps = buildRecurringExceptionMaps(exceptionRows || []);
        const visibleMeetings = filterMeetingsHidingRecurringExceptions(
          meetingsData || [],
          exceptionMaps
        );

        const { data: recurringEventsData, error: recurringError } = await supabase
          .from('calendar_view')
          .select('id, title, start_time, end_time, start_timezone, end_timezone, meeting_link, html_link, event_id, account_id, user_id, is_recurring_parent, until, location')
          .eq('user_id', user.id)
          .eq('is_recurring_parent', true)
          .order('start_time', { ascending: true });

        if (recurringError) {
          console.error('Error fetching recurring events:', recurringError);
        }

        // Fetch attendees separately from calendar_event_attendees table, keyed by event UUID
        const allEventUuids = [
          ...(meetingsData || []).map((e: any) => e.id),
          ...(recurringEventsData || []).map((e: any) => e.id),
        ].filter(Boolean);

        const attendeesByEventId = new Map<string, Array<{ email: string }>>();
        if (allEventUuids.length > 0) {
          const { data: attendeesData } = await supabase
            .from('calendar_event_attendees')
            .select('event_id, email')
            .in('event_id', allEventUuids);

          for (const a of (attendeesData || [])) {
            if (!attendeesByEventId.has(a.event_id)) {
              attendeesByEventId.set(a.event_id, []);
            }
            attendeesByEventId.get(a.event_id)!.push({ email: a.email });
          }
        }

        const nowDate = new Date();
        const activeRecurringEvents = (recurringEventsData || []).filter((event: any) => {
          if (!event.until) return true;
          const untilDate = new Date(event.until);
          return untilDate >= nowDate;
        });

        let recurringInstances: CalendarEvent[] = [];
        if (activeRecurringEvents && activeRecurringEvents.length > 0) {
          const eventIds = Array.from(new Set(activeRecurringEvents.map((e: any) => e.event_id)));

          const { data: recurrencesData, error: recurrencesError } = await supabase
            .from('calendar_recurrences')
            .select('account_id, parent_event_id, freq, interval, byday, until, count')
            .in('parent_event_id', eventIds);

          if (recurrencesError) {
            console.error('Error fetching recurrences:', recurrencesError);
          }

          const recurrenceMap = new Map<string, RecurrenceRule>();
          if (recurrencesData) {
            recurrencesData.forEach(
              (rec: {
                account_id: string;
                parent_event_id: string;
                freq: string | null;
                interval: number | null;
                byday: string[] | null;
                until: string | null;
                count: number | null;
              }) => {
                recurrenceMap.set(`${rec.account_id}|${rec.parent_event_id}`, {
                  freq: rec.freq ?? '',
                  interval: rec.interval,
                  byday: rec.byday,
                  until: rec.until,
                  count: rec.count,
                });
              }
            );
          }

          const { data: originalStartRows } = await supabase
            .from('calendar_events')
            .select('account_id, event_id, original_start_time')
            .eq('user_id', user.id)
            .in('event_id', eventIds);

          const originalStartByKey = new Map<string, string | null>();
          (originalStartRows || []).forEach(
            (r: {
              account_id: string;
              event_id: string;
              original_start_time: string | null;
            }) => {
              const key = `${r.account_id}|${r.event_id}`;
              originalStartByKey.set(key, r.original_start_time);
            }
          );

          activeRecurringEvents.forEach((event: any) => {
            const recRow = recurrenceMap.get(`${event.account_id}|${event.event_id}`);
            if (recRow) {
              const eventKey = `${event.account_id}|${event.event_id}`;
              const parentAttendees = attendeesByEventId.get(event.id) || [];
              const rows = generateRecurringCalendarInstances(
                {
                  id: event.id,
                  title: event.title,
                  start_time: event.start_time,
                  end_time: event.end_time,
                  start_timezone: event.start_timezone,
                  end_timezone: event.end_timezone,
                  meeting_link: event.meeting_link,
                  html_link: event.html_link,
                  original_start_time: originalStartByKey.get(eventKey) ?? null,
                  calendar_event_attendees: parentAttendees,
                  location: event.location,
                },
                recRow,
                {
                  maxInstances: 100,
                  horizonDays,
                  suppressedSlotStartMs: exceptionMaps.suppressedSlotStartMsByParent.get(eventKey),
                }
              );
              recurringInstances.push(
                ...rows.map((inst) => ({
                  id: inst.id,
                  title: inst.title,
                  description: '',
                  startTime: inst.start_time,
                  endTime: inst.end_time,
                  location: inst.location || undefined,
                  attendees: inst.calendar_event_attendees?.map((a: { email: string }) => ({
                    email: a.email,
                  })) || [],
                  meetingLink: inst.meeting_link || undefined,
                }))
              );
            }
          });
        }

        const regularEventsData: CalendarEvent[] = visibleMeetings.map((event: any) => ({
          id: event.id,
          title: event.title,
          description: '',
          startTime: event.start_time,
          endTime: event.end_time,
          location: event.location || undefined,
          attendees: attendeesByEventId.get(event.id) || [],
          meetingLink: event.meeting_link || undefined,
        }));

        const eventsInVisibleRange = [...regularEventsData, ...recurringInstances].filter((event) => {
          const startMs = parseCalendarToJsDate(String(event.startTime)).getTime();
          const endMs = parseCalendarToJsDate(String(event.endTime)).getTime();
          return endMs >= visibleRangeStart.getTime() && startMs <= visibleRangeEnd.getTime();
        });

        setRegularEvents(eventsInVisibleRange);
      } catch (error) {
        console.error('Calendar fetch error:', error);
        setError(error instanceof Error ? error.message : 'Failed to load calendar events');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCalendarEvents();
  }, [user?.id, selectedDate, calendarView]);

  // Fetch the viewer's timezone (users.id === auth uid in this monorepo)
  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.id) {
        const supabase = createClient();
        const { data: userData, error } = await supabase
          .from('users')
          .select('id, timezone')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && userData) {
          setUserTimezone(userData.timezone || null);
        }
      }
    };
    fetchUserData();
  }, [user]);

  // Fetch project tasks visible to the current user (RLS-enforced)
  useEffect(() => {
    if (!user?.id) {
      setProjectTasks([]);
      return;
    }

    const supabase = createClient();
    const viewerUserId = user.id;

    const fetchProjectTasks = async () => {
      try {
        const loaded = await loadProjectTasksWithSchedules(supabase, viewerUserId);
        setProjectTasks(loaded);
      } catch (err) {
        console.error('Error loading project tasks with schedules:', err);
      }
    };

    fetchProjectTasks();

    const channel = supabase
      .channel('project-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_tasks',
        },
        () => {
          fetchProjectTasks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_task_schedules',
        },
        () => {
          fetchProjectTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setProjects([]);
      return;
    }

    let cancelled = false;
    loadAccessibleProjects(user.id, { select: ACCESSIBLE_PROJECT_SELECT.summary })
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleProjectTaskClick = (taskId: string) => {
    const row = projectTasks.find((task) => task.id === taskId);
    if (row) {
      setEditProjectTask(row);
      setTaskFormOpen(true);
    }
  };

  const handleCreateTask = () => {
    setEditProjectTask(null);
    setTaskFormOpen(true);
  };

  const handleTaskFormClose = () => {
    setTaskFormOpen(false);
    setEditProjectTask(null);
  };

  const handleTaskFormSaved = () => {
    handleTaskFormClose();
    if (!user?.id) return;
    const supabase = createClient();
    void loadProjectTasksWithSchedules(supabase, user.id)
      .then((loaded) => setProjectTasks(loaded))
      .catch((err) => console.error('Error refreshing project tasks:', err));
  };

  // Check for timezone mismatch
  useEffect(() => {
    if (userTimezone) {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTimezone !== userTimezone) {
        setShowTimezoneAlert(true);
      }
    }
  }, [userTimezone]);

  const handleEventDeleted = (eventId: string) => {
    setRegularEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
    wallsToast.negative("Event Deleted", "The event has been removed from your calendar view");
  };

  const handleEventUpdated = (eventId: string, updatedData: any) => {
    setRegularEvents(prevEvents =>
      prevEvents.map(event =>
        event.id === eventId ? { ...event, ...updatedData } : event
      )
    );
    wallsToast.success("Event Updated", "The changes have been saved to your calendar");
  };

  const handleProjectTaskCompleted = (taskId: string) => {
    setProjectTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status: 'completed', completed_at: new Date().toISOString() }
          : task
      )
    );
  };

  const handleLegacyTaskCompleted = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: 'complete' } : task
      )
    );
  };

  const sidebarProps = {
    onProjectTaskCompleted: handleProjectTaskCompleted,
    onLegacyTaskCompleted: handleLegacyTaskCompleted,
    onProjectTaskClick: handleProjectTaskClick,
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handlePrev = () => {
    if (calendarView === 'monthly') setSelectedDate(prev => subMonths(prev, 1));
    else if (calendarView === 'weekly') setSelectedDate(prev => subWeeks(prev, 1));
    else setSelectedDate(prev => addDays(prev, -1));
  };

  const handleNext = () => {
    if (calendarView === 'monthly') setSelectedDate(prev => addMonths(prev, 1));
    else if (calendarView === 'weekly') setSelectedDate(prev => addWeeks(prev, 1));
    else setSelectedDate(prev => addDays(prev, 1));
  };

  return (
    <div className="kenoo-calendar-atmosphere flex h-full min-h-0 items-stretch gap-3 overflow-hidden overscroll-none p-4">
      <CalendarDaySidebar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        events={allEvents}
        onCreateTask={handleCreateTask}
        {...sidebarProps}
      />

      {/* h-full keeps this column flush with the sidebar; no overflow clip so glass shadows paint */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3">
        <CalendarHeader
          selectedDate={selectedDate}
          onTodayClick={() => setSelectedDate(new Date())}
          onPrev={handlePrev}
          onNext={handleNext}
          calendarView={calendarView}
          onViewChange={setCalendarView}
        />

        <div className="flex min-h-0 flex-1 flex-col overscroll-none">
          {/* Shadow on the outer chrome; clip scroll content on the inner shell */}
          <div className="kenoo-glass-chrome-dense flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-[1.75rem] border border-white/40">
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]">
              {calendarView === 'monthly' ? (
                <AgentMonthGrid
                  selectedDate={selectedDate}
                  onDateSelect={(date) => setSelectedDate(date)}
                  allEvents={allEvents}
                />
              ) : (
                <CalendarGrid
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  allEvents={allEvents}
                  onTaskDrop={() => {}}
                  onEventDeleted={handleEventDeleted}
                  onEventUpdated={handleEventUpdated}
                  onProjectTaskClick={handleProjectTaskClick}
                  userTimezone={userTimezone}
                  viewMode={calendarView === 'daily' ? 'day' : 'week'}
                />
              )}
            </div>
          </div>
        </div>

        <TimezoneAlert
          isOpen={showTimezoneAlert}
          onClose={() => setShowTimezoneAlert(false)}
          browserTimezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          userTimezone={userTimezone || ''}
        />

        <CreateTasksPopup
          open={taskFormOpen}
          onClose={handleTaskFormClose}
          onSaved={handleTaskFormSaved}
          projects={projects}
          existing={editProjectTask}
          defaultScheduleDate={selectedDate}
        />

        <Toaster />
      </div>
    </div>
  );
}

export default function AgentCalendar(props: AgentCalendarProps) {
  return <AgentCalendarContent {...props} />;
}
