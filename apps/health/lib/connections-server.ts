import { createHash } from "node:crypto";

import { createAdminClient } from "@walls/supabase/admin";
import { createClient } from "@walls/supabase/server";

import {
  STRAVA_PROVIDER,
  STRAVA_SERVICE,
  type SafeUserConnection,
  type StravaConnectionRecord,
} from "@/lib/connections";
import type { StravaAthlete, StravaTokenResponse } from "@/lib/strava-oauth";

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
    console.error("[health] list connections:", error);
    return [];
  }

  return (data ?? []) as SafeUserConnection[];
}

export async function listStravaConnections(
  userId: string,
): Promise<SafeUserConnection[]> {
  const connections = await listSafeConnectionsForUser(userId);
  return connections.filter(
    (c) => c.provider === STRAVA_PROVIDER && c.service === STRAVA_SERVICE,
  );
}

export async function getStravaConnectionWithTokens(
  userId: string,
): Promise<StravaConnectionRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_connections")
    .select("id, user_id, account_id, access_token, refresh_token, token_expiry, token_payload")
    .eq("user_id", userId)
    .eq("provider", STRAVA_PROVIDER)
    .eq("service", STRAVA_SERVICE)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("[health] get strava connection:", error);
    return null;
  }

  return (data as StravaConnectionRecord | null) ?? null;
}

function hashScopes(scopes: string): string {
  return createHash("sha256").update(scopes).digest("hex");
}

function athleteName(athlete: StravaAthlete | undefined): string | null {
  if (!athlete) return null;
  const name = [athlete.firstname, athlete.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || athlete.username || null;
}

/** Stores (or refreshes) the single Strava connection for a user. */
export async function upsertStravaConnection(input: {
  userId: string;
  token: StravaTokenResponse;
  scopes: string;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const athlete = input.token.athlete;

  const row = {
    user_id: input.userId,
    provider: STRAVA_PROVIDER,
    service: STRAVA_SERVICE,
    account_id: athlete?.id != null ? String(athlete.id) : null,
    access_token: input.token.access_token,
    refresh_token: input.token.refresh_token,
    token_expiry: new Date(input.token.expires_at * 1000).toISOString(),
    token_payload: {
      athlete_name: athleteName(athlete),
      profile_url: athlete?.profile ?? null,
      athlete: athlete ?? null,
      scope: input.scopes,
    },
    scope_hash: hashScopes(input.scopes),
    last_token_refresh: now,
    updated_at: now,
    revoked_at: null,
  };

  const { data: existing } = await admin
    .from("user_connections")
    .select("id")
    .eq("user_id", input.userId)
    .eq("provider", STRAVA_PROVIDER)
    .eq("service", STRAVA_SERVICE)
    .maybeSingle();

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
}

/** Removes the Strava connection (cascades health_activities via user_connection_id). */
export async function revokeStravaConnection(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", STRAVA_PROVIDER)
    .eq("service", STRAVA_SERVICE);

  if (error) throw error;
}
