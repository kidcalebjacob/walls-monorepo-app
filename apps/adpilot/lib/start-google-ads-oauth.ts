import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCurrentUserId } from "@/lib/account-context";
import { buildGoogleAdsAuthorizeUrl } from "@/lib/google-ads-oauth";

export const GOOGLE_ADS_OAUTH_STATE_COOKIE = "google_ads_oauth_state";

/** Starts Google Ads OAuth - used by `/api/oauth/google/login`. */
export async function startGoogleAdsOAuthLogin(): Promise<NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_ADS_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildGoogleAdsAuthorizeUrl(state));
}
