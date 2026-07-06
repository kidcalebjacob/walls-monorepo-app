import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import {
  getCurrentUserId,
  upsertMetaConnection,
} from "@/lib/connections-server";
import {
  exchangeMetaCodeForToken,
  exchangeMetaForLongLivedToken,
  fetchMetaAdAccounts,
  getAdpilotBaseUrl,
} from "@/lib/meta-oauth";
import { META_OAUTH_STATE_COOKIE } from "@/lib/start-meta-oauth";

export async function GET(request: NextRequest) {
  const baseUrl = getAdpilotBaseUrl();
  const settingsUrl = new URL("/settings", baseUrl);

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

  try {
    const shortLived = await exchangeMetaCodeForToken(code);
    const longLived = await exchangeMetaForLongLivedToken(
      shortLived.access_token,
    );

    const adAccounts = await fetchMetaAdAccounts(longLived.access_token);
    const primaryAccount = adAccounts[0];

    const expiresIn = longLived.expires_in ?? 60 * 60 * 24 * 60;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    await upsertMetaConnection({
      userId,
      accessToken: longLived.access_token,
      refreshToken: longLived.access_token,
      tokenExpiry,
      accountId: primaryAccount?.id ?? null,
      tokenPayload: {
        ad_accounts: adAccounts,
        scopes: shortLived,
      },
    });

    settingsUrl.searchParams.set("connected", "meta");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("[adpilot] Meta OAuth callback:", err);
    settingsUrl.searchParams.set("error", "meta_oauth_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
