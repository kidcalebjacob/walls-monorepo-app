"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { fetchThreadDetailFromSupabase } from "@/lib/agentMail/supabase-email";
import { Thread } from "@/types/email.types";
import { Loader2, Mail } from "lucide-react";
import { formatPreviewDate, cleanSubject, getThreadParticipants } from "@/utils/format-utils";
import { decodeHtmlEntities } from "@/utils/email-utils";
import { cn } from "@/lib/utils";
import EmailPreview from "@/components/agentMail/email-preview";
import { FallbackEmailAvatar } from "@/components/agentMail/ui/fallback-email-avatar";

interface ConversationsProps {
  dealId: string;
}

type MessageMeta = {
  from: string;
  fromName: string | null;
  fromAvatarUrl: string | null;
  messagesCount: number;
};

function buildMessageMeta(
  messages: Array<{
    thread_id: string | null;
    from: string | null;
    from_name: string | null;
    from_avatar_url: string | null;
    received_at: string | null;
    created_at: string | null;
  }>
): Map<string, MessageMeta> {
  const countByThread = new Map<string, number>();
  const latestByThread = new Map<string, (typeof messages)[0]>();
  const msgTime = (m: (typeof messages)[0]) =>
    new Date(m.received_at ?? m.created_at ?? 0).getTime();

  for (const m of messages) {
    if (!m.thread_id) continue;
    countByThread.set(m.thread_id, (countByThread.get(m.thread_id) ?? 0) + 1);
    const existing = latestByThread.get(m.thread_id);
    if (!existing || msgTime(m) > msgTime(existing)) {
      latestByThread.set(m.thread_id, m);
    }
  }

  const meta = new Map<string, MessageMeta>();
  latestByThread.forEach((latest, threadId) => {
    meta.set(threadId, {
      from: latest.from ?? "",
      fromName: latest.from_name?.trim() || null,
      fromAvatarUrl: latest.from_avatar_url || null,
      messagesCount: countByThread.get(threadId) ?? 1,
    });
  });
  return meta;
}

function ConversationCard({
  thread,
  userEmail,
  onSelect,
}: {
  thread: Thread;
  userEmail: string;
  onSelect: (thread: Thread) => void;
}) {
  const [avatarImgError, setAvatarImgError] = useState(false);
  const participants = getThreadParticipants(thread, userEmail);
  const otherParticipant = thread.fromName ?? participants[0] ?? "Unknown";
  const showAvatarImg = !!thread.fromAvatarUrl && !avatarImgError;

  return (
    <button
      type="button"
      onClick={() => onSelect(thread)}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-2xl p-3.5 text-left",
        "border border-white/30 shadow-lg transition-all duration-150",
        "hover:border-white/50",
        thread.unread ? "bg-white/80" : "bg-white/5"
      )}
    >
      <div className="relative shrink-0 mt-0.5 w-10 h-10">
        {showAvatarImg ? (
          <Image
            src={thread.fromAvatarUrl!}
            alt={otherParticipant}
            width={40}
            height={40}
            className="w-full h-full rounded-full object-cover"
            onError={() => setAvatarImgError(true)}
          />
        ) : (
          <FallbackEmailAvatar name={otherParticipant} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {thread.unread && (
              <span className="w-2 h-2 rounded-full bg-kenoo-lime shrink-0 shadow-[0_0_5px_rgba(206,255,0,0.7)]" />
            )}
            <span
              className={cn(
                "text-sm truncate",
                thread.unread ? "font-light text-neutral-900" : "font-light text-neutral-500"
              )}
            >
              {otherParticipant}
            </span>
            {thread.messagesCount > 1 && (
              <span className="text-xs text-neutral-400 shrink-0 font-normal">
                {thread.messagesCount}
              </span>
            )}
          </div>
        </div>

        <div className="mt-0.5 truncate">
          <span className="text-[13px] leading-snug font-normal text-neutral-600">
            {cleanSubject(thread.subject)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-xs text-neutral-400 truncate leading-relaxed flex-1 min-w-0">
            {decodeHtmlEntities(thread.snippet)}
          </span>
          <span className="text-xs font-light text-neutral-400 shrink-0 whitespace-nowrap">
            {formatPreviewDate(thread.lastMessageDate)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function Conversations({ dealId }: ConversationsProps) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  const userEmail = user?.email ?? "";

  useEffect(() => {
    if (!user?.id) return;

    const fetchThreads = async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from("email_threads")
          .select(
            "id, provider_thread_id, subject, last_message_at, deal_id, is_read, is_starred, latest_snippet, category"
          )
          .eq("deal_id", dealId)
          .order("last_message_at", { ascending: false });

        if (!data?.length) {
          setThreads([]);
          return;
        }

        const threadIds = data.map((t) => t.id);
        const { data: messages } = await supabase
          .from("email_messages")
          .select("thread_id, from, from_name, from_avatar_url, received_at, created_at")
          .in("thread_id", threadIds);

        const messageMeta = buildMessageMeta(messages ?? []);

        const mapped: Thread[] = data.map((t) => {
          const meta = messageMeta.get(t.id);
          return {
            id: t.provider_thread_id || t.id,
            threadId: t.provider_thread_id || t.id,
            dealId: t.deal_id,
            subject: t.subject || "No Subject",
            snippet: t.latest_snippet || "",
            lastMessageDate: t.last_message_at || "",
            labelIds: t.is_starred ? ["STARRED"] : [],
            unread: !t.is_read,
            messagesCount: meta?.messagesCount ?? 0,
            participants: [],
            from: meta?.from ?? "",
            fromName: meta?.fromName ?? null,
            fromAvatarUrl: meta?.fromAvatarUrl ?? null,
            to: "",
          };
        });
        setThreads(mapped);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThreads();
  }, [dealId, user?.id]);

  const handleThreadSelect = async (thread: Thread) => {
    if (!user?.id) return;
    setSelectedThread(thread);
    setIsLoadingThread(true);
    try {
      const supabase = getSupabaseClient();
      const detail = await fetchThreadDetailFromSupabase(supabase, user.id, thread.threadId);
      if (detail) setSelectedThread(detail);
    } finally {
      setIsLoadingThread(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (selectedThread) {
    return (
      <div className="flex flex-col" style={{ height: "600px" }}>
        <div className="flex-1 rounded-2xl overflow-hidden border border-neutral-200/50">
          <EmailPreview
            thread={selectedThread}
            onClose={() => setSelectedThread(null)}
            onReply={() => {}}
            onForward={() => {}}
            currentUserEmail={userEmail}
            isLoading={isLoadingThread}
            onSendReply={() => {}}
            userId={user?.id}
          />
        </div>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Mail className="h-10 w-10 text-neutral-300 mb-3" />
        <p className="text-neutral-500 text-sm">No conversations linked to this deal</p>
        <p className="text-neutral-400 text-xs mt-1">
          Link email threads from the mail view using the deal icon
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {threads.map((thread) => (
        <ConversationCard
          key={thread.id}
          thread={thread}
          userEmail={userEmail}
          onSelect={handleThreadSelect}
        />
      ))}
    </div>
  );
}
