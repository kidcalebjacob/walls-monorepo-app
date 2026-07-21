import { cookies } from "next/headers";

import {
  ACTIVE_ACCOUNT_COOKIE,
  getAccountIdsWithAppAccess,
} from "@walls/auth/active-account";
import { createClient } from "@walls/supabase/server";

/**
 * Admin console is account-scoped: views reflect the active Kenoo account
 * (personal or organization) selected in the header switcher.
 */

export const ADMIN_ACCOUNT_COOKIE = "admin_account_id";

export const ADMIN_APP_SLUG =
  process.env.NEXT_PUBLIC_ADMIN_APP_SLUG || "admin";

export type AdminAccountType = "personal" | "organization";

export type AdminAccount = {
  id: string;
  name: string;
  accountType: AdminAccountType;
  iconUrl: string | null;
  role: string;
  isDefault: boolean;
  hasAppAccess: boolean;
};

type AccountMembershipRow = {
  role: string;
  is_default: boolean;
  accounts:
    | {
        id: string;
        name: string;
        account_type: AdminAccountType;
        icon_url: string | null;
      }
    | {
        id: string;
        name: string;
        account_type: AdminAccountType;
        icon_url: string | null;
      }[]
    | null;
};

function mapMembership(row: AccountMembershipRow): AdminAccount | null {
  const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    accountType: account.account_type,
    iconUrl: account.icon_url,
    role: row.role,
    isDefault: row.is_default,
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

export async function listAccountsForUser(
  userId: string,
): Promise<AdminAccount[]> {
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
    console.error("[admin] list accounts:", error);
    return [];
  }

  const accounts = (data ?? [])
    .map((row) => mapMembership(row as AccountMembershipRow))
    .filter((account): account is AdminAccount => account !== null);

  const allowedIds = await getAccountIdsWithAppAccess(
    supabase,
    userId,
    ADMIN_APP_SLUG,
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

export async function resolveActiveAccountId(
  userId: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const preferredAccountId =
    cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value ??
    cookieStore.get(ADMIN_ACCOUNT_COOKIE)?.value ??
    null;

  if (preferredAccountId) {
    const membership = await getAccountMembership(userId, preferredAccountId);
    if (membership) {
      const accounts = await listAccountsForUser(userId);
      const match = accounts.find(
        (account) => account.id === preferredAccountId && account.hasAppAccess,
      );
      if (match) return preferredAccountId;
    }
  }

  const accounts = await listAccountsForUser(userId);
  const accessible = accounts.filter((account) => account.hasAppAccess);
  if (accessible.length === 0) return null;

  const defaultAccount = accessible.find((account) => account.isDefault);
  return (defaultAccount ?? accessible[0]).id;
}

export async function getActiveAccount(
  userId: string,
): Promise<AdminAccount | null> {
  const accounts = await listAccountsForUser(userId);
  if (accounts.length === 0) return null;

  const cookieStore = await cookies();
  const preferredAccountId =
    cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value ??
    cookieStore.get(ADMIN_ACCOUNT_COOKIE)?.value ??
    null;

  const fromCookie = preferredAccountId
    ? accounts.find(
        (account) => account.id === preferredAccountId && account.hasAppAccess,
      )
    : undefined;
  if (fromCookie) return fromCookie;

  const accessible = accounts.filter((account) => account.hasAppAccess);
  return (
    accessible.find((account) => account.isDefault) ?? accessible[0] ?? null
  );
}
