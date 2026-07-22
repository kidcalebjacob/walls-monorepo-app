// types/email.types.ts

export interface EmailAttachment {
  id: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isInline: boolean;
  providerAttachmentId: string;
}

export interface MessageHeader {
    name: string;
    value: string;
  }
  
  export interface MessagePartBody {
    attachmentId?: string;
    size: number;
    data?: string;
  }
  
  export interface MessagePart {
    partId?: string;
    mimeType: string;
    filename?: string;
    headers: MessageHeader[];
    body: MessagePartBody;
    parts?: MessagePart[];
  }
  
  export interface GmailMessagePayload {
    partId?: string;
    mimeType: string;
    filename?: string;
    headers: MessageHeader[];
    body: MessagePartBody;
    parts?: MessagePart[];
  }
  
  export interface Email {
    id: string;
    subject: string;
    from: string;
    to: string | string[];
    cc?: string | string[];
    date: string;
    snippet: string;
    unread: boolean;
    threadId: string;
    labelIds: string[];
    payload?: GmailMessagePayload;
  }
  
  export interface EmailHeader {
    name: string;
    value: string;
  }
  
  export interface EmailPayload {
    headers: EmailHeader[];
    mimeType: string;
    body: MessagePartBody;
    parts?: EmailPayload[];
  }
  
  export interface FullEmail {
    id: string;
    threadId: string;
    labelIds?: string[];
    snippet?: string;
    historyId?: string;
    internalDate?: string;
    payload?: EmailPayload;
    sizeEstimate?: number;
    raw?: string;
    from: string;
    fromName?: string | null;
    /** Avatar URL from email_messages.from_avatar_url when available */
    fromAvatarUrl?: string | null;
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    date: string;
    messageId?: string;
    htmlContent?: string;
    textContent?: string;
    unread?: boolean;
    threadMessages?: FullEmail[];
    scheduledTime?: string;
    template?: string;
    emailTemplate?: string;
    attachments?: EmailAttachment[];
  }
  
  export type MailboxType = 'inbox' | 'sent' | 'starred' | 'trash' | 'archive' | 'schedule' | 'deals';
  
  export interface EmailMessage {
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
    subject: string;
    from: string;
    to: string | string[];
    date: string;
    unread: boolean;
    htmlContent?: string;
  }
  
  export interface Thread {
    id: string;
    threadId: string;
    /** deals.id when this thread is linked to a deal (email_threads.deal_id) */
    dealId?: string | null;
    subject: string;
    snippet: string;
    lastMessageDate: string;
    labelIds: string[];
    unread: boolean;
    messagesCount: number;
    participants: string[];
    /** Display name from email_messages.from_name when available */
    fromName?: string | null;
    /** Avatar URL from email_messages.from_avatar_url when available */
    fromAvatarUrl?: string | null;
    from: string;
    to: string;
    htmlContent?: string;
    textContent?: string;
    threadEmails?: FullEmail[];
  }
  
  export interface ReplyTo {
    to: string;
    /** Display name for the primary reply recipient (from message from_name / From header). */
    toName?: string;
    subject: string;
    originalMessage?: string;
    threadId?: string;
    messageId?: string;
    /** The database id of the specific email message being replied to (used for UI positioning) */
    targetMessageId?: string;
    draftId?: string;
    replyAll?: boolean;
    isForward?: boolean;
    cc?: string;
    headers?: {
      'Message-ID'?: string;
      'References'?: string;
      'In-Reply-To'?: string;
    };
  }
  
  export interface Draft {
    id: string;
    message: string;
    to: string;
    subject: string;
    date: string;
    threadId?: string;
    snippet?: string;
  }
  
  export interface CategoryCache {
    emails: FullEmail[];
    nextPageToken: string | null;
  }
  
  export interface EmailPreview {
    id: string;
    from: string;
    date: string;
    snippet: string;
    isExpanded: boolean;
  }
  
  export interface ThreadPreview extends Thread {
    expandedMessageId: string;
    collapsedCount: number;
    previewMessages: EmailPreview[];
  }

  export interface Message {
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    snippet: string;
    date: string;
    htmlContent: string;
    textContent: string;
    labelIds: string[];
  }

  export interface ReplyData {
    content: string;
    threadId: string;
    messageId: string;
    inReplyTo: string;
    references: string;
    to: string;
    subject: string;
    cc?: string;
    headers?: {
      'Message-ID': string;
      'References': string;
      'In-Reply-To': string;
    };
  }