import { NextResponse, type NextRequest } from "next/server";

import { refreshMiddlewareSession } from "@walls/auth/middleware";

const PUBLIC_PATHS = ["/login", "/reset-password", "/create-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Refresh auth cookies on public auth pages (host-only on localhost).
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  await refreshMiddlewareSession(request, response);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
