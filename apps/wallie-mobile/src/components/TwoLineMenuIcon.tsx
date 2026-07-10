import { StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";

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
  const barColor = color ?? colors.text;

  const topBarStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [-1, 0, 1], [size * 1.12, size, size * 0.7]),
    transform: [
      { translateY: interpolate(progress.value, [-1, 0, 1], [4, 0, -5]) },
      {
        rotate: `${interpolate(progress.value, [-1, 0, 1], [8, 0, -8])}deg`,
      },
    ],
  }));

  const bottomBarStyle = useAnimatedStyle(() => ({
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
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[styles.bar, { backgroundColor: barColor }, topBarStyle]}
      />
      <Animated.View
        style={[styles.bar, { backgroundColor: barColor }, bottomBarStyle]}
      />
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
