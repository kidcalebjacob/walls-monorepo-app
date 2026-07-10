import { useCallback, useRef } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { GlassSurface } from "@/components/GlassSurface";
import { useTheme } from "@/context/ThemeContext";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPIN_MS = 520;

export function ThemeToggleButton() {
  const { isDark, colors, toggleTheme } = useTheme();
  const spin = useSharedValue(0);
  const press = useSharedValue(0);
  const isSpinningRef = useRef(false);

  const finishSpin = useCallback(() => {
    isSpinningRef.current = false;
  }, []);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.88]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(spin.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  const handlePress = () => {
    if (isSpinningRef.current) return;

    isSpinningRef.current = true;
    spin.value = 0;
    spin.value = withTiming(
      1,
      {
        duration: SPIN_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(toggleTheme)();
          spin.value = 0;
          runOnJS(finishSpin)();
        }
      },
    );
    press.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 220 }),
    );
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 160 });
      }}
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <GlassSurface
        borderRadius={22}
        intensity={60}
        contentStyle={styles.glassContent}
        style={styles.glass}
      >
        <Animated.View style={pressStyle}>
          <Animated.View style={iconStyle}>
            <Ionicons
              name={isDark ? "sunny" : "moon"}
              size={20}
              color={isDark ? colors.text : colors.textMuted}
            />
          </Animated.View>
        </Animated.View>
      </GlassSurface>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  glass: {
    width: 44,
    height: 44,
  },
  glassContent: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
