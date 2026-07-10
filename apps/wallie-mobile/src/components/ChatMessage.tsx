import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  extractEmailDraftIntro,
  type WallieMessage,
} from "@walls/wallie-core";

import { EmailDraftCard } from "@/components/EmailDraftCard";
import { MarkdownText } from "@/components/MarkdownText";
import { PeopleList } from "@/components/PeopleList";
import { spacing, type AppColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

const PEOPLE_CONTACT_TABLE_PLACEHOLDER = "{peopleContactTable}";

interface ChatMessageProps {
  message: WallieMessage;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
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
      borderRadius: 25,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    userText: {
      fontSize: 16,
      lineHeight: 26,
      color: colors.text,
    },
    aiRow: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xl,
      gap: spacing.md,
      width: "100%",
    },
  });
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUser = message.sender === "user";

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
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
