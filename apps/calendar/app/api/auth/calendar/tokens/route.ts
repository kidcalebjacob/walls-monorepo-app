import { NextResponse } from "next/server";

import {
  getCalendarTokensForUser,
  requireCalendarUser,
} from "@/lib/google-calendar-auth";

export async function GET() {
  const { user, error } = await requireCalendarUser();
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const tokens = await getCalendarTokensForUser(user.id);
  if (!tokens.ok) {
    return NextResponse.json(
      {
        error: tokens.error,
        requiresGoogleAuth: tokens.requiresGoogleAuth,
        requiresReauth: tokens.requiresReauth,
        details: tokens.details,
      },
      { status: tokens.status },
    );
  }

  return NextResponse.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiry: tokens.tokenExpiry,
  });
}
