import { type NextRequest } from "next/server";

import {
  handleProtectedAppRequest,
  protectedAppMiddlewareMatcher,
} from "@walls/auth/middleware";

export async function middleware(request: NextRequest) {
  return handleProtectedAppRequest(request, {
    appSlug: process.env.NEXT_PUBLIC_ADPILOT_APP_SLUG || "adpilot",
  });
}

export const config = {
  matcher: protectedAppMiddlewareMatcher,
};
