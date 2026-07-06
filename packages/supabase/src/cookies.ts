import type { CookieOptions } from "@supabase/ssr";

function isWallsAgencyHost(hostname: string): boolean {
  return hostname === "walls.agency" || hostname.endsWith(".walls.agency");
}

/**
 * Shared Supabase auth cookie domain for SSO across subdomains (portal → AdPilot).
 * Set SUPABASE_AUTH_COOKIE_DOMAIN=.walls.agency to override.
 */
export function getSupabaseAuthCookieOptions(
  hostname?: string,
): CookieOptions | undefined {
  const configured = process.env.SUPABASE_AUTH_COOKIE_DOMAIN?.trim();
  if (configured) {
    return {
      domain: configured,
      path: "/",
      sameSite: "lax",
      secure: !configured.includes("localhost"),
    };
  }

  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);

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
      domain: ".walls.agency",
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
