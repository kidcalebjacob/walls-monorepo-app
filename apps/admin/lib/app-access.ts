import { createAdminClient } from "@walls/supabase/admin";

import {
  type AppAccessRecord,
  isOrgManagedAppSlug,
} from "./app-access-shared";

export type { AppAccessRecord } from "./app-access-shared";
export {
  isOrgManagedAppSlug,
  ORG_MANAGED_APP_EXCLUDED_SLUGS,
} from "./app-access-shared";

type AppRow = {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
};

function mapApp(row: AppRow): AppAccessRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    iconUrl: row.icon_url,
  };
}

export async function listManagedApps(): Promise<AppAccessRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("apps")
    .select("id, slug, name, icon_url")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AppRow[])
    .filter((row) => isOrgManagedAppSlug(row.slug))
    .map(mapApp);
}

export async function listAccountAppIds(accountId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_app_access")
    .select("app_id")
    .eq("account_id", accountId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => row.app_id as string)
    .filter(Boolean);
}

export async function listAccountUserAppIds(params: {
  accountId: string;
  userId: string;
}): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_app_user_access")
    .select("app_id")
    .eq("account_id", params.accountId)
    .eq("user_id", params.userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => row.app_id as string)
    .filter(Boolean);
}

export async function listMemberAppIdsForAccount(
  accountId: string,
  userIds: string[],
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  for (const userId of userIds) {
    result[userId] = [];
  }
  if (userIds.length === 0) return result;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_app_user_access")
    .select("user_id, app_id")
    .eq("account_id", accountId)
    .in("user_id", userIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const appId = row.app_id as string;
    if (!userId || !appId) continue;
    if (!result[userId]) result[userId] = [];
    result[userId].push(appId);
  }

  return result;
}

async function assertManagedApp(
  appId: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: app, error } = await admin
    .from("apps")
    .select("id, slug, is_active")
    .eq("id", appId)
    .maybeSingle();

  if (error || !app) {
    return { ok: false, error: "App not found" };
  }
  if (!app.is_active || !isOrgManagedAppSlug(app.slug as string)) {
    return { ok: false, error: "App cannot be managed here" };
  }
  return { ok: true, slug: app.slug as string };
}

/** Enable an app on the account catalog (account_app_access). */
export async function grantAccountAppAccess(params: {
  accountId: string;
  appId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const appCheck = await assertManagedApp(params.appId);
  if (!appCheck.ok) return appCheck;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("account_app_access")
    .select("id")
    .eq("account_id", params.accountId)
    .eq("app_id", params.appId)
    .maybeSingle();

  if (existing) return { ok: true };

  const { error } = await admin.from("account_app_access").insert({
    account_id: params.accountId,
    app_id: params.appId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Remove an app from the account catalog and revoke every member's
 * account_app_user_access row for that app on this account.
 */
export async function revokeAccountAppAccess(params: {
  accountId: string;
  appId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const appCheck = await assertManagedApp(params.appId);
  if (!appCheck.ok) return appCheck;

  const admin = createAdminClient();

  const { error: memberError } = await admin
    .from("account_app_user_access")
    .delete()
    .eq("account_id", params.accountId)
    .eq("app_id", params.appId);

  if (memberError) return { ok: false, error: memberError.message };

  const { error } = await admin
    .from("account_app_access")
    .delete()
    .eq("account_id", params.accountId)
    .eq("app_id", params.appId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function grantAccountUserAppAccess(params: {
  accountId: string;
  userId: string;
  appId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const appCheck = await assertManagedApp(params.appId);
  if (!appCheck.ok) return appCheck;

  const admin = createAdminClient();

  const { data: catalog } = await admin
    .from("account_app_access")
    .select("id")
    .eq("account_id", params.accountId)
    .eq("app_id", params.appId)
    .maybeSingle();

  if (!catalog) {
    return {
      ok: false,
      error: "Enable this app for the organization before assigning it to a member",
    };
  }

  const { data: membership } = await admin
    .from("account_users")
    .select("id")
    .eq("account_id", params.accountId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!membership) {
    return { ok: false, error: "User is not a member of this organization" };
  }

  const { data: existing } = await admin
    .from("account_app_user_access")
    .select("id")
    .eq("account_id", params.accountId)
    .eq("user_id", params.userId)
    .eq("app_id", params.appId)
    .maybeSingle();

  if (existing) return { ok: true };

  const { error } = await admin.from("account_app_user_access").insert({
    account_id: params.accountId,
    user_id: params.userId,
    app_id: params.appId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function revokeAccountUserAppAccess(params: {
  accountId: string;
  userId: string;
  appId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const appCheck = await assertManagedApp(params.appId);
  if (!appCheck.ok) return appCheck;

  const admin = createAdminClient();
  const { error } = await admin
    .from("account_app_user_access")
    .delete()
    .eq("account_id", params.accountId)
    .eq("user_id", params.userId)
    .eq("app_id", params.appId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
