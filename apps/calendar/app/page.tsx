import AgentCalendar from "@/components/calendar/agent-calendar";

export default function CalendarPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none kenoo-calendar-atmosphere">
      <AgentCalendar calendarData={null} />
    </div>
  );
}
