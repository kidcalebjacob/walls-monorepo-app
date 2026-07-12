export type EventStatus = "confirmed" | "tentative" | "cancelled";
export type EventVisibility = "default" | "public" | "private" | "confidential";
export type TaskStatus = "deferred" | "todo" | "inprogress" | "complete";
export type TaskPriority = "low" | "medium" | "high";

export interface CalendarEvent {
  id?: string;
  title: string;
  description: string;
  startTime: Date | string;
  endTime: Date | string;
  location?: string;
  attendees?: Attendee[];
  recurrence?: RecurrenceRule[];
  color?: CalendarEventColor;
  status?: EventStatus;
  visibility?: EventVisibility;
  reminders?: Reminder[];
  creator?: {
    email: string;
    displayName?: string;
  };
  organizer?: {
    email: string;
    displayName?: string;
  };
  conferenceData?: ConferenceData;
  colorId?: string;
  type?: string;
  meetingLink?: string;
}

export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  optional?: boolean;
}

export interface RecurrenceRule {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval?: number;
  until?: Date;
  count?: number;
  byDay?: string[];
  byMonth?: number[];
  byMonthDay?: number[];
}

export interface Reminder {
  method: "email" | "popup";
  minutes: number;
}

export interface ConferenceData {
  type: "meetingUrl" | "googleMeet" | "zoom";
  url?: string;
  meetingId?: string;
  password?: string;
}

export interface CalendarEventColor {
  id: string;
  background: string;
  foreground: string;
}

export interface TaskData {
  id?: string;
  name: string;
  description: string;
  attachments?: File[];
  project?: string;
  assignee: string;
  status: TaskStatus | string;
  priority?: TaskPriority;
  duration: string;
  startDate?: Date | null;
  deadline?: Date;
  hardDeadline?: boolean;
  schedule?: string;
  labels?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  scheduleStart: Date | null;
  scheduleEnd: Date | null;
  eventType?: string;
  dealId?: string;
  readOnly?: boolean;
}

export interface ScheduledTask {
  id: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  readOnly?: boolean;
}

export interface TaskEvent extends CalendarEvent {
  taskType: "todo" | "reminder" | "deadline";
  priority?: TaskPriority;
  completed?: boolean;
  completedAt?: Date;
  tags?: string[];
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
}

export interface CalendarSettings {
  defaultReminders: Reminder[];
  defaultVisibility: EventVisibility;
  defaultDuration: number;
  workingHours: {
    start: string;
    end: string;
    daysOfWeek: number[];
  };
}

export interface CalendarView {
  type: "day" | "week" | "month" | "agenda";
  date: Date;
}

export interface CalendarFilter {
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  status?: EventStatus[];
  calendars?: string[];
}

export interface CalendarResponse {
  events: CalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface CalendarError {
  code: string;
  message: string;
  status?: number;
}

export interface RecurringEventException {
  originalStartTime: Date;
  newStartTime?: Date;
  newEndTime?: Date;
  status: "cancelled" | "modified";
  modifiedProperties?: Partial<CalendarEvent>;
}
