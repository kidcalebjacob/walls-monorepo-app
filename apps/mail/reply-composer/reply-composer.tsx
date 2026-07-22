// components/agent-mail/reply-composer/reply-composer.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Reply, Forward, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Editor, { type EditorRef } from '@/components/agentCRM/emailComposer/components/editor/editor';
import { TextFormattingTool } from '@/components/agentCRM/emailComposer/components/editor/tools/textFormatting';
import { HyperlinkTool } from '@/components/agentCRM/emailComposer/components/editor/tools/hyperlink';
import { AttachmentsTool } from '@/components/agentCRM/emailComposer/components/editor/tools/attachments';
import { SignatureTool } from '@/components/agentCRM/emailComposer/components/editor/tools/signature';
import { SendOptionsDropdown } from '@/components/agentCRM/emailComposer/components/editor/tools/sendOptions';
import { TestSendTool } from '@/components/agentCRM/emailComposer/components/editor/tools/testSend';
import { ScheduleDialog } from '@/components/agentCRM/emailComposer/components/footer/schedule-popup/schedule-popup';
import { AIReplier } from '@/components/agentMail/reply-composer/aiReplier';
import { RecipientField } from '@/components/agentCRM/emailComposer/components/recipients/recipient-field';
import { cn } from "@/lib/utils";
import { Timestamp } from 'firebase/firestore';

import { createThreadedReply } from '@/utils/reply-formatting';
import { ReplyTo } from '@/types/email.types';
import { normalizeEmailHtmlForSend } from '@/components/agentCRM/emailComposer/components/editor/editor';
import { extractNameFromEmail, extractEmailAddresses } from '@/utils/format-utils';

interface EmailTag {
  email: string;
  id: string;
  personName?: string;
  personPhoto?: string;
}

interface ReplyData {
  content: string;
  threadId?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  to: string;
  cc?: string;
  subject: string;
}

interface ReplyComposerProps {
  replyTo?: ReplyTo;
  onClose: () => void;
  onSend: (data: ReplyData) => void;
  className?: string;
}

function getPlainTextFromHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';

  if (typeof document === 'undefined') {
    return trimmed
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
}

/** Reply-only send normalization: CRM composer rules + preserve TipTap blank lines on Gmail transform. */
function normalizeReplyHtmlForSend(html: string): string {
  let out = normalizeEmailHtmlForSend(html);

  // TipTap often emits <p><br></p> for blank lines; without this, transformToGmailFormat
  // collapses consecutive spacer paragraphs and sent replies lose the gap before signatures.
  out = out.replace(/<p([^>]*)>\s*<br\s*\/?>\s*<\/p>/gi, `<p$1>&nbsp;</p>`);

  return out;
}

