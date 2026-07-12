import { useCallback, useRef } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { GlassSurface } from "@/components/GlassSurface";
import { darkColors, lightColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useThemeWipe } from "@/context/ThemeWipeContext";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPIN_MS = 720;

export type ThemeWipeRequest = {
  nextIsDark: boolean;
  background: string;
};

interface ThemeToggleButtonProps {
  /** Landing-screen cinematic wipe. Parent owns the overlay + theme commit. */
  onCinematicToggle?: (request: ThemeWipeRequest) => void;
  disabled?: boolean;
}

export function ThemeToggleButton({
  onCinematicToggle,
  disabled = false,
}: ThemeToggleButtonProps) {
  const { isDark, colors, toggleTheme } = useTheme();
  const wipe = useThemeWipe();
  const spin = useSharedValue(0);
  const press = useSharedValue(0);
  const isBusyRef = useRef(false);

  const finishBusy = useCallback(() => {
    isBusyRef.current = false;
  }, []);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.88]) }],
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(spin.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  const iconColorStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return {
        opacity: 1,
      };
    }

    return {
      opacity: interpolate(wipe.progress.value, [0, 0.45, 0.55, 1], [1, 1, 0, 0]),
    };
  }, [wipe]);

  const nextIconColorStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return { opacity: 0 };
    }

    return {
      opacity: interpolate(wipe.progress.value, [0, 0.45, 0.55, 1], [0, 0, 1, 1]),
    };
  }, [wipe]);

  const handlePress = () => {
    if (disabled || isBusyRef.current) return;

    isBusyRef.current = true;
    spin.value = 0;
    spin.value = withTiming(1, {
      duration: SPIN_MS,
      easing: Easing.out(Easing.cubic),
    });
    press.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 220 }),
    );

    if (onCinematicToggle) {
      const nextIsDark = !isDark;
      onCinematicToggle({
        nextIsDark,
        background: nextIsDark
          ? darkColors.background
          : lightColors.background,
      });
      setTimeout(finishBusy, SPIN_MS + 80);
      return;
    }

    toggleTheme();
    setTimeout(finishBusy, SPIN_MS);
  };

  const currentIconColor = isDark ? colors.text : colors.textMuted;
  const nextIconColor = wipe?.toDark
    ? wipe.toColors.text
    : wipe?.toColors.textMuted ?? currentIconColor;
  const nextIconName = wipe?.toDark ? "sunny" : "moon";

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 160 });
      }}
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <GlassSurface
        borderRadius={24}
        intensity={60}
        contentStyle={styles.glassContent}
        style={styles.glass}
      >
        <Animated.View style={pressStyle}>
          <Animated.View style={[styles.iconStack, iconWrapStyle]}>
            <Animated.View style={[styles.iconLayer, iconColorStyle]}>
              <Ionicons
                name={isDark ? "sunny" : "moon"}
                size={22}
                color={currentIconColor}
              />
            </Animated.View>
            {wipe?.active ? (
              <Animated.View style={[styles.iconLayer, nextIconColorStyle]}>
                <Ionicons
                  name={nextIconName}
                  size={22}
                  color={nextIconColor}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GlassSurface>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  glass: {
    width: 48,
    height: 48,
  },
  glassContent: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  iconStack: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
