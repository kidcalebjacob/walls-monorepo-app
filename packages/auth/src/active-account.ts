import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAuthCookieOptions } from "@walls/supabase/cookies";

/** Shared across portal + apps so launcher and middleware agree on context. */
export const ACTIVE_ACCOUNT_COOKIE = "kenoo_account_id";

export function getActiveAccountCookieOptions(
  hostname?: string,
): CookieOptions {
  const shared = getSupabaseAuthCookieOptions(hostname);
  return {
    path: "/",
    sameSite: "lax",
    // Readable by client launcher/AuthProvider; not a secret.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    ...(shared?.domain ? { domain: shared.domain } : {}),
  };
}

/**
 * Resolve which account scopes app access for Kenoo SaaS.
 * Prefers an explicit cookie/preferred id (when the user is still a member),
 * then is_default, then the first membership.
 */
export async function resolveActiveAccountId(
  supabase: SupabaseClient,
  userId: string,
  preferredAccountId?: string | null,
): Promise<string | null> {
  if (preferredAccountId) {
    const { data: preferred } = await supabase
      .from("account_users")
      .select("account_id")
      .eq("user_id", userId)
      .eq("account_id", preferredAccountId)
      .maybeSingle();
    if (preferred?.account_id) {
      return preferred.account_id as string;
    }
  }

  const { data: memberships, error } = await supabase
    .from("account_users")
    .select("account_id, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error || !memberships?.length) {
    return null;
  }

  const defaultMembership = memberships.find((row) => row.is_default === true);
  return (defaultMembership ?? memberships[0]).account_id as string;
}

/**
 * True when the user is on the Kenoo SaaS app-grant model
 * (has any account_app_user_access or account_app_access via membership).
 */
export async function userHasAccountAppGrants(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: memberships, error: membershipError } = await supabase
    .from("account_users")
    .select("account_id")
    .eq("user_id", userId);

  if (membershipError) {
    console.error("[auth] Error checking account_users:", membershipError);
    return false;
  }

  const accountIds = (memberships ?? [])
    .map((row) => row.account_id)
    .filter((id): id is string => !!id);

  if (accountIds.length === 0) {
    return false;
  }

  const [{ data: userRows, error: userError }, { data: accountRows, error: accountError }] =
    await Promise.all([
      supabase
        .from("account_app_user_access")
        .select("id")
        .eq("user_id", userId)
        .in("account_id", accountIds)
        .limit(1),
      supabase
        .from("account_app_access")
        .select("id")
        .in("account_id", accountIds)
        .limit(1),
    ]);

  if (userError) {
    console.error("[auth] Error checking account_app_user_access:", userError);
  }
  if (accountError) {
    console.error("[auth] Error checking account_app_access:", accountError);
  }

  return (userRows?.length ?? 0) > 0 || (accountRows?.length ?? 0) > 0;
}

/** Per-member grant for a specific account + app. */
export async function accountUserHasAppAccess(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  appId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("account_app_user_access")
    .select("id")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("app_id", appId)
    .maybeSingle();

  if (error) {
    console.error("[auth] Error checking account_app_user_access:", error);
    return false;
  }

  return !!data;
}

export async function userHasLegacyAppAccess(
  supabase: SupabaseClient,
  userId: string,
  appId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_app_access")
    .select("id")
    .eq("user_id", userId)
    .eq("app_id", appId)
    .maybeSingle();

  if (error) {
    console.error("[auth] Error checking user_app_access:", error);
    return false;
  }

  return !!data;
}

/**
 * Which of `accountIds` the user can open `appSlug` with.
 * SaaS: account_app_user_access rows for that app.
 * Legacy: all accountIds when user_app_access grants the app, else none.
 * Unknown / inactive slug: fail open (same as middleware).
 */
