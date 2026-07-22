import AgentEmail from "@/components/agentMail/agent-email";

export const dynamic = "force-dynamic";

export default function MailPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white">
      <AgentEmail />
    </div>
  );
}
