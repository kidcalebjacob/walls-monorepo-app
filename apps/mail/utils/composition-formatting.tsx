// utils/composition-formatting.tsx

/**
 * Encode a subject line for use in email headers (RFC 2047).
 * Non-ASCII characters (e.g. é, ñ) must be encoded or they can appear as mojibake (e.g. Ã©).
 */
export function encodeSubjectForHeader(subject: string): string {
  if (!subject) return subject;
  // Pure ASCII does not require encoding
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

interface EmailHeaders {
    'Message-ID'?: string;
    'References'?: string;
    'In-Reply-To'?: string;
    'X-Gm-Schedule-Time'?: string;
    [key: string]: string | undefined;
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
  
  interface EmailRequestBody {
    raw: string;
    threadId?: string;
    labelIds?: string[];
    payload: {
      headers: {
        name: string;
        value: string;
      }[];
    };
  }
  
  export function formatEmailContent({
    to,
    cc,
    bcc,
    subject,
    message,
    formattedFromName,
    userEmail,
    headers,
    attachments
  }: FormatEmailParams): string {
    const boundary = 'foo_bar_baz';
    const emailLines = [
      `To: ${to}`,
      `From: =?UTF-8?B?${Buffer.from(formattedFromName).toString('base64')}?= <${userEmail}>`,
      `Subject: ${encodeSubjectForHeader(subject)}`,
      'Content-Type: multipart/related; boundary="' + boundary + '"',
      'MIME-Version: 1.0',
      '',
      '--' + boundary,
      'Content-Type: text/html; charset="UTF-8"',
      'MIME-Version: 1.0',
      'Content-Transfer-Encoding: 7bit',
      '',
      message,
      '',
    ];
  
    if (cc && cc.trim()) {
      emailLines.splice(3, 0, `Cc: ${cc}`);
    }
    if (bcc && bcc.trim()) {
      emailLines.splice(3, 0, `Bcc: ${bcc}`);
    }
  
    if (headers) {
      // Handle specific headers with special formatting
      if (headers['Message-ID']) {
        emailLines.splice(3, 0, `Message-ID: ${headers['Message-ID']}`);
      }
      if (headers['References']) {
        emailLines.splice(3, 0, `References: ${headers['References'].split(' ')
          .map(id => id.includes('@mail.gmail.com') ? `<${id}>` : `<${id}@mail.gmail.com>`)
          .join(' ')}`);
      }
      if (headers['In-Reply-To']) {
        const replyTo = headers['In-Reply-To'].includes('@mail.gmail.com') 
          ? `<${headers['In-Reply-To']}>`
          : `<${headers['In-Reply-To']}@mail.gmail.com>`;
        emailLines.splice(3, 0, `In-Reply-To: ${replyTo}`);
      }
      
      // Handle all other custom headers
      const specialHeaders = ['Message-ID', 'References', 'In-Reply-To'];
      Object.entries(headers).forEach(([key, value]) => {
        if (!specialHeaders.includes(key) && value) {
          emailLines.splice(3, 0, `${key}: ${value}`);
        }
      });
    }
  
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        const base64Data = Buffer.from(new Uint8Array(attachment.data)).toString('base64');
        emailLines.push('--' + boundary);
        emailLines.push(`Content-Type: ${attachment.type}; name="${attachment.name}"`);
        emailLines.push('MIME-Version: 1.0');
        emailLines.push('Content-Transfer-Encoding: base64');
        emailLines.push(`Content-Disposition: attachment; filename="${attachment.name}"`);
        emailLines.push('');
        emailLines.push(base64Data);
        emailLines.push('');
      }
    }
  
    emailLines.push('--' + boundary + '--');
  
    const email = emailLines.join('\r\n');
    
    return Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

// Convert Gmail format back to editor format (for loading saved content)
export function prepareForEditor(html: string): string {
  if (!html) return '<p></p>';
  
  let editorHtml = html;
  
  // Remove the outer dir="ltr" wrapper if present
  editorHtml = editorHtml.replace(/<div[^>]*dir="ltr"[^>]*>([\s\S]*)<\/div>$/i, '$1');
  
  // Convert Gmail divs to paragraphs
  // First, handle empty divs with br (these are single line breaks in Gmail)
  editorHtml = editorHtml.replace(/<div><br\s*\/?><\/div>/gi, '<p></p>');
  editorHtml = editorHtml.replace(/<div>\s*<\/div>/gi, '<p></p>');
  
  // Convert remaining divs to paragraphs
  editorHtml = editorHtml.replace(/<div([^>]*)>/gi, '<p$1>');
  editorHtml = editorHtml.replace(/<\/div>/gi, '</p>');
  
  // Clean up: collapse consecutive empty paragraphs into one
  // In Gmail, <div><br></div> is ONE line break, but TipTap shows each <p></p> as a line
  editorHtml = editorHtml.replace(/(<p[^>]*>\s*<\/p>\s*){2,}/g, '<p></p>');
  
  // If empty, return default
  if (!editorHtml.trim() || editorHtml.trim() === '<p></p>') {
    return '<p></p>';
  }
  
  return editorHtml;
}

// Gmail HTML transformation function
export function transformToGmailFormat(html: string): string {
  let transformedHtml = html;

  // Step 1: Clean up any existing div structures (from pasted content)
  // Convert divs to paragraphs first for consistent processing
  transformedHtml = transformedHtml.replace(/<div[^>]*>/gi, '<p>');
  transformedHtml = transformedHtml.replace(/<\/div>/gi, '</p>');

  // Step 2: Clean up multiple consecutive br tags
  transformedHtml = transformedHtml.replace(/(<br\s*\/?>\s*){2,}/gi, '</p><p>');

  // Step 3: Collapse consecutive empty paragraphs (two become one)
  transformedHtml = transformedHtml.replace(/(<p[^>]*>\s*<\/p>\s*){2,}/g, '<p></p>');
  transformedHtml = transformedHtml.replace(/(<p[^>]*>\s*<br\s*\/?>\s*<\/p>\s*){2,}/g, '<p><br></p>');

  // Step 4: Clean up whitespace between tags
  transformedHtml = transformedHtml.replace(/>\s+</g, '><');

  // Step 5: Convert to Gmail's div structure
  transformedHtml = transformedHtml
    .replace(/<p[^>]*>/g, '<div>')
    .replace(/<\/p>/g, '</div>')
    // Use [\s\S] so multiline HTML (e.g. a multi-line <a> tag) is not truncated — .* does not match newlines.
    .replace(/^(?!<div[^>]*dir="ltr")([\s\S]*)/, '<div dir="ltr">$1</div>')
    .replace(/<div>\s*<\/div>/g, '<div><br></div>')
    .replace(/<div>(\s*)<\/div>/g, '<div><br></div>')
    .replace(/<div>(<div[^>]*>)/g, '$1')
    .replace(/<\/div>(<\/div>)/g, '$1');

  return transformedHtml;
}

// Update the prepareEmailRequest function to use the transformed HTML
export function prepareEmailRequest({
  to,
  cc,
  bcc,
  subject,
  message,
  formattedFromName,
  userEmail,
  headers,
  attachments,
  threadId,
  scheduledTime
}: FormatEmailParams): EmailRequestBody {
  // Transform the HTML message before encoding
  const gmailFormattedMessage = transformToGmailFormat(message);

  // Format the email content with transformed message
  const encodedEmail = formatEmailContent({
    to,
    cc,
    bcc,
    subject,
    message: gmailFormattedMessage,
    formattedFromName,
    userEmail,
    headers: scheduledTime ? {
      ...headers,
      'X-Gm-Schedule-Time': new Date(scheduledTime).getTime().toString()
    } : headers,
    attachments
  });

  // Prepare the request body
  const requestBody: EmailRequestBody = {
    raw: encodedEmail,
    ...(threadId && { threadId }),
    payload: {
      headers: [
        {
          name: 'From',
          value: `"${formattedFromName}" <${userEmail}>`
        }
      ]
    }
  };

  // If it's a scheduled email, add the SCHEDULED label
  if (scheduledTime) {
    requestBody.labelIds = ['SCHEDULED'];
  }

  return requestBody;
}

// Helper function to format sender name
export function formatSenderName(user: { displayName?: string; email: string }): string {
  return user.displayName || user.email.split('@')[0].split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
} 