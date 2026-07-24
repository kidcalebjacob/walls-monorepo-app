import { cfImage } from "./cf-image";

export const FALLBACK_ICON_PATH = "/fallback-icon.png";

/** Default fallback avatar/icon (128px wide, ~2× for 64px UI). */
export const FALLBACK_ICON_URL = cfImage(FALLBACK_ICON_PATH, 128);

/** Profile/avatar placeholder used in PartnerHub and similar surfaces. */
export const AVATAR_FALLBACK_URL =
  "https://assets.wallsentertainment.com/avatar-fallback-v2.png";

/** True for raw or Cloudflare-resized fallback icon URLs (not for DB persistence). */
export function isFallbackIconUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("fallback-icon.png");
}

/** Sized fallback for small thumbnails (e.g. 20–32px UI at 2×). */
export function fallbackIconUrl(displayPx = 32): string {
  return cfImage(FALLBACK_ICON_PATH, Math.max(32, displayPx * 2));
}
