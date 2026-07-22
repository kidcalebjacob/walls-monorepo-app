import { createHash } from "node:crypto";

import { createAdminClient } from "@walls/supabase/admin";
import { createClient } from "@walls/supabase/server";

import {
  GOOGLE_ADS_SERVICE,
  GOOGLE_PROVIDER,
  META_EMPTY_REFRESH_TOKEN,
  META_PROVIDER,
  META_SERVICE,
  type GoogleAdsConnectionRecord,
  type MetaConnectionRecord,
  type SafeAccountConnection,
} from "@/lib/connections";
import type { GoogleAdsCustomer } from "@/lib/google-ads-oauth";

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
    console.error("[adpilot] list connections:", error);
    return [];
  }

  return (data ?? []) as SafeAccountConnection[];
}

export async function listMetaConnectionsWithTokens(
  accountId: string,
): Promise<MetaConnectionRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_connections")
    .select("id, account_id, provider_account_id, access_token, token_payload")
    .eq("account_id", accountId)
    .eq("provider", META_PROVIDER)
    .eq("service", META_SERVICE)
    .is("revoked_at", null)
    .not("provider_account_id", "is", null);

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
  accountId: string;
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

  const activeProviderAccountIds: string[] = [];

  const upsertRow = async (account: MetaAdAccount | null) => {
    const providerAccountId = account?.id ?? null;
    if (providerAccountId) {
      activeProviderAccountIds.push(providerAccountId);
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
      account_id: input.accountId,
      provider: META_PROVIDER,
      service: META_SERVICE,
      provider_account_id: providerAccountId,
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
      .from("account_connections")
      .select("id")
      .eq("account_id", input.accountId)
      .eq("provider", META_PROVIDER)
      .eq("service", META_SERVICE);

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
    } else {
      const { error } = await admin.from("account_connections").insert(row);
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
    .from("account_connections")
    .select("id, provider_account_id")
    .eq("account_id", input.accountId)
    .eq("provider", META_PROVIDER)
    .eq("service", META_SERVICE)
    .is("revoked_at", null);

  if (staleError) throw staleError;

  const staleIds = (staleRows ?? [])
    .filter(
      (row) =>
        row.provider_account_id &&
        !activeProviderAccountIds.includes(row.provider_account_id),
    )
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error } = await admin
      .from("account_connections")
      .delete()
      .in("id", staleIds);

    if (error) throw error;
  }
}

/** Removes all Meta connections for an account (cascades ad_entities, ad_metrics_daily, etc.). */
export async function revokeMetaConnection(accountId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("account_connections")
    .delete()
    .eq("account_id", accountId)
    .eq("provider", META_PROVIDER)
    .eq("service", META_SERVICE);

  if (error) throw error;
}

export async function upsertGoogleAdsConnections(input: {
  accountId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string | null;
  scopes: string;
  tokenResponse: Record<string, unknown>;
  providerUser: { id: string; email?: string; name?: string } | null;
  customers: GoogleAdsCustomer[];
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const scopeHash = hashScopes(input.scopes);
  const accountsToStore: GoogleAdsCustomer[] =
    input.customers.length > 0 ? input.customers : [];

  const activeProviderAccountIds: string[] = [];

  const upsertRow = async (customer: GoogleAdsCustomer | null) => {
    const providerAccountId = customer?.id ?? null;
    if (providerAccountId) {
      activeProviderAccountIds.push(providerAccountId);
    }

    const tokenPayload = {
      provider_user_id: input.providerUser?.id ?? null,
      provider_user_email: input.providerUser?.email ?? null,
      provider_user_name: input.providerUser?.name ?? null,
      account_name: customer?.name ?? null,
      manager: customer?.manager ?? null,
      currency_code: customer?.currencyCode ?? null,
      oauth: {
        scope: input.tokenResponse.scope ?? null,
        token_type: input.tokenResponse.token_type ?? null,
      },
      customers: input.customers,
    };

    const row = {
      account_id: input.accountId,
      provider: GOOGLE_PROVIDER,
      service: GOOGLE_ADS_SERVICE,
      provider_account_id: providerAccountId,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expiry: input.tokenExpiry,
      token_payload: tokenPayload,
      scope_hash: scopeHash,
      last_token_refresh: now,
      updated_at: now,
      revoked_at: null,
    };

    let query = admin
      .from("account_connections")
      .select("id")
      .eq("account_id", input.accountId)
      .eq("provider", GOOGLE_PROVIDER)
      .eq("service", GOOGLE_ADS_SERVICE);

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
    } else {
      const { error } = await admin.from("account_connections").insert(row);
      if (error) throw error;
    }
  };

  if (accountsToStore.length === 0) {
    await upsertRow(null);
  } else {
    for (const customer of accountsToStore) {
      await upsertRow(customer);
    }
  }

  const { data: staleRows, error: staleError } = await admin
    .from("account_connections")
    .select("id, provider_account_id")
    .eq("account_id", input.accountId)
    .eq("provider", GOOGLE_PROVIDER)
    .eq("service", GOOGLE_ADS_SERVICE)
    .is("revoked_at", null);

  if (staleError) throw staleError;

  const staleIds = (staleRows ?? [])
    .filter(
      (row) =>
        row.provider_account_id &&
        !activeProviderAccountIds.includes(row.provider_account_id),
    )
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error } = await admin
      .from("account_connections")
      .delete()
      .in("id", staleIds);

    if (error) throw error;
  }
}

export async function listGoogleAdsConnectionsWithTokens(
  accountId: string,
): Promise<GoogleAdsConnectionRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_connections")
    .select(
      "id, account_id, provider_account_id, access_token, refresh_token, token_expiry, token_payload",
    )
    .eq("account_id", accountId)
    .eq("provider", GOOGLE_PROVIDER)
    .eq("service", GOOGLE_ADS_SERVICE)
    .is("revoked_at", null)
    .not("provider_account_id", "is", null);

  if (error) {
    console.error("[adpilot] list google ads connections with tokens:", error);
    return [];
  }

  return (data ?? []) as GoogleAdsConnectionRecord[];
}

/** Removes all Google Ads connections for an account. */
export async function revokeGoogleAdsConnection(accountId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("account_connections")
    .delete()
    .eq("account_id", accountId)
    .eq("provider", GOOGLE_PROVIDER)
    .eq("service", GOOGLE_ADS_SERVICE);

  if (error) throw error;
}
