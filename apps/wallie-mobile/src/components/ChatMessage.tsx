import { Image, StyleSheet, Text, View } from "react-native";
import {
  extractEmailDraftIntro,
  type WallieMessage,
} from "@walls/wallie-core";

import { EmailDraftCard } from "@/components/EmailDraftCard";
import { MarkdownText } from "@/components/MarkdownText";
import { PeopleList } from "@/components/PeopleList";
import { assets, colors, spacing } from "@/constants/theme";

const PEOPLE_CONTACT_TABLE_PLACEHOLDER = "{peopleContactTable}";

interface ChatMessageProps {
  message: WallieMessage;
  avatarUrl?: string | null;
}

export function ChatMessage({ message, avatarUrl }: ChatMessageProps) {
  const isUser = message.sender === "user";

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
        <Image
          source={{ uri: avatarUrl || assets.wallsLogoFallback }}
          style={styles.avatar}
        />
      </View>
    );
  }

  const text =
    (message.isTyping ? message.renderedContent : message.content) ?? "";
  const showEmailDraft = !!message.emailDraft && !message.isTyping;
  const showPeople =
    !!message.apolloPeople?.length && !message.isTyping;
  const introMarkdown =
    showEmailDraft && message.emailDraft
      ? extractEmailDraftIntro(message.content, message.emailDraft)
      : message.emailDraft && message.isTyping
        ? (message.renderedContent ?? "")
        : text;
  const cleanedMarkdown = introMarkdown
    .replaceAll(PEOPLE_CONTACT_TABLE_PLACEHOLDER, "")
    .trim();

  return (
    <View style={styles.aiRow}>
      {cleanedMarkdown ? <MarkdownText content={cleanedMarkdown} /> : null}
      {showPeople && message.apolloPeople ? (
        <PeopleList people={message.apolloPeople} />
      ) : null}
      {showEmailDraft && message.emailDraft ? (
        <EmailDraftCard draft={message.emailDraft} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
    maxWidth: "100%",
  },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: colors.userBubble,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 25,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  userText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginTop: 6,
  },
  aiRow: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.md,
    width: "100%",
  },
});
