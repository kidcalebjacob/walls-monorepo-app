"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { ScheduleDialog } from "./schedule-popup/schedule-popup";
import { EditorToolbar } from '../editor/editor-toolbar';
import { EditorRef } from '../editor/editor';
import { normalizeEmailHtmlForSend } from '@/components/agentCRM/emailComposer/components/editor/editor';
import { SendOptionsDropdown } from '../editor/tools/sendOptions';
import { TestSendTool } from '../editor/tools/testSend';
import { Timestamp } from 'firebase/firestore';
import type { SelectedCreatorSummary } from '../editor/tools/pitchTracker';

interface EmailFooterProps {
  onSend: () => Promise<void>;
  sending: boolean;
  disabled: boolean;
  editorRef: React.RefObject<EditorRef | null>;
  onChange: (content: string) => void;
  onAttachmentsChange: (files: File[]) => void;
  onPitchChange?: (creators: SelectedCreatorSummary[]) => void;
  recipientEmails: string[];
  selectedCreators: SelectedCreatorSummary[];
  onSubjectChange: (subject: string) => void;
  subject: string;
  attachments?: File[];
  onAIGeneratingChange?: (generating: boolean) => void;
  onAIGenerationComplete?: (result: { subject: string; content: string }) => void;
  isFollowUpTab?: boolean;
  firstEmailContent?: string;
}

export function EmailFooter({ 
  onSend, 
  sending, 
  disabled, 
  editorRef, 
  onChange,
  onAttachmentsChange,
  onPitchChange,
  recipientEmails,
  selectedCreators,
  onSubjectChange,
  subject,
  attachments,
  onAIGeneratingChange,
  onAIGenerationComplete,
  isFollowUpTab = false,
  firstEmailContent = '',
}: EmailFooterProps) {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const { handleTestSend } = TestSendTool();

  const handleScheduleSend = async (timestamp: Timestamp, timezone: string) => {
    try {
      // Normalize HTML for send so paragraph spacing is preserved in Gmail etc.
      const content = normalizeEmailHtmlForSend(editorRef.current?.getEditor()?.getHTML() || '');
      
      // Call the schedule-send API endpoint
      const response = await fetch('/api/gmail/send/scheduled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipientEmails.join(', '),
          subject,
          message: content,
          scheduledTime: {
            seconds: timestamp.seconds,
            nanoseconds: timestamp.nanoseconds
          },
          timezone,
          attachments
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to schedule email');
      }

      // Close the dialog
      setShowScheduleDialog(false);
    } catch (error) {
      console.error('Error scheduling email:', error);
      // You might want to add error handling/notification here
      throw error; // Re-throw to let the dialog component handle the error state
    }
  };

  return (
    <div className="bg-gradient-to-t from-gray-50 to-transparent border-t">
      <div className="p-4">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            <div className="relative send-button-group">
              <Button
                onClick={onSend}
                disabled={sending || disabled}
                className="bg-walls-lime hover:bg-walls-lime/70 text-black px-6"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-2" />
                    Send
                  </>
                )}
              </Button>
              <div className="send-button-divider" />
              <SendOptionsDropdown
                onScheduleClick={() => setShowScheduleDialog(true)}
                onTestSendClick={() => handleTestSend({ 
                  subject,
                  content: normalizeEmailHtmlForSend(editorRef.current?.getEditor()?.getHTML() || ''),
                  attachments
                })}
                disabled={disabled}
              />
            </div>

            <EditorToolbar 
              editorRef={editorRef}
              onChange={onChange}
              onAttachmentsChange={onAttachmentsChange}
              onPitchChange={onPitchChange}
              recipientEmails={recipientEmails}
              selectedCreators={selectedCreators}
              onSubjectChange={onSubjectChange}
              onAIGeneratingChange={onAIGeneratingChange}
              onAIGenerationComplete={onAIGenerationComplete}
              isFollowUpTab={isFollowUpTab}
              firstEmailContent={firstEmailContent}
            />
          </div>
        </div>
      </div>

      <ScheduleDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onSchedule={handleScheduleSend}
        sending={sending}
      />

      <style jsx>{`
        .send-button-group {
          display: flex;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .send-button-group button:first-child {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }

        .send-button-group button:last-child {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}