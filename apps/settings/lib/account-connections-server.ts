import { createHash } from "node:crypto";

import { createAdminClient } from "@walls/supabase/admin";
import { createClient } from "@walls/supabase/server";

import {
  type AccountConnectionRecord,
  type SafeAccountConnection,
} from "./account-connections";

async function getAccountMembershipForUser(
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

  if (error || !data) {
    return null;
  }

  return {
    role: data.role as string,
    isDefault: data.is_default,
  };
}

export async function listSafeConnectionsForAccount(
  accountId: string,
): Promise<SafeAccountConnection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_connections")
    .select(
      "id, provider, service, provider_account_id, token_expiry, revoked_at, created_at, updated_at, token_payload",
    )
    .eq("account_id", accountId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[settings] list account connections:", error);
    return [];
  }

  return (data ?? []) as SafeAccountConnection[];
}

export async function listSafeConnectionsForAccountAsUser(input: {
  accountId: string;
  userId: string;
}): Promise<SafeAccountConnection[]> {
  const membership = await getAccountMembershipForUser(
    input.userId,
    input.accountId,
  );
  if (!membership) {
    return [];
  }

  return listSafeConnectionsForAccount(input.accountId);
}

export async function getAccountConnectionWithTokens(input: {
  accountId: string;
  provider: string;
  service: string;
  providerAccountId?: string | null;
}): Promise<AccountConnectionRecord | null> {
  const admin = createAdminClient();

  let query = admin
    .from("account_connections")
    .select(
      "id, account_id, provider_account_id, access_token, refresh_token, token_expiry, token_payload",
    )
    .eq("account_id", input.accountId)
    .eq("provider", input.provider)
    .eq("service", input.service)
    .is("revoked_at", null);

  if (input.providerAccountId) {
    query = query.eq("provider_account_id", input.providerAccountId);
  } else {
    query = query.is("provider_account_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[settings] get account connection:", error);
    return null;
  }

  return (data as AccountConnectionRecord | null) ?? null;
}

function hashScopes(scopes: string): string {
  return createHash("sha256").update(scopes).digest("hex");
}

export async function upsertAccountConnection(input: {
  accountId: string;
  provider: string;
  service: string;
  providerAccountId?: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiry?: string | null;
  tokenPayload?: Record<string, unknown> | null;
  scopes?: string;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const providerAccountId = input.providerAccountId ?? null;

  const row = {
    account_id: input.accountId,
    provider: input.provider,
    service: input.service,
    provider_account_id: providerAccountId,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    token_expiry: input.tokenExpiry ?? null,
    token_payload: input.tokenPayload ?? null,
    scope_hash: input.scopes ? hashScopes(input.scopes) : null,
    last_token_refresh: now,
    updated_at: now,
    revoked_at: null,
  };

  let query = admin
    .from("account_connections")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("provider", input.provider)
    .eq("service", input.service);

  if (providerAccountId) {
    query = query.eq("provider_account_id", providerAccountId);
  } else {
    query = query.is("provider_account_id", null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("account_connections")
      .update(row)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("account_connections").insert(row);
  if (error) throw error;
}

export async function revokeAccountConnection(input: {
  accountId: string;
  provider: string;
  service: string;
  providerAccountId?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  let query = admin
    .from("account_connections")
    .update({
      revoked_at: now,
      updated_at: now,
    })
    .eq("account_id", input.accountId)
    .eq("provider", input.provider)
    .eq("service", input.service)
    .is("revoked_at", null);

  if (input.providerAccountId) {
    query = query.eq("provider_account_id", input.providerAccountId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function deleteAccountConnection(input: {
  accountId: string;
  provider: string;
  service: string;
  providerAccountId?: string | null;
}): Promise<void> {
  const admin = createAdminClient();

  let query = admin
    .from("account_connections")
    .delete()
    .eq("account_id", input.accountId)
    .eq("provider", input.provider)
    .eq("service", input.service);

  if (input.providerAccountId) {
    query = query.eq("provider_account_id", input.providerAccountId);
  }

  const { error } = await query;
  if (error) throw error;
}
