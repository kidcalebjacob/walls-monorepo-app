import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  interpolate,
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
  /** Freeze chat canvas during theme wipe so commit/teardown can't flash. */
  surfaceColor?: string;
}

export function ChatDrawerLayout({
  open,
  onClose,
  drawer,
  children,
  surfaceColor,
}: ChatDrawerLayoutProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const drawerWidth = width * DRAWER_WIDTH_RATIO;
  const pushDistance = width * MAIN_PUSH_RATIO;
  const progress = useSharedValue(open ? 1 : 0);
  const panelColor = surfaceColor ?? colors.background;

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
      backgroundColor: panelColor,
    };
  }, [colors.glassBorder, panelColor, pushDistance]);

  const chatEdgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const sidebarEdgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: isDark ? "#050506" : colors.drawerBackground,
        },
      ]}
    >
      <View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            backgroundColor: isDark ? "#101014" : colors.drawerBackground,
          },
        ]}
      >
        <View style={styles.drawerContent}>{drawer}</View>

        <Animated.View
          pointerEvents="none"
          style={[styles.sidebarEdge, sidebarEdgeStyle]}
        >
          {isDark ? (
            <LinearGradient
              colors={[
                "transparent",
                "rgba(255, 255, 255, 0.045)",
                "rgba(255, 255, 255, 0.12)",
              ]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.reverseShadow}
            />
          ) : (
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
          )}
        </Animated.View>
      </View>

      <Animated.View style={[styles.mainPanel, { width }, mainPanelStyle]}>
        <View
          style={[styles.mainContent, { backgroundColor: panelColor }]}
          pointerEvents={open ? "none" : "auto"}
        >
          {children}
        </View>

        <Animated.View pointerEvents="none" style={[styles.edge, chatEdgeStyle]}>
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
  },
  drawerContent: {
    flex: 1,
    zIndex: 1,
    backgroundColor: "transparent",
  },
  sidebarEdge: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    zIndex: 2,
  },
  reverseShadow: {
    ...StyleSheet.absoluteFillObject,
  },
  mainPanel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
    overflow: "hidden",
  },
  mainContent: {
    flex: 1,
    zIndex: 1,
  },
  edge: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
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
    zIndex: 3,
  },
});
