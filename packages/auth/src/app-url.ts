/**
 * Resolve monorepo app origins from `apps.subdomain` (and local env overrides).
 * Legacy `apps.url_redirect` path values remain for walls-app until cutover.
 */

const DEFAULT_ROOT_DOMAIN = "kenoo.io";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function envOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return stripTrailingSlash(trimmed);
}

/** Known app origin env vars by slug (local ports / Vercel overrides). */
export function originForAppSlug(slug: string): string | null {
  const map: Record<string, string | undefined> = {
    adpilot: process.env.NEXT_PUBLIC_ADPILOT_URL,
    wallie: process.env.NEXT_PUBLIC_WALLIE_URL,
    settings: process.env.NEXT_PUBLIC_SETTINGS_URL,
    health: process.env.NEXT_PUBLIC_HEALTH_URL,
    calendar: process.env.NEXT_PUBLIC_CALENDAR_URL,
    projects: process.env.NEXT_PUBLIC_PROJECTS_URL,
    admin: process.env.NEXT_PUBLIC_ADMIN_URL,
    crm: process.env.NEXT_PUBLIC_CRM_URL,
    ledger: process.env.NEXT_PUBLIC_LEDGER_URL,
  };

  return envOrigin(map[slug]);
}

/** Build `https://{subdomain}.kenoo.io` from a host label. */
export function buildSubdomainOrigin(
  subdomain: string,
  rootDomain = DEFAULT_ROOT_DOMAIN,
): string {
  const host = subdomain.trim().replace(/^\.+|\.+$/g, "");
  return `https://${host}.${rootDomain}`;
}

export type ResolveAppHrefOptions = {
  slug: string;
  /** Host label from `apps.subdomain` (preferred in monorepo). */
  subdomain?: string | null;
  /** Legacy walls-app path or absolute URL from `apps.url_redirect`. */
  urlRedirect?: string | null;
  /**
   * Legacy platform prefix (e.g. `/agents`) used only when subdomain is empty
   * and url_redirect is a relative path.
   */
  platformBase?: string;
};

/**
 * Where a launcher / profile-button app should navigate.
 * Preference: env origin → subdomain origin → absolute url_redirect → legacy path.
 */
export function resolveAppHref(options: ResolveAppHrefOptions): string {
  const {
    slug,
    subdomain,
    urlRedirect,
    platformBase = "/agents",
  } = options;

  const fromEnv = originForAppSlug(slug);
  if (fromEnv) return fromEnv;

  const sub = subdomain?.trim();
  if (sub) return buildSubdomainOrigin(sub);

  const redirect = urlRedirect?.trim();
  if (redirect && /^https?:\/\//i.test(redirect)) {
    return stripTrailingSlash(redirect);
  }

  // No platform base → keep legacy relative paths as-is (portal launcher).
  if (!platformBase?.trim()) {
    if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
      return redirect;
    }
    if (redirect) {
      return `/${redirect.replace(/^\/*/, "")}`;
    }
    return `/${slug}`;
  }

  if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
    const pathPart = redirect.replace(/^\/*/, "");
    return `${stripTrailingSlash(platformBase)}/${pathPart}`;
  }

  if (redirect) {
    const pathPart = redirect.replace(/^\/*/, "");
    return `${stripTrailingSlash(platformBase)}/${pathPart}`;
  }

  return `${stripTrailingSlash(platformBase)}/${slug}`;
}
