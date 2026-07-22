import { getGmailClient } from '@/lib/gmail';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function isGmailNotFound(err: unknown): boolean {
  const e = err as { status?: number; code?: number };
  return e?.status === 404 || e?.code === 404;
}

export async function POST(request: Request) {
  try {
    const { threadId, userEmail } = await request.json();

    if (!threadId || !userEmail) {
      return NextResponse.json(
        { error: 'Thread ID and user email are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .maybeSingle();

    const gmail = await getGmailClient(userEmail);
    try {
      await gmail.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: { addLabelIds: ['INBOX'] },
      });
    } catch (error) {
      if (isGmailNotFound(error)) {
        // Thread hard-deleted in Gmail; proceed with DB-only update
      } else {
        console.error('Gmail API Error:', error);
        return NextResponse.json(
          { error: 'Failed to unarchive thread' },
          { status: 500 }
        );
      }
    }

    if (!userError && userRow?.id) {
      await supabase
        .from('email_threads')
        .update({ category: 'primary' })
        .eq('user_id', userRow.id)
        .eq('provider_thread_id', threadId);
    } else {
      console.warn('[gmail unarchive] could not resolve users.id for email_threads update', {
        userEmail,
        error: userError?.message,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unarchiving thread:', error);
    return NextResponse.json(
      { error: 'Failed to unarchive thread' },
      { status: 500 }
    );
  }
}
