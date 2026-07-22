import { type NextRequest } from "next/server";

import { handleProtectedAppRequest } from "@walls/auth/middleware";

export async function middleware(request: NextRequest) {
  return handleProtectedAppRequest(request, {
    appSlug: process.env.NEXT_PUBLIC_MAIL_APP_SLUG || "mail",
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
