import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { WallieThread } from "@walls/wallie-core";

import { colors, spacing } from "@/constants/theme";

interface ThreadListProps {
  threads: WallieThread[];
  currentThreadId: string | null;
  loading?: boolean;
  onSelect: (threadId: string) => void;
  onNewChat: () => void;
}

export function ThreadList({
  threads,
  currentThreadId,
  loading = false,
  onSelect,
  onNewChat,
}: ThreadListProps) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.newChatButton} onPress={onNewChat}>
        <Text style={styles.newChatText}>+ New chat</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.wallsBlue} />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const active = item.id === currentThreadId;
            return (
              <Pressable
                onPress={() => onSelect(item.id)}
                style={[styles.threadRow, active && styles.threadRowActive]}
              >
                <Text style={styles.threadTitle} numberOfLines={1}>
                  {item.title?.trim() || "New conversation"}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No conversations yet.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  newChatButton: {
    margin: spacing.md,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: "center",
  },
  newChatText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  loader: {
    marginTop: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  threadRow: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  threadRowActive: {
    borderWidth: 1,
    borderColor: colors.wallsYellow,
  },
  threadTitle: {
    fontSize: 15,
    color: colors.text,
  },
  empty: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});
