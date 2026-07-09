import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  extractEmailDraftIntro,
  type WallieMessage,
} from "@walls/wallie-core";

function getDelay(prevChar: string) {
  let delay = 1 + Math.random() * 2;
  if ([".", "!", "?"].includes(prevChar)) {
    delay += 6 + Math.random() * 6;
  } else if ([",", ":", ";"].includes(prevChar)) {
    delay += 3 + Math.random() * 3;
  } else if (prevChar === "\n") {
    delay += 4 + Math.random() * 4;
  }
  return delay;
}

export function useWallieTyping(
  messages: WallieMessage[],
  setMessages: Dispatch<SetStateAction<WallieMessage[]>>,
) {
  const typingIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;

  const startTyping = useCallback((messageId: string, fullText: string) => {
    let index = 0;

    const typeNextChar = () => {
      const prevChar = index > 0 ? fullText[index - 1] : "";
      index += 1;
      const isDone = index >= fullText.length;

      setMessagesRef.current((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                renderedContent: fullText.slice(0, index),
                isTyping: !isDone,
              }
            : message,
        ),
      );

      if (!isDone) {
        typingTimeoutRef.current = setTimeout(typeNextChar, getDelay(prevChar));
      } else {
        typingIdRef.current = null;
      }
    };

    typingTimeoutRef.current = setTimeout(typeNextChar, 16);
  }, []);

  useEffect(() => {
    const typingMessage = messages.find(
      (message) => message.sender === "ai" && message.isTyping,
    );

    if (!typingMessage || typingIdRef.current === typingMessage.id) {
      return;
    }

    if (typingMessage.emailDraft) {
      typingIdRef.current = typingMessage.id;
      const intro = extractEmailDraftIntro(
        typingMessage.content,
        typingMessage.emailDraft,
      );
      if (!intro) {
        setMessagesRef.current((prev) =>
          prev.map((message) =>
            message.id === typingMessage.id
              ? { ...message, renderedContent: "", isTyping: false }
              : message,
          ),
        );
        return;
      }
      startTyping(typingMessage.id, intro);
      return;
    }

    typingIdRef.current = typingMessage.id;
    startTyping(typingMessage.id, typingMessage.content);
  }, [messages, startTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
}
