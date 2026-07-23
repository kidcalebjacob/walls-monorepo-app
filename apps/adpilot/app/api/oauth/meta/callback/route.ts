import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { after } from "next/server";

import { upsertMetaConnections } from "@/lib/connections-server";
import {
  getCurrentUserId,
  resolveActiveAccountId,
} from "@/lib/account-context";
import { getAdDataScope } from "@/lib/ad-scope";
import { syncMetaConnectionsForAccount } from "@/lib/meta-sync";
import {
  exchangeMetaCodeForToken,
  exchangeMetaForLongLivedToken,
  fetchMetaAdAccounts,
  fetchMetaUser,
  getAdpilotBaseUrl,
  META_AD_SCOPES,
} from "@/lib/meta-oauth";
import { META_OAUTH_STATE_COOKIE } from "@/lib/start-meta-oauth";

export async function GET(request: NextRequest) {
  const baseUrl = getAdpilotBaseUrl();
  const settingsUrl = new URL("/settings/connections/meta", baseUrl);

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    settingsUrl.searchParams.set("error", error);
    return NextResponse.redirect(settingsUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(META_OAUTH_STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    settingsUrl.searchParams.set("error", "invalid_oauth_state");
    return NextResponse.redirect(settingsUrl);
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    settingsUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(settingsUrl);
  }

  const accountId = await resolveActiveAccountId(userId);
  if (!accountId) {
    settingsUrl.searchParams.set("error", "no_active_account");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const shortLived = await exchangeMetaCodeForToken(code);
    const longLived = await exchangeMetaForLongLivedToken(
      shortLived.access_token,
    );

    const [providerUser, adAccounts] = await Promise.all([
      fetchMetaUser(longLived.access_token),
      fetchMetaAdAccounts(longLived.access_token),
    ]);

    const expiresIn = longLived.expires_in ?? 60 * 60 * 24 * 60;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    await upsertMetaConnections({
      accountId,
      accessToken: longLived.access_token,
      tokenExpiry,
      scopes: META_AD_SCOPES.join(","),
      shortLivedToken: shortLived,
      longLivedToken: longLived,
      providerUser,
      adAccounts,
    });

    after(async () => {
      try {
        const scope = await getAdDataScope();
        if (scope) {
          await syncMetaConnectionsForAccount(scope);
        }
      } catch (syncError) {
        console.error("[adpilot] Meta sync after OAuth:", syncError);
      }
    });

    settingsUrl.searchParams.set("connected", "meta");
    settingsUrl.searchParams.set("syncing", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("[adpilot] Meta OAuth callback:", err);
    settingsUrl.searchParams.set("error", "meta_oauth_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