export default function ReplyComposer({
  replyTo,
  onClose,
  onSend,
  className
}: ReplyComposerProps) {
  const buildEmailTags = React.useCallback((emails?: string, displayName?: string): EmailTag[] => {
    if (!emails) return [];

    const parsedEmails = extractEmailAddresses(emails)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    // Keep fallback so non-standard formatting still displays as one recipient.
    const normalizedEmails = parsedEmails.length ? parsedEmails : [emails.trim()];
    const uniqueEmails = Array.from(new Set(normalizedEmails));

    return uniqueEmails.map((email, index) => ({
      email,
      id: Math.random().toString(36).substr(2, 9),
      ...(index === 0 && displayName?.trim() ? { personName: displayName.trim() } : {}),
    }));
  }, []);

  const [content, setContent] = useState('<p></p>');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [replyMode, setReplyMode] = useState<'reply' | 'forward'>(replyTo?.isForward ? 'forward' : 'reply');
  const [editingRecipients, setEditingRecipients] = useState(replyTo?.isForward ? true : false);
  const [toTags, setToTags] = useState<EmailTag[]>(
    replyTo?.isForward ? [] : buildEmailTags(replyTo?.to, replyTo?.toName)
  );
  const [ccTags, setCcTags] = useState<EmailTag[]>(
    replyTo?.isForward ? [] : buildEmailTags(replyTo?.cc)
  );
  const [bccTags, setBccTags] = useState<EmailTag[]>([]);
  const editorRef = useRef<EditorRef>(null);
  const { handleTestSend } = TestSendTool();

  useEffect(() => {
    if (editorRef.current?.getEditor()) {
      editorRef.current.getEditor()?.commands.focus();
    }
  }, []);

  // Keep editable recipient fields in sync if replyTo changes
  useEffect(() => {
    if (replyTo?.isForward) {
      setReplyMode('forward');
      setEditingRecipients(true);
      setToTags([]);
      setCcTags([]);
      setBccTags([]);
    } else {
      setReplyMode('reply');
      setToTags(buildEmailTags(replyTo?.to, replyTo?.toName));
      setCcTags(buildEmailTags(replyTo?.cc));
      setBccTags([]);
    }
  }, [replyTo?.to, replyTo?.toName, replyTo?.cc, replyTo?.isForward, buildEmailTags]);

  const hasReplyContent = React.useMemo(
    () => getPlainTextFromHtml(content).length > 0,
    [content]
  );

  const handleSend = () => {
    if (!hasReplyContent) return;
    const newContent = editorRef.current.getEditor()?.getHTML() || '';
    const normalized = normalizeReplyHtmlForSend(newContent);
    const threadedContent = createThreadedReply(normalized, {
      originalMessage: replyTo?.originalMessage,
      to: replyTo?.to
    });

    const toEmails =
      (toTags.length ? toTags.map(tag => tag.email).join(', ') : replyTo?.to || '').trim();
    const ccEmails =
      (ccTags.length ? ccTags.map(tag => tag.email).join(', ') : replyTo?.cc || '').trim() || undefined;

    const replyData: ReplyData = {
      content: threadedContent,
      threadId: replyTo?.threadId,
      messageId: replyTo?.headers?.['Message-ID'],
      inReplyTo: replyTo?.headers?.['In-Reply-To'],
      references: replyTo?.headers?.['References'],
      to: toEmails,
      cc: ccEmails,
      subject: replyTo?.subject || 'Re: No Subject'
    };

    setSending(true);
    onSend(replyData);
    setContent('<p></p>');
    setAttachments([]);
    onClose();
    setSending(false);
  };

  const handleScheduleSend = async (timestamp: Timestamp, timezone: string) => {
    if (!hasReplyContent) return;
    const html = editorRef.current?.getEditor()?.getHTML() || '';
    const content = normalizeReplyHtmlForSend(html);
    const toEmails =
      (toTags.length ? toTags.map(tag => tag.email).join(', ') : replyTo?.to || '').trim();

    const response = await fetch('/api/gmail/send/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toEmails,
        subject: replyTo?.subject ?? 'Re: No Subject',
        message: content,
        scheduledTime: { seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds },
        timezone,
        attachments: attachments.length ? attachments : undefined
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to schedule');
    }
    setShowScheduleDialog(false);
  };

  const handleAttachmentsChange = (files: File[]) => {
    setAttachments(files);
  };

  const handleDiscard = () => {
    setContent('<p></p>');
    setAttachments([]);
    onClose();
  };

  // Match email-preview / email-list: show sender display name, not "username (domain.com)"
  const recipientLabel = React.useMemo(() => {
    const tagName = toTags[0]?.personName?.trim();
    if (tagName) return tagName;
    const replyName = replyTo?.toName?.trim();
    if (replyName) return replyName;
    const primaryTo = toTags[0]?.email || replyTo?.to;
    if (!primaryTo) return 'Unknown';
    return extractNameFromEmail(primaryTo);
  }, [toTags, replyTo?.to, replyTo?.toName]);

  // Compact summary for additional recipients (e.g. "+2 more")
  const extraRecipientsLabel = React.useMemo(() => {
    const totalRecipients = toTags.length + ccTags.length + bccTags.length;
    if (totalRecipients <= 1) return '';
    const extra = totalRecipients - 1;
    return extra > 0 ? `+${extra} more` : '';
  }, [toTags, ccTags, bccTags]);

  return (
    <div className={cn(
      "rounded-[28px] shadow-lg overflow-hidden",
      "h-[400px]",
      className
    )}>
      {/* Composer Body */}
      <div className="flex flex-col h-full">
        {/* Recipients */}
        <div className="flex-none px-4 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  {replyMode === 'reply' ? (
                    <Reply className="h-4 w-4" />
                  ) : (
                    <Forward className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32 text-sm">
                <DropdownMenuItem
                  onClick={() => setReplyMode('reply')}
                  className="text-sm"
                >
                  <Reply className="h-4 w-4 mr-2 text-neutral-900" />
                  Reply
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setReplyMode('forward')}
                  className="text-sm"
                >
                  <Forward className="h-4 w-4 mr-2 text-neutral-900" />
                  Forward
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="text-sm text-neutral-900 cursor-text"
              onClick={() => setEditingRecipients(true)}
            >
              {recipientLabel}
            </button>
            {extraRecipientsLabel && (
              <span className="text-xs text-muted-foreground">{extraRecipientsLabel}</span>
            )}
          </div>
          {editingRecipients && (
            <div className="mt-1 -mx-4">
              <RecipientField
                toTags={toTags}
                ccTags={ccTags}
                bccTags={bccTags}
                onToTagsChange={setToTags}
                onCcTagsChange={setCcTags}
                onBccTagsChange={setBccTags}
              />
            </div>
          )}
        </div>

        {/* Message Area */}
        <div
          className="flex-1 min-h-0 flex flex-col"
          onClick={() => {
            if (editingRecipients) setEditingRecipients(false);
          }}
        >
          {/* Editor */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-2 pb-3">
            <Editor
              ref={editorRef}
              content={content}
              onChange={setContent}
              placeholder="Write your reply..."
            />
          </div>
        </div>

        {/* Footer with Tools - Send button UI matches CRM emailComposer */}
        <div className="flex-none p-4 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative send-button-group border-[0.5px] border-solid border-neutral-300/80">
              <Button
                onClick={handleSend}
                disabled={sending || !hasReplyContent}
                className="bg-transparent text-neutral-500 border border-transparent hover:bg-gray-50 hover:text-neutral-500 hover:border-neutral-200 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out px-6 font-normal font-[Arial] shadow-none"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-neutral-500" />
                    Sending...
                  </>
                ) : (
                  'Send'
                )}
              </Button>
              <SendOptionsDropdown
                onScheduleClick={() => setShowScheduleDialog(true)}
                onTestSendClick={() =>
                  handleTestSend({
                    subject: replyTo?.subject ?? 'Re: No Subject',
                    content: normalizeReplyHtmlForSend(editorRef.current?.getEditor()?.getHTML() || ''),
                    attachments: attachments.length ? attachments : undefined
                  })
                }
                disabled={sending || !hasReplyContent}
              />
            </div>
            <AIReplier
              editorRef={editorRef}
              onChange={setContent}
              replyTo={replyTo}
            />
            <TextFormattingTool editor={editorRef.current?.getEditor()} />
            <HyperlinkTool editorRef={editorRef} />
            <AttachmentsTool onAttachmentsChange={handleAttachmentsChange} />
            <SignatureTool editorRef={editorRef} />
            {attachments.length > 0 && (
              <span className="text-sm text-muted-foreground ml-2">
                {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
              </span>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDiscard}
            className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
            title="Discard reply"
          >
            <div className="relative">
              <div className="relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95">
                <Trash2 className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500 transition-colors group-hover:text-red-500" />
              </div>
            </div>
          </Button>
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
            align-items: stretch;
          }

          .send-button-group button:first-child {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
          }

          .send-button-group button:last-child {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
          }
        `}</style>
      </div>
    </div>
  );
}