import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";

interface TwoLineMenuIconProps {
  color?: string;
  size?: number;
}

export function TwoLineMenuIcon({
  color = colors.text,
  size = 18,
}: TwoLineMenuIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.bar, { width: size, backgroundColor: color }]} />
      <View style={[styles.bar, { width: size, backgroundColor: color }]} />
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
