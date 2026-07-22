import { NextRequest } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
    });
  }

  try {
    const gmail = await getGmailClient(email);
    
    await gmail.users.drafts.delete({
      userId: 'me',
      id: params.id,
    });

    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Error deleting draft:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete draft' }), {
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