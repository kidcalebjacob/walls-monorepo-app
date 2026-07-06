import { NextResponse, type NextRequest } from "next/server";

import { createMiddlewareSupabaseClient } from "@walls/auth/middleware";

const PUBLIC_PATHS = ["/login", "/reset-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Refresh auth cookies on public auth pages (with shared .walls.agency domain).
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createMiddlewareSupabaseClient(request, response);
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
