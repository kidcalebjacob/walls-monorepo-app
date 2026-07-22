import AgentCalendar from "@/components/calendar/agent-calendar";

export default function CalendarPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <AgentCalendar calendarData={null} />
    </div>
  );
}
