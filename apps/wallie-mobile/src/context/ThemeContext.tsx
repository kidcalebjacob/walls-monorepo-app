import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import {
  darkColors,
  getVoiceColorsForScheme,
  isThemePreference,
  lightColors,
  resolveColorScheme,
  type AppColors,
  type ColorScheme,
  type ThemePreference,
  type VoiceOverlayColors,
} from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/lib/supabase";

interface ThemeContextValue {
  colors: AppColors;
  voiceColors: VoiceOverlayColors;
  colorScheme: ColorScheme;
  themePreference: ThemePreference;
  isDark: boolean;
  blurTint: "light" | "dark";
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");

  useEffect(() => {
    if (!user?.id) {
      setThemePreferenceState("system");
      return;
    }

    let cancelled = false;

    void getSupabase()
      .from("users")
      .select("theme")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (isThemePreference(data?.theme)) {
          setThemePreferenceState(data.theme);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const colorScheme = useMemo(
    () =>
      resolveColorScheme(
        themePreference,
        systemScheme === "dark" ? "dark" : "light",
      ),
    [systemScheme, themePreference],
  );

  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const voiceColors = getVoiceColorsForScheme(colorScheme);
  const isDark = colorScheme === "dark";
  const blurTint = isDark ? "dark" : "light";

  const persistThemePreference = useCallback(
    async (preference: ThemePreference) => {
      if (!user?.id) return;

      const { error } = await getSupabase()
        .from("users")
        .update({ theme: preference })
        .eq("id", user.id);

      if (error) {
        console.error("[wallie-mobile] failed to save theme preference:", error);
      }
    },
    [user?.id],
  );

  const setThemePreference = useCallback(
    async (preference: ThemePreference) => {
      setThemePreferenceState(preference);
      await persistThemePreference(preference);
    },
    [persistThemePreference],
  );

  const toggleTheme = useCallback(() => {
    const nextPreference: ThemePreference = isDark ? "light" : "dark";
    setThemePreferenceState(nextPreference);
    void persistThemePreference(nextPreference);
  }, [isDark, persistThemePreference]);

  const value = useMemo(
    () => ({
      colors,
      voiceColors,
      colorScheme,
      themePreference,
      isDark,
      blurTint,
      setThemePreference,
      toggleTheme,
    }),
    [
      blurTint,
      colorScheme,
      colors,
      isDark,
      setThemePreference,
      themePreference,
      toggleTheme,
      voiceColors,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
