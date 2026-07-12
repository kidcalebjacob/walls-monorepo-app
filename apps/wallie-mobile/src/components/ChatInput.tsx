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
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";

import { GlassSurface } from "@/components/GlassSurface";
import { assets, spacing, type AppColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useThemeWipe } from "@/context/ThemeWipeContext";

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
      position: "relative",
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
    placeholder: {
      position: "absolute",
      left: spacing.sm,
      right: spacing.xs,
      fontSize: 16,
      lineHeight: 22,
      ...Platform.select({
        ios: {
          top: 9,
        },
        android: {
          top: 8,
        },
        default: {
          top: 8,
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
    },
    trailingDisabled: {
      opacity: 0.55,
    },
    logo: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    iconStack: {
      width: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    iconLayer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
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
  const wipe = useThemeWipe();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasContent = value.trim().length > 0;
  const isMultiline = value.includes("\n");
  const canSend = hasContent && !isLoading;
  const showMic = !hasContent && !!onVoicePress && !isVoiceBusy;
  const showPlaceholder = value.length === 0;

  const trailingIdleStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return {
        backgroundColor: colors.glassTrailingIdle,
        borderColor: colors.glassTrailingBorder,
      };
    }

    return {
      backgroundColor: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [wipe.fromColors.glassTrailingIdle, wipe.toColors.glassTrailingIdle],
      ),
      borderColor: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [
          wipe.fromColors.glassTrailingBorder,
          wipe.toColors.glassTrailingBorder,
        ],
      ),
    };
  }, [colors.glassTrailingBorder, colors.glassTrailingIdle, wipe]);

  const trailingSendStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return {
        backgroundColor: colors.sendButton,
        borderColor: colors.sendButton,
      };
    }

    return {
      backgroundColor: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [wipe.fromColors.sendButton, wipe.toColors.sendButton],
      ),
      borderColor: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [wipe.fromColors.sendButton, wipe.toColors.sendButton],
      ),
    };
  }, [colors.sendButton, wipe]);

  const placeholderStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return { color: colors.textSubtle };
    }

    return {
      color: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [wipe.fromColors.textSubtle, wipe.toColors.textSubtle],
      ),
    };
  }, [colors.textSubtle, wipe]);

  const fromMicStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return { opacity: 1 };
    }

    return {
      opacity: interpolate(wipe.progress.value, [0, 1], [1, 0]),
    };
  }, [wipe]);

  const toMicStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return { opacity: 0 };
    }

    return {
      opacity: interpolate(wipe.progress.value, [0, 1], [0, 1]),
    };
  }, [wipe]);

  const fromMuted = wipe?.active
    ? wipe.fromColors.textMuted
    : colors.textMuted;
  const toMuted = wipe?.active ? wipe.toColors.textMuted : colors.textMuted;
  const sendIconColor = wipe?.active
    ? wipe.toColors.sendIcon
    : colors.sendIcon;

  return (
    <View
      style={[
        styles.container,
        compactFooter ? styles.containerCompact : null,
      ]}
    >
      <GlassSurface
        borderRadius={26}
        elevated
        intensity={60}
        style={styles.composerGlass}
      >
        <View
          style={[
            styles.composer,
            isMultiline ? styles.composerMultiline : null,
          ]}
        >
          <View style={styles.inputWrap}>
            {showPlaceholder ? (
              <Animated.Text
                pointerEvents="none"
                style={[styles.placeholder, placeholderStyle]}
              >
                {placeholder}
              </Animated.Text>
            ) : null}
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChangeText}
              placeholder=""
              multiline
              editable={!isLoading && !isVoiceBusy}
            />
          </View>

          {showMic ? (
            <Pressable
              onPress={onVoicePress}
              disabled={isLoading || isVoiceBusy}
            >
              <Animated.View style={[styles.trailingButton, trailingIdleStyle]}>
                <View style={styles.iconStack}>
                  <Animated.View style={[styles.iconLayer, fromMicStyle]}>
                    <Ionicons name="mic" size={20} color={fromMuted} />
                  </Animated.View>
                  {wipe?.active ? (
                    <Animated.View style={[styles.iconLayer, toMicStyle]}>
                      <Ionicons name="mic" size={20} color={toMuted} />
                    </Animated.View>
                  ) : null}
                </View>
              </Animated.View>
            </Pressable>
          ) : (
            <Pressable onPress={onSend} disabled={!canSend}>
              <Animated.View
                style={[
                  styles.trailingButton,
                  hasContent ? trailingSendStyle : trailingIdleStyle,
                  !canSend ? styles.trailingDisabled : null,
                ]}
              >
                {isLoading || isVoiceBusy ? (
                  <ActivityIndicator
                    color={hasContent ? sendIconColor : fromMuted}
                    size="small"
                  />
                ) : hasContent ? (
                  <Ionicons name="arrow-up" size={20} color={sendIconColor} />
                ) : (
                  <Image
                    source={{ uri: assets.wallsLogoFallback }}
                    style={styles.logo}
                  />
                )}
              </Animated.View>
            </Pressable>
          )}
        </View>
      </GlassSurface>
    </View>
  );
}
