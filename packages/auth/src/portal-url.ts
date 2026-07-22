import { sanitizePostLoginRedirect } from "./post-login-redirect";

const DEFAULT_DEV_PORTAL_ORIGIN = "http://localhost:3002";
const DEFAULT_PROD_PORTAL_ORIGIN = "https://portal.kenoo.io";
const LEGACY_PROD_PORTAL_ORIGIN = "https://portal.walls.agency";

/** Local next-dev ports that belong to apps, not the portal. */
const LOCAL_APP_PORTS = new Set([
  3000, 3001, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012,
]);

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

function looksLikeLocalAppOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return false;
    }
    const port = Number(url.port || "80");
    return LOCAL_APP_PORTS.has(port);
  } catch {
    return false;
  }
}

/**
 * Portal origin for login/logout redirects.
 * Skips env values that match the current app host (common Vercel misconfiguration).
 * Also skips local env values that point at an app port (swapped portal/adpilot trap).
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
    if (looksLikeLocalAppOrigin(origin)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[auth] Portal URL (${origin}) looks like an app port; using ${DEFAULT_DEV_PORTAL_ORIGIN}`,
        );
      }
      continue;
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

/**
 * redirectTo embedded in Supabase invite emails.
 *
 * Invite links are opened from email clients (often on another device), and
 * hosted Supabase rejects localhost redirectTo values that aren't allow-listed —
 * falling back to Site URL (`https://portal.kenoo.io`), which our portal then
 * bounces to `/login`. Always prefer the production portal for invite emails
 * when the resolved portal origin is local.
 */
export function buildPortalInviteRedirectUrl(
  currentAppOrigin?: string,
): string {
  const origin = resolvePortalLoginOrigin(currentAppOrigin);

  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return new URL("/create-password", DEFAULT_PROD_PORTAL_ORIGIN).toString();
    }
  } catch {
    // fall through
  }

  return new URL("/create-password", origin).toString();
}
