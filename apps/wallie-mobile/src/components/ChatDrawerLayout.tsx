import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  DRAWER_WIDTH_RATIO,
  MAIN_PUSH_RATIO,
} from "@/constants/drawer-layout";
import { useTheme } from "@/context/ThemeContext";

const MAIN_RADIUS_OPEN = 28;
const ANIMATION_MS = 300;

interface ChatDrawerLayoutProps {
  open: boolean;
  onClose: () => void;
  drawer: ReactNode;
  children: ReactNode;
}

export function ChatDrawerLayout({
  open,
  onClose,
  drawer,
  children,
}: ChatDrawerLayoutProps) {
  const { colors, blurTint } = useTheme();
  const { width } = useWindowDimensions();
  const drawerWidth = width * DRAWER_WIDTH_RATIO;
  const pushDistance = width * MAIN_PUSH_RATIO;
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: ANIMATION_MS });
  }, [open, progress]);

  const mainPanelStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [0, pushDistance],
      Extrapolation.CLAMP,
    );
    const radius = interpolate(
      progress.value,
      [0, 1],
      [0, MAIN_RADIUS_OPEN],
      Extrapolation.CLAMP,
    );
    const borderWidth = interpolate(
      progress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ translateX }],
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
      borderWidth,
      borderColor: colors.glassBorder,
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [colors.background, colors.glassPanelOpen],
      ),
    };
  }, [colors.background, colors.glassBorder, colors.glassPanelOpen]);

  const glassLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const drawerShadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.root, { backgroundColor: colors.drawerBackground }]}>
      <View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            backgroundColor: colors.drawerBackground,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        {drawer}
        <Animated.View
          pointerEvents="none"
          style={[styles.sidebarShadow, drawerShadowStyle]}
        >
          <LinearGradient
            colors={[
              "transparent",
              colors.sidebarShadowMid,
              colors.sidebarShadowEnd,
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.mainPanel, { width }, mainPanelStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.glassLayer, glassLayerStyle]}
        >
          <BlurView
            intensity={72}
            tint={blurTint}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[styles.glassTint, { backgroundColor: colors.glassTint }]}
          />
          <View
            style={[
              styles.glassHighlight,
              { backgroundColor: colors.glassHighlight },
            ]}
          />
        </Animated.View>

        {open ? (
          <Pressable style={styles.dismissOverlay} onPress={onClose} />
        ) : null}

        <View
          style={styles.mainContent}
          pointerEvents={open ? "none" : "auto"}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
    overflow: "hidden",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  sidebarShadow: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
    zIndex: 2,
  },
  mainPanel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
    overflow: "hidden",
  },
  glassLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
  },
  glassHighlight: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 1,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  mainContent: {
    flex: 1,
    zIndex: 1,
  },
});
