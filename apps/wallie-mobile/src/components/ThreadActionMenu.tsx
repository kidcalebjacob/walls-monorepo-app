import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { WallieThread } from "@walls/wallie-core";

import { getSidebarContentMaxX } from "@/constants/drawer-layout";
import { colors, spacing } from "@/constants/theme";

export interface ThreadMenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ThreadActionMenuProps {
  thread: WallieThread | null;
  anchor: ThreadMenuAnchor | null;
  visible: boolean;
  onClose: () => void;
  onPin: (threadId: string) => void;
  onRename: (thread: WallieThread) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
}

const MENU_WIDTH = 224;
const MENU_ESTIMATED_HEIGHT = 196;
const ANCHOR_GAP = 6;

interface MenuAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  onPress: () => void;
}

export function ThreadActionMenu({
  thread,
  anchor,
  visible,
  onClose,
  onPin,
  onRename,
  onArchive,
  onDelete,
}: ThreadActionMenuProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const sidebarMaxX = getSidebarContentMaxX(screenWidth);

  const menuPosition = useMemo(() => {
    if (!anchor) {
      return { top: 0, left: spacing.md };
    }

    const maxTop = screenHeight - insets.bottom - MENU_ESTIMATED_HEIGHT - spacing.sm;
    const belowTop = anchor.y + anchor.height + ANCHOR_GAP;
    const aboveTop = anchor.y - MENU_ESTIMATED_HEIGHT - ANCHOR_GAP;
    const top =
      belowTop <= maxTop
        ? belowTop
        : Math.max(insets.top + spacing.sm, aboveTop);

    const maxMenuLeft = Math.min(
      sidebarMaxX - MENU_WIDTH,
      screenWidth - MENU_WIDTH - spacing.sm,
    );
    const left = Math.min(Math.max(anchor.x, spacing.sm), maxMenuLeft);

    return { top, left };
  }, [
    anchor,
    insets.bottom,
    insets.top,
    screenHeight,
    screenWidth,
    sidebarMaxX,
  ]);

  const highlightLayout = useMemo(() => {
    if (!anchor) return null;

    const left = anchor.x;
    const maxWidth = Math.max(0, sidebarMaxX - left);

    return {
      top: anchor.y,
      left,
      width: Math.min(anchor.width, maxWidth),
      height: anchor.height,
    };
  }, [anchor, sidebarMaxX]);

  if (!thread) return null;

  const actions: MenuAction[] = [
    {
      key: "pin",
      label: thread.is_pinned ? "Unpin" : "Pin",
      icon: thread.is_pinned ? "pin" : "pin-outline",
      onPress: () => onPin(thread.id),
    },
    {
      key: "rename",
      label: "Rename",
      icon: "pencil-outline",
      onPress: () => onRename(thread),
    },
    {
      key: "archive",
      label: "Archive",
      icon: "archive-outline",
      onPress: () => onArchive(thread.id),
    },
    {
      key: "delete",
      label: "Delete",
      icon: "trash-outline",
      danger: true,
      onPress: () => onDelete(thread.id),
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        {highlightLayout ? (
          <View
            pointerEvents="none"
            style={[styles.rowHighlight, highlightLayout]}
          />
        ) : null}

        <View
          style={[
            styles.menu,
            {
              top: menuPosition.top,
              left: menuPosition.left,
              width: MENU_WIDTH,
            },
          ]}
        >
          {actions.map((action, index) => (
            <View key={action.key}>
              {index === actions.length - 1 ? <View style={styles.menuDivider} /> : null}
              <Pressable
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
              >
                <Ionicons
                  name={action.icon}
                  size={18}
                  color={action.danger ? colors.danger : "#4B5563"}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    action.danger && styles.menuItemDangerText,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  rowHighlight: {
    position: "absolute",
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  menu: {
    position: "absolute",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    paddingVertical: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    marginHorizontal: 6,
    borderRadius: 10,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderMuted,
    marginHorizontal: spacing.md,
    marginVertical: 4,
  },
  menuItemPressed: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  menuItemText: {
    fontSize: 16,
    color: "#374151",
  },
  menuItemDangerText: {
    color: colors.danger,
    fontWeight: "500",
  },
});
