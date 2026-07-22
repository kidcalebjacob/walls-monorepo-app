import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { Redirect } from "expo-router";

import {
  SettingsRadioOption,
  SettingsScreenShell,
  chatAccentBlue,
  createSettingsStyles,
} from "@/components/settings/SettingsUI";
import { type ThemePreference } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ThemeSettingsScreen() {
  const { user, loading } = useAuth();
  const { colors, isDark, themePreference, setThemePreference } = useTheme();
  const styles = useMemo(
    () => createSettingsStyles(colors, isDark),
    [colors, isDark],
  );
  const accent = chatAccentBlue(isDark);

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  const handleSelect = (preference: ThemePreference) => {
    if (preference === themePreference) return;
    // Apply immediately through ThemeContext — no chat wipe animation.
    void setThemePreference(preference);
  };

  return (
    <SettingsScreenShell
      colors={colors}
      styles={styles}
      title="Theme"
      showBack
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.optionList}>
          {THEME_OPTIONS.map((option) => (
            <SettingsRadioOption
              key={option.value}
              label={option.label}
              selected={themePreference === option.value}
              onPress={() => handleSelect(option.value)}
              accent={accent}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>
      </ScrollView>
    </SettingsScreenShell>
  );
}
