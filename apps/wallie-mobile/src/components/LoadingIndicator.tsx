import { StyleSheet, View } from "react-native";
import type { WallieLoadingStatus } from "@walls/wallie-core";

import { ShiningText } from "@/components/ShiningText";
import { colors, spacing } from "@/constants/theme";

interface LoadingIndicatorProps {
  status?: WallieLoadingStatus;
}

function getStatusLabel(status?: WallieLoadingStatus): string {
  if (status === "searching") return "Wallie is searching the web...";
  if (status === "people_search") return "Wallie is finding contacts...";
  return "Wallie is thinking...";
}

export function LoadingIndicator({ status }: LoadingIndicatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <ShiningText text={getStatusLabel(status)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.wallsYellow,
  },
});
