import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { assets, colors, spacing } from "@/constants/theme";

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  isRecording?: boolean;
  isVoiceBusy?: boolean;
  placeholder?: string;
  compactFooter?: boolean;
  onVoicePressIn?: () => void;
  onVoicePressOut?: () => void;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  isLoading = false,
  isRecording = false,
  isVoiceBusy = false,
  placeholder = "Ask WALLIE",
  compactFooter = false,
  onVoicePressIn,
  onVoicePressOut,
}: ChatInputProps) {
  const hasContent = value.trim().length > 0;
  const canSend = hasContent && !isLoading;
  const showMic =
    !hasContent && !!onVoicePressIn && !!onVoicePressOut && !isVoiceBusy;

  return (
    <View
      style={[
        styles.container,
        compactFooter ? styles.containerCompact : null,
      ]}
    >
      <View style={styles.composer}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textSubtle}
            multiline
            editable={!isLoading && !isVoiceBusy}
          />
        </View>

        {showMic ? (
          <Pressable
            onPressIn={onVoicePressIn}
            onPressOut={onVoicePressOut}
            disabled={isLoading}
            style={[
              styles.trailingButton,
              isRecording ? styles.trailingSend : styles.trailingIdle,
            ]}
          >
            <Ionicons
              name="mic"
              size={20}
              color={isRecording ? "#E5E5E5" : colors.textMuted}
            />
          </Pressable>
        ) : (
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            style={[
              styles.trailingButton,
              hasContent ? styles.trailingSend : styles.trailingIdle,
              !canSend && styles.trailingDisabled,
            ]}
          >
            {isLoading || isVoiceBusy ? (
              <ActivityIndicator
                color={hasContent ? "#E5E5E5" : colors.textMuted}
                size="small"
              />
            ) : hasContent ? (
              <Ionicons name="arrow-up" size={20} color="#E5E5E5" />
            ) : (
              <Image
                source={{ uri: assets.wallsLogoFallback }}
                style={styles.logo}
              />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  containerCompact: {
    paddingBottom: 0,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    backgroundColor: colors.composerBackground,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 25,
    padding: spacing.sm,
  },
  inputWrap: {
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  input: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    maxHeight: 120,
    paddingHorizontal: spacing.xs,
    paddingVertical: 8,
  },
  trailingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  trailingIdle: {
    backgroundColor: colors.inputBackground,
  },
  trailingSend: {
    backgroundColor: "#404040",
    borderColor: colors.borderMuted,
  },
  trailingDisabled: {
    opacity: 0.55,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
