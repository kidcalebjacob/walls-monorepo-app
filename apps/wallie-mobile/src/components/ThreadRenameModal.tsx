import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { WallieThread } from "@walls/wallie-core";

import { spacing, type AppColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

interface ThreadRenameModalProps {
  thread: WallieThread | null;
  visible: boolean;
  onClose: () => void;
  onSave: (threadId: string, title: string) => void;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.modalBackdrop,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: spacing.md,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.inputBackground,
      marginBottom: spacing.md,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.sm,
    },
    secondaryButton: {
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
    },
    secondaryButtonText: {
      fontSize: 15,
      color: colors.textMuted,
      fontWeight: "500",
    },
    primaryButton: {
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      backgroundColor: colors.primaryButton,
    },
    primaryButtonText: {
      fontSize: 15,
      color: colors.primaryButtonText,
      fontWeight: "600",
    },
  });
}

export function ThreadRenameModal({
  thread,
  visible,
  onClose,
  onSave,
}: ThreadRenameModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (thread) {
      setValue(thread.title?.trim() || "New Chat");
    }
  }, [thread]);

  if (!thread) return null;

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(thread.id, trimmed);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Rename chat</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Chat name"
            placeholderTextColor={colors.textSubtle}
            autoFocus
            selectTextOnFocus
            style={styles.input}
            onSubmitEditing={handleSave}
            returnKeyType="done"
          />
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleSave}>
              <Text style={styles.primaryButtonText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
