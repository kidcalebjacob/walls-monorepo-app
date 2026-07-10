import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import type { WallieVoiceState } from "@/hooks/useWallieVoice";
import { useTheme } from "@/context/ThemeContext";

interface VoiceOrbProps {
  state: WallieVoiceState;
  audioLevel?: number;
}

interface OrbPalette {
  blobA: string;
  blobB: string;
  blobC: string;
  blobD: string;
  core: string;
  halo: string;
}

const DARK_PALETTES: Record<WallieVoiceState, OrbPalette> = {
  idle: {
    blobA: "rgba(161, 161, 170, 0.7)",
    blobB: "rgba(113, 113, 122, 0.65)",
    blobC: "rgba(212, 212, 216, 0.5)",
    blobD: "rgba(244, 244, 245, 0.4)",
    core: "#18181b",
    halo: "rgba(161, 161, 170, 0.18)",
  },
  listening: {
    blobA: "rgba(99, 102, 241, 0.85)",
    blobB: "rgba(34, 211, 238, 0.75)",
    blobC: "rgba(167, 139, 250, 0.7)",
    blobD: "rgba(244, 244, 245, 0.55)",
    core: "#18181b",
    halo: "rgba(99, 102, 241, 0.22)",
  },
  processing: {
    blobA: "rgba(251, 146, 60, 0.9)",
    blobB: "rgba(244, 63, 94, 0.8)",
    blobC: "rgba(250, 204, 21, 0.75)",
    blobD: "rgba(255, 237, 213, 0.55)",
    core: "#1c1410",
    halo: "rgba(251, 146, 60, 0.26)",
  },
  speaking: {
    blobA: "rgba(56, 189, 248, 0.9)",
    blobB: "rgba(37, 99, 235, 0.85)",
    blobC: "rgba(125, 211, 252, 0.75)",
    blobD: "rgba(224, 242, 254, 0.6)",
    core: "#0c1929",
    halo: "rgba(56, 189, 248, 0.28)",
  },
};

const LIGHT_PALETTES: Record<WallieVoiceState, OrbPalette> = {
  idle: {
    blobA: "rgba(161, 161, 170, 0.55)",
    blobB: "rgba(113, 113, 122, 0.45)",
    blobC: "rgba(212, 212, 216, 0.65)",
    blobD: "rgba(255, 255, 255, 0.75)",
    core: "#FFFFFF",
    halo: "rgba(161, 161, 170, 0.14)",
  },
  listening: {
    blobA: "rgba(99, 102, 241, 0.72)",
    blobB: "rgba(34, 211, 238, 0.62)",
    blobC: "rgba(167, 139, 250, 0.58)",
    blobD: "rgba(255, 255, 255, 0.8)",
    core: "#F8FAFF",
    halo: "rgba(99, 102, 241, 0.18)",
  },
  processing: {
    blobA: "rgba(251, 146, 60, 0.78)",
    blobB: "rgba(244, 63, 94, 0.68)",
    blobC: "rgba(250, 204, 21, 0.62)",
    blobD: "rgba(255, 255, 255, 0.82)",
    core: "#FFFCF8",
    halo: "rgba(251, 146, 60, 0.2)",
  },
  speaking: {
    blobA: "rgba(56, 189, 248, 0.78)",
    blobB: "rgba(37, 99, 235, 0.72)",
    blobC: "rgba(125, 211, 252, 0.65)",
    blobD: "rgba(255, 255, 255, 0.85)",
    core: "#F5FAFF",
    halo: "rgba(56, 189, 248, 0.22)",
  },
};

const STATE_STOPS = [0, 1, 2, 3] as const;
const COLOR_TRANSITION_MS = 1100;

function stateToStop(state: WallieVoiceState): number {
  switch (state) {
    case "listening":
      return 1;
    case "processing":
      return 2;
    case "speaking":
      return 3;
    default:
      return 0;
  }
}

function useOrbPalette(state: WallieVoiceState, isDark: boolean) {
  const paletteProgress = useSharedValue(stateToStop(state));
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  const { idle, listening, processing, speaking } = palettes;

  useEffect(() => {
    paletteProgress.value = withTiming(stateToStop(state), {
      duration: COLOR_TRANSITION_MS,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [paletteProgress, state]);

  const haloColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      paletteProgress.value,
      [...STATE_STOPS],
      [idle.halo, listening.halo, processing.halo, speaking.halo],
    ),
  }));

  const coreColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      paletteProgress.value,
      [...STATE_STOPS],
      [idle.core, listening.core, processing.core, speaking.core],
    ),
  }));

  const blobAColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      paletteProgress.value,
      [...STATE_STOPS],
      [idle.blobA, listening.blobA, processing.blobA, speaking.blobA],
    ),
  }));

  const blobBColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      paletteProgress.value,
      [...STATE_STOPS],
      [idle.blobB, listening.blobB, processing.blobB, speaking.blobB],
    ),
  }));

  const blobCColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      paletteProgress.value,
      [...STATE_STOPS],
      [idle.blobC, listening.blobC, processing.blobC, speaking.blobC],
    ),
  }));

  const blobDColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      paletteProgress.value,
      [...STATE_STOPS],
      [idle.blobD, listening.blobD, processing.blobD, speaking.blobD],
    ),
  }));

  return {
    haloColorStyle,
    coreColorStyle,
    blobAColorStyle,
    blobBColorStyle,
    blobCColorStyle,
    blobDColorStyle,
  };
}

