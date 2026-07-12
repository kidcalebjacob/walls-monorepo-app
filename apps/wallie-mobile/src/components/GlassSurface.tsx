import { BlurView } from "expo-blur";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";
import { useThemeWipe } from "@/context/ThemeWipeContext";

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  intensity?: number;
  elevated?: boolean;
}

export function GlassSurface({
  children,
  style,
  contentStyle,
  borderRadius = 20,
  intensity = 55,
  elevated = false,
}: GlassSurfaceProps) {
  const { colors, blurTint } = useTheme();
  const wipe = useThemeWipe();

  const shellStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return { backgroundColor: colors.surface };
    }

    return {
      backgroundColor: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [wipe.fromColors.surface, wipe.toColors.surface],
      ),
    };
  }, [colors.surface, wipe]);

  const tintStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return {
        backgroundColor: colors.glassTint,
        borderColor: colors.glassBorder,
      };
    }

    return {
      backgroundColor: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [wipe.fromColors.glassTint, wipe.toColors.glassTint],
      ),
      borderColor: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [wipe.fromColors.glassBorder, wipe.toColors.glassBorder],
      ),
    };
  }, [colors.glassBorder, colors.glassTint, wipe]);

  // Destination blur for the wipe so the composite matches the final theme.
  const liveBlurTint = wipe?.active
    ? wipe.toDark
      ? "dark"
      : "light"
    : blurTint;

  return (
    <Animated.View
      style={[
        elevated ? styles.shadowElevated : styles.shadow,
        {
          borderRadius,
          shadowColor: colors.shadowColor,
        },
        shellStyle,
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius }]}>
        <BlurView
          intensity={intensity}
          tint={liveBlurTint}
          style={[styles.blur, { borderRadius }]}
        >
          <Animated.View
            style={[
              styles.tint,
              { borderRadius },
              tintStyle,
              contentStyle,
            ]}
          >
            {children}
          </Animated.View>
        </BlurView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  shadowElevated: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 14,
  },
  clip: {
    overflow: "hidden",
  },
  blur: {
    overflow: "hidden",
  },
  tint: {
    borderWidth: 1,
    overflow: "hidden",
  },
});
