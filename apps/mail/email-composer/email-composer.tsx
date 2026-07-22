// components/agent-mail/email-composer/email-composer.tsx
"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/auth/AuthContext";
import { cn } from "@/lib/utils";
import { X, Loader2 } from 'lucide-react';
import { Input } from "@/components/ui/input";
import Editor, { EditorRef } from './components/editor/editor';
import { normalizeEmailHtmlForSend } from '@/components/agentCRM/emailComposer/components/editor/editor';

// Import sub-components
import { EmailHeader } from './components/EmailHeader';
import { RecipientField } from './components/recipients/recipient-field';
import { EmailFooter } from './components/footer/email-footer';
import type { SelectedCreatorSummary } from './components/editor/tools/pitchTracker';

// Types
interface Position {
  x: number;
  y: number;
}

interface EmailTag {
  email: string;
  id: string;
}

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  replyTo?: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    originalMessage?: string;
    threadId?: string;
    messageId?: string;
    draftId?: string;
    headers?: {
      'References': string;
      'In-Reply-To': string;
      'Message-ID': string;
    };
  };
}

export default function EmailComposer({ isOpen, onClose, replyTo }: EmailComposerProps) {
  const { user } = useAuth();
  
  // Position state for dragging
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<Position | null>(null);
  const initialPosition = useRef<Position | null>(null);

  // Core state
  const [toTags, setToTags] = useState<EmailTag[]>(
    replyTo?.to ? [{ email: replyTo.to, id: Math.random().toString(36).substr(2, 9) }] : []
  );
  const [ccTags, setCcTags] = useState<EmailTag[]>(
    replyTo?.cc ? [{ email: replyTo.cc, id: Math.random().toString(36).substr(2, 9) }] : []
  );
  const [bccTags, setBccTags] = useState<EmailTag[]>(
    replyTo?.bcc ? [{ email: replyTo.bcc, id: Math.random().toString(36).substr(2, 9) }] : []
  );
  const [subject, setSubject] = useState(
    replyTo ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : ''
  );
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const editorRef = useRef<EditorRef>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<SelectedCreatorSummary[]>([]);

  const handleSubjectChange = (newSubject: string) => {
    console.log('EmailComposer: Updating subject to:', newSubject);
    setSubject(newSubject);
  };

  const handleSubjectPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');

    const normalizedText = text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/\u2013|\u2014/g, '-')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();

    handleSubjectChange(normalizedText);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleAttachmentsChange = (files: File[]) => {
    setAttachments(files);
    console.log('Attachments updated:', files);
  };

  const handlePitchChange = (creators: SelectedCreatorSummary[]) => {
    setSelectedCreators(creators);
  };

  const handleSend = async () => {
    if (sending) return;

    const toEmails = toTags.map(tag => tag.email).join(', ');

    if (!toEmails || !subject || !content.trim()) {
      wallsToast.error("Missing Information", "Please fill in all required fields before sending.");
      return;
    }

    try {
      setSending(true);

      const newMessageId = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
      const headers = {
        'Message-ID': `<${newMessageId}@mail.gmail.com>`,
        ...(replyTo?.headers && {
          'References': replyTo.headers['References'],
          'In-Reply-To': replyTo.headers['Message-ID'],
        }),
      };

      const attachmentData = await Promise.all(
        attachments.map(async (file) => {
          const data = await file.arrayBuffer();
          return {
            name: file.name,
            type: file.type || 'application/octet-stream',
            data: Array.from(new Uint8Array(data)),
          };
        })
      );

      const emailData = {
        to: toEmails,
        cc: ccTags.length ? ccTags.map(tag => tag.email).join(', ') : undefined,
        bcc: bccTags.length ? bccTags.map(tag => tag.email).join(', ') : undefined,
        subject,
        message: normalizeEmailHtmlForSend(content),
        threadId: replyTo?.threadId,
        headers,
        attachments: attachmentData,
        selectedCreators
      };

      console.log('Sending email with attachments:', attachmentData.length);

      console.log('=== Email Content Debug ===');
      console.log('Raw content:', content);
      console.log('HTML structure:', editorRef.current?.getEditor()?.getHTML());

      const response = await fetch('/api/gmail/send/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      if (draftId) {
        await fetch(`/api/gmail/drafts/${draftId}?email=${encodeURIComponent(user?.email || '')}`, {
          method: 'DELETE',
        });
      }

      wallsToast.success("Email Sent", "Your email has been sent successfully.");

      // Reset form
      setContent('');
      setSubject('');
      setToTags([]);
      setCcTags([]);
      setBccTags([]);
      setAttachments([]);
      setSelectedCreators([]);
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      wallsToast.error("Error", error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-700/40 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={cn(
          "w-full h-full",
          "flex flex-col relative",
          "overflow-hidden",
          "font-[Arial]",
          "transition-all duration-300 ease-out",
          "bg-white/10 backdrop-blur-2xl",
          "border border-white/30",
          "shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]",
          "rounded-3xl",
          "hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.5)] hover:border-white/40",
          "hover:bg-white/15"
        )}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'default',
          boxShadow: `
            0 8px 32px 0 rgba(31, 38, 135, 0.37),
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 rgba(255, 255, 255, 0.1)
          `
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glass overlay for visual effect */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-white/5 to-white/10 pointer-events-none" />
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-30 pointer-events-none" />
        
        {/* Content container with proper z-index */}
        <div className="relative z-10 flex flex-col h-full">
          <EmailHeader 
            subject={subject}
            isReply={!!replyTo}
            onClose={onClose}
            fromEmail={user?.email}
            onSubjectChange={handleSubjectChange}
            onDragStart={(e: React.MouseEvent) => {
              setIsDragging(true);
              dragStart.current = { x: e.clientX, y: e.clientY };
              initialPosition.current = position;
            }}
            onDrag={(e: React.MouseEvent) => {
              if (isDragging && dragStart.current && initialPosition.current) {
                const deltaX = e.clientX - dragStart.current.x;
                const deltaY = e.clientY - dragStart.current.y;
                setPosition({
                  x: initialPosition.current.x + deltaX,
                  y: initialPosition.current.y + deltaY
                });
              }
            }}
            onDragEnd={() => {
              setIsDragging(false);
              dragStart.current = null;
              initialPosition.current = null;
            }}
            isDragging={isDragging}
          />

          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="space-y-1">
              <RecipientField
                toTags={toTags}
                ccTags={ccTags}
                bccTags={bccTags}
                onToTagsChange={setToTags}
                onCcTagsChange={setCcTags}
                onBccTagsChange={setBccTags}
                replyTo={replyTo}
              />

              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                onPaste={handleSubjectPaste}
                className="border-0 bg-transparent focus-visible:ring-0 px-6 py-4 text-[13px] font-[Arial] placeholder:text-[#4b5563] font-black"
                style={{ color: 'black' }}
              />
            </div>

            <div className="flex-1 overflow-y-auto cursor-text">
              <Editor
                content={content}
                onChange={handleContentChange}
                placeholder="Write your message..."
                ref={editorRef}
              />
            </div>

            <EmailFooter
              onSend={handleSend}
              sending={sending}
              disabled={!toTags.length || !subject || !content.trim()}
              editorRef={editorRef}
              onChange={handleContentChange}
              onAttachmentsChange={handleAttachmentsChange}
              onPitchChange={handlePitchChange}
              recipientEmails={toTags.map(tag => tag.email)}
              selectedCreators={selectedCreators}
              onSubjectChange={handleSubjectChange}
              subject={subject}
            />
          </div>
        </div>
      </div>
    </div>
  );
}