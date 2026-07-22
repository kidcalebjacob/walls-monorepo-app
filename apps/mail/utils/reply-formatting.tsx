// utils/reply-formatting.ts
import { transformToGmailFormat, encodeSubjectForHeader } from './composition-formatting';
import escapeHtml from 'escape-html';

interface EmailHeaders {
  'Message-ID'?: string;
  'References'?: string;
  'In-Reply-To'?: string;
  'X-Gm-Schedule-Time'?: string;
}

interface EmailAttachment {
  data: number[];
  type: string;
  name: string;
}

interface FormatEmailParams {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  message: string;
  formattedFromName: string;
  userEmail: string;
  headers?: EmailHeaders;
  attachments?: EmailAttachment[];
  threadId?: string;
  scheduledTime?: string;
}

// Helper Functions
function extractEmailAddress(formattedEmail: string): string {
  // Match email address within angle brackets
  const emailMatch = formattedEmail.match(/<([^>]+)>/);
  if (emailMatch) {
    return emailMatch[1]; // Return just the email address
  }
  
  // If no angle brackets, check if the string is just an email
  const basicEmailMatch = formattedEmail.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (basicEmailMatch) {
    return basicEmailMatch[0];
  }
  
  return formattedEmail; // Return original if no email found
}

function normalizeEmailHtml(content: string): string {
  // Don't process if it contains gmail_quote
  if (content.includes('gmail_quote')) {
    return content;
  }

  return content
    // Convert paragraphs to divs
    .replace(/<p[^>]*>/g, '<div>')
    .replace(/<\/p>/g, '</div>')
    // Handle line breaks
    .replace(/\n/g, '<br>')
    .replace(/(<br\s*\/?>\s*){2,}/g, '<div><br></div>')
    // Handle empty divs
    .replace(/<div>\s*<\/div>/g, '<div><br></div>')
    .replace(/<div>(\s*)<\/div>/g, '<div><br></div>')
    // Clean up nested divs
    .replace(/<div>(<div[^>]*>)/g, '$1')
    .replace(/<\/div>(<\/div>)/g, '$1')
    // Remove any existing dir attributes
    .replace(/dir="ltr"/g, '')
    // Remove empty signatures
    .replace(/<div[^>]*(?:class="gmail_signature"|data-smartmail="gmail_signature")[^>]*>(?:[^<]*|<(?!\/div>)[^<]*)*<\/div>/g, '')
    .replace(/<span[^>]*>\s*(?:<div[^>]*>\s*<\/div>)*\s*<\/span>/g, '');
}

function getFullThreadContent(originalMessage: string): string {
  // Return the original message as-is to preserve Gmail's HTML structure
  return originalMessage;
}

// Thread Content Formatting
export function formatThreadContent(originalMessage: string, replyToEmail: string): string {
  const date = new Date();
  const formattedDate = date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const formattedTime = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });

  // Create the attribution line and quote container with spacing
  const spacingDiv = '<div><br></div>';
  const attributionLine = `<div dir="ltr" class="gmail_attr">On ${formattedDate} at ${formattedTime}, ${escapeHtml(replyToEmail)} wrote:</div>`;
  const quoteContainer = `<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">`;

  // Simply wrap the entire original message in our new quote container
  return `${spacingDiv}${attributionLine}${quoteContainer}${originalMessage}</blockquote>`;
}

// Create a reply with proper Gmail threading
export function createThreadedReply(newContent: string, replyTo: any): string {
  // Transform the new content to Gmail format
  const transformedContent = transformToGmailFormat(newContent);
  
  if (!replyTo?.originalMessage) {
    return transformedContent;
  }

  // Decode the base64 content if it exists
  const decodedOriginalMessage = replyTo.originalMessage instanceof Buffer 
    ? replyTo.originalMessage.toString()
    : typeof replyTo.originalMessage === 'string' && replyTo.originalMessage.startsWith('base64:')
      ? Buffer.from(replyTo.originalMessage.slice(7), 'base64').toString()
      : replyTo.originalMessage;

  // Get the reply-to email from the replyTo object - use 'to' as it contains the original sender's address
  const replyToEmail = replyTo.to || '';

  // Format the thread content with proper attribution and quoting
  const formattedThread = formatThreadContent(decodedOriginalMessage, replyToEmail);

  // Combine the new content with the formatted thread
  return `<div>${transformedContent}</div>${formattedThread}`;
}

// Format sender name consistently
export function formatSenderName(user: { displayName?: string; email: string }): string {
  return user.displayName || user.email.split('@')[0].split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Format email content for sending
export function formatEmailContent({
  to,
  cc,
  bcc,
  subject,
  message,
  formattedFromName,
  userEmail,
  headers,
  attachments,
  scheduledTime
}: FormatEmailParams): string {
  const boundary = 'foo_bar_baz';
  const emailLines = [
    `To: ${to}`,
    `From: =?UTF-8?B?${Buffer.from(formattedFromName).toString('base64')}?= <${userEmail}>`,
    `Subject: ${encodeSubjectForHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'Content-Type: multipart/related; boundary="' + boundary + '"',
    'MIME-Version: 1.0'
  ];

  if (cc) emailLines.push(`Cc: ${cc}`);
  if (bcc) emailLines.push(`Bcc: ${bcc}`);
  if (headers) {
    if (headers['Message-ID']) emailLines.push(`Message-ID: ${headers['Message-ID']}`);
    if (headers['References']) emailLines.push(`References: ${headers['References']}`);
    if (headers['In-Reply-To']) emailLines.push(`In-Reply-To: ${headers['In-Reply-To']}`);
  }

  emailLines.push(
    '',
    '--' + boundary,
    'Content-Type: text/html; charset="UTF-8"',
    'MIME-Version: 1.0',
    'Content-Transfer-Encoding: 7bit',
    '',
    message,
    ''
  );

  if (attachments?.length) {
    for (const attachment of attachments) {
      const base64Data = Buffer.from(new Uint8Array(attachment.data)).toString('base64');
      emailLines.push(
        '--' + boundary,
        `Content-Type: ${attachment.type}; name="${attachment.name}"`,
        'MIME-Version: 1.0',
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.name}"`,
        '',
        base64Data,
        ''
      );
    }
  }

  emailLines.push('--' + boundary + '--');
  
  return Buffer.from(emailLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}