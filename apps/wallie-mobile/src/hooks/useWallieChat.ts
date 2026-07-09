import { useCallback, useState } from "react";
import {
  extractEmailDraftIntro,
  parseWallieEmailDraft,
  type WallieLoadingStatus,
  type WallieMessage,
} from "@walls/wallie-core";

import { useAuth } from "@/context/AuthContext";
import { sendWallieChat } from "@/lib/wallie-api";
import { getSupabase } from "@/lib/supabase";

const DEFAULT_MODEL = "gpt-4o";

interface UseWallieChatOptions {
  threadId: string | null;
  onThreadId?: (threadId: string) => void;
  onThreadTitle?: (threadId: string, title: string) => void;
}

export function useWallieChat({
  threadId,
  onThreadId,
  onThreadTitle,
}: UseWallieChatOptions) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<WallieMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] =
    useState<WallieLoadingStatus>(null);

  const loadMessages = useCallback(
    async (targetThreadId: string) => {
      const { data, error } = await getSupabase()
        .from("wallie_chats")
        .select("raw_text, mentions, created_at, tool_results")
        .eq("thread_id", targetThreadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[wallie-mobile] load messages:", error);
        return;
      }

      const loaded: WallieMessage[] = (data ?? []).map((row, index) => {
        const hasMentions =
          row.mentions &&
          Array.isArray(row.mentions) &&
          row.mentions.length > 0;
        const isAi = hasMentions ? false : index % 2 === 1;
        const toolResults = row.tool_results as
          | { email_draft?: unknown }
          | null
          | undefined;
        const emailDraft = isAi
          ? parseWallieEmailDraft(toolResults?.email_draft)
          : undefined;

        return {
          id: `${targetThreadId}-${index}`,
          content: row.raw_text,
          sender: hasMentions ? "user" : index % 2 === 0 ? "user" : "ai",
          timestamp: new Date(row.created_at),
          emailDraft,
        };
      });

      setMessages(loaded);
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || !user?.id) return;

      const userMessage: WallieMessage = {
        id: `${Date.now()}-user`,
        content: trimmed,
        sender: "user",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setLoadingStatus(null);

      const conversationHistory = messages.map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      }));
      conversationHistory.push({ role: "user", content: trimmed });

      try {
        const data = await sendWallieChat(
          {
            message: trimmed,
            mentions: [],
            conversationHistory,
            model: DEFAULT_MODEL,
            userId: user.id,
            threadId: threadId ?? undefined,
          },
          {
            onStatus: setLoadingStatus,
          },
        );

        const emailDraft = parseWallieEmailDraft(data.emailDraft);
        const emailIntro = emailDraft
          ? extractEmailDraftIntro(data.response || "", emailDraft)
          : "";

        const aiMessage: WallieMessage = {
          id: `${Date.now()}-ai`,
          content:
            data.response || "I'm sorry, I couldn't generate a response.",
          sender: "ai",
          timestamp: new Date(),
          renderedContent:
            emailDraft && emailIntro ? "" : emailDraft ? undefined : "",
          isTyping: emailDraft ? !!emailIntro : true,
          apolloPeople: data.apolloPeople?.length ? data.apolloPeople : undefined,
          emailDraft,
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (data.threadId) {
          onThreadId?.(data.threadId);
        }

        return aiMessage.content;
      } catch (error) {
        console.error("[wallie-mobile] send message:", error);
        throw error;
      } finally {
        setIsLoading(false);
        setLoadingStatus(null);
      }
    },
    [
      isLoading,
      messages,
      onThreadId,
      onThreadTitle,
      threadId,
      user?.id,
    ],
  );

  return {
    messages,
    setMessages,
    isLoading,
    loadingStatus,
    loadMessages,
    sendMessage,
  };
}
