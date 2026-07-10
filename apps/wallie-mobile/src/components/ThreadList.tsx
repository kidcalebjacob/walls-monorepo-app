import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type View as RNView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { WallieThread } from "@walls/wallie-core";

import {
  ThreadActionMenu,
  type ThreadMenuAnchor,
} from "@/components/ThreadActionMenu";
import { ThreadRenameModal } from "@/components/ThreadRenameModal";
import { getSidebarContentInset } from "@/constants/drawer-layout";
import { spacing, type AppColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { categorizeThreads } from "@/lib/thread-categories";

interface ThreadListProps {
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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.drawerBackground,
    },
    newChatButton: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      height: 40,
      paddingHorizontal: spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "transparent",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    newChatText: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.iconMuted,
    },
    loader: {
      marginTop: spacing.lg,
    },
    list: {
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.lg,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.iconMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    threadRow: {
      minHeight: 36,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
      marginBottom: 2,
      borderWidth: 1,
      borderColor: "transparent",
      justifyContent: "center",
    },
    threadRowActive: {
      backgroundColor: colors.surface,
      borderColor: colors.borderMuted,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 1,
    },
    threadRowMenuOpen: {
      opacity: 0,
    },
    threadTitle: {
      fontSize: 16,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
  });
}

export function ThreadList({
  threads,
  currentThreadId,
  loading = false,
  onSelect,
  onNewChat,
  onRenameThread,
  onPinThread,
  onArchiveThread,
  onDeleteThread,
}: ThreadListProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const sidebarRightInset = getSidebarContentInset(screenWidth);

  const [menuThread, setMenuThread] = useState<WallieThread | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<ThreadMenuAnchor | null>(null);
  const [renameThread, setRenameThread] = useState<WallieThread | null>(null);
  const rowRefs = useRef(new Map<string, RNView>());

  const sections = useMemo(() => categorizeThreads(threads), [threads]);

  const closeMenu = () => {
    setMenuThread(null);
    setMenuAnchor(null);
  };

  const openMenu = (thread: WallieThread) => {
    const row = rowRefs.current.get(thread.id);
    if (!row) {
      setMenuThread(thread);
      setMenuAnchor(null);
      return;
    }

    row.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
      setMenuThread(thread);
    });
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.newChatButton, { marginRight: sidebarRightInset }]}
        onPress={onNewChat}
      >
        <Ionicons name="add" size={18} color={colors.iconMuted} />
        <Text style={styles.newChatText}>New chat</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.wallsBlue} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingRight: sidebarRightInset },
          ]}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const active = item.id === currentThreadId;
            const menuOpen = menuThread?.id === item.id;
            return (
              <Pressable
                ref={(ref) => {
                  if (ref) rowRefs.current.set(item.id, ref);
                  else rowRefs.current.delete(item.id);
                }}
                onPress={() => onSelect(item.id)}
                onLongPress={() => openMenu(item)}
                delayLongPress={320}
                style={[
                  styles.threadRow,
                  active && styles.threadRowActive,
                  menuOpen && styles.threadRowMenuOpen,
                ]}
              >
                <Text style={styles.threadTitle} numberOfLines={1}>
                  {item.title?.trim() || "New Chat"}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No conversations yet.</Text>
          }
        />
      )}

      <ThreadActionMenu
        thread={menuThread}
        anchor={menuAnchor}
        visible={!!menuThread}
        onClose={closeMenu}
        onPin={onPinThread}
        onRename={setRenameThread}
        onArchive={onArchiveThread}
        onDelete={onDeleteThread}
      />

      <ThreadRenameModal
        thread={renameThread}
        visible={!!renameThread}
        onClose={() => setRenameThread(null)}
        onSave={onRenameThread}
      />
    </View>
  );
}
