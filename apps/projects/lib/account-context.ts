import { cookies } from "next/headers";

import {
  ACTIVE_ACCOUNT_COOKIE,
  getAccountIdsWithAppAccess,
} from "@walls/auth/active-account";
import { createClient } from "@walls/supabase/server";

/**
 * Projects is an account-scoped app: every project belongs to a WALLS account
 * (personal or organization). This module resolves the current user, the
 * accounts they belong to, and the "active" account (whose projects are shown),
 * which is persisted in a cookie and validated against membership on every read.
 */

export const PROJECTS_ACCOUNT_COOKIE = "projects_account_id";

export const PROJECTS_APP_SLUG =
  process.env.NEXT_PUBLIC_PROJECTS_APP_SLUG || "projects";

export type ProjectsAccountType = "personal" | "organization";

export type ProjectsAccount = {
  id: string;
  name: string;
  accountType: ProjectsAccountType;
  iconUrl: string | null;
  role: string;
  isDefault: boolean;
  /** Whether the user can open Projects under this account. */
  hasAppAccess: boolean;
};

type AccountMembershipRow = {
  role: string;
  is_default: boolean;
  accounts:
    | {
        id: string;
        name: string;
        account_type: ProjectsAccountType;
        icon_url: string | null;
      }
    | {
        id: string;
        name: string;
        account_type: ProjectsAccountType;
        icon_url: string | null;
      }[]
    | null;
};

function mapMembership(row: AccountMembershipRow): ProjectsAccount | null {
  const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    accountType: account.account_type,
    iconUrl: account.icon_url,
    role: row.role,
    isDefault: row.is_default,
    // Filled by listAccountsForUser after checking grants for this app.
    hasAppAccess: true,
  };
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Every account the user belongs to, default first, then alphabetical. */
export async function listAccountsForUser(
  userId: string,
): Promise<ProjectsAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_users")
    .select(
      `role, is_default, accounts!inner (
        id, name, account_type, icon_url
      )`,
    )
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) {
    console.error("[projects] list accounts:", error);
    return [];
  }

  const accounts = (data ?? [])
    .map((row) => mapMembership(row as AccountMembershipRow))
    .filter((account): account is ProjectsAccount => account !== null);

  const allowedIds = await getAccountIdsWithAppAccess(
    supabase,
    userId,
    PROJECTS_APP_SLUG,
    accounts.map((account) => account.id),
  );

  const withAccess = accounts.map((account) => ({
    ...account,
    hasAppAccess: allowedIds.has(account.id),
  }));

  return withAccess.sort((left, right) => {
    if (left.hasAppAccess !== right.hasAppAccess) {
      return left.hasAppAccess ? -1 : 1;
    }
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export async function getAccountMembership(
  userId: string,
  accountId: string,
): Promise<{ role: string; isDefault: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_users")
    .select("role, is_default")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error || !data) return null;
  return { role: data.role as string, isDefault: data.is_default as boolean };
}

/**
 * Resolve the account whose projects should display. Prefers the shared
 * Kenoo active-account cookie, then the Projects cookie, then is_default.
 */
export async function resolveActiveAccountId(
  userId: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const preferredAccountId =
    cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value ??
    cookieStore.get(PROJECTS_ACCOUNT_COOKIE)?.value ??
    null;

  if (preferredAccountId) {
    const membership = await getAccountMembership(userId, preferredAccountId);
    if (membership) return preferredAccountId;
  }

  const accounts = await listAccountsForUser(userId);
  if (accounts.length === 0) return null;

  const defaultAccount = accounts.find((account) => account.isDefault);
  return (defaultAccount ?? accounts[0]).id;
}

export async function getActiveAccount(
  userId: string,
): Promise<ProjectsAccount | null> {
  const accounts = await listAccountsForUser(userId);
  if (accounts.length === 0) return null;

  const cookieStore = await cookies();
  const preferredAccountId =
    cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value ??
    cookieStore.get(PROJECTS_ACCOUNT_COOKIE)?.value ??
    null;

  const fromCookie = preferredAccountId
    ? accounts.find((account) => account.id === preferredAccountId)
    : undefined;
  if (fromCookie) return fromCookie;

  return accounts.find((account) => account.isDefault) ?? accounts[0];
}
