import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { GlassSurface } from "@/components/GlassSurface";
import { useTheme } from "@/context/ThemeContext";
import { useThemeWipe } from "@/context/ThemeWipeContext";

export type WallieAppMode = "work" | "chat";

interface ModeToggleProps {
  value: WallieAppMode;
  onChange: (mode: WallieAppMode) => void;
}

const MODES: WallieAppMode[] = ["work", "chat"];
const SEGMENT_WIDTH = 72;
const TRACK_PADDING = 2;
const TRACK_HEIGHT = 44;
const PILL_HEIGHT = TRACK_HEIGHT - TRACK_PADDING * 2;
const SPRING = {
  damping: 18,
  stiffness: 240,
  mass: 0.8,
};

function ModeLabel({
  mode,
  active,
}: {
  mode: WallieAppMode;
  active: boolean;
}) {
  const { colors } = useTheme();
  const wipe = useThemeWipe();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, progress]);

  const textStyle = useAnimatedStyle(() => {
    const muted = wipe?.active
      ? interpolateColor(
          wipe.progress.value,
          [0, 1],
          [wipe.fromColors.textMuted, wipe.toColors.textMuted],
        )
      : colors.textMuted;
    const text = wipe?.active
      ? interpolateColor(
          wipe.progress.value,
          [0, 1],
          [wipe.fromColors.text, wipe.toColors.text],
        )
      : colors.text;

    return {
      color: interpolateColor(progress.value, [0, 1], [muted, text]),
      opacity: 0.72 + progress.value * 0.28,
      transform: [{ scale: 0.96 + progress.value * 0.04 }],
    };
  }, [colors.text, colors.textMuted, wipe]);

  return (
    <Animated.Text style={[styles.label, textStyle]}>
      {mode === "work" ? "Work" : "Chat"}
    </Animated.Text>
  );
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  const { colors } = useTheme();
  const wipe = useThemeWipe();
  const index = value === "work" ? 0 : 1;
  const slide = useSharedValue(index);

  useEffect(() => {
    slide.value = withSpring(index, SPRING);
  }, [index, slide]);

  const pillStyle = useAnimatedStyle(() => {
    const backgroundColor = wipe?.active
      ? interpolateColor(
          wipe.progress.value,
          [0, 1],
          [wipe.fromColors.glassHighlight, wipe.toColors.glassHighlight],
        )
      : colors.glassHighlight;
    const borderColor = wipe?.active
      ? interpolateColor(
          wipe.progress.value,
          [0, 1],
          [wipe.fromColors.glassBorder, wipe.toColors.glassBorder],
        )
      : colors.glassBorder;

    return {
      backgroundColor,
      borderColor,
      transform: [{ translateX: slide.value * SEGMENT_WIDTH }],
    };
  }, [colors.glassBorder, colors.glassHighlight, wipe]);

  return (
    <GlassSurface
      borderRadius={24}
      intensity={68}
      elevated
      contentStyle={styles.trackContent}
      style={styles.track}
    >
      <View style={styles.inner}>
        <Animated.View
          style={[
            styles.pill,
            { shadowColor: colors.shadowColor },
            pillStyle,
          ]}
        />

        {MODES.map((mode) => (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === mode }}
            accessibilityLabel={`${mode === "work" ? "Work" : "Chat"} mode`}
            style={styles.segment}
          >
            <ModeLabel mode={mode} active={value === mode} />
          </Pressable>
        ))}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 48,
    justifyContent: "center",
  },
  trackContent: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: TRACK_PADDING,
  },
  inner: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    height: TRACK_HEIGHT,
    width: SEGMENT_WIDTH * 2,
  },
  pill: {
    position: "absolute",
    left: 0,
    top: TRACK_PADDING,
    width: SEGMENT_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  segment: {
    width: SEGMENT_WIDTH,
    height: TRACK_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