export async function getAccountIdsWithAppAccess(
  supabase: SupabaseClient,
  userId: string,
  appSlug: string,
  accountIds: string[],
): Promise<Set<string>> {
  if (accountIds.length === 0) {
    return new Set();
  }

  const { data: appRow, error: appError } = await supabase
    .from("apps")
    .select("id")
    .eq("is_active", true)
    .eq("slug", appSlug)
    .maybeSingle();

  if (appError || !appRow?.id) {
    return new Set(accountIds);
  }

  const appId = appRow.id as string;
  const onSaaS = await userHasAccountAppGrants(supabase, userId);
  if (!onSaaS) {
    const hasLegacy = await userHasLegacyAppAccess(supabase, userId, appId);
    return hasLegacy ? new Set(accountIds) : new Set();
  }

  const { data, error } = await supabase
    .from("account_app_user_access")
    .select("account_id")
    .eq("user_id", userId)
    .eq("app_id", appId)
    .in("account_id", accountIds);

  if (error) {
    console.error("[auth] Error listing account_app_user_access:", error);
    return new Set();
  }

  return new Set(
    (data ?? [])
      .map((row) => row.account_id as string)
      .filter((id): id is string => !!id),
  );
}

/** True when the user can open `appSlug` under a specific account. */
export async function userHasAppAccessForAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  appSlug: string,
): Promise<boolean> {
  const allowed = await getAccountIdsWithAppAccess(
    supabase,
    userId,
    appSlug,
    [accountId],
  );
  return allowed.has(accountId);
}

/**
 * Kenoo SaaS: gate on account_app_user_access for the active account.
 * Legacy walls-app: fall back to user_app_access when the user has no
 * account-level grants yet.
 */
export async function userHasAppAccessForActiveAccount(
  supabase: SupabaseClient,
  userId: string,
  appSlug: string,
  preferredAccountId?: string | null,
): Promise<boolean> {
  const { data: appRow, error: appError } = await supabase
    .from("apps")
    .select("id")
    .eq("is_active", true)
    .eq("slug", appSlug)
    .maybeSingle();

  if (appError || !appRow?.id) {
    // Unknown / inactive slug: fail open (same as previous middleware).
    return true;
  }

  const onSaaS = await userHasAccountAppGrants(supabase, userId);
  if (onSaaS) {
    const activeAccountId = await resolveActiveAccountId(
      supabase,
      userId,
      preferredAccountId,
    );
    if (!activeAccountId) {
      return false;
    }
    return accountUserHasAppAccess(
      supabase,
      activeAccountId,
      userId,
      appRow.id as string,
    );
  }

  return userHasLegacyAppAccess(supabase, userId, appRow.id as string);
}

function browserHostname(): string | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const loc = (globalThis as { location?: { hostname?: string } }).location;
  return loc?.hostname;
}

/** Browser helper — reads the shared active-account cookie when present. */
export function readActiveAccountIdFromDocumentCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${ACTIVE_ACCOUNT_COOKIE}=`;
  const matches = document.cookie
    .split("; ")
    .filter((row) => row.startsWith(prefix));
  if (matches.length === 0) return null;
  // Prefer the last match — host-only and domain cookies can coexist in prod.
  const value = matches[matches.length - 1]!.slice(prefix.length);
  try {
    return decodeURIComponent(value) || null;
  } catch {
    return value || null;
  }
}

/** Persist active account for portal launcher + middleware (client-side). */
export function writeActiveAccountIdToDocumentCookie(
  accountId: string,
  hostname?: string,
): void {
  if (typeof document === "undefined") return;

  const host = hostname ?? browserHostname();
  const options = getActiveAccountCookieOptions(host);
  const maxAge = 60 * 60 * 24 * 365;
  const secure = options?.secure ? "; secure" : "";
  const domainOpt = options?.domain ? `; domain=${options.domain}` : "";

  // Clear stale host-only and domain-scoped cookies before writing.
  document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  if (options?.domain) {
    document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=; path=/; max-age=0; domain=${options.domain}; samesite=lax${secure}`;
  }

  document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=${encodeURIComponent(accountId)}; path=/; max-age=${maxAge}; samesite=lax${secure}${domainOpt}`;
}
