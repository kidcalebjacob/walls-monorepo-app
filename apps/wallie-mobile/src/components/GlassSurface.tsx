import { BlurView } from "expo-blur";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

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
  return (
    <View
      style={[
        elevated ? styles.shadowElevated : styles.shadow,
        { borderRadius },
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius }]}>
        <BlurView
          intensity={intensity}
          tint="light"
          style={[styles.blur, { borderRadius }]}
        >
          <View style={[styles.tint, { borderRadius }, contentStyle]}>
            {children}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  shadowElevated: {
    shadowColor: "#000000",
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
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.88)",
    overflow: "hidden",
  },
});
