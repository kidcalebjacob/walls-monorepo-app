export type ThemePreference = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

export interface AppColors {
  wallsYellow: string;
  wallsBlue: string;
  wallsSky: string;
  wallsLight: string;
  background: string;
  neutral100: string;
  drawerBackground: string;
  surface: string;
  composerBackground: string;
  inputBackground: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textSecondary: string;
  border: string;
  borderMuted: string;
  userBubble: string;
  aiBubble: string;
  glassTint: string;
  glassHighlight: string;
  glassBorder: string;
  glassPanelOpen: string;
  glassTrailingIdle: string;
  glassTrailingBorder: string;
  primaryButton: string;
  primaryButtonText: string;
  sendButton: string;
  sendIcon: string;
  iconMuted: string;
  modalBackdrop: string;
  menuBackdrop: string;
  pressedOverlay: string;
  danger: string;
  dangerBackground: string;
  dangerBorder: string;
  shadowColor: string;
  sidebarShadowMid: string;
  sidebarShadowEnd: string;
}

export interface VoiceOverlayColors {
  gradient: readonly [string, string, string];
  vignetteTop: string;
  vignetteBottom: string;
  closeBackground: string;
  closeBorder: string;
  closeIcon: string;
  statusText: string;
}

export const lightColors: AppColors = {
  wallsYellow: "#e2f85c",
  wallsBlue: "#0066b2",
  wallsSky: "#6eadc0",
  wallsLight: "#6B8CAE",
  background: "#F9FAFB",
  neutral100: "#EFEFEF",
  drawerBackground: "#EFEFEF",
  surface: "#F9FAFB",
  composerBackground: "#F9FAFB",
  inputBackground: "#F5F5F5",
  text: "#0A0A0A",
  textMuted: "#737373",
  textSubtle: "#A3A3A3",
  textSecondary: "#374151",
  border: "#E5E5E5",
  borderMuted: "rgba(229, 229, 229, 0.5)",
  userBubble: "#EFEFEF",
  aiBubble: "#F3F4F6",
  glassTint: "rgba(255, 255, 255, 0.42)",
  glassHighlight: "rgba(255, 255, 255, 0.95)",
  glassBorder: "rgba(255, 255, 255, 0.88)",
  glassPanelOpen: "rgba(255, 255, 255, 0.55)",
  glassTrailingIdle: "rgba(255, 255, 255, 0.35)",
  glassTrailingBorder: "rgba(255, 255, 255, 0.65)",
  primaryButton: "#404040",
  primaryButtonText: "#F9FAFB",
  sendButton: "#404040",
  sendIcon: "#E5E5E5",
  iconMuted: "#6B7280",
  modalBackdrop: "rgba(0, 0, 0, 0.28)",
  menuBackdrop: "rgba(0, 0, 0, 0.12)",
  pressedOverlay: "rgba(0, 0, 0, 0.04)",
  danger: "#DC2626",
  dangerBackground: "rgba(220, 38, 38, 0.1)",
  dangerBorder: "rgba(220, 38, 38, 0.2)",
  shadowColor: "#000000",
  sidebarShadowMid: "rgba(0, 0, 0, 0.06)",
  sidebarShadowEnd: "rgba(0, 0, 0, 0.18)",
};

/** Dark chat UI — matches the voice overlay aesthetic. */
export const darkColors: AppColors = {
  wallsYellow: "#e2f85c",
  wallsBlue: "#60a5fa",
  wallsSky: "#7dd3fc",
  wallsLight: "#93c5fd",
  background: "#09090b",
  neutral100: "#18181b",
  drawerBackground: "#0a0a0a",
  surface: "#18181b",
  composerBackground: "#09090b",
  inputBackground: "#27272a",
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  textSubtle: "#71717A",
  textSecondary: "#D4D4D8",
  border: "rgba(255, 255, 255, 0.12)",
  borderMuted: "rgba(255, 255, 255, 0.08)",
  userBubble: "#27272a",
  aiBubble: "#18181b",
  glassTint: "rgba(255, 255, 255, 0.06)",
  glassHighlight: "rgba(255, 255, 255, 0.12)",
  glassBorder: "rgba(255, 255, 255, 0.14)",
  glassPanelOpen: "rgba(24, 24, 27, 0.78)",
  glassTrailingIdle: "rgba(255, 255, 255, 0.08)",
  glassTrailingBorder: "rgba(255, 255, 255, 0.18)",
  primaryButton: "#E4E4E7",
  primaryButtonText: "#18181B",
  sendButton: "#E4E4E7",
  sendIcon: "#18181B",
  iconMuted: "#A1A1AA",
  modalBackdrop: "rgba(0, 0, 0, 0.55)",
  menuBackdrop: "rgba(0, 0, 0, 0.45)",
  pressedOverlay: "rgba(255, 255, 255, 0.06)",
  danger: "#F87171",
  dangerBackground: "rgba(248, 113, 113, 0.12)",
  dangerBorder: "rgba(248, 113, 113, 0.24)",
  shadowColor: "#000000",
  sidebarShadowMid: "rgba(0, 0, 0, 0.35)",
  sidebarShadowEnd: "rgba(0, 0, 0, 0.55)",
};

export const lightVoiceColors: VoiceOverlayColors = {
  gradient: ["#F9FAFB", "#FFFFFF", "#F3F4F6"],
  vignetteTop: "rgba(0, 0, 0, 0.04)",
  vignetteBottom: "rgba(0, 0, 0, 0.06)",
  closeBackground: "rgba(0, 0, 0, 0.06)",
  closeBorder: "rgba(0, 0, 0, 0.1)",
  closeIcon: "rgba(64, 64, 64, 0.85)",
  statusText: "rgba(115, 115, 115, 0.95)",
};

export const darkVoiceColors: VoiceOverlayColors = {
  gradient: ["#09090b", "#111827", "#0a0a0a"],
  vignetteTop: "rgba(0, 0, 0, 0.45)",
  vignetteBottom: "rgba(0, 0, 0, 0.5)",
  closeBackground: "rgba(255, 255, 255, 0.08)",
  closeBorder: "rgba(255, 255, 255, 0.1)",
  closeIcon: "rgba(255, 255, 255, 0.72)",
  statusText: "rgba(161, 161, 170, 0.95)",
};

/** @deprecated Use `useTheme().colors` instead. */
export const colors = lightColors;

export const assets = {
  wallsLogoIndented:
    "https://assets.wallsentertainment.com/logo-variations/black-gradient-indented.png",
  wallsLogoFallback:
    "https://assets.wallsentertainment.com/logo-variations/black-logo.png",
  heroVideoMobile:
    "https://assets.wallsentertainment.com/hero-video-mobile-v2.mp4",
};

export const urls = {
  portalResetPassword: "https://portal.walls.agency/reset-password",
  terms: "https://wallsentertainment.com/terms-and-conditions",
  privacy: "https://wallsentertainment.com/privacy-policy",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export function getColorsForScheme(scheme: ColorScheme): AppColors {
  return scheme === "dark" ? darkColors : lightColors;
}

export function getVoiceColorsForScheme(scheme: ColorScheme): VoiceOverlayColors {
  return scheme === "dark" ? darkVoiceColors : lightVoiceColors;
}

export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: ColorScheme | null | undefined,
): ColorScheme {
  if (preference === "light" || preference === "dark") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}
