/**
 * Kenoo brand color values for JS/TS (inline styles, Framer Motion, charts, etc.).
 * Keep in sync with `kenoo-theme.css`.
 */
export const kenooColors = {
  blue: { DEFAULT: "#0066b2", hover: "#005091" },
  beige: { DEFAULT: "#f5e6d3", hover: "#ebd5bb" },
  light: { DEFAULT: "#30a1f4", hover: "#0066b2" },
  yellow: { DEFAULT: "#e2f85c", hover: "#e2f85c" },
  darkYellow: { DEFAULT: "#e0ea00", hover: "#c8d100" },
  lime: { DEFAULT: "#ceff00", hover: "#5bd424" },
  black: { DEFAULT: "#000000", hover: "#0a0b0d" },
  red: { DEFAULT: "#d82727", hover: "#b91f1f" },
  sky: { DEFAULT: "#6eadc0", hover: "#5a9ba8" },
  orange: { DEFAULT: "#f08a5d", hover: "#e07a4d" },
  emerald: { DEFAULT: "#8dcf76", hover: "#75b85f" },
  forest: { DEFAULT: "#2b5b00", hover: "#234a00" },
  white: { DEFAULT: "#FCFCFC", hover: "#FCFCFC" },
} as const;

export type KenooColorName = keyof typeof kenooColors;

const cssVarNames: Record<KenooColorName, string> = {
  blue: "--kenoo-blue",
  beige: "--kenoo-beige",
  light: "--kenoo-light",
  yellow: "--kenoo-yellow",
  darkYellow: "--kenoo-dark-yellow",
  lime: "--kenoo-lime",
  black: "--kenoo-black",
  red: "--kenoo-red",
  sky: "--kenoo-sky",
  orange: "--kenoo-orange",
  emerald: "--kenoo-emerald",
  forest: "--kenoo-forest",
  white: "--kenoo-white",
};

/** CSS custom property reference, e.g. `kenooCssVar("yellow")` → `var(--kenoo-yellow)` */
export function kenooCssVar(name: KenooColorName): string {
  return `var(${cssVarNames[name]})`;
}

/** Hex value for a brand color */
export function kenooColor(
  name: KenooColorName,
  variant: "DEFAULT" | "hover" = "DEFAULT",
): string {
  return kenooColors[name][variant];
}