const ROTATION_SPEED_A = 0.022;
const ROTATION_SPEED_B = -0.03;
const ROTATION_SPEED_C = 0.017;
const BREATHE_DURATION_MS = 2400;
const LEVEL_SMOOTH_MS = 120;

function levelBoostForState(state: WallieVoiceState): number {
  if (state === "listening") return 1;
  if (state === "speaking") return 0.72;
  return 0.35;
}

function useOrbMotion(audioLevel: number, state: WallieVoiceState) {
  const spinA = useSharedValue(0);
  const spinB = useSharedValue(0);
  const spinC = useSharedValue(0);
  const breathe = useSharedValue(0);
  const level = useSharedValue(0);
  const breatheStarted = useRef(false);

  useEffect(() => {
    level.value = withTiming(audioLevel, {
      duration: LEVEL_SMOOTH_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [audioLevel, level]);

  useEffect(() => {
    if (breatheStarted.current) return;
    breatheStarted.current = true;

    breathe.value = withRepeat(
      withTiming(1, {
        duration: BREATHE_DURATION_MS,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [breathe]);

  useFrameCallback((frameInfo) => {
    "worklet";
    const dt = frameInfo.timeSincePreviousFrame;
    if (!dt) return;

    spinA.value += dt * ROTATION_SPEED_A;
    spinB.value += dt * ROTATION_SPEED_B;
    spinC.value += dt * ROTATION_SPEED_C;
  });

  const orbitAStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinA.value}deg` }],
  }));

  const orbitBStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinB.value}deg` }],
  }));

  const orbitCStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinC.value}deg` }, { scale: 0.88 }],
  }));

  const boost = levelBoostForState(state);

  const haloStyle = useAnimatedStyle(() => {
    const driven = level.value * boost;
    const pulse = 1 + breathe.value * 0.08 + driven * 0.22;
    return {
      transform: [{ scale: pulse }],
      opacity: 0.35 + breathe.value * 0.3 + driven * 0.45,
    };
  }, [boost]);

  const coreStyle = useAnimatedStyle(() => {
    const driven = level.value * boost;
    return {
      transform: [{ scale: 1 + breathe.value * 0.05 + driven * 0.12 }],
    };
  }, [boost]);

  const meltStyle = useAnimatedStyle(() => ({
    opacity: 0.82 + breathe.value * 0.1,
    transform: [{ scale: 1.02 + breathe.value * 0.03 }],
  }));

  return { orbitAStyle, orbitBStyle, orbitCStyle, haloStyle, coreStyle, meltStyle };
}

export function VoiceOrb({ state, audioLevel = 0 }: VoiceOrbProps) {
  const { isDark, blurTint } = useTheme();
  const {
    haloColorStyle,
    coreColorStyle,
    blobAColorStyle,
    blobBColorStyle,
    blobCColorStyle,
    blobDColorStyle,
  } = useOrbPalette(state, isDark);
  const {
    orbitAStyle,
    orbitBStyle,
    orbitCStyle,
    haloStyle,
    coreStyle,
    meltStyle,
  } = useOrbMotion(audioLevel, state);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.halo, haloColorStyle, haloStyle]}
      />

      <View style={styles.field}>
        <Animated.View style={[styles.orbit, orbitCStyle]}>
          <Animated.View
            style={[
              styles.blob,
              styles.blobSm,
              blobDColorStyle,
              { top: 4, left: 78 },
            ]}
          />
          <Animated.View
            style={[
              styles.blob,
              styles.blobSm,
              blobAColorStyle,
              { bottom: 6, left: 12 },
            ]}
          />
        </Animated.View>

        <Animated.View style={[styles.orbit, orbitAStyle]}>
          <Animated.View
            style={[
              styles.blob,
              styles.blobLg,
              blobAColorStyle,
              { top: 8, left: 42 },
            ]}
          />
          <Animated.View
            style={[
              styles.blob,
              styles.blobMd,
              blobBColorStyle,
              { bottom: 18, right: 28 },
            ]}
          />
        </Animated.View>

        <Animated.View style={[styles.orbit, orbitBStyle]}>
          <Animated.View
            style={[
              styles.blob,
              styles.blobMd,
              blobCColorStyle,
              { top: 52, right: 8 },
            ]}
          />
          <Animated.View
            style={[
              styles.blob,
              styles.blobSm,
              blobDColorStyle,
              { bottom: 42, left: 18 },
            ]}
          />
        </Animated.View>

        <Animated.View style={[styles.melt, meltStyle]}>
          <BlurView
            intensity={isDark ? 68 : 48}
            tint={blurTint}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.meltSoft, meltStyle]}>
          <BlurView
            intensity={isDark ? 28 : 20}
            tint={isDark ? "light" : "dark"}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.core,
            isDark ? styles.coreShadowDark : styles.coreShadowLight,
            coreColorStyle,
            coreStyle,
          ]}
        />
      </View>
    </View>
  );
}

const ORB_SIZE = 260;
const FIELD_SIZE = 220;

const styles = StyleSheet.create({
  wrap: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
  },
  field: {
    width: FIELD_SIZE,
    height: FIELD_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  orbit: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
  },
  blobLg: {
    width: 118,
    height: 118,
  },
  blobMd: {
    width: 96,
    height: 96,
  },
  blobSm: {
    width: 72,
    height: 72,
  },
  melt: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FIELD_SIZE / 2,
    overflow: "hidden",
  },
  meltSoft: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FIELD_SIZE / 2,
    overflow: "hidden",
    opacity: 0.35,
  },
  core: {
    width: 132,
    height: 132,
    borderRadius: 66,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  coreShadowDark: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 16,
  },
  coreShadowLight: {
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
});
