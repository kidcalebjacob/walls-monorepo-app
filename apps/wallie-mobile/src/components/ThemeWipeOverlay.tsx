import { useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import {
  THEME_WIPE_EASE,
  THEME_WIPE_MS,
  THEME_WIPE_SETTLE_MS,
} from "@/context/ThemeWipeContext";

const FADE_OUT_MS = 180;

interface ThemeWipeOverlayProps {
  active: boolean;
  color: string;
  progress: SharedValue<number>;
  /** Sheet fully covers — parent should commit theme + canvas under it. */
  onCovered: () => void;
  /** Overlay faded out — parent can clear wipe state. */
  onDismissed: () => void;
}

/**
 * Rising destination-color sheet behind landing chrome.
 * Never hard-unmounts while opaque — fades out after the parent has committed.
 */
export function ThemeWipeOverlay({
  active,
  color,
  progress,
  onCovered,
  onDismissed,
}: ThemeWipeOverlayProps) {
  const { height } = useWindowDimensions();
  const opacity = useSharedValue(1);
  const onCoveredRef = useRef(onCovered);
  const onDismissedRef = useRef(onDismissed);
  const wipeIdRef = useRef(0);
  const hasCoveredRef = useRef(false);

  useEffect(() => {
    onCoveredRef.current = onCovered;
  }, [onCovered]);

  useEffect(() => {
    onDismissedRef.current = onDismissed;
  }, [onDismissed]);

  useEffect(() => {
    if (!active) {
      hasCoveredRef.current = false;
      opacity.value = 1;
      return;
    }

    const wipeId = ++wipeIdRef.current;
    hasCoveredRef.current = false;
    opacity.value = 1;

    const covered = () => {
      if (hasCoveredRef.current) return;
      if (wipeId !== wipeIdRef.current) return;
      hasCoveredRef.current = true;
      progress.value = 1;
      onCoveredRef.current();

      const dismiss = () => {
        if (wipeId !== wipeIdRef.current) return;
        onDismissedRef.current();
      };

      // Hold full cover while theme/canvas settle, then fade out (no hard cut).
      setTimeout(() => {
        if (wipeId !== wipeIdRef.current) return;
        opacity.value = withTiming(
          0,
          { duration: FADE_OUT_MS, easing: THEME_WIPE_EASE },
          (finished) => {
            if (finished) {
              runOnJS(dismiss)();
            }
          },
        );
      }, THEME_WIPE_SETTLE_MS);
    };

    progress.value = withTiming(
      1,
      { duration: THEME_WIPE_MS, easing: THEME_WIPE_EASE },
      (finished) => {
        if (finished) {
          runOnJS(covered)();
        }
      },
    );
  }, [active, opacity, progress]);

  // Grow from the bottom — avoids translateY compositor gaps.
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: interpolate(
      progress.value,
      [0, 1],
      [0, height],
      Extrapolation.CLAMP,
    ),
  }));

  if (!active) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.sheet, { backgroundColor: color }, sheetStyle]}
    />
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    elevation: 0,
  },
});
