import { useEffect, useRef } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { GlassSurface } from "@/components/GlassSurface";
import { TwoLineMenuIcon } from "@/components/TwoLineMenuIcon";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const PEAK_MS = 200;
const SETTLE_MS = 280;

interface MenuButtonProps {
  onPress: () => void;
  drawerOpen: boolean;
}

export function MenuButton({ onPress, drawerOpen }: MenuButtonProps) {
  const progress = useSharedValue(0);
  const wasOpenRef = useRef(drawerOpen);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(progress.value, [-1, 0, 1], [0.94, 1, 0.94]),
      },
      {
        rotate: `${interpolate(progress.value, [-1, 0, 1], [4, 0, -4])}deg`,
      },
    ],
  }));

  const playOpenAnimation = () => {
    cancelAnimation(progress);
    progress.value = withSequence(
      withTiming(1, { duration: PEAK_MS, easing: EASE }),
      withTiming(0, { duration: SETTLE_MS, easing: EASE }),
    );
  };

  const playCloseAnimation = () => {
    cancelAnimation(progress);
    progress.value = withSequence(
      withTiming(-1, { duration: PEAK_MS, easing: EASE }),
      withTiming(0, { duration: SETTLE_MS, easing: EASE }),
    );
  };

  useEffect(() => {
    if (wasOpenRef.current && !drawerOpen) {
      playCloseAnimation();
    }
    wasOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  const handlePress = () => {
    playOpenAnimation();
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Open conversations"
    >
      <Animated.View style={buttonStyle}>
        <GlassSurface
          borderRadius={24}
          intensity={60}
          contentStyle={styles.glassContent}
          style={styles.glass}
        >
          <TwoLineMenuIcon progress={progress} size={20} />
        </GlassSurface>
      </Animated.View>
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
});
