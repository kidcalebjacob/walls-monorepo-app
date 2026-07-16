export const KENOO_PUBLIC_SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.NEXT_PUBLIC_WALLS_PUBLIC_SITE_URL ??
  process.env.APP_BASE_URL ??
  "https://wallsentertainment.com"
).replace(/\/$/, "");

/** @deprecated Use KENOO_PUBLIC_SITE_URL */
export const WALLS_PUBLIC_SITE_URL = KENOO_PUBLIC_SITE_URL;

export function publicSitePath(path: string): string {
  return `${KENOO_PUBLIC_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
