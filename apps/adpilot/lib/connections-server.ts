import { createHash } from "node:crypto";

import { createAdminClient } from "@walls/supabase/admin";
import { createClient } from "@walls/supabase/server";

import {
  META_EMPTY_REFRESH_TOKEN,
  META_PROVIDER,
  META_SERVICE,
  type MetaConnectionRecord,
  type SafeUserConnection,
} from "@/lib/connections";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listSafeConnectionsForUser(
  userId: string,
): Promise<SafeUserConnection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_connections")
    .select(
      "id, provider, service, account_id, token_expiry, revoked_at, created_at, updated_at, token_payload",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[adpilot] list connections:", error);
    return [];
  }

  return (data ?? []) as SafeUserConnection[];
}

export async function listMetaConnectionsWithTokens(
  userId: string,
): Promise<MetaConnectionRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_connections")
    .select("id, user_id, account_id, access_token, token_payload")
    .eq("user_id", userId)
    .eq("provider", META_PROVIDER)
    .eq("service", META_SERVICE)
    .is("revoked_at", null)
    .not("account_id", "is", null);

  if (error) {
    console.error("[adpilot] list meta connections with tokens:", error);
    return [];
  }

  return (data ?? []) as MetaConnectionRecord[];
}

function hashScopes(scopes: string): string {
  return createHash("sha256").update(scopes).digest("hex");
}

type MetaAdAccount = {
  id: string;
  name?: string;
  account_status?: number;
};

export async function upsertMetaConnections(input: {
  userId: string;
  accessToken: string;
  tokenExpiry: string | null;
  scopes: string;
  shortLivedToken: Record<string, unknown>;
  longLivedToken: Record<string, unknown>;
  providerUser: { id: string; name?: string } | null;
  adAccounts: MetaAdAccount[];
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const scopeHash = hashScopes(input.scopes);
  const accountsToStore: MetaAdAccount[] =
    input.adAccounts.length > 0 ? input.adAccounts : [];

  const activeAccountIds: string[] = [];

  const upsertRow = async (account: MetaAdAccount | null) => {
    const accountId = account?.id ?? null;
    if (accountId) {
      activeAccountIds.push(accountId);
    }

    const tokenPayload = {
      provider_user_id: input.providerUser?.id ?? null,
      provider_user_name: input.providerUser?.name ?? null,
      account_name: account?.name ?? null,
      account_status: account?.account_status ?? null,
      short_lived: input.shortLivedToken,
      long_lived: input.longLivedToken,
      ad_accounts: input.adAccounts,
    };

    const row = {
      user_id: input.userId,
      provider: META_PROVIDER,
      service: META_SERVICE,
      account_id: accountId,
      access_token: input.accessToken,
      refresh_token: META_EMPTY_REFRESH_TOKEN,
      token_expiry: input.tokenExpiry,
      token_payload: tokenPayload,
      scope_hash: scopeHash,
      last_token_refresh: now,
      updated_at: now,
      revoked_at: null,
    };

    let query = admin
      .from("user_connections")
      .select("id")
      .eq("user_id", input.userId)
      .eq("provider", META_PROVIDER)
      .eq("service", META_SERVICE);

    if (accountId) {
      query = query.eq("account_id", accountId);
    } else {
      query = query.is("account_id", null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from("user_connections")
        .update(row)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("user_connections").insert(row);
      if (error) throw error;
    }
  };

  if (accountsToStore.length === 0) {
    await upsertRow(null);
  } else {
    for (const account of accountsToStore) {
      await upsertRow(account);
    }
  }

  const { data: staleRows, error: staleError } = await admin
    .from("user_connections")
    .select("id, account_id")
    .eq("user_id", input.userId)
    .eq("provider", META_PROVIDER)
    .eq("service", META_SERVICE)
    .is("revoked_at", null);

  if (staleError) throw staleError;

  const staleIds = (staleRows ?? [])
    .filter((row) => row.account_id && !activeAccountIds.includes(row.account_id))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error } = await admin
      .from("user_connections")
      .update({
        revoked_at: now,
        updated_at: now,
      })
      .in("id", staleIds);

    if (error) throw error;
  }
}

export async function revokeMetaConnection(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_connections")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", META_PROVIDER)
    .eq("service", META_SERVICE)
    .is("revoked_at", null);

  if (error) throw error;
}
