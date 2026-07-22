// hooks/useEmailReply.ts

import { useState, useCallback } from 'react';
import { Thread, FullEmail, ReplyTo } from '@/types/email.types';
import { extractEmailAddresses, extractNameFromEmail } from '@/utils/format-utils';

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

export const useEmailReply = (userEmail: string) => {
  const [replyTo, setReplyTo] = useState<ReplyTo | undefined>();
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [minimizedThreads, setMinimizedThreads] = useState<Set<string>>(new Set());

  const generateMessageId = (userEmail: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const domain = userEmail.split('@')[1];
    return `<${timestamp}.${random}@${domain}>`;
  };

  const buildEmailReferences = (thread: Thread): string => {
    // Build references chain chronologically
    if (!thread.threadEmails) return '';

    const references = thread.threadEmails
      .map(msg => {
        // Use messageId if available, otherwise use the email id
        const messageId = msg.messageId || msg.id;

        // Ensure proper formatting
        return messageId.includes('@') 
          ? messageId.includes('<') ? messageId : `<${messageId}>`
          : `<${msg.id}@mail.gmail.com>`;
      })
      .join(' ');
    
    console.log('Debug - Building References:', {
      threadId: thread.id,
      messageCount: thread.threadEmails.length,
      references
    });
    
    return references;
  };

  const handleForward = useCallback((thread: Thread, specificMessage?: FullEmail) => {
    if (!thread.threadEmails?.length) return;

    const targetMessage = specificMessage || thread.threadEmails[thread.threadEmails.length - 1];

    const originalMessageId = targetMessage.messageId
      ? (targetMessage.messageId.includes('@')
          ? targetMessage.messageId
          : `<${targetMessage.messageId}@mail.gmail.com>`)
      : `<${targetMessage.id}@mail.gmail.com>`;

    const references = thread.threadEmails
      .map(msg => {
        const msgId = msg.messageId
          ? (msg.messageId.includes('@')
              ? msg.messageId
              : `<${msg.messageId}@mail.gmail.com>`)
          : `<${msg.id}@mail.gmail.com>`;
        return msgId;
      })
      .join(' ');

    const forwardData: ReplyTo = {
      to: '',
      subject: `Fwd: ${thread.subject.replace(/^Fwd:\s*/i, '')}`,
      originalMessage: targetMessage.htmlContent || targetMessage.snippet || '',
      threadId: thread.threadId,
      messageId: originalMessageId,
      targetMessageId: targetMessage.id,
      isForward: true,
      headers: {
        'Message-ID': generateMessageId(userEmail),
        'References': references,
        'In-Reply-To': originalMessageId,
      }
    };

    setReplyTo(forwardData);
    setShowReplyComposer(true);
  }, [userEmail]);

  const handleReply = useCallback((thread: Thread, replyAll: boolean = false, specificMessage?: FullEmail) => {
    if (!thread.threadEmails?.length) return;

    // Use the specific clicked message when provided, otherwise fall back to the last message
    const targetMessage = specificMessage || thread.threadEmails[thread.threadEmails.length - 1];

    // If the target message is from the current user, find the most recent email
    // NOT from us so we don't reply to ourselves.
    const isTargetFromSelf = extractEmailAddresses(targetMessage.from || '').some(
      email => email.toLowerCase() === userEmail.toLowerCase()
    );
    let replyRecipientMessage = targetMessage;
    if (isTargetFromSelf) {
      const emails = thread.threadEmails;
      for (let i = emails.length - 1; i >= 0; i--) {
        const isFromSelf = extractEmailAddresses(emails[i].from || '').some(
          email => email.toLowerCase() === userEmail.toLowerCase()
        );
        if (!isFromSelf) {
          replyRecipientMessage = emails[i];
          break;
        }
      }
    }

    const toRecipients = extractEmailAddresses(replyRecipientMessage.from || '')
      .map((email) => email.toLowerCase())
      .filter(Boolean)
      .filter((email, index, arr) => arr.indexOf(email) === index)
      .filter((email) => email !== userEmail.toLowerCase());
    const primaryTo = toRecipients[0] || replyRecipientMessage.from;

    const ccRecipients = replyAll
      ? extractEmailAddresses(
          Array.isArray(targetMessage.cc) ? targetMessage.cc.join(', ') : targetMessage.cc || ''
        )
          .map((email) => email.toLowerCase())
          .filter(Boolean)
          .filter((email, index, arr) => arr.indexOf(email) === index)
          .filter((email) => email !== userEmail.toLowerCase())
          .filter((email) => email !== primaryTo.toLowerCase())
      : [];

    // Get the messageId if available, or generate one in Gmail format
    const originalMessageId = targetMessage.messageId
      ? (targetMessage.messageId.includes('@')
          ? targetMessage.messageId
          : `<${targetMessage.messageId}@mail.gmail.com>`)
      : `<${targetMessage.id}@mail.gmail.com>`;

    // Build references chain including all message IDs in the thread
    const references = thread.threadEmails
      .map(msg => {
        const msgId = msg.messageId
          ? (msg.messageId.includes('@')
              ? msg.messageId
              : `<${msg.messageId}@mail.gmail.com>`)
          : `<${msg.id}@mail.gmail.com>`;
        return msgId;
      })
      .join(' ');

    console.log('Debug - Reply Data:', {
      threadId: thread.threadId,
      targetMessageId: targetMessage.id,
      originalMessageId,
      references,
      subject: thread.subject,
      from: targetMessage.from
    });

    const toName =
      replyRecipientMessage.fromName?.trim() ||
      extractNameFromEmail(replyRecipientMessage.from);

    const replyData: ReplyTo = {
      to: primaryTo,
      toName,
      subject: `Re: ${thread.subject.replace(/^Re:\s*/i, '')}`,
      originalMessage: targetMessage.htmlContent || targetMessage.snippet || '',
      threadId: thread.threadId,
      messageId: originalMessageId,
      targetMessageId: targetMessage.id,
      replyAll,
      cc: ccRecipients.length ? ccRecipients.join(', ') : undefined,
      headers: {
        'Message-ID': generateMessageId(userEmail),
        'References': references,
        'In-Reply-To': originalMessageId
      }
    };

    console.log('Debug - Generated Reply Headers:', replyData.headers);

    setReplyTo(replyData);
    setShowReplyComposer(true);
  }, [userEmail]);

  const clearReply = useCallback(() => {
    setReplyTo(undefined);
  }, []);

  const handleNewEmail = useCallback(() => {
    setReplyTo(undefined);
    setShowReplyComposer(true);
  }, []);

  const closeComposer = useCallback(() => {
    setShowReplyComposer(false);
    setReplyTo(undefined);
  }, []);

  const handleDraftReply = useCallback((draft: {
    to: string;
    subject: string;
    message?: string;
    threadId?: string;
    messageId?: string;
    draftId?: string;
  }) => {
    const replyData: ReplyTo = {
      to: draft.to,
      subject: draft.subject,
      originalMessage: draft.message,
      threadId: draft.threadId,
      messageId: draft.messageId,
      draftId: draft.draftId
    };

    setReplyTo(replyData);
    setShowReplyComposer(true);
  }, []);

  const handleMinimize = useCallback((threadId: string) => {
    setMinimizedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  const handleSendReply = useCallback(async (data: ReplyData) => {
    if (!replyTo) {
      console.error('Debug - No replyTo data available');
      return;
    }

    const requestData = {
      to: data.to,
      subject: data.subject,
      content: data.content,
      threadId: replyTo.threadId,
      messageId: replyTo.headers?.['Message-ID'],
      inReplyTo: replyTo.headers?.['In-Reply-To'],
      references: replyTo.headers?.['References'],
      cc: data.cc,
      headers: replyTo.headers
    };

    console.log('Debug - Sending Reply Request:', JSON.stringify({
      ...requestData,
      content: data.content.substring(0, 100) + '...' // Truncate content for logging
    }, null, 2));

    try {
      const response = await fetch('/api/gmail/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      let responseData;
      const responseText = await response.text();
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('Debug - Failed to parse response:', responseText);
        responseData = { error: 'Invalid JSON response' };
      }

      console.log('Debug - Reply API Response:', JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        data: responseData
      }, null, 2));

      if (!response.ok) {
        console.error('Debug - Reply API Error:', JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          error: responseData.error,
          details: responseData,
          requestData: {
            ...requestData,
            content: data.content.substring(0, 100) + '...' // Truncate content for logging
          }
        }, null, 2));
        throw new Error(responseData.error || `Failed to send reply: ${response.statusText}`);
      }

      // Clear the reply state after successful send
      setShowReplyComposer(false);
      setReplyTo(undefined);

    } catch (error) {
      console.error('Debug - Reply Error Details:', JSON.stringify({
        error: error.message,
        errorStack: error.stack,
        replyTo: {
          ...replyTo,
          originalMessage: replyTo.originalMessage?.substring(0, 100) + '...' // Truncate for logging
        },
        requestData: {
          ...data,
          content: data.content.substring(0, 100) + '...' // Truncate content for logging
        }
      }, null, 2));
      throw error;
    }
  }, [replyTo]);

  return {
    replyTo,
    showReplyComposer,
    minimizedThreads,
    handleReply,
    handleForward,
    handleNewEmail,
    handleDraftReply,
    handleMinimize,
    handleSendReply,
    closeComposer,
    clearReply
  };
};