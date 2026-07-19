import type { CookieOptions } from "@supabase/ssr";

function isKenooHost(hostname: string): boolean {
  return hostname === "kenoo.io" || hostname.endsWith(".kenoo.io");
}

function isWallsAgencyHost(hostname: string): boolean {
  return hostname === "walls.agency" || hostname.endsWith(".walls.agency");
}

function isLocalHost(hostname?: string): boolean {
  if (!hostname) return false;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

/**
 * Shared Supabase auth cookie domain for SSO across subdomains (portal → apps).
 * Set SUPABASE_AUTH_COOKIE_DOMAIN=.kenoo.io to override.
 *
 * On localhost we intentionally return undefined so cookies are host-only and
 * shared across ports (portal:3002 ↔ apps). A production Domain= value copied
 * into local env would otherwise break session sharing or bloat cookies.
 */
export function getSupabaseAuthCookieOptions(
  hostname?: string,
): CookieOptions | undefined {
  if (isLocalHost(hostname)) {
    return undefined;
  }

  const configured = process.env.SUPABASE_AUTH_COOKIE_DOMAIN?.trim();
  if (configured) {
    // Stale rebrand value — prefer Kenoo so SSO works on *.kenoo.io.
    const domain =
      configured === ".walls.agency" || configured === "walls.agency"
        ? ".kenoo.io"
        : configured;

    if (domain.includes("localhost")) {
      return undefined;
    }

    return {
      domain,
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }

  if (hostname && isKenooHost(hostname)) {
    return {
      domain: ".kenoo.io",
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }

  if (hostname && isWallsAgencyHost(hostname)) {
    return {
      domain: ".walls.agency",
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }

  if (!hostname && process.env.NODE_ENV === "production") {
    return {
      domain: ".kenoo.io",
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }

  return undefined;
}

export function mergeSupabaseCookieOptions(
  options?: CookieOptions,
  hostname?: string,
): CookieOptions {
  const defaults = getSupabaseAuthCookieOptions(hostname);
  if (!defaults) return options ?? {};
  return { ...options, ...defaults };
}
