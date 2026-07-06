import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js reserves `@` in paths for parallel routes.
 * Rewrite `/representation/@handle` internally while keeping `@` in the URL bar.
 */
export function middleware(request: NextRequest) {
  const representationAtHandle = request.nextUrl.pathname.match(
    /^\/representation\/(?:@|%40)([^/]+)\/?$/i,
  );

  if (representationAtHandle) {
    const url = request.nextUrl.clone();
    url.pathname = `/representation/${representationAtHandle[1]}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/representation/:path*"],
};
