import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { WallieEmailDraft } from "@walls/wallie-core";

import { spacing, type AppColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

interface EmailDraftCardProps {
  draft: WallieEmailDraft;
}

function getRecipients(draft: WallieEmailDraft): string[] {
  const { recipients } = draft;
  if (!recipients) return [];
  if (Array.isArray(recipients)) {
    return recipients.map(String).filter(Boolean);
  }
  if (typeof recipients === "string") {
    return recipients
      .split(/[,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof recipients === "object") {
    return [
      ...(recipients.to ?? []),
      ...(recipients.cc ?? []),
    ].map(String).filter(Boolean);
  }
  return [];
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 16,
      backgroundColor: colors.surface,
      padding: spacing.md,
      gap: spacing.xs,
    },
    label: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    meta: {
      fontSize: 14,
      color: colors.textMuted,
    },
    subject: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textMuted,
    },
  });
}

export function EmailDraftCard({ draft }: EmailDraftCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const recipients = getRecipients(draft);
  const bodyPreview = draft.body?.trim().slice(0, 180);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Email draft</Text>
      {recipients.length > 0 ? (
        <Text style={styles.meta} numberOfLines={1}>
          To: {recipients.join(", ")}
        </Text>
      ) : null}
      {draft.subject ? (
        <Text style={styles.subject} numberOfLines={2}>
          {draft.subject}
        </Text>
      ) : null}
      {bodyPreview ? (
        <Text style={styles.body} numberOfLines={4}>
          {bodyPreview}
          {(draft.body?.length ?? 0) > 180 ? "…" : ""}
        </Text>
      ) : null}
    </View>
  );
}
