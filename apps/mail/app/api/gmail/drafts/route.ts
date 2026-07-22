import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";
import { encodeSubjectForHeader } from "@/utils/composition-formatting";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
    });
  }

  try {
    const gmail = await getGmailClient(email);
    
    const response = await gmail.users.drafts.list({
      userId: 'me',
      maxResults: 20,
    });

    const drafts = await Promise.all(
      (response.data.drafts || []).map(async (draft) => {
        const draftDetails = await gmail.users.drafts.get({
          userId: 'me',
          id: draft.id!,
          format: 'full',
        });

        const message = draftDetails.data.message!;
        const headers = message.payload?.headers;
        
        return {
          id: draft.id,
          to: headers?.find(h => h.name === 'To')?.value || '',
          subject: headers?.find(h => h.name === 'Subject')?.value || '',
          message: message.snippet || '',
          snippet: message.snippet || '',
          date: headers?.find(h => h.name === 'Date')?.value || '',
          threadId: message.threadId,
          messageId: message.id,
        };
      })
    );

    return new Response(JSON.stringify({ drafts }));
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch drafts' }), {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
    });
  }

  try {
    const gmail = await getGmailClient(email);
    const { to, subject, message, threadId, messageId, draftId } = await request.json();
    
    // Create email content
    const emailContent = [
      'Content-Type: text/plain; charset="UTF-8"\n',
      'MIME-Version: 1.0\n',
      'Content-Transfer-Encoding: 7bit\n',
      `To: ${to}\n`,
      `Subject: ${encodeSubjectForHeader(subject)}\n`,
      '\n',
      message,
    ].join('');

    let draft;
    if (draftId) {
      // Update existing draft
      draft = await gmail.users.drafts.update({
        userId: 'me',
        id: draftId,
        requestBody: {
          message: {
            raw: Buffer.from(emailContent).toString('base64url'),
            threadId,
          },
        },
      });
    } else {
      // Create new draft
      draft = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: Buffer.from(emailContent).toString('base64url'),
            threadId,
          },
        },
      });
    }

    return new Response(JSON.stringify({ draftId: draft.data.id }));
  } catch (error) {
    console.error('Error creating/updating draft:', error);
    return new Response(JSON.stringify({ error: 'Failed to save draft' }), {
      status: 500,
    });
  }
}

async function getGmailClient(email: string) {
  const supabase = await createClient();
  const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !supabaseUser) {
    throw new Error('User not authenticated');
  }

  const user = toUser(supabaseUser);

  if (!user?.email) {
    throw new Error('User not authenticated');
  }

  // Get refresh token from Supabase
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('gmail_refresh_token')
    .eq('auth_id', user.id)
    .single();

  if (userError || !userData?.gmail_refresh_token) {
    throw new Error('No Gmail refresh token found');
  }

  const refreshToken = userData.gmail_refresh_token;

  // Initialize Gmail API
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  return gmail;
} 