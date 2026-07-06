const DEFAULT_DEV_PORTAL_ORIGIN = "http://localhost:3002";
const DEFAULT_PROD_PORTAL_ORIGIN = "https://portal.walls.agency";

export function normalizePortalOrigin(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

/**
 * Portal origin for login/logout redirects.
 * Skips env values that match the current app host (common Vercel misconfiguration).
 */
export function resolvePortalLoginOrigin(currentAppOrigin?: string): string {
  const candidates = [
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_WALLS_AGENCY_URL,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const origin = normalizePortalOrigin(raw);
    if (!origin) continue;
    if (currentAppOrigin && origin === currentAppOrigin) continue;
    return origin;
  }

  if (currentAppOrigin) {
    try {
      const host = new URL(currentAppOrigin).hostname;
      if (host.endsWith(".walls.agency") && host !== "portal.walls.agency") {
        return DEFAULT_PROD_PORTAL_ORIGIN;
      }
    } catch {
      // ignore
    }
  }

  if (process.env.NODE_ENV === "development") {
    return DEFAULT_DEV_PORTAL_ORIGIN;
  }

  return DEFAULT_PROD_PORTAL_ORIGIN;
}

export function buildPortalLoginUrl(
  currentAppOrigin: string | undefined,
  options?: { redirect?: string; logout?: boolean },
): string {
  const loginUrl = new URL("/login", resolvePortalLoginOrigin(currentAppOrigin));

  if (options?.redirect) {
    loginUrl.searchParams.set("redirect", options.redirect);
  }
  if (options?.logout) {
    loginUrl.searchParams.set("logout", "1");
  }

  return loginUrl.toString();
}
