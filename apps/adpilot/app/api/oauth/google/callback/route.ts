import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { upsertGoogleAdsConnections } from "@/lib/connections-server";
import {
  getCurrentUserId,
  resolveActiveAccountId,
} from "@/lib/account-context";
import {
  exchangeGoogleCodeForTokens,
  fetchGoogleAdsCustomers,
  fetchGoogleUser,
  getAdpilotBaseUrl,
  GOOGLE_ADS_SCOPES,
} from "@/lib/google-ads-oauth";
import { GOOGLE_ADS_OAUTH_STATE_COOKIE } from "@/lib/start-google-ads-oauth";

export async function GET(request: NextRequest) {
  const baseUrl = getAdpilotBaseUrl();
  const settingsUrl = new URL("/settings/connections/google", baseUrl);

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    settingsUrl.searchParams.set("error", error);
    return NextResponse.redirect(settingsUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get(GOOGLE_ADS_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_ADS_OAUTH_STATE_COOKIE);

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
    const tokens = await exchangeGoogleCodeForTokens(code);
    if (!tokens.access_token) {
      throw new Error("Google token response missing access_token");
    }
    if (!tokens.refresh_token) {
      throw new Error(
        "Google token response missing refresh_token - revoke Kenoo access in Google Account and try again",
      );
    }

    const [providerUser, customers] = await Promise.all([
      fetchGoogleUser(tokens.access_token),
      fetchGoogleAdsCustomers(tokens.access_token),
    ]);

    const expiresIn = tokens.expires_in ?? 3600;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    await upsertGoogleAdsConnections({
      accountId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry,
      scopes: tokens.scope ?? GOOGLE_ADS_SCOPES.join(" "),
      tokenResponse: tokens,
      providerUser,
      customers,
    });

    settingsUrl.searchParams.set("connected", "google");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("[adpilot] Google Ads OAuth callback:", err);
    settingsUrl.searchParams.set("error", "google_oauth_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
