import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmail';
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";

function isGmailNotFound(err: unknown): boolean {
  const e = err as { status?: number; code?: number };
  return e?.status === 404 || e?.code === 404;
}

export async function POST(request: Request) {
  try {
    const { threadId, userEmail } = await request.json();

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

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .maybeSingle();
    const userId = userRow?.id ?? supabaseUser.id;
    const { data: threadRow } = await supabase
      .from('email_threads')
      .select('id')
      .eq('user_id', userId)
      .eq('provider_thread_id', threadId)
      .maybeSingle();

    let alreadyUnreadInGmail = false;
    const gmail = await getGmailClient(user.email);

    try {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId
      });
      alreadyUnreadInGmail = thread.data.messages?.some(msg => msg.labelIds?.includes('UNREAD')) ?? false;
      if (!alreadyUnreadInGmail) {
        await gmail.users.threads.modify({
          userId: 'me',
          id: threadId,
          requestBody: { addLabelIds: ['UNREAD'] }
        });
      }
    } catch (error) {
      if (isGmailNotFound(error)) {
        // Thread hard-deleted in Gmail; proceed with DB-only update
      } else {
        console.error('Gmail API Error:', error);
        return NextResponse.json(
          { error: 'Failed to modify thread labels' },
          { status: 500 }
        );
      }
    }

    if (threadRow) {
      await supabase.from('email_threads').update({ is_read: false }).eq('id', threadRow.id);
      await supabase
        .from('email_messages')
        .update({ is_read: false })
        .eq('thread_id', threadRow.id);
    }

    return NextResponse.json({ success: true, alreadyUnread: alreadyUnreadInGmail });
  } catch (error) {
    console.error('Error marking thread as unread:', error);
    return NextResponse.json(
      { error: 'Failed to mark thread as unread' },
      { status: 500 }
    );
  }
}