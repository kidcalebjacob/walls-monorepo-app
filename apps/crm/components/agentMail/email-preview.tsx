"use client";

import React, { useRef, useState, useEffect } from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import {
  Reply,
  ReplyAll,
  X,
  MoreHorizontal,
  Plus,
  Paperclip,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File,
} from 'lucide-react';
import { FullEmail, Thread, ReplyTo, EmailAttachment } from '@/types/email.types';
import { cn } from "@/lib/utils";
import {
  formatDetailedDate,
  extractNameFromEmail,
  formatBytes,
} from '@/utils/format-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GlassButton } from "@/components/ui/glass-button";
import ReplyComposer from './reply-composer/reply-composer';
import { EmailDetailsDropdown } from './ui/email-details-dropdown';
import { CollapsedEmail } from "./collapsed-email";
import { EmailContentViewer } from './email-content-viewer';
import { useAuth } from "@/app/auth/AuthContext";
import { FallbackEmailAvatar } from './ui/fallback-email-avatar';

/** Optimistic reply: shown in thread immediately after send, before refetch. */
export type OptimisticReplyEntry = {
  threadId: string;
  afterMessageId: string;
  message: FullEmail;
};

interface EmailPreviewProps {
  thread: Thread | null;
  onClose: () => void;
  onReply: (threadId: string, replyAll?: boolean, message?: FullEmail) => void;
  onForward: (threadId: string, messageId: string) => void;
  currentUserEmail: string;
  isLoading?: boolean;
  replyTo?: ReplyTo;
  onSendReply: (data: ReplyData) => void;
  onClearReply?: () => void;
  userId?: string;
  /** Replies just sent: show in thread below the message we replied to until refetch. */
  optimisticReplies?: OptimisticReplyEntry[];
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

interface EmailMessageProps {
  message: FullEmail;
  isExpanded: boolean;
  onToggle: () => void;
  isLatest: boolean;
  currentUserEmail: string;
  onReply: (replyAll: boolean) => void;
  onForward: () => void;
  showReplyComposer?: boolean;
  replyTo?: ReplyTo;
  onSendReply: (data: ReplyData) => void;
  onClearReply?: () => void;
  replyContainerRef?: (el: HTMLDivElement | null) => void;
  userId?: string;
  currentUserAvatarUrl?: string | null;
}

interface CollapsedMessagesProps {
  count: number;
  onClick: () => void;
}

function getAttachmentIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return FileText;
  return File;
}

