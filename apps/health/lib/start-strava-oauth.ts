import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCurrentUserId } from "@/lib/connections-server";
import { buildStravaAuthorizeUrl, getHealthBaseUrl } from "@/lib/strava-oauth";

export const STRAVA_OAUTH_STATE_COOKIE = "strava_oauth_state";

/** Starts Strava OAuth: sets a state cookie and redirects to Strava's consent screen. */
export async function startStravaOAuthLogin(): Promise<NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId) {
    const loginUrl = new URL("/settings", getHealthBaseUrl());
    loginUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(loginUrl);
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STRAVA_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildStravaAuthorizeUrl(state));
}
