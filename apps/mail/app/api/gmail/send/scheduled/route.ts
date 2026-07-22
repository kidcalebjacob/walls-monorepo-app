// app/api/gmail/schedule-send/route.ts 
import { NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";
import { formatEmailContent, formatSenderName, transformToGmailFormat } from "@/utils/composition-formatting";

// Function to generate the email signature
const generateSignature = (userData: { 
  displayName: string; 
  title: string; 
  department: string;
  email: string;
}) => `
<table cellpadding="0" cellspacing="0" border="0" style="width: 500px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #000; margin-top: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);">
  <tr>
    <td style="padding: 20px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <!-- Logo and Name Section -->
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td style="vertical-align: middle; width: 80px;">
                  <img src="https://www.wallsentertainment.com/images/emailSignature/logo.png" 
                       alt="WALLS Entertainment Logo" 
                       width="70" 
                       style="display: block;">
                </td>
                <td style="vertical-align: middle; padding-left: 14px;">
                  <div style="font-size: 17px; font-weight: 600; color: #000000; margin-bottom: 2px; letter-spacing: -0.2px;">
                    ${userData.displayName}
                  </div>
                  <div style="font-size: 13px; color: #1a1a1a; font-weight: 400; letter-spacing: -0.1px;">
                    WALLS Entertainment
                  </div>
                  <div style="font-size: 13px; color: #1a1a1a; font-weight: 400; letter-spacing: -0.1px;">
                    ${userData.title}, ${userData.department}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td>
            <div style="height: 1px; background-color: rgba(0, 0, 0, 0.2); margin: 16px 0;"></div>
          </td>
        </tr>

        <!-- Contact Info and Social Media Section -->
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td>
                  <!-- Contact Info -->
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="color: rgba(0,0,0,0.7); font-size: 12px; font-weight: 500; padding-right: 8px; font-family: 'SF Mono', Monaco, monospace;">E:</td>
                      <td>
                        <a href="mailto:${userData.email}" 
                           style="color: #000000; text-decoration: none; font-size: 12px; font-weight: 400;">
                          ${userData.email}
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="color: rgba(0,0,0,0.7); font-size: 12px; font-weight: 500; padding-right: 8px; font-family: 'SF Mono', Monaco, monospace;">P:</td>
                      <td style="color: #000000; font-size: 12px; font-weight: 400;">
                        647.767.6078
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- Social Media Icons -->
                <td style="text-align: right;">
                  <a href="https://www.wallsentertainment.com/" style="text-decoration: none; margin-left: 12px;">
                    <img src="https://www.wallsentertainment.com/images/emailSignature/website.png" 
                         alt="Website Social Icon" 
                         width="28" 
                         style="display: inline-block;">
                  </a>
                  <a href="https://www.linkedin.com/company/walls-entertainment/" style="text-decoration: none; margin-left: 12px;">
                    <img src="https://www.wallsentertainment.com/images/emailSignature/linkedin.png" 
                         alt="LinkedIn Social Icon" 
                         width="28" 
                         style="display: inline-block;">
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

// Function to clean and format text content
function formatTextContent(html: string): string {
  // Remove all HTML tags
  let text = html.replace(/<[^>]+>/g, ' ');
  
  // Replace multiple spaces, newlines, and special characters
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  
  // Fix spacing after punctuation
  text = text
    .replace(/([.!?])\s*([A-Za-z])/g, '$1 $2')  // Add space after periods, exclamation marks, and question marks
    .replace(/,\s*([A-Za-z])/g, ', $1');        // Add space after commas
  
  return text;
}

function formatSnippet(html: string): string {
  const text = formatTextContent(html);
  return text.substring(0, 150);
}

// Function to format date in RFC 2822 format with proper timezone
function formatEmailDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const values: { [key: string]: string } = {};
  parts.forEach(part => {
    values[part.type] = part.value;
  });

  // Get timezone offset for the specified timezone
  const timeZoneOffset = new Date(date).toLocaleTimeString('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset'
  }).split(' ').pop() || '+0000';

  return `${values.weekday}, ${values.day} ${values.month} ${values.year} ${values.hour}:${values.minute}:${values.second} ${timeZoneOffset}`;
}

// Function to update lastContacted field for contacts in Supabase
const updateLastContactedFields = async (recipientEmails: string[], scheduledTimestamp: Date) => {
  if (!recipientEmails.length) return;
  
  const supabase = await createClient();
  
  // Normalize emails for comparison
  const normalizedEmails = recipientEmails.map(email => email.trim().toLowerCase());
  console.log('Looking for these normalized emails:', normalizedEmails);
  
  try {
    // Helper function to check if an email matches any of our normalized emails
    const isEmailMatch = (email: string | undefined) => {
      if (!email) return false;
      return normalizedEmails.includes(email.trim().toLowerCase());
    };

    // Process contacts
    const { data: contacts } = await supabase.from('contacts').select('id, email');
    if (contacts) {
      for (const contact of contacts) {
        if (isEmailMatch(contact.email)) {
          console.log(`Found matching contact: ${contact.email}`);
          await supabase
            .from('contacts')
            .update({ last_contacted: scheduledTimestamp.toISOString() })
            .eq('id', contact.id);
        }
      }
    }

    // Process leads
    const { data: leads } = await supabase.from('leads').select('id, email');
    if (leads) {
      for (const lead of leads) {
        if (isEmailMatch(lead.email)) {
          console.log(`Found matching lead: ${lead.email}`);
          await supabase
            .from('leads')
            .update({ last_contacted: scheduledTimestamp.toISOString() })
            .eq('id', lead.id);
        }
      }
    }

    // Process scouter
    const { data: scouter } = await supabase.from('scouter').select('id, personal_email');
    if (scouter) {
      for (const scout of scouter) {
        if (isEmailMatch(scout.personal_email)) {
          console.log(`Found matching scouter: ${scout.personal_email}`);
          await supabase
            .from('scouter')
            .update({ last_contacted: scheduledTimestamp.toISOString() })
            .eq('id', scout.id);
        }
      }
    }
    
    console.log('Successfully updated lastContacted fields');
  } catch (error) {
    console.error('Error updating lastContacted fields:', error);
  }
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = toUser(supabaseUser);

    if (!user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { 
      to, 
      cc, 
      bcc, 
      subject, 
      message,
      scheduledTime,
      timezone,
      threadId, 
      headers, 
      attachments 
    } = await req.json();

    // Convert the timestamp data to a Date
    const scheduledDate = scheduledTime?.seconds 
      ? new Date(scheduledTime.seconds * 1000)
      : new Date(scheduledTime);
    const formattedDate = formatEmailDate(scheduledDate, timezone);

    // Prepare all recipient emails for updating lastContacted field
    const allRecipients = [
      ...to.split(',').map(email => email.trim()),
      ...(cc ? cc.split(',').map(email => email.trim()) : []),
      ...(bcc ? bcc.split(',').map(email => email.trim()) : [])
    ].filter(email => email.length > 0);
    
    // Update lastContacted field for all recipients in respective collections
    if (allRecipients.length > 0) {
      await updateLastContactedFields(allRecipients, scheduledDate);
    }

    // Generate a unique message ID
    const messageId = `scheduled-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Format the sender name
    const formattedFromName = formatSenderName(user);

    // Fetch user data from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, title, department, email')
      .eq('auth_id', user.id)
      .single();

    const userDataFormatted = userData ? {
      displayName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || user.email,
      title: userData.title || '',
      department: userData.department || '',
      email: user.email
    } : {
      displayName: user.displayName || user.email,
      title: '',
      department: '',
      email: user.email
    };

    // Check if message contains flashy signature placeholder and replace it
    let messageWithSignature = message;
    if (message.includes('{flashySignature}')) {
      messageWithSignature = message.replace('{flashySignature}', generateSignature({
        displayName: userDataFormatted.displayName,
        title: userDataFormatted.title,
        department: userDataFormatted.department,
        email: user.email
      }));
    }

    // Transform the message to Gmail format
    const gmailFormattedMessage = transformToGmailFormat(messageWithSignature);

    // Format attachments if present
    const formattedAttachments = attachments?.map((attachment: any) => ({
      filename: attachment.name,
      mimeType: attachment.type || 'application/octet-stream',
      attachmentId: `attachment-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      data: attachment.data
    })) || [];

    // Get the raw email content (we'll store this for when we actually send the email)
    const rawEmail = formatEmailContent({
      to,
      cc,
      bcc,
      subject,
      message: gmailFormattedMessage,
      formattedFromName,
      userEmail: user.email,
      headers: {
        ...headers,
        'Message-ID': `<${messageId}@scheduled.walls.app>`,
        'X-Gm-Schedule-Time': scheduledDate.getTime().toString()
      },
      attachments: formattedAttachments
    });

    // Create email document with same structure as Cloud Run function
    const emailData = {
      message_id: messageId,
      thread_id: threadId || messageId,
      label_ids: ['SCHEDULED'],
      snippet: formatSnippet(messageWithSignature),
      subject,
      from: `${formattedFromName} <${user.email}>`,
      to,
      cc: cc || '',
      bcc: bcc || '',
      date: formattedDate,
      scheduled_time: scheduledDate.toISOString(),
      timezone,
      html_content: gmailFormattedMessage,
      text_content: formatTextContent(messageWithSignature),
      attachments: formattedAttachments,
      user_email: user.email,
      timestamp: new Date().toISOString(),
      processed: false,
      headers: {
        ...headers,
        'Message-ID': `<${messageId}@scheduled.walls.app>`,
        'X-Gm-Schedule-Time': scheduledDate.getTime().toString()
      },
      is_scheduled: true,
      raw_email: rawEmail
    };

    // Store in Supabase
    const { error: insertError } = await supabase
      .from('scheduled_emails')
      .insert(emailData);
    
    if (insertError) throw insertError;

    return NextResponse.json({ 
      success: true, 
      messageId,
      scheduledTime: formattedDate
    });
  } catch (error) {
    console.error('Error scheduling email:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to schedule email' },
      { status: 500 }
    );
  }
} 