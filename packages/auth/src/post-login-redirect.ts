/**
 * Safe post-login redirect handling for the portal and other auth entry points.
 */

function configuredOrigins(): string[] {
  const values = [
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_WALLS_AGENCY_URL,
    process.env.NEXT_PUBLIC_ADPILOT_URL,
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

export function isAllowedPostLoginRedirect(target: string): boolean {
  if (!target) return false;

  if (target.startsWith("/") && !target.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(target);

    if (process.env.NODE_ENV === "development" && url.hostname === "localhost") {
      return true;
    }

    return configuredOrigins().includes(url.origin);
  } catch {
    return false;
  }
}

export function resolvePostLoginRedirect(
  redirect: string | null | undefined,
  fallbackPath = "/",
): string {
  if (redirect && isAllowedPostLoginRedirect(redirect)) {
    return redirect;
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
