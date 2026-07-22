import { wallsToast } from "@/components/ui/walls-toast";
import { useAuth } from "@/app/auth/AuthContext";

interface TestSendToolProps {
  subject: string;
  content: string;
  attachments?: File[];
}

export const TestSendTool = () => {
  const { user } = useAuth();

  const handleTestSend = async ({ subject, content, attachments }: TestSendToolProps) => {
    if (!user?.email) {
      wallsToast.error("Error", "No user email found for test send");
      return;
    }

    try {
      // Send test email using the dedicated test endpoint
      const response = await fetch('/api/gmail/send/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message: content,
          attachments: attachments || []
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send test email');
      }

      wallsToast.success("Test Email Sent", `A test email has been sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending test email:', error);
      wallsToast.error("Error", error instanceof Error ? error.message : "Failed to send test email");
    }
  };

  return { handleTestSend };
};