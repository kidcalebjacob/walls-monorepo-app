// app/api/gmail/reply/route.ts
import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmail';
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";
import { formatEmailContent } from '@/utils/reply-formatting';

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
      content,
      threadId,
      inReplyTo,
      references,
      to,
      cc,
      subject,
    } = await req.json();

    const gmail = await getGmailClient(user.email);

    const { data: userData } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('email', user.email)
      .single();

    const firstName = userData?.first_name || '';
    const lastName = userData?.last_name || '';
    const formattedFromName = `${firstName} ${lastName}`.trim() || user.email;

    // Get the thread to ensure proper message ID chaining
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    // Get all message IDs in the thread for the References header
    const messageIds = thread.data.messages?.map(msg => {
      const msgIdHeader = msg.payload?.headers?.find(h => h.name === 'Message-ID')?.value;
      return msgIdHeader || `<${msg.id}@mail.gmail.com>`;
    }) || [];

    // Use the inReplyTo from the client (the specific clicked message's ID) when available.
    // Only fall back to the last thread message if the client didn't send one.
    const lastMessage = thread.data.messages?.[thread.data.messages.length - 1];
    const lastMessageId = lastMessage?.payload?.headers?.find(h => h.name === 'Message-ID')?.value
      || `<${lastMessage?.id}@mail.gmail.com>`;
    const effectiveInReplyTo = inReplyTo || lastMessageId;

    // Create email headers
    const newMessageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${user.email.split('@')[1]}>`;
    const emailHeaders = {
      'Message-ID': newMessageId,
      'References': references || messageIds.join(' '),
      'In-Reply-To': effectiveInReplyTo
    };

    // Format the email content with proper headers for threading
    const formattedEmail = formatEmailContent({
      to,
      cc,
      subject,
      message: content,
      formattedFromName,
      userEmail: user.email,
      headers: emailHeaders,
      threadId
    });

    // Send the email as part of the thread
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: formattedEmail,
        threadId
      }
    });

    // Persist the sent reply to Supabase so it appears in the email_messages table
    if (response.data.id && response.data.threadId) {
      try {
        // Look up the email_thread by its Gmail provider_thread_id
        const { data: emailThread } = await supabase
          .from('email_threads')
          .select('id')
          .eq('provider_thread_id', response.data.threadId)
          .maybeSingle();

        if (emailThread?.id) {
          await supabase.from('email_messages').insert({
            thread_id: emailThread.id,
            provider_thread_id: response.data.threadId,
            provider_message_id: response.data.id,
            from: user.email,
            subject: subject || null,
            status: 'sent',
            rfc_message_id: newMessageId,
            received_at: new Date().toISOString(),
          });
        }
      } catch (dbErr) {
        // Non-fatal: log but don't fail the response since the email was already sent
        console.error('Error persisting sent reply to Supabase:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      threadId: response.data.threadId,
      messageId: response.data.id
    });

  } catch (error) {
    console.error('Error sending reply:', error);
    return NextResponse.json(
      { error: 'Failed to send reply', details: error.message },
      { status: 500 }
    );
  }
}