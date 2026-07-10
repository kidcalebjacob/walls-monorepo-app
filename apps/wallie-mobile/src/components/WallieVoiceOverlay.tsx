import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { WallieLoadingStatus } from "@walls/wallie-core";

import { spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { WallieVoiceState } from "@/hooks/useWallieVoice";
import { GlassSurface } from "@/components/GlassSurface";
import { VoiceOrb } from "@/components/VoiceOrb";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const REVEAL_SIZE = 128;
const ENTER_MS = 960;
const EXIT_MS = 720;
const ENTER_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const EXIT_EASE = Easing.bezier(0.4, 0, 0.2, 1);

interface WallieVoiceOverlayProps {
  visible: boolean;
  state: WallieVoiceState;
  audioLevel?: number;
  loadingStatus?: WallieLoadingStatus;
  onClose: () => void;
}

function statusLabel(
  state: WallieVoiceState,
  loadingStatus?: WallieLoadingStatus,
): string {
  if (state === "listening") return "Listening…";
  if (state === "speaking") return "Speaking…";
  if (state === "processing") {
    if (loadingStatus === "searching") return "Searching the web…";
    if (loadingStatus === "people_search") return "Finding contacts…";
    return "Thinking…";
  }
  return "Starting…";
}

export function WallieVoiceOverlay({
  visible,
  state,
  audioLevel = 0,
  loadingStatus,
  onClose,
}: WallieVoiceOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { voiceColors, colors } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  const revealMaxScale = useMemo(() => {
    const diagonal = Math.hypot(width, height);
    return (diagonal * 1.15) / REVEAL_SIZE;
  }, [height, width]);

  const revealOrigin = useMemo(
    () => ({
      left: width / 2 - REVEAL_SIZE / 2,
      top: height / 2 - REVEAL_SIZE / 2,
    }),
    [height, width],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      cancelAnimation(progress);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: ENTER_MS,
        easing: ENTER_EASE,
      });
      return;
    }

    if (!mounted) return;

    cancelAnimation(progress);
    progress.value = withTiming(
      0,
      { duration: EXIT_MS, easing: EXIT_EASE },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      },
    );
  }, [mounted, progress, visible]);

  const revealStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [0.01, revealMaxScale],
          Extrapolation.CLAMP,
        ),
      },
    ],
    opacity: interpolate(progress.value, [0, 0.08], [0, 1], Extrapolation.CLAMP),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0.12, 0.68, 1],
          [0.4, 1.35, 1.55],
          Extrapolation.CLAMP,
        ),
      },
    ],
    opacity: interpolate(
      progress.value,
      [0.12, 0.38, 0.72, 1],
      [0, 0.35, 0.12, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.5, 0.88], [0, 1], Extrapolation.CLAMP),
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0.5, 0.92],
          [0.72, 1],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          progress.value,
          [0.5, 0.92],
          [28, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
    opacity: interpolate(progress.value, [0.5, 0.78], [0, 1], Extrapolation.CLAMP),
  }));

  const statusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.64, 0.97], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0.64, 0.97],
          [18, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.72, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0.72, 1],
          [0.82, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.reveal,
            {
              left: revealOrigin.left,
              top: revealOrigin.top,
            },
            revealStyle,
          ]}
        >
          <LinearGradient
            colors={[...voiceColors.gradient]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              voiceColors.vignetteTop,
              "transparent",
              voiceColors.vignetteBottom,
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: width / 2 - 72,
              top: height / 2 - 72,
              borderColor: voiceColors.closeBorder,
            },
            ringStyle,
          ]}
        />

        <Animated.View style={[styles.contentLayer, contentStyle]}>
          <AnimatedPressable
            onPress={onClose}
            style={[
              styles.closeButton,
              { top: insets.top + spacing.sm },
              closeStyle,
            ]}
            accessibilityLabel="Exit voice mode"
          >
            <GlassSurface
              borderRadius={22}
              intensity={60}
              contentStyle={styles.closeGlassContent}
              style={styles.closeGlass}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </GlassSurface>
          </AnimatedPressable>

          <View style={styles.content}>
            <Animated.View style={orbStyle}>
              <VoiceOrb state={state} audioLevel={audioLevel} />
            </Animated.View>
            <Animated.Text
              style={[styles.status, { color: voiceColors.statusText }, statusStyle]}
            >
              {statusLabel(state, loadingStatus)}
            </Animated.Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  reveal: {
    position: "absolute",
    width: REVEAL_SIZE,
    height: REVEAL_SIZE,
    borderRadius: REVEAL_SIZE / 2,
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 1,
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: "absolute",
    right: spacing.md,
    zIndex: 2,
  },
  closeGlass: {
    width: 44,
    height: 44,
  },
  closeGlassContent: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  status: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.35,
  },
});
