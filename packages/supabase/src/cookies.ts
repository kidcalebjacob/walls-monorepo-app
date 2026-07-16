import type { CookieOptions } from "@supabase/ssr";

function isKenooHost(hostname: string): boolean {
  return hostname === "kenoo.io" || hostname.endsWith(".kenoo.io");
}

function isWallsAgencyHost(hostname: string): boolean {
  return hostname === "walls.agency" || hostname.endsWith(".walls.agency");
}

/**
 * Shared Supabase auth cookie domain for SSO across subdomains (portal → apps).
 * Set SUPABASE_AUTH_COOKIE_DOMAIN=.kenoo.io to override.
 */
export function getSupabaseAuthCookieOptions(
  hostname?: string,
): CookieOptions | undefined {
  const configured = process.env.SUPABASE_AUTH_COOKIE_DOMAIN?.trim();
  if (configured) {
    // Stale rebrand value — prefer Kenoo so SSO works on *.kenoo.io.
    const domain =
      configured === ".walls.agency" || configured === "walls.agency"
        ? ".kenoo.io"
        : configured;
    return {
      domain,
      path: "/",
      sameSite: "lax",
      secure: !domain.includes("localhost"),
    };
  }

  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);

  if (host && isKenooHost(host)) {
    return {
      domain: ".kenoo.io",
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }

  if (host && isWallsAgencyHost(host)) {
    return {
      domain: ".walls.agency",
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }

  if (!host && process.env.NODE_ENV === "production") {
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
