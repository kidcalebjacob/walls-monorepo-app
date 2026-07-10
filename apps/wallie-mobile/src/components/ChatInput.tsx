import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GlassSurface } from "@/components/GlassSurface";
import { assets, spacing, type AppColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  isVoiceBusy?: boolean;
  placeholder?: string;
  compactFooter?: boolean;
  onVoicePress?: () => void;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      backgroundColor: "transparent",
    },
    containerCompact: {
      paddingBottom: spacing.sm,
    },
    composerGlass: {
      width: "100%",
    },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    composerMultiline: {
      alignItems: "flex-end",
    },
    inputWrap: {
      flex: 1,
      justifyContent: "center",
      minHeight: 40,
    },
    input: {
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
      maxHeight: 120,
      paddingLeft: spacing.sm,
      paddingRight: spacing.xs,
      paddingVertical: 0,
      margin: 0,
      backgroundColor: "transparent",
      ...Platform.select({
        ios: {
          paddingTop: 9,
          paddingBottom: 9,
        },
        android: {
          textAlignVertical: "center",
          paddingVertical: 8,
        },
        default: {
          paddingVertical: 8,
        },
      }),
    },
    trailingButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.glassTrailingBorder,
    },
    trailingIdle: {
      backgroundColor: colors.glassTrailingIdle,
    },
    trailingSend: {
      backgroundColor: colors.sendButton,
      borderColor: colors.sendButton,
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
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  isLoading = false,
  isVoiceBusy = false,
  placeholder = "Ask WALLIE",
  compactFooter = false,
  onVoicePress,
}: ChatInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasContent = value.trim().length > 0;
  const isMultiline = value.includes("\n");
  const canSend = hasContent && !isLoading;
  const showMic = !hasContent && !!onVoicePress && !isVoiceBusy;

  return (
    <View
      style={[
        styles.container,
        compactFooter ? styles.containerCompact : null,
      ]}
    >
      <GlassSurface borderRadius={26} elevated intensity={60} style={styles.composerGlass}>
        <View
          style={[
            styles.composer,
            isMultiline ? styles.composerMultiline : null,
          ]}
        >
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
              onPress={onVoicePress}
              disabled={isLoading || isVoiceBusy}
              style={[styles.trailingButton, styles.trailingIdle]}
            >
              <Ionicons name="mic" size={20} color={colors.textMuted} />
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
                  color={hasContent ? colors.sendIcon : colors.textMuted}
                  size="small"
                />
              ) : hasContent ? (
                <Ionicons name="arrow-up" size={20} color={colors.sendIcon} />
              ) : (
                <Image
                  source={{ uri: assets.wallsLogoFallback }}
                  style={styles.logo}
                />
              )}
            </Pressable>
          )}
        </View>
      </GlassSurface>
    </View>
  );
}
