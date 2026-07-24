/** Cloudflare Image Resizing for the assets zone (manual /cdn-cgi/image/ URLs). */

export const CF_ASSETS_ORIGIN =
  process.env.NEXT_PUBLIC_CF_ASSETS_ORIGIN ??
  "https://assets.wallsentertainment.com";

export const CF_ASSETS_HOST = new URL(CF_ASSETS_ORIGIN).hostname;

const CF_IMAGE_SEGMENT = "/cdn-cgi/image/";

const PASSTHROUGH_EXTENSIONS = /\.(svg|ico|mp4|webm|mov)(\?|$)/i;

export function isCfResizedUrl(url: string): boolean {
  return url.includes(CF_IMAGE_SEGMENT);
}

export function isCfAssetsUrl(url: string): boolean {
  try {
    const parsed = new URL(url, CF_ASSETS_ORIGIN);
    return parsed.hostname === CF_ASSETS_HOST;
  } catch {
    return false;
  }
}

/** Build a Cloudflare resized URL from an assets path (e.g. `/fallback-icon.png`). */
export function cfImage(
  path: string,
  width: number,
  quality = 85
): string {
  const pathname = path.startsWith("http")
    ? new URL(path).pathname
    : path.startsWith("/")
      ? path
      : `/${path}`;

  const options = `width=${Math.round(width)},quality=${quality},format=auto`;
  return `${CF_ASSETS_ORIGIN}${CF_IMAGE_SEGMENT}${options}${pathname}`;
}

/**
 * Resize a full URL when it is served from the Cloudflare assets zone.
 * Other origins are returned unchanged.
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  width: number,
  quality = 85
): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();
  if (isCfResizedUrl(trimmed)) return trimmed;
  if (!isCfAssetsUrl(trimmed)) return trimmed;

  try {
    const pathname = new URL(trimmed, CF_ASSETS_ORIGIN).pathname;
    if (PASSTHROUGH_EXTENSIONS.test(pathname)) return trimmed;
    return cfImage(pathname, width, quality);
  } catch {
    return trimmed;
  }
}

/** @deprecated Prefer optimizeImageUrl — kept for readability at call sites. */
export const getCfOptimizedUrl = optimizeImageUrl;
