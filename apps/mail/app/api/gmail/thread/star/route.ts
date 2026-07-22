import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmail';
import { createClient } from '@/lib/supabase/server';

function isGmailNotFound(err: unknown): boolean {
  const e = err as { status?: number; code?: number };
  return e?.status === 404 || e?.code === 404;
}

export async function POST(req: Request) {
  try {
    const { email, threadId, starred } = await req.json();

    const supabase = await createClient();
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !supabaseUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    const userId = userRow?.id ?? supabaseUser.id;
    const { data: threadRow } = await supabase
      .from('email_threads')
      .select('id')
      .eq('user_id', userId)
      .eq('provider_thread_id', threadId)
      .maybeSingle();

    const gmail = await getGmailClient(email);
    try {
      if (starred) {
        await gmail.users.threads.modify({
          userId: 'me',
          id: threadId,
          requestBody: { addLabelIds: ['STARRED'] },
        });
      } else {
        await gmail.users.threads.modify({
          userId: 'me',
          id: threadId,
          requestBody: { removeLabelIds: ['STARRED'] },
        });
      }
    } catch (error) {
      if (isGmailNotFound(error)) {
        // Thread hard-deleted in Gmail; proceed with DB-only update
      } else {
        console.error('Gmail API Error:', error);
        return NextResponse.json(
          { error: 'Failed to modify thread' },
          { status: 500 }
        );
      }
    }

    if (threadRow) {
      await supabase.from('email_threads').update({ is_starred: !!starred }).eq('id', threadRow.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error modifying thread:', error);
    return NextResponse.json(
      { error: 'Failed to modify thread' },
      { status: 500 }
    );
  }
}