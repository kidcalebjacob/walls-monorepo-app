// utils/email-utils.ts
import { 
    MessagePart, 
    GmailMessagePayload, 
    Thread, 
    FullEmail 
  } from '@/types/email.types';
  
  export const decodeHtmlEntities = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };
  
  export const parseMessagePart = (messagePart: MessagePart): string => {
    if (!messagePart) return '';
  
    if (messagePart.body?.data) {
      return atob(messagePart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  
    if (messagePart.parts) {
      return messagePart.parts
        .filter(part => part.mimeType.startsWith('text/'))
        .map(part => parseMessagePart(part))
        .join('\n');
    }
  
    return '';
  };
  
  export const getMainContent = (messagePart: MessagePart | GmailMessagePayload): string => {
    if (!messagePart) return '';
  
    const findMainContent = (part: MessagePart): string => {
      if (part.mimeType === 'text/html') {
        const content = parseMessagePart(part);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        return tempDiv.innerHTML
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
          .replace(/<div\s*\/?>/gi, '')
          .replace(/<\/div>/gi, '\n');
      }
  
      if (part.mimeType === 'text/plain') {
        return parseMessagePart(part);
      }
  
      if (part.parts) {
        for (const subPart of part.parts) {
          const content = findMainContent(subPart);
          if (content) return content;
        }
      }
  
      return '';
    };
  
    return findMainContent(messagePart);
  };
  
  export const getTrimmedContent = (messagePart: MessagePart | GmailMessagePayload): string | null => {
    if (!messagePart) return null;
  
    const findQuotedContent = (part: MessagePart): string | null => {
      const isQuoted = part.headers?.some(header => {
        const headerName = header.name.toLowerCase();
        const headerValue = header.value.toLowerCase();
        return (
          (headerName === 'content-disposition' && headerValue.includes('quoted')) ||
          (headerName === 'x-gmail-original-message-content') ||
          (headerName === 'x-gmail-quote-container')
        );
      });
  
      if (isQuoted) {
        return parseMessagePart(part);
      }
  
      if (part.parts) {
        // First check for explicitly marked quoted parts
        for (const subPart of part.parts) {
          const quotedContent = findQuotedContent(subPart);
          if (quotedContent) return quotedContent;
        }
  
        // If no explicit quotes, check second text part
        const textParts = part.parts.filter(p =>
          p.mimeType === 'text/html' || p.mimeType === 'text/plain'
        );
        if (textParts.length > 1) {
          return parseMessagePart(textParts[1]);
        }
      }
  
      return null;
    };
  
    return findQuotedContent(messagePart);
  };
  
  export const cleanPreviewContent = (content: string, payload?: MessagePart | GmailMessagePayload): string => {
    if (!content) return '';
  
    if (payload) {
      const mainContent = getMainContent(payload);
      if (mainContent) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = mainContent;
        let cleanContent = tempDiv.textContent || tempDiv.innerText || '';
  
        cleanContent = cleanContent.replace(/\s+/g, ' ').trim();
  
        const signatureMarkers = [
          /^.*-{2,}.*$/m,
          /^.*={2,}.*$/m,
          /^Best regards,?.*$/im,
          /^Regards,?.*$/im,
          /^Sincerely,?.*$/im,
          /^Thanks,?.*$/im,
          /^Thank you,?.*$/im,
          /^Sent from my .*$/im,
          /^Get Outlook for .*$/im,
        ];
  
        signatureMarkers.forEach(marker => {
          cleanContent = cleanContent.split(marker)[0];
        });
  
        return cleanContent.trim();
      }
    }
  
    if (content.includes('<')) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      return (tempDiv.textContent || tempDiv.innerText || '').trim();
    }
  
    return content.trim();
  };
  
  export const groupEmailsByThread = (emails: FullEmail[]): Thread[] => {
    const threadMap = new Map<string, Thread>();
  
    emails.forEach(email => {
      const threadId = email.threadId;
      if (!threadMap.has(threadId)) {
        // If this is the first email in the thread, create an array with just this email
        const threadEmails = [email];
  
        threadMap.set(threadId, {
          id: threadId,
          threadId: threadId,
          threadEmails: threadEmails,
          snippet: cleanPreviewContent(email.snippet || ''),
          lastMessageDate: email.date,
          unread: email.unread || false,
          subject: email.subject,
          labelIds: email.labelIds || [],
          from: email.from || '',
          to: typeof email.to === 'string' ? email.to : email.to[0] || '',
          messagesCount: 1,
          htmlContent: email.htmlContent || '',
          textContent: email.textContent || '',
          participants: [
            email.from,
            ...(typeof email.to === 'string' ? [email.to] : email.to || []),
            ...(typeof email.cc === 'string' ? [email.cc] : email.cc || [])
          ].filter(Boolean).map(addr => addr.split('@')[0])
        });
      } else {
        // If we already have a thread, add this email to it
        const thread = threadMap.get(threadId)!;
        thread.threadEmails.push(email);
        thread.threadEmails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Update thread metadata with latest email
        const latestEmail = thread.threadEmails[thread.threadEmails.length - 1];
        thread.lastMessageDate = latestEmail.date;
        thread.unread = thread.unread || email.unread || false;
        thread.messagesCount = thread.threadEmails.length;
        thread.htmlContent = latestEmail.htmlContent || '';
        thread.textContent = latestEmail.textContent || '';
        
        // Update participants
        const newParticipants = [
          email.from,
          ...(typeof email.to === 'string' ? [email.to] : email.to || []),
          ...(typeof email.cc === 'string' ? [email.cc] : email.cc || [])
        ].filter(Boolean).map(addr => addr.split('@')[0]);
        
        thread.participants = Array.from(new Set([...thread.participants, ...newParticipants]));
      }
    });
  
    return Array.from(threadMap.values())
      .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
  };
  
  export const mergeEmails = (oldEmails: FullEmail[], newEmails: FullEmail[]): FullEmail[] => {
    const emailMap = new Map<string, FullEmail>();
    
    oldEmails.forEach(email => {
      emailMap.set(email.id, email);
    });
    
    newEmails.forEach(email => {
      emailMap.set(email.id, email);
    });
    
    return Array.from(emailMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };
  
  export const decodeGmailContent = (content: string): string => {
    try {
      return decodeURIComponent(
        atob(content.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch (e) {
      console.error('Error decoding Gmail content:', e);
      return content;
    }
  };
  
  export const processGmailHtml = (htmlContent: string): string => {
    // Remove Gmail's quote markers (using [\s\S] instead of . with s flag)
    let processed = htmlContent.replace(/<div class="gmail_quote"[\s\S]*?>[\s\S]*?<\/div>/g, '');
    
    // Handle Gmail-specific image proxying
    processed = processed.replace(
      /src="cid:([^"]+)"/g,
      'src="data:image/jpeg;base64,$1"'
    );
    
    // Remove Gmail's extra spacing divs (using [\s\S] instead of . with s flag)
    processed = processed.replace(/<div class="gmail_extra">[\s\S]*?<\/div>/g, '');
    
    return processed;
  };