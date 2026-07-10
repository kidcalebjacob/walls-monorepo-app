import { useEffect, useRef } from "react";
import { Animated, StyleSheet, type TextStyle } from "react-native";

import { useTheme } from "@/context/ThemeContext";

interface ShiningTextProps {
  text: string;
  style?: TextStyle;
}

export function ShiningText({ text, style }: ShiningTextProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.Text
      style={[
        styles.text,
        { color: colors.textMuted },
        style,
        { opacity },
      ]}
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
  },
});
