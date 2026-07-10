import { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { spacing, type AppColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

interface MarkdownTextProps {
  content: string;
}

function parseInline(
  text: string,
  keyPrefix: string,
  colors: AppColors,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <Text
          key={`${keyPrefix}-b-${partIndex}`}
          style={{ fontWeight: "700" }}
        >
          {token.slice(2, -2)}
        </Text>,
      );
    } else {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        parts.push(
          <Text
            key={`${keyPrefix}-l-${partIndex}`}
            style={{ color: colors.wallsSky, textDecorationLine: "underline" }}
            onPress={() => void Linking.openURL(url)}
          >
            {label}
          </Text>,
        );
      }
    }

    lastIndex = match.index + token.length;
    partIndex += 1;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : [text];
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    h1: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 30,
    },
    h2: {
      fontSize: 19,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 27,
    },
    h3: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      lineHeight: 25,
    },
    paragraph: {
      fontSize: 16,
      lineHeight: 26,
      color: colors.text,
    },
    list: {
      gap: spacing.xs,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    bullet: {
      fontSize: 16,
      lineHeight: 26,
      color: colors.textMuted,
    },
  });
}

export function MarkdownText({ content }: MarkdownTextProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!content.trim()) return null;

  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let blockIndex = 0;

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <View key={`list-${blockIndex}`} style={styles.list}>
        {listItems.map((item, index) => (
          <View key={`li-${index}`} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.paragraph}>
              {parseInline(item, `li-${index}`, colors)}
            </Text>
          </View>
        ))}
      </View>,
    );
    listItems = [];
    blockIndex += 1;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <Text key={`h3-${blockIndex}`} style={styles.h3}>
          {parseInline(trimmed.slice(4), `h3-${blockIndex}`, colors)}
        </Text>,
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <Text key={`h2-${blockIndex}`} style={styles.h2}>
          {parseInline(trimmed.slice(3), `h2-${blockIndex}`, colors)}
        </Text>,
      );
    } else if (trimmed.startsWith("# ")) {
      blocks.push(
        <Text key={`h1-${blockIndex}`} style={styles.h1}>
          {parseInline(trimmed.slice(2), `h1-${blockIndex}`, colors)}
        </Text>,
      );
    } else {
      blocks.push(
        <Text key={`p-${blockIndex}`} style={styles.paragraph}>
          {parseInline(trimmed, `p-${blockIndex}`, colors)}
        </Text>,
      );
    }

    blockIndex += 1;
  }

  flushList();

  return <View style={styles.container}>{blocks}</View>;
}
