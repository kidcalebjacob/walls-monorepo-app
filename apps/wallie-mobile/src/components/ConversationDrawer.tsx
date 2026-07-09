import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { WallieThread } from "@walls/wallie-core";

import { ThreadList } from "@/components/ThreadList";
import { getSidebarContentInset } from "@/constants/drawer-layout";
import { colors, spacing } from "@/constants/theme";

interface ConversationDrawerProps {
  threads: WallieThread[];
  currentThreadId: string | null;
  loading?: boolean;
  onSelect: (threadId: string) => void;
  onNewChat: () => void;
  onRenameThread: (threadId: string, title: string) => void;
  onPinThread: (threadId: string) => void;
  onArchiveThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
}

export function ConversationDrawer({
  threads,
  currentThreadId,
  loading,
  onSelect,
  onNewChat,
  onRenameThread,
  onPinThread,
  onArchiveThread,
  onDeleteThread,
}: ConversationDrawerProps) {
  const { width: screenWidth } = useWindowDimensions();
  const sidebarRightInset = getSidebarContentInset(screenWidth);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.header, { paddingRight: sidebarRightInset }]}>
        <Text style={styles.title}>Conversations</Text>
      </View>
      <ThreadList
        threads={threads}
        currentThreadId={currentThreadId}
        loading={loading}
        onSelect={onSelect}
        onNewChat={onNewChat}
        onRenameThread={onRenameThread}
        onPinThread={onPinThread}
        onArchiveThread={onArchiveThread}
        onDeleteThread={onDeleteThread}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.drawerBackground,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.text,
  },
});
