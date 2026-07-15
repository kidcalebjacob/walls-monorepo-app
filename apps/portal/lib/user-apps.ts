import { getSupabaseClient } from "@walls/auth";

export type PortalLauncherApp = {
  app_id: string;
  name: string;
  slug: string;
  icon: string;
  href: string;
};

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function envOrigin(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return stripTrailingSlash(trimmed);
}

/** Known app origins by slug for when `apps.url_redirect` is relative. */
function originForSlug(slug: string): string | null {
  const map: Record<string, string> = {
    adpilot: envOrigin(
      process.env.NEXT_PUBLIC_ADPILOT_URL,
      process.env.NODE_ENV === "development"
        ? "http://localhost:3001"
        : "https://adpilot.walls.agency",
    ),
    wallie: envOrigin(
      process.env.NEXT_PUBLIC_WALLIE_URL,
      process.env.NODE_ENV === "development"
        ? "http://localhost:3003"
        : "https://wallie.walls.agency",
    ),
    settings: envOrigin(
      process.env.NEXT_PUBLIC_SETTINGS_URL,
      process.env.NODE_ENV === "development"
        ? "http://localhost:3004"
        : "https://settings.walls.agency",
    ),
    health: envOrigin(
      process.env.NEXT_PUBLIC_HEALTH_URL,
      process.env.NODE_ENV === "development"
        ? "http://localhost:3005"
        : "https://health.walls.agency",
    ),
    calendar: envOrigin(
      process.env.NEXT_PUBLIC_CALENDAR_URL,
      process.env.NODE_ENV === "development"
        ? "http://localhost:3006"
        : "https://calendar.walls.agency",
    ),
    projects: envOrigin(
      process.env.NEXT_PUBLIC_PROJECTS_URL,
      process.env.NODE_ENV === "development"
        ? "http://localhost:3007"
        : "https://projects.walls.agency",
    ),
    admin: envOrigin(
      process.env.NEXT_PUBLIC_ADMIN_URL,
      process.env.NODE_ENV === "development"
        ? "http://localhost:3008"
        : "https://admin.walls.agency",
    ),
  };

  return map[slug] ?? null;
}

export function resolveAppHref(slug: string, urlRedirect: string | null): string {
  const redirect = urlRedirect?.trim();
  if (redirect && /^https?:\/\//i.test(redirect)) {
    return stripTrailingSlash(redirect);
  }

  const fromEnv = originForSlug(slug);
  if (fromEnv) return fromEnv;

  if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }

  if (redirect) {
    const cleaned = redirect.replace(/^\/*/, "");
    return `/${cleaned}`;
  }

  return `/${slug}`;
}

function pushApp(
  appList: PortalLauncherApp[],
  seen: Set<string>,
  appId: string,
  apps: unknown,
) {
  if (seen.has(appId)) return;
  if (!apps || typeof apps !== "object") return;

  const a = Array.isArray(apps) ? apps[0] : apps;
  if (
    !a ||
    typeof a !== "object" ||
    !("slug" in a) ||
    !("name" in a) ||
    a.slug == null ||
    a.name == null
  ) {
    return;
  }

  const slug = String(a.slug);
  const name = String(a.name);
  const urlRedirect =
    "url_redirect" in a && a.url_redirect != null
      ? String(a.url_redirect)
      : null;
  const iconUrl =
    "icon_url" in a && a.icon_url
      ? String(a.icon_url)
      : `https://assets.wallsentertainment.com/walls-app-icons/${slug}.svg`;

  seen.add(appId);
  appList.push({
    app_id: appId,
    name,
    slug,
    icon: iconUrl,
    href: resolveAppHref(slug, urlRedirect),
  });
}

/** Load personal + account app grants for the portal launcher. */
export async function fetchUserLauncherApps(
  userId: string,
): Promise<PortalLauncherApp[]> {
  const supabase = getSupabaseClient();

  const [accessResult, membershipResult] = await Promise.all([
    supabase
      .from("user_app_access")
      .select("app_id, order_index, apps(id, slug, name, icon_url, url_redirect)")
      .eq("user_id", userId)
      .order("order_index", { ascending: true }),
    supabase.from("account_users").select("account_id").eq("user_id", userId),
  ]);

  const accessRows = accessResult.data ?? [];
  const accountIds = (membershipResult.data ?? [])
    .map((row) => row.account_id)
    .filter((id): id is string => !!id);

  let accountAccessRows: { app_id: string; apps: unknown }[] = [];

  if (accountIds.length > 0) {
    const { data } = await supabase
      .from("account_app_access")
      .select("app_id, apps(id, slug, name, icon_url, url_redirect)")
      .in("account_id", accountIds);
    accountAccessRows = data ?? [];
  }

  const appList: PortalLauncherApp[] = [];
  const seenAppIds = new Set<string>();

  accessRows.forEach((row: { app_id: string; apps: unknown }) => {
    pushApp(appList, seenAppIds, row.app_id, row.apps);
  });
  accountAccessRows.forEach((row) => {
    pushApp(appList, seenAppIds, row.app_id, row.apps);
  });

  return appList;
}
