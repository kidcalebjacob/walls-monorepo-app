import { BlurView } from "expo-blur";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/context/ThemeContext";

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

  return (
    <View
      style={[
        elevated ? styles.shadowElevated : styles.shadow,
        {
          borderRadius,
          shadowColor: colors.shadowColor,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius }]}>
        <BlurView
          intensity={intensity}
          tint={blurTint}
          style={[styles.blur, { borderRadius }]}
        >
          <View
            style={[
              styles.tint,
              {
                borderRadius,
                backgroundColor: colors.glassTint,
                borderColor: colors.glassBorder,
              },
              contentStyle,
            ]}
          >
            {children}
          </View>
        </BlurView>
      </View>
    </View>
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
