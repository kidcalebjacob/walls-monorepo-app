import { StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";
import { useThemeWipe } from "@/context/ThemeWipeContext";

interface TwoLineMenuIconProps {
  progress: SharedValue<number>;
  color?: string;
  size?: number;
}

export function TwoLineMenuIcon({
  progress,
  color,
  size = 18,
}: TwoLineMenuIconProps) {
  const { colors } = useTheme();
  const wipe = useThemeWipe();
  const barColor = color ?? colors.text;

  const topBarStyle = useAnimatedStyle(() => {
    const backgroundColor = color
      ? barColor
      : wipe?.active
        ? interpolateColor(
            wipe.progress.value,
            [0, 1],
            [wipe.fromColors.text, wipe.toColors.text],
          )
        : barColor;

    return {
      backgroundColor,
      width: interpolate(
        progress.value,
        [-1, 0, 1],
        [size * 1.12, size, size * 0.7],
      ),
      transform: [
        { translateY: interpolate(progress.value, [-1, 0, 1], [4, 0, -5]) },
        {
          rotate: `${interpolate(progress.value, [-1, 0, 1], [8, 0, -8])}deg`,
        },
      ],
    };
  }, [barColor, color, size, wipe]);

  const bottomBarStyle = useAnimatedStyle(() => {
    const backgroundColor = color
      ? barColor
      : wipe?.active
        ? interpolateColor(
            wipe.progress.value,
            [0, 1],
            [wipe.fromColors.text, wipe.toColors.text],
          )
        : barColor;

    return {
      backgroundColor,
      width: interpolate(
        progress.value,
        [-1, -0.2, 0, 0.2, 1],
        [size * 1.12, size, size, size, size * 0.7],
      ),
      transform: [
        {
          translateY: interpolate(
            progress.value,
            [-1, -0.2, 0, 0.2, 1],
            [-4, 0, 0, 0, 5],
          ),
        },
        {
          rotate: `${interpolate(
            progress.value,
            [-1, -0.2, 0, 0.2, 1],
            [-8, 0, 0, 0, 8],
          )}deg`,
        },
      ],
    };
  }, [barColor, color, size, wipe]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[styles.bar, topBarStyle]} />
      <Animated.View style={[styles.bar, bottomBarStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    gap: 5,
  },
  bar: {
    height: 2,
    borderRadius: 1,
  },
});
