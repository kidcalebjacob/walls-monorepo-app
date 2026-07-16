/**
 * Safe post-login redirect handling for the portal and other auth entry points.
 */

import { normalizePortalOrigin } from "./portal-url";

const AUTH_ENTRY_PATHS = ["/login", "/reset-password", "/create-password"] as const;

function isAuthEntryPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return AUTH_ENTRY_PATHS.some(
    (entry) => path === entry || path.startsWith(`${entry}/`),
  );
}

function portalOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_WALLS_AGENCY_URL,
  ]
    .map((value) => (value ? normalizePortalOrigin(value) : null))
    .filter((value): value is string => value !== null);
}

function configuredOrigins(): string[] {
  const values = [
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_WALLS_AGENCY_URL,
    process.env.NEXT_PUBLIC_ADPILOT_URL,
    process.env.NEXT_PUBLIC_SETTINGS_URL,
    process.env.NEXT_PUBLIC_HEALTH_URL,
    process.env.NEXT_PUBLIC_CALENDAR_URL,
    process.env.NEXT_PUBLIC_PROJECTS_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL,
    process.env.NEXT_PUBLIC_CRM_URL,
    process.env.NEXT_PUBLIC_LEDGER_URL,
    process.env.NEXT_PUBLIC_WALLIE_URL,
    process.env.NEXT_PUBLIC_WALLS_PUBLIC_SITE_URL,
    process.env.APP_BASE_URL,
  ];

  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => value !== null);
}

function parseAbsoluteUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function cleanAbsoluteUrl(url: URL): string {
  const clean = new URL(url.href);
  clean.searchParams.delete("redirect");
  return clean.href;
}

/**
 * Unwrap nested `?redirect=` chains and never return auth entry URLs.
 * Returns null when the target should be ignored (use platform fallback).
 */
export function sanitizePostLoginRedirect(
  target: string | null | undefined,
): string | null {
  if (!target?.trim()) return null;

  let current = target.trim();

  for (let depth = 0; depth < 10; depth += 1) {
    if (current.startsWith("/") && !current.startsWith("//")) {
      const pathOnly = current.split("?")[0] ?? current;
      if (isAuthEntryPath(pathOnly)) return null;
      return current;
    }

    const url = parseAbsoluteUrl(current);
    if (!url) return null;

    const nested = url.searchParams.get("redirect");
    const shouldUnwrap =
      nested &&
      (isAuthEntryPath(url.pathname) ||
        nested.includes("/login") ||
        nested.includes("redirect="));

    if (shouldUnwrap) {
      current = nested;
      continue;
    }

    if (isAuthEntryPath(url.pathname)) {
      if (portalOrigins().includes(url.origin)) {
        return null;
      }
      return `${url.origin}/`;
    }

    return cleanAbsoluteUrl(url);
  }

  const finalUrl = parseAbsoluteUrl(current);
  if (!finalUrl) return null;
  if (isAuthEntryPath(finalUrl.pathname)) {
    return portalOrigins().includes(finalUrl.origin) ? null : `${finalUrl.origin}/`;
  }
  return cleanAbsoluteUrl(finalUrl);
}

export function isAllowedPostLoginRedirect(target: string): boolean {
  if (!target) return false;

  const sanitized = sanitizePostLoginRedirect(target);
  if (!sanitized || sanitized !== target) {
    if (!sanitized) return false;
    target = sanitized;
  }

  if (target.startsWith("/") && !target.startsWith("//")) {
    return !isAuthEntryPath(target.split("?")[0] ?? target);
  }

  try {
    const url = new URL(target);

    if (process.env.NODE_ENV === "development" && url.hostname === "localhost") {
      return !isAuthEntryPath(url.pathname);
    }

    if (isAuthEntryPath(url.pathname)) return false;

    if (configuredOrigins().includes(url.origin)) return true;

    // Allow same-brand subdomain redirects even when individual app URL envs lag.
    const host = url.hostname;
    if (host === "kenoo.io" || host.endsWith(".kenoo.io")) return true;
    if (host === "walls.agency" || host.endsWith(".walls.agency")) return true;

    return false;
  } catch {
    return false;
  }
}

export function resolvePostLoginRedirect(
  redirect: string | null | undefined,
  fallbackPath = "/",
): string {
  const sanitized = sanitizePostLoginRedirect(redirect);
  if (sanitized && isAllowedPostLoginRedirect(sanitized)) {
    return sanitized;
  }

  return fallbackPath;
}

export function navigateAfterLogin(
  redirect: string | null | undefined,
  fallbackPath: string,
  router: { push: (href: string) => void; refresh: () => void },
): void {
  const destination = resolvePostLoginRedirect(redirect, fallbackPath);

  if (destination.startsWith("http://") || destination.startsWith("https://")) {
    window.location.assign(destination);
    return;
  }

  router.push(destination);
  router.refresh();
}

/** Safe return URL when sending unauthenticated users to the portal login. */
export function safeAuthReturnUrl(href: string, origin: string, pathname: string): string {
  if (isAuthEntryPath(pathname)) {
    return `${origin}/`;
  }
  return sanitizePostLoginRedirect(href) ?? `${origin}/`;
}