const EmailMessage = ({
  message,
  isExpanded,
  onToggle,
  isLatest,
  currentUserEmail,
  onReply,
  onForward,
  showReplyComposer,
  replyTo,
  onSendReply,
  onClearReply,
  replyContainerRef,
  userId,
  currentUserAvatarUrl,
}: EmailMessageProps) => {
  const [showQuotedContent, setShowQuotedContent] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const isFromCurrentUser = message.from?.includes(currentUserEmail);
  const emailRegex = /<([^>]+)>/;
  const emailMatch = message.from?.match(emailRegex);
  const senderEmail = emailMatch ? emailMatch[1] : message.from;
  const senderName = message.fromName?.trim() || extractNameFromEmail(message.from);
  const senderAvatarUrl = isFromCurrentUser
    ? (currentUserAvatarUrl || message.fromAvatarUrl)
    : message.fromAvatarUrl;
  const showSenderAvatarImg = !!senderAvatarUrl && !avatarImgError;

  // Filter out "undisclosed-recipients" placeholder addresses
  const isUndisclosedAddress = (addr: string) =>
    addr.toLowerCase().includes("undisclosed-recipients");

  // Combine and format all recipients, then cap preview display.
  const recipientsPreview = React.useMemo(() => {
    const RECIPIENT_PREVIEW_LIMIT = 3;
    const toRecipients = Array.isArray(message.to) ? message.to : [message.to];
    const ccRecipients = message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]) : [];
    const bccRecipients = message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]) : [];

    const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients]
      .filter(Boolean)
      .filter(recipient => !isUndisclosedAddress(recipient))
      .map(recipient => {
        if (recipient.includes(currentUserEmail)) {
          return 'me';
        }
        return extractNameFromEmail(recipient);
      });

    const visibleRecipients = allRecipients.slice(0, RECIPIENT_PREVIEW_LIMIT);
    const additionalRecipientsCount = Math.max(0, allRecipients.length - RECIPIENT_PREVIEW_LIMIT);
    const previewText = visibleRecipients.join(', ');

    return additionalRecipientsCount > 0
      ? `${previewText}, +${additionalRecipientsCount}`
      : previewText;
  }, [message.to, message.cc, message.bcc, currentUserEmail]);

  const formattedEmail = React.useMemo(() => {
    if (!message.htmlContent && !message.textContent) {
      return message.snippet || '';
    }
    return message.htmlContent || message.textContent || '';
  }, [message.htmlContent, message.textContent, message.snippet]);

  const hasQuotedContent = React.useMemo(() => {
    if (!message.htmlContent) return false;
    return message.htmlContent.includes('gmail_quote') || 
           message.htmlContent.includes('On ') ||
           message.htmlContent.includes('wrote:');
  }, [message.htmlContent]);

  const handleReplyClick = (replyAll: boolean = false) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply(replyAll);
  };

  const toRecipients = (Array.isArray(message.to) ? message.to : [message.to]).filter(r => r && !isUndisclosedAddress(r));
  const ccRecipients = message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]) : [];
  const allRecipients = new Set([...toRecipients, ...ccRecipients]);
  const showReplyAllButton = allRecipients.size > 1;

  console.log('To Recipients:', message.to);
  console.log('CC Recipients:', message.cc);

  const handleDownloadAttachment = async (attachment: EmailAttachment) => {
    try {
      if (!message.messageId) return;

      const params = new URLSearchParams({
        messageId: message.messageId,
        attachmentId: attachment.providerAttachmentId,
        email: currentUserEmail,
      });

      const res = await fetch(`/api/gmail/download-attachment?${params.toString()}`);
      if (!res.ok) return;

      const { data } = await res.json();
      if (!data) return;

      // Gmail API returns URL-safe base64; normalize before decoding
      let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4 !== 0) {
        base64 += "=";
      }

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const blob = new Blob([byteArray], {
        type: attachment.mimeType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename || "attachment";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download attachment", error);
    }
  };

  return (
    <>
    <div
      className={cn(
        "rounded-[28px] bg-white shadow-sm",
        !isExpanded && "cursor-pointer"
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={!isExpanded ? onToggle : undefined}
    >
      <div className="px-6 pt-6 pb-6">
        {isExpanded ? (
          <>
            {/* Header - Only show in expanded view */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex gap-3">
                {/* Sender Avatar */}
                <div className={cn(
                  "w-11 h-11 rounded-full mt-0 shrink-0 overflow-hidden"
                )}>
                  {showSenderAvatarImg ? (
                    <Image
                      src={senderAvatarUrl}
                      alt={senderName}
                      width={44}
                      height={44}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarImgError(true)}
                    />
                  ) : (
                    <FallbackEmailAvatar name={senderName} />
                  )}
                </div>
                
                {/* Name and Email Info Container */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-light text-neutral-500">
                      {isFromCurrentUser ? 'me' : senderName}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-light">
                      <span className="text-neutral-300">To:</span>{" "}
                      <span className="text-neutral-400">{recipientsPreview}</span>
                    </span>
                    <EmailDetailsDropdown message={message} userId={userId} />
                  </div>
                </div>
              </div>
              
              {/* Reply buttons */}
              <div className="flex items-center gap-2">
                {(isHovering || isExpanded) && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.div whileHover="hover" initial="initial">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleReplyClick(false)}
                              className="h-8 w-8 p-0 hover:bg-transparent shadow-none group"
                            >
                              <motion.span
                                variants={{
                                  initial: { rotate: 0 },
                                  hover: {
                                    rotate: [0, -8, 8, -8, 8, 0],
                                    transition: { duration: 0.5, ease: "easeInOut" }
                                  }
                                }}
                                className="flex items-center justify-center p-2 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95"
                              >
                                <Reply className="h-4 w-4 text-neutral-500" />
                              </motion.span>
                            </Button>
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reply</p>
                        </TooltipContent>
                      </Tooltip>

                      {showReplyAllButton && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <motion.div whileHover="hover" initial="initial">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleReplyClick(true)}
                                className="h-8 w-8 p-0 hover:bg-transparent shadow-none group"
                              >
                                <motion.span
                                  variants={{
                                    initial: { rotate: 0 },
                                    hover: {
                                      rotate: [0, -8, 8, -8, 8, 0],
                                      transition: { duration: 0.5, ease: "easeInOut" }
                                    }
                                  }}
                                  className="flex items-center justify-center p-2 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95"
                                >
                                  <ReplyAll className="h-4 w-4 text-neutral-500" />
                                </motion.span>
                              </Button>
                            </motion.div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reply all</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.div whileHover="hover" initial="initial">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={onForward}
                              className="h-8 w-8 p-0 hover:bg-transparent shadow-none group"
                            >
                              <motion.span
                                variants={{
                                  initial: { rotate: 0 },
                                  hover: {
                                    rotate: [0, -8, 8, -8, 8, 0],
                                    transition: { duration: 0.5, ease: "easeInOut" }
                                  }
                                }}
                                className="flex items-center justify-center p-2 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95"
                              >
                                <Reply className="h-4 w-4 -scale-x-100 text-neutral-500" />
                              </motion.span>
                            </Button>
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Forward</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-xs font-light text-neutral-400 whitespace-nowrap">
                      {formatDetailedDate(message.date)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Message Content */}
            <div className="space-y-4">
              <div className="prose max-w-none">
                <EmailContentViewer 
                  content={message.htmlContent || message.textContent || ''}
                  className="min-h-[100px]"
                  showQuotedContent={showQuotedContent}
                />
              </div>

              {/* Show More/Less Button */}
              {hasQuotedContent && (
                <motion.button
                  type="button"
                  onClick={() => setShowQuotedContent(!showQuotedContent)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-neutral-400 text-xs font-normal cursor-pointer hover:text-neutral-700 transition-colors duration-150 w-fit"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
                  <span>{showQuotedContent ? "Show less" : "Show full message"}</span>
                </motion.button>
              )}

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-1.5 mb-2 text-neutral-400">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="text-xs font-normal">
                      {message.attachments.length === 1 ? "1 attachment" : `${message.attachments.length} attachments`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    {message.attachments.map((attachment) => {
                      const Icon = getAttachmentIcon(attachment.mimeType);
                      const name = attachment.filename || "Attachment";
                      const size = attachment.sizeBytes != null ? formatBytes(attachment.sizeBytes) : null;
                      return (
                        <button
                          key={attachment.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadAttachment(attachment);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-700 w-full text-left hover:bg-neutral-200 transition-colors"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-normal leading-tight">{name}</span>
                            {size && (
                              <span className="text-neutral-400 leading-tight">{size}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </>
        ) : (
          <CollapsedEmail
            senderName={senderName}
            senderEmail={senderEmail}
            snippet={message.snippet || ''}
            date={message.date}
            avatarUrl={senderAvatarUrl}
            isFromCurrentUser={isFromCurrentUser}
            isHovering={isHovering}
            onReply={onReply}
            onForward={onForward}
            onClick={onToggle}
          />
        )}
      </div>
      
    </div>

      {/* Reply Composer - ref used to scroll into view within preview only */}
      {showReplyComposer && (
        <div ref={replyContainerRef} className="mt-3">
          <ReplyComposer
            replyTo={replyTo}
            onClose={onClearReply}
            onSend={onSendReply}
            className="rounded-[28px] bg-white overflow-hidden"
          />
        </div>
      )}
    </>
  );
};

const CollapsedMessages = ({ count, onClick }: CollapsedMessagesProps) => {
  const label = count === 1 ? "1 more message" : `${count} more messages`;
  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <div className="flex-1 h-px bg-neutral-200" />
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs text-neutral-400 font-normal cursor-pointer hover:text-neutral-700 transition-colors duration-200 whitespace-nowrap"
      >
        <Plus className="h-3 w-3 shrink-0" />
        <span>{label}</span>
      </motion.button>
      <div className="flex-1 h-px bg-neutral-200" />
    </div>
  );
};

export default function EmailPreview({
  thread,
  onClose,
  onReply,
  onForward,
  currentUserEmail,
  isLoading = false,
  replyTo,
  onSendReply,
  onClearReply,
  userId,
  optimisticReplies = [],
}: EmailPreviewProps) {
  const { profile } = useAuth();
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const replyContainerRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Merge optimistic replies into the list: insert each right below the message we replied to
  // Computed directly from thread.threadEmails (no intermediate state) so it's available on first render
  const mergedEmails = React.useMemo(() => {
    if (!thread?.threadEmails) return [];
    const sorted = [...thread.threadEmails].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const forThread = optimisticReplies.filter((r) => r.threadId === thread.threadId);
    const list: FullEmail[] = [];
    for (const email of sorted) {
      list.push(email);
      for (const o of forThread) {
        if (o.afterMessageId === email.id) list.push(o.message);
      }
    }
    return list;
  }, [thread?.threadEmails, optimisticReplies, thread?.threadId]);

  // Scroll to bottom when thread changes
  React.useEffect(() => {
    if (previewContainerRef.current) {
      previewContainerRef.current.scrollTop = previewContainerRef.current.scrollHeight;
    }
  }, [thread?.id]);

  // When a reply is triggered, scroll the reply composer into view inside the preview only (no main page scroll)
  useEffect(() => {
    if (!replyTo?.targetMessageId) return;
    const replyEl = replyContainerRefsMap.current.get(replyTo.targetMessageId);
    const container = previewContainerRef.current;
    if (!replyEl || !container) return;
    const t = setTimeout(() => {
      const containerRect = container.getBoundingClientRect();
      const elRect = replyEl.getBoundingClientRect();
      const delta = elRect.top - containerRect.top;
      let newScrollTop = container.scrollTop;
      if (delta < 0) {
        newScrollTop += delta;
      } else if (elRect.bottom > containerRect.bottom) {
        newScrollTop += elRect.bottom - containerRect.bottom;
      }
      if (newScrollTop !== container.scrollTop) {
        container.scrollTo({ top: Math.max(0, newScrollTop), behavior: 'smooth' });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [replyTo?.targetMessageId]);

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const expandAllMessages = () => {
    if (mergedEmails.length > 0) {
      setExpandedMessages(prev => {
        const next = new Set(prev);
        mergedEmails.forEach(email => next.add(email.id));
        return next;
      });

      // After expanding all, gently scroll to the bottom so the
      // newest messages are in view and we can scroll upward.
      const container = previewContainerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        });
      }
    }
  };

  const handleMessageReply = (messageId: string, replyAll: boolean = false) => {
    if (thread) {
      // Find the specific message that was clicked
      const message = thread.threadEmails?.find(email => email.id === messageId);
      if (message) {
        // Pass the specific message so the reply targets the correct sender and uses
        // its content as the quote, and the composer appears below this message.
        onReply(thread.threadId, replyAll, message);
      }
    }
  };

  const handleMessageForward = (messageId: string) => {
    if (thread) {
      onForward(thread.threadId, messageId);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full w-full bg-neutral-100 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden bg-neutral-100 flex flex-col items-center justify-center min-h-0">
          <div className="flex flex-col items-center justify-center gap-0 pt-16">
            <Image
              src={FALLBACK_ICON_URL}
              alt="Loading"
              width={180}
              height={180}
              className="rounded-full object-cover aspect-square"
            />
            <div className="w-48 h-1 bg-neutral-100 rounded-full overflow-hidden -mt-9">
              <motion.div
                className="h-full bg-[#e2f85c] rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: 1.5,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!thread) return null;

  const latestEmail = mergedEmails[mergedEmails.length - 1];
  const latestToRecipients = latestEmail ? (Array.isArray(latestEmail.to) ? latestEmail.to : [latestEmail.to]) : [];
  const latestCcRecipients = latestEmail?.cc ? (Array.isArray(latestEmail.cc) ? latestEmail.cc : [latestEmail.cc]) : [];
  const showReplyAllForLatest = new Set([...latestToRecipients, ...latestCcRecipients]).size > 1;
  const latestComposerOpen = !!(replyTo?.targetMessageId && latestEmail && replyTo.targetMessageId === latestEmail.id);

  return (
    <div className="h-full w-full bg-neutral-100 overflow-hidden slide-in relative flex flex-col">
        {/* Floating glass close button (overlay, doesn't reserve vertical space) */}
        <div className="absolute right-4 top-3 z-10 pointer-events-none">
          <motion.div whileHover="hover" initial="initial" className="pointer-events-auto">
            <GlassButton
              size="sm"
              onClick={onClose}
              aria-label="Close thread"
              className="flex items-center gap-2 pr-4 text-xs rounded-full bg-white/60 backdrop-blur-sm border border-neutral-200/40 shadow-md hover:bg-white/80"
            >
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-red-500/15 text-red-500">
                <motion.span
                  variants={{
                    initial: { rotate: 0 },
                    hover: {
                      rotate: [0, -8, 8, -8, 8, 0],
                      transition: { duration: 0.5, ease: "easeInOut" }
                    }
                  }}
                  className="flex"
                >
                  <X className="h-3.5 w-3.5" />
                </motion.span>
              </span>
              <span className="text-neutral-800 font-normal">Close thread</span>
            </GlassButton>
          </motion.div>
        </div>

        {/* Messages - bg matches email-list.tsx and task-list */}
        <div
          className="flex-1 overflow-y-auto bg-neutral-100 min-h-0"
          data-scrollable="true"
          ref={previewContainerRef}
        >
          <div
            className={cn(
              "flex flex-col gap-4 pt-4 min-h-full bg-neutral-100",
              latestComposerOpen ? "pb-24" : "pb-40"
            )}
          >
            <AnimatePresence initial={false}>
            {mergedEmails.map((email, index, emails) => {
              // Show composer directly below the specific message that was clicked for reply.
              // We use targetMessageId (the database row id) which is unambiguous.
              const showComposer = !!(replyTo?.targetMessageId && replyTo.targetMessageId === email.id);
              
              const totalEmails = emails.length;
              const isExpandedOrOptimistic = (id: string) =>
                expandedMessages.has(id) || id.startsWith("optimistic-");
              const hasHiddenMessages = totalEmails > 3 &&
                emails.some((msg, i) => i > 0 && i < totalEmails - 1 && !isExpandedOrOptimistic(msg.id));

              // Shared ref callback so we can scroll the clicked message into view
              const setMessageRef = (el: HTMLDivElement | null) => {
                if (el) messageRefsMap.current.set(email.id, el);
                else messageRefsMap.current.delete(email.id);
              };
              const setReplyContainerRef = showComposer
                ? (el: HTMLDivElement | null) => {
                    if (el) replyContainerRefsMap.current.set(email.id, el);
                    else replyContainerRefsMap.current.delete(email.id);
                  }
                : undefined;

              if (totalEmails > 3) {
                if (index === 0) {
                  return (
                    <motion.div
                      key={email.id}
                      ref={setMessageRef}
                      layout="position"
                    >
                      <EmailMessage
                        message={email}
                        isExpanded={isExpandedOrOptimistic(email.id)}
                        onToggle={() => toggleMessage(email.id)}
                        isLatest={false}
                        currentUserEmail={currentUserEmail}
                        onReply={(replyAll) => handleMessageReply(email.id, replyAll)}
                        onForward={() => handleMessageForward(email.id)}
                        showReplyComposer={showComposer}
                        replyTo={replyTo}
                        onSendReply={onSendReply}
                        onClearReply={onClearReply}
                        replyContainerRef={setReplyContainerRef}
                        userId={userId}
                        currentUserAvatarUrl={profile?.avatarUrl}
                      />
                    </motion.div>
                  );
                } else if (index === totalEmails - 1) {
                  return (
                    <motion.div
                      key={email.id}
                      ref={setMessageRef}
                      layout="position"
                    >
                      <EmailMessage
                        message={email}
                        isExpanded={true}
                        onToggle={() => {}}
                        isLatest={true}
                        currentUserEmail={currentUserEmail}
                        onReply={(replyAll) => handleMessageReply(email.id, replyAll)}
                        onForward={() => handleMessageForward(email.id)}
                        showReplyComposer={showComposer}
                        replyTo={replyTo}
                        onSendReply={onSendReply}
                        onClearReply={onClearReply}
                        replyContainerRef={setReplyContainerRef}
                        userId={userId}
                        currentUserAvatarUrl={profile?.avatarUrl}
                      />
                    </motion.div>
                  );
                } else if (isExpandedOrOptimistic(email.id)) {
                  return (
                    <motion.div
                      key={email.id}
                      ref={setMessageRef}
                      layout="position"
                    >
                      <EmailMessage
                        message={email}
                        isExpanded={true}
                        onToggle={() => toggleMessage(email.id)}
                        isLatest={false}
                        currentUserEmail={currentUserEmail}
                        onReply={(replyAll) => handleMessageReply(email.id, replyAll)}
                        onForward={() => handleMessageForward(email.id)}
                        showReplyComposer={showComposer}
                        replyTo={replyTo}
                        onSendReply={onSendReply}
                        onClearReply={onClearReply}
                        replyContainerRef={setReplyContainerRef}
                        userId={userId}
                        currentUserAvatarUrl={profile?.avatarUrl}
                      />
                    </motion.div>
                  );
                } else if (index === 1 && hasHiddenMessages) {
                  return (
                    <motion.div
                      key="collapsed-messages"
                      layout="position"
                    >
                      <CollapsedMessages
                        count={emails.filter((msg, i) =>
                          i > 0 && i < totalEmails - 1 && !isExpandedOrOptimistic(msg.id)
                        ).length}
                        onClick={expandAllMessages}
                      />
                    </motion.div>
                  );
                }
                return null;
              }

              return (
                <motion.div
                  key={email.id}
                  ref={setMessageRef}
                  layout="position"
                >
                  <EmailMessage
                    message={email}
                    isExpanded={index === totalEmails - 1 || isExpandedOrOptimistic(email.id)}
                    onToggle={() => toggleMessage(email.id)}
                    isLatest={index === totalEmails - 1}
                    currentUserEmail={currentUserEmail}
                    onReply={(replyAll) => handleMessageReply(email.id, replyAll)}
                    onForward={() => handleMessageForward(email.id)}
                    showReplyComposer={showComposer}
                    replyTo={replyTo}
                    onSendReply={onSendReply}
                    onClearReply={onClearReply}
                    replyContainerRef={setReplyContainerRef}
                    userId={userId}
                    currentUserAvatarUrl={profile?.avatarUrl}
                  />
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        </div>

        {/* Floating reply action buttons - bottom-left, overlayed above content */}
        <AnimatePresence>
          {latestEmail && !latestComposerOpen && (
            <motion.div
              className="absolute left-4 bottom-24 z-10 pointer-events-none"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-2 pointer-events-auto">
                <motion.div whileHover="hover" initial="initial">
                  <GlassButton
                    size="sm"
                    onClick={() => handleMessageReply(latestEmail.id, false)}
                    className="flex items-center gap-2 pr-4 text-xs rounded-full bg-white/60 backdrop-blur-sm border border-neutral-200/40 shadow-md hover:bg-white/80"
                  >
                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-kenoo-yellow/60 text-neutral-900">
                      <motion.span
                        variants={{
                          initial: { rotate: 0 },
                          hover: {
                            rotate: [0, -8, 8, -8, 8, 0],
                            transition: { duration: 0.5, ease: "easeInOut" }
                          }
                        }}
                        className="flex"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </motion.span>
                    </span>
                    <span className="text-neutral-900 font-normal">Reply</span>
                  </GlassButton>
                </motion.div>

                {showReplyAllForLatest && (
                  <motion.div whileHover="hover" initial="initial">
                    <GlassButton
                      size="sm"
                      onClick={() => handleMessageReply(latestEmail.id, true)}
                      className="flex items-center gap-2 pr-4 text-xs rounded-full bg-white/60 backdrop-blur-sm border border-neutral-200/40 shadow-md hover:bg-white/80"
                    >
                      <span className="flex items-center justify-center h-7 w-7 rounded-full bg-kenoo-yellow/60 text-neutral-900">
                        <motion.span
                          variants={{
                            initial: { rotate: 0 },
                            hover: {
                              rotate: [0, -8, 8, -8, 8, 0],
                              transition: { duration: 0.5, ease: "easeInOut" }
                            }
                          }}
                          className="flex"
                        >
                          <ReplyAll className="h-3.5 w-3.5" />
                        </motion.span>
                      </span>
                      <span className="text-neutral-900 font-normal">Reply all</span>
                    </GlassButton>
                  </motion.div>
                )}

                <motion.div whileHover="hover" initial="initial">
                  <GlassButton
                    size="sm"
                    onClick={() => handleMessageForward(latestEmail.id)}
                    className="flex items-center gap-2 pr-4 text-xs rounded-full bg-white/60 backdrop-blur-sm border border-neutral-200/40 shadow-md hover:bg-white/80"
                  >
                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-kenoo-yellow/60 text-neutral-900">
                      <motion.span
                        variants={{
                          initial: { rotate: 0 },
                          hover: {
                            rotate: [0, -8, 8, -8, 8, 0],
                            transition: { duration: 0.5, ease: "easeInOut" }
                          }
                        }}
                        className="flex"
                      >
                        <Reply className="h-3.5 w-3.5 -scale-x-100" />
                      </motion.span>
                    </span>
                    <span className="text-neutral-900 font-normal">Forward</span>
                  </GlassButton>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}