import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import {
  getCurrentUserId,
  upsertStravaConnection,
} from "@/lib/connections-server";
import {
  exchangeStravaCodeForToken,
  getHealthBaseUrl,
  STRAVA_SCOPES,
} from "@/lib/strava-oauth";
import { STRAVA_OAUTH_STATE_COOKIE } from "@/lib/start-strava-oauth";

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings", getHealthBaseUrl());

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    settingsUrl.searchParams.set("error", error);
    return NextResponse.redirect(settingsUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get(STRAVA_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(STRAVA_OAUTH_STATE_COOKIE);

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
    const token = await exchangeStravaCodeForToken(code);

    await upsertStravaConnection({
      userId,
      token,
      scopes: STRAVA_SCOPES.join(","),
    });

    settingsUrl.searchParams.set("connected", "strava");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("[health] Strava OAuth callback:", err);
    settingsUrl.searchParams.set("error", "strava_oauth_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
