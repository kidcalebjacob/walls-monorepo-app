import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";

interface EmailAttachment {
  filename: string;
  mimeType: string;
  attachmentId: string;
}

interface EmailPart {
  mimeType: string;
  filename?: string;
  body: {
    data?: string;
    attachmentId?: string;
  };
  parts?: EmailPart[];
}

interface EmailHeader {
  name: string;
  value: string;
}

export async function POST(request: Request) {
  try {
    const { userEmail } = await request.json();

    // Validate authentication
    const supabase = await createClient();
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = toUser(supabaseUser);

    if (!user?.email || user.email !== userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's Gmail refresh token from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('gmail_refresh_token')
      .eq('email', userEmail)
      .single();

    if (userError || !userData?.gmail_refresh_token) {
      return NextResponse.json(
        { error: 'Gmail not connected' },
        { status: 400 }
      );
    }

    const refreshToken = userData.gmail_refresh_token;

    // Initialize Gmail API with all required scopes
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.settings.basic',
        'https://www.googleapis.com/auth/gmail.settings.sharing',
        'https://www.googleapis.com/auth/contacts'
      ].join(' ')
    });

    // Debug token scopes
    const credentials = await oauth2Client.getAccessToken();
    console.log('Current token scopes:', {
      accessToken: credentials.token?.substring(0, 10) + '...',
      scopes: await oauth2Client.getTokenInfo(credentials.token || '')
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    let newEmailsCount = 0;
    let pageToken: string | undefined;

    do {
      // Fetch messages in batches
      const messages = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        pageToken
      });

      if (!messages.data.messages) break;

      // Process each message
      for (const message of messages.data.messages) {
        // Check if email already exists in Supabase
        const { data: existingEmail } = await supabase
          .from('emails')
          .select('id')
          .eq('message_id', message.id)
          .eq('user_email', userEmail)
          .limit(1)
          .maybeSingle();

        if (existingEmail) continue;

        // Get full message details
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        if (!email.data.payload) continue;

        // Process email parts exactly like Cloud Run function
        const parts = email.data.payload.parts || [email.data.payload];
        let htmlContent = '';
        let textContent = '';
        const attachments: EmailAttachment[] = [];
        const allHtmlParts: string[] = [];
        const allTextParts: string[] = [];

        const processPart = (part: EmailPart) => {
          if (part.body?.data) {
            if (part.mimeType === 'text/html') {
              allHtmlParts.push(Buffer.from(part.body.data, 'base64').toString());
            } else if (part.mimeType === 'text/plain') {
              allTextParts.push(Buffer.from(part.body.data, 'base64').toString());
            }
          }

          if (part.filename && part.body?.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              attachmentId: part.body.attachmentId,
            });
          }

          if (part.parts) {
            part.parts.forEach(processPart);
          }
        };

        parts.forEach(processPart);

        // Combine all found content
        htmlContent = allHtmlParts.join('\n');
        textContent = allTextParts.join('\n');

        // Get headers
        const headers = email.data.payload.headers || [];
        const getHeader = (name: string): string => {
          const header = headers.find(h => h.name === name);
          return header?.value || '';
        };

        // Store email in Supabase with exact same fields as Cloud Run
        const emailData = {
          message_id: email.data.id || '',
          thread_id: email.data.threadId || '',
          label_ids: email.data.labelIds || [],
          snippet: email.data.snippet || '',
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          cc: getHeader('Cc'),
          date: getHeader('Date'),
          html_content: htmlContent,
          text_content: textContent,
          attachments: attachments,
          user_email: userEmail,
          timestamp: new Date(parseInt(email.data.internalDate || Date.now().toString())).toISOString(),
          unread: email.data.labelIds?.includes('UNREAD') || false,
          processed: true,
          processed_at: new Date().toISOString(),
        };

        // Store the processed email
        const { error: insertError } = await supabase
          .from('emails')
          .upsert(emailData, { onConflict: 'message_id' });
        
        if (insertError) {
          console.error('Error inserting email:', insertError);
          continue;
        }
        
        newEmailsCount++;
      }

      pageToken = messages.data.nextPageToken;
    } while (pageToken && newEmailsCount < 1000); // Limit to 1000 emails per sync to avoid timeouts

    return NextResponse.json({ 
      success: true,
      newEmailsCount,
      message: `Successfully synced ${newEmailsCount} new emails`
    });

  } catch (error) {
    console.error('Error syncing emails:', error);
    return NextResponse.json(
      { error: 'Failed to sync emails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
