/**
 * WALLS brand color values for JS/TS (inline styles, Framer Motion, charts, etc.).
 * Keep in sync with `walls-theme.css`.
 */
export const wallsColors = {
  blue: { DEFAULT: "#0066b2", hover: "#005091" },
  beige: { DEFAULT: "#f5e6d3", hover: "#ebd5bb" },
  light: { DEFAULT: "#30a1f4", hover: "#0066b2" },
  yellow: { DEFAULT: "#e2f85c", hover: "#e2f85c" },
  darkYellow: { DEFAULT: "#e0ea00", hover: "#c8d100" },
  lime: { DEFAULT: "#ceff00", hover: "#5bd424" },
  black: { DEFAULT: "#000000", hover: "#0a0b0d" },
  red: { DEFAULT: "#d82727", hover: "#b91f1f" },
  sky: { DEFAULT: "#6eadc0", hover: "#5a9ba8" },
  emerald: { DEFAULT: "#8dcf76", hover: "#75b85f" },
  forest: { DEFAULT: "#2b5b00", hover: "#234a00" },
  white: { DEFAULT: "#FCFCFC", hover: "#FCFCFC" },
} as const;

export type WallsColorName = keyof typeof wallsColors;

const cssVarNames: Record<WallsColorName, string> = {
  blue: "--walls-blue",
  beige: "--walls-beige",
  light: "--walls-light",
  yellow: "--walls-yellow",
  darkYellow: "--walls-dark-yellow",
  lime: "--walls-lime",
  black: "--walls-black",
  red: "--walls-red",
  sky: "--walls-sky",
  emerald: "--walls-emerald",
  forest: "--walls-forest",
  white: "--walls-white",
};

/** CSS custom property reference, e.g. `wallsCssVar("yellow")` → `var(--walls-yellow)` */
export function wallsCssVar(name: WallsColorName): string {
  return `var(${cssVarNames[name]})`;
}

/** Hex value for a brand color */
export function wallsColor(
  name: WallsColorName,
  variant: "DEFAULT" | "hover" = "DEFAULT",
): string {
  return wallsColors[name][variant];
}
