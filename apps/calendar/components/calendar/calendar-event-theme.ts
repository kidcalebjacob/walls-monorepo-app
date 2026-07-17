export type CalendarEventLike = {
  title: string;
  type?: 'regular-event' | 'scheduled-task' | 'project-task' | 'project-task-schedule';
  eventType?: string;
  status?: string;
};

export type CalendarEventTheme = {
  container: string;
  dotColor: string;
  accentColor: string;
  title: string;
  time: string;
  label: string;
};

export function getCalendarEventTheme(event: CalendarEventLike): CalendarEventTheme {
  const isMeeting = event.type === 'regular-event';
  const accentColor = isMeeting ? 'bg-kenoo-sky' : 'bg-kenoo-yellow';

  return {
    container: 'rounded-md transition-colors hover:bg-muted/40',
    dotColor: accentColor,
    accentColor,
    title: 'font-normal text-foreground',
    time: 'font-normal text-muted-foreground',
    label: isMeeting ? 'Event' : event.eventType === 'deal' ? 'Deal' : 'Task',
  };
}

export function formatCompactTimeLabel(time: string): string {
  return time.replace(' ', '');
}

export function getCalendarEventDisplayLabel(
  event: CalendarEventLike,
  compactStartTime?: string
): string {
  if (
    (event.type === 'regular-event' || event.type === 'project-task-schedule') &&
    compactStartTime
  ) {
    return `${event.title}, ${formatCompactTimeLabel(compactStartTime)}`;
  }
  return event.title;
}

export const GOOGLE_MEET_ICON_URL =
  'https://www.gstatic.com/images/branding/product/2x/meet_2020q4_48dp.png';

export function isGoogleMeetLink(link?: string | null): boolean {
  return !!link && link.includes('meet.google');
}

const COMPLETED_PROJECT_STATUSES = new Set(['completed', 'done']);
const COMPLETED_LEGACY_STATUSES = new Set(['complete', 'completed', 'done']);

export function isCalendarTaskCompleted(event: CalendarEventLike): boolean {
  const status = (event.status ?? '').toLowerCase();

  if (event.type === 'project-task' || event.type === 'project-task-schedule') {
    return COMPLETED_PROJECT_STATUSES.has(status);
  }

  if (event.type === 'scheduled-task' && event.eventType === 'task') {
    return COMPLETED_LEGACY_STATUSES.has(status);
  }

  return false;
}

export function getCompletedTaskAccentClass(): string {
  return 'bg-neutral-300';
}

export function getCompletedTaskTitleClass(): string {
  return 'line-through text-muted-foreground';
}
