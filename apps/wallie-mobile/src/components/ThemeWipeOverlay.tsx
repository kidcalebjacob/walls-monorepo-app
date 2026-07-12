import { useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { THEME_WIPE_EASE, THEME_WIPE_MS } from "@/context/ThemeWipeContext";

interface ThemeWipeOverlayProps {
  active: boolean;
  color: string;
  progress: SharedValue<number>;
  onComplete: () => void;
}

/** Rising color sheet that sits behind landing UI (text, chrome, composer). */
export function ThemeWipeOverlay({
  active,
  color,
  progress,
  onComplete,
}: ThemeWipeOverlayProps) {
  const { height } = useWindowDimensions();
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) {
      hasCompletedRef.current = false;
      return;
    }

    hasCompletedRef.current = false;
    progress.value = 0;

    const finish = () => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      onCompleteRef.current();
    };

    progress.value = withTiming(
      1,
      { duration: THEME_WIPE_MS, easing: THEME_WIPE_EASE },
      (finished) => {
        if (finished) {
          runOnJS(finish)();
        }
      },
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [active, progress]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [height, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  if (!active) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sheet,
        { height, backgroundColor: color },
        sheetStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  sheet: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    elevation: 0,
  },
});
