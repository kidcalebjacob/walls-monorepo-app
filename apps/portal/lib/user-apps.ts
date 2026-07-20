import {
  getSupabaseClient,
  readActiveAccountIdFromDocumentCookie,
  resolveAppHref,
  writeActiveAccountIdToDocumentCookie,
} from "@walls/auth";

export type PortalLauncherApp = {
  app_id: string;
  name: string;
  slug: string;
  icon: string;
  href: string;
  subdomain?: string | null;
};

export type PortalAccountOption = {
  id: string;
  name: string;
  accountType: "personal" | "organization";
  iconUrl: string | null;
  isDefault: boolean;
};

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
  const subdomain =
    "subdomain" in a && a.subdomain != null ? String(a.subdomain) : null;
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
    subdomain,
    href: resolveAppHref({
      slug,
      subdomain,
      urlRedirect,
      // Portal launcher should not fall back to /agents/* paths.
      platformBase: "",
    }),
  });
}

/** Accounts the user belongs to, for the portal account switcher. */
export async function fetchPortalAccounts(userId: string): Promise<{
  accounts: PortalAccountOption[];
  activeAccountId: string | null;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("account_users")
    .select(
      `is_default, accounts!inner (
        id, name, account_type, icon_url
      )`,
    )
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) {
    console.error("[portal] list accounts:", error);
    return { accounts: [], activeAccountId: null };
  }

  const accounts: PortalAccountOption[] = [];
  for (const row of data ?? []) {
    const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    if (!account) continue;
    accounts.push({
      id: account.id as string,
      name: account.name as string,
      accountType: account.account_type as "personal" | "organization",
      iconUrl: (account.icon_url as string | null) ?? null,
      isDefault: Boolean(row.is_default),
    });
  }

  accounts.sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

  const preferredAccountId = readActiveAccountIdFromDocumentCookie();
  const fromCookie = preferredAccountId
    ? accounts.find((account) => account.id === preferredAccountId)
    : undefined;
  let activeAccountId =
    fromCookie?.id ??
    accounts.find((account) => account.isDefault)?.id ??
    accounts[0]?.id ??
    null;

  // Avoid landing on a default org/personal account with zero app grants when
  // the user has access elsewhere (common after SaaS cutover).
  if (activeAccountId && !fromCookie) {
    const { data: userGrants } = await supabase
      .from("account_app_user_access")
      .select("account_id")
      .eq("user_id", userId);

    const grantAccountIds = new Set(
      (userGrants ?? [])
        .map((row) => row.account_id as string)
        .filter(Boolean),
    );

    if (grantAccountIds.size > 0 && !grantAccountIds.has(activeAccountId)) {
      const fallback =
        accounts.find((account) => grantAccountIds.has(account.id)) ?? null;
      if (fallback) {
        activeAccountId = fallback.id;
      }
    }
  }

  if (activeAccountId) {
    writeActiveAccountIdToDocumentCookie(activeAccountId);
  }

  return { accounts, activeAccountId };
}

/**
 * Load launcher apps for the active Kenoo account via account_app_user_access.
 * Falls back to legacy user_app_access when the user has no account grants yet
 * so walls-app users keep working during cutover.
 */
export async function fetchUserLauncherApps(
  userId: string,
  explicitAccountId?: string | null,
): Promise<PortalLauncherApp[]> {
  const supabase = getSupabaseClient();

  const [membershipResult, legacyAccessResult] = await Promise.all([
    supabase
      .from("account_users")
      .select("account_id, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false }),
    supabase
      .from("user_app_access")
      .select(
        "app_id, order_index, apps(id, slug, name, icon_url, url_redirect, subdomain)",
      )
      .eq("user_id", userId)
      .order("order_index", { ascending: true }),
  ]);

  const memberships = membershipResult.data ?? [];
  const accountIds = memberships
    .map((row) => row.account_id)
    .filter((id): id is string => !!id);
  const legacyAccessRows = legacyAccessResult.data ?? [];

  const preferredAccountId =
    explicitAccountId ?? readActiveAccountIdFromDocumentCookie();
  const defaultMembership = memberships.find((row) => row.is_default === true);
  const activeAccountId =
    (preferredAccountId && accountIds.includes(preferredAccountId)
      ? preferredAccountId
      : null) ??
    (defaultMembership?.account_id as string | undefined) ??
    accountIds[0] ??
    null;

  const [{ count: accountUserGrantCount }, { count: accountGrantCount }] =
    accountIds.length > 0
      ? await Promise.all([
          supabase
            .from("account_app_user_access")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .in("account_id", accountIds),
          supabase
            .from("account_app_access")
            .select("id", { count: "exact", head: true })
            .in("account_id", accountIds),
        ])
      : [{ count: 0 }, { count: 0 }];

  const onSaaS =
    (accountUserGrantCount ?? 0) > 0 || (accountGrantCount ?? 0) > 0;
  const appList: PortalLauncherApp[] = [];
  const seenAppIds = new Set<string>();

  if (onSaaS) {
    if (!activeAccountId) return [];
    const { data } = await supabase
      .from("account_app_user_access")
      .select(
        "app_id, apps(id, slug, name, icon_url, url_redirect, subdomain)",
      )
      .eq("account_id", activeAccountId)
      .eq("user_id", userId);

    for (const row of data ?? []) {
      pushApp(appList, seenAppIds, row.app_id, row.apps);
    }
    return appList;
  }

  for (const row of legacyAccessRows) {
    pushApp(appList, seenAppIds, row.app_id, row.apps);
  }
  return appList;
}
