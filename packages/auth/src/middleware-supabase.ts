import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";

import { mergeSupabaseCookieOptions } from "@walls/supabase/cookies";

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse,
) {
  const hostname = request.nextUrl.hostname;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: mergeSupabaseCookieOptions(undefined, hostname),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...mergeSupabaseCookieOptions(options, hostname),
            });
          });
        },
      },
    },
  );
}
