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

    const gmail = await getGmailClient(user.email);
    try {
      await gmail.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: {
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX']
        }
      });
    } catch (error) {
      if (isGmailNotFound(error)) {
        // Thread hard-deleted in Gmail; proceed with DB-only update
      } else {
        console.error('Gmail API Error:', error);
        return NextResponse.json(
          { error: 'Failed to move thread to trash' },
          { status: 500 }
        );
      }
    }

    const { data: thread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('provider_thread_id', threadId)
      .eq('user_id', userId)
      .maybeSingle();

    if (thread) {
      await supabase
        .from('email_threads')
        .update({ category: 'trash' })
        .eq('id', thread.id);

      const { data: messages } = await supabase
        .from('email_messages')
        .select('id')
        .eq('thread_id', thread.id);

      if (messages && messages.length > 0) {
        const messageIds = messages.map(m => m.id);
        await supabase
          .from('email_message_labels')
          .delete()
          .in('message_id', messageIds)
          .eq('label', 'INBOX');
        const trashLabels = messageIds.map(messageId => ({
          message_id: messageId,
          label: 'TRASH'
        }));
        await supabase
          .from('email_message_labels')
          .upsert(trashLabels, {
            onConflict: 'message_id,label',
            ignoreDuplicates: true
          });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error moving thread to trash:', error);
    return NextResponse.json(
      { error: 'Failed to move thread to trash' },
      { status: 500 }
    );
  }
} 