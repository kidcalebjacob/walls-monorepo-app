export const DRAWER_WIDTH_RATIO = 0.8;
export const MAIN_PUSH_RATIO = 0.76;

/** Keeps sidebar list items from extending under the pushed chat panel. */
export function getSidebarContentInset(
  screenWidth: number,
  extraPadding = 16,
): number {
  const overlap = screenWidth * (DRAWER_WIDTH_RATIO - MAIN_PUSH_RATIO);
  return overlap + extraPadding;
}

export function getSidebarContentMaxX(
  screenWidth: number,
  extraPadding = 16,
): number {
  return screenWidth * MAIN_PUSH_RATIO - extraPadding;
}
