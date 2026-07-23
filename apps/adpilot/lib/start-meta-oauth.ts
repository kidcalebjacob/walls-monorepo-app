import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCurrentUserId } from "@/lib/account-context";
import { buildMetaAuthorizeUrl } from "@/lib/meta-oauth";

export const META_OAUTH_STATE_COOKIE = "meta_oauth_state";

/** Starts Meta OAuth - used by `/api/oauth/meta` and `/api/oauth/meta/login`. */
export async function startMetaOAuthLogin(): Promise<NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildMetaAuthorizeUrl(state));
}
