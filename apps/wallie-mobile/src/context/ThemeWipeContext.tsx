import { createContext, useContext, type ReactNode } from "react";
import { Easing, type SharedValue } from "react-native-reanimated";

import type { AppColors } from "@/constants/theme";

export const THEME_WIPE_MS = 680;
/** Hold destination wipe chrome after theme commit so JS/UI paint can catch up. */
export const THEME_WIPE_SETTLE_MS = 320;
export const THEME_WIPE_EASE = Easing.bezier(0.22, 1, 0.36, 1);

export type ThemeWipeState = {
  progress: SharedValue<number>;
  active: boolean;
  fromColors: AppColors;
  toColors: AppColors;
  fromDark: boolean;
  toDark: boolean;
};

const ThemeWipeContext = createContext<ThemeWipeState | null>(null);

export function ThemeWipeProvider({
  value,
  children,
}: {
  value: ThemeWipeState | null;
  children: ReactNode;
}) {
  return (
    <ThemeWipeContext.Provider value={value}>
      {children}
    </ThemeWipeContext.Provider>
  );
}

export function useThemeWipe() {
  return useContext(ThemeWipeContext);
}
