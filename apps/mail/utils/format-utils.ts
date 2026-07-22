// utils/format-utils.ts
import { Thread } from '@/types/email.types';

interface FormattedEmail {
  mainContent: string;
  signature: string | null;
  quotedContent: string | null;
}

/**
 * Formats bytes into human readable string
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Formats a date for the email preview list
 */
export const formatPreviewDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (days === 0) {
    // Today - show time
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    // Within a week - show day name
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else if (weeks < 4) {
    // Within a month - show week count
    return `${weeks}w ago`;
  } else if (months < 6) {
    // Within 6 months - show month and day
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } else {
    // Older - show full date
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
};

/**
 * Formats a date for the email detail view
 */
export const formatDetailedDate = (dateString: string): string => {
  const date = new Date(dateString);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${weekday}, ${month} ${day}, ${time}`;
};

/**
 * Extracts a display name from an email string
 */
export const extractNameFromEmail = (emailString: string | undefined): string => {
  if (!emailString) return 'Unknown';

  // Try to extract name from format: "Display Name <email@example.com>"
  const match = emailString.match(/^([^<]+)</);
  if (match) {
    return match[1].trim();
  }

  // If no display name, format the email username
  const username = emailString.split('@')[0];
  return username
    .split(/[.+]/) // Split by dots or plus signs
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Extracts email addresses from a string
 */
export const extractEmailAddresses = (emailString: string): string[] => {
  if (!emailString) return [];

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  return emailString.match(emailRegex) || [];
};

/**
 * Gets initials from a name string
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Cleans a subject line by removing common prefixes
 */
export const cleanSubject = (subject: string): string => {
  return subject.replace(/^(Re:|RE:|re:|FWD:|Fwd:|fwd:)\s+/g, '');
};

/**
 * Formats an email address list for display
 */
export const formatEmailList = (emails: string[], limit: number = 2): string => {
  if (emails.length === 0) return '';
  if (emails.length <= limit) return emails.join(', ');
  
  const displayEmails = emails.slice(0, limit);
  const remaining = emails.length - limit;
  return `${displayEmails.join(', ')} ${remaining > 0 ? `and ${remaining} more` : ''}`;
};

/**
 * Formats a timestamp relative to now (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return formatPreviewDate(dateString);
};

/**
 * Formats a number with abbreviated suffixes (e.g., 1.2K, 1.2M)
 */
export const formatNumber = (num: number): string => {
  if (num < 1000) return num.toString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  return `${(num / 1000000).toFixed(1)}M`;
};

/**
 * Formats a thread participant list
 */
export const getThreadParticipants = (thread: Thread, currentUserEmail: string): string[] => {
  const participants = new Set<string>();

  if (thread.from) {
    const fromEmail = extractEmailAddresses(thread.from)[0];
    if (fromEmail !== currentUserEmail) {
      participants.add(extractNameFromEmail(thread.from));
    }
  }

  // Handle 'to' field which can now be string or string[]
  if (thread.to) {
    const toList = Array.isArray(thread.to) ? thread.to : [thread.to];
    toList.forEach(recipient => {
      const email = extractEmailAddresses(recipient)[0];
      if (email !== currentUserEmail) {
        participants.add(extractNameFromEmail(recipient));
      }
    });
  }

  const participantsArray = Array.from(participants);
  return participantsArray.length === 0 ? ['Unknown'] : participantsArray;
};

export const formatParticipants = (
  participants: string[],
  currentUser: string,
  limit: number = 3
): string => {
  const otherParticipants = participants.filter(p => p !== currentUser);
  
  if (otherParticipants.length === 0) return 'No participants';
  if (otherParticipants.length <= limit) return otherParticipants.join(', ');
  
  return `${otherParticipants.slice(0, limit).join(', ')} and ${otherParticipants.length - limit} others`;
};

/**
 * Formats email content for display
 */
export const formatEmailContent = (content: string): string => {
  if (!content) return '';

  // Split at the thread marker
  const threadMarkerRegex = /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}(?:\s+at\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)\s+.*?wrote:/i;
  const parts = content.split(threadMarkerRegex);
  
  // Take only the first part (current message)
  const currentMessage = parts[0];

  return currentMessage
    // First, normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    
    // Handle HTML content
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    
    // Remove any remaining HTML tags
    .replace(/<[^>]+>/g, '')
    
    // Handle HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    
    // Normalize whitespace while preserving intentional line breaks
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Extracts quoted content from a string
 */
export const getQuotedContent = (content: string): string[] => {
  if (!content) return [];

  const threadMarkerRegex = /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}(?:\s+at\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)\s+.*?wrote:/i;
  
  // Split the content into separate messages
  const messages = content.split(threadMarkerRegex)
    .map(message => message.trim())
    .filter(Boolean);  // Remove empty strings

  // If there's only one message (no thread marker found), return empty array
  if (messages.length <= 1) return [];

  // Return all messages except the first one (current message)
  return messages.slice(1).map(message => 
    message
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  );
};