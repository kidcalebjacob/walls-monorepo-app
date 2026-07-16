import { sanitizePostLoginRedirect } from "./post-login-redirect";

const DEFAULT_DEV_PORTAL_ORIGIN = "http://localhost:3002";
const DEFAULT_PROD_PORTAL_ORIGIN = "https://portal.kenoo.io";
const LEGACY_PROD_PORTAL_ORIGIN = "https://portal.walls.agency";

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

function portalOriginForHost(hostname: string): string | null {
  if (hostname.endsWith(".kenoo.io") && hostname !== "portal.kenoo.io") {
    return DEFAULT_PROD_PORTAL_ORIGIN;
  }
  if (hostname.endsWith(".walls.agency") && hostname !== "portal.walls.agency") {
    // Prefer Kenoo portal; legacy walls.agency hosts still share auth via cookie domain.
    return DEFAULT_PROD_PORTAL_ORIGIN;
  }
  return null;
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
    // Stale env after rebrand: never send users to the dead walls.agency portal.
    if (origin === LEGACY_PROD_PORTAL_ORIGIN) {
      return DEFAULT_PROD_PORTAL_ORIGIN;
    }
    return origin;
  }

  if (currentAppOrigin) {
    try {
      const host = new URL(currentAppOrigin).hostname;
      const fromHost = portalOriginForHost(host);
      if (fromHost) return fromHost;
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
    const safeRedirect = sanitizePostLoginRedirect(options.redirect);
    if (safeRedirect) {
      loginUrl.searchParams.set("redirect", safeRedirect);
    }
  }
  if (options?.logout) {
    loginUrl.searchParams.set("logout", "1");
  }

  return loginUrl.toString();
}

/** Portal URL where invited users set their password after clicking the invite email. */
export function buildPortalCreatePasswordUrl(
  currentAppOrigin?: string,
): string {
  return new URL(
    "/create-password",
    resolvePortalLoginOrigin(currentAppOrigin),
  ).toString();
}
