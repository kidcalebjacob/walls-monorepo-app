import { type NextRequest } from "next/server";

import { handleProtectedAppRequest } from "@walls/auth/middleware";

export async function middleware(request: NextRequest) {
  return handleProtectedAppRequest(request, {
    appSlug: process.env.NEXT_PUBLIC_SETTINGS_APP_SLUG || "settings",
    publicPaths: [
      "/api/google/gmail/callback",
      "/api/google/calendar/callback",
    ],
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
