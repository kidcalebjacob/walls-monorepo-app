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

function isStaleRefreshTokenError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token")
  );
}

/** Expire leftover Supabase auth cookie chunks (prevents HTTP 431 after failed refresh). */
export function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
): void {
  const hostname = request.nextUrl.hostname;
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith("sb-")) continue;
    response.cookies.set({
      name: cookie.name,
      value: "",
      ...mergeSupabaseCookieOptions(
        { path: "/", maxAge: 0, expires: new Date(0) },
        hostname,
      ),
    });
  }
}

/**
 * Refresh the session; on invalid/missing refresh tokens, clear auth cookies
 * so the browser does not keep sending a bloated/broken Cookie header (431).
 */
export async function refreshMiddlewareSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{
  supabase: ReturnType<typeof createMiddlewareSupabaseClient>;
  user: Awaited<
    ReturnType<ReturnType<typeof createMiddlewareSupabaseClient>["auth"]["getUser"]>
  >["data"]["user"];
  error: Awaited<
    ReturnType<ReturnType<typeof createMiddlewareSupabaseClient>["auth"]["getUser"]>
  >["error"];
}> {
  const supabase = createMiddlewareSupabaseClient(request, response);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && isStaleRefreshTokenError(error)) {
    console.warn(
      "[auth] Clearing stale Supabase session cookies:",
      error.code ?? error.message,
    );
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore — we still expire cookies below.
    }
    clearSupabaseAuthCookies(request, response);
    return { supabase, user: null, error };
  }

  return { supabase, user, error };
}
