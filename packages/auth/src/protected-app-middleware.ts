import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { isMfaSecondFactorPending } from "./mfa-assurance";
import { refreshMiddlewareSession } from "./middleware-supabase";
import { buildPortalLoginUrl, normalizePortalOrigin, resolvePortalLoginOrigin } from "./portal-url";
import { safeAuthReturnUrl } from "./post-login-redirect";

export {
  clearSupabaseAuthCookies,
  createMiddlewareSupabaseClient,
  refreshMiddlewareSession,
} from "./middleware-supabase";

export interface ProtectedAppMiddlewareOptions {
  /** Routes that skip auth (default: none). */
  publicPaths?: string[];
  /** Portal origin override (optional). Defaults from env via resolvePortalLoginOrigin. */
  portalLoginUrl?: string;
  /**
   * When set, user must have access to this apps.slug via user_app_access
   * OR membership in an account with account_app_access.
   * Omit to only require a valid portal session.
   */
  appSlug?: string;
  /** When true, user must have users.is_admin = true. */
  requireAdmin?: boolean;
}

export const protectedAppMiddlewareMatcher = [
  "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
];

function isPublicPath(pathname: string, publicPaths: string[]): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Preserve Set-Cookie from session refresh / cookie clears onto a redirect. */
function withSessionCookies(
  redirect: NextResponse,
  sessionResponse: NextResponse,
): NextResponse {
  for (const cookie of sessionResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

function redirectToPortalLogin(
  request: NextRequest,
  portalLoginUrl?: string,
  sessionResponse?: NextResponse,
): NextResponse {
  const returnUrl = safeAuthReturnUrl(
    request.nextUrl.href,
    request.nextUrl.origin,
    request.nextUrl.pathname,
  );

  const configuredOrigin = portalLoginUrl
    ? normalizePortalOrigin(portalLoginUrl)
    : null;

  let redirect: NextResponse;
  if (configuredOrigin && configuredOrigin !== request.nextUrl.origin) {
    const override = new URL("/login", configuredOrigin);
    override.searchParams.set("redirect", returnUrl);
    redirect = NextResponse.redirect(override);
  } else {
    redirect = NextResponse.redirect(
      buildPortalLoginUrl(request.nextUrl.origin, {
        redirect: returnUrl,
      }),
    );
  }

  return sessionResponse ? withSessionCookies(redirect, sessionResponse) : redirect;
}

/** Logged-in but not allowed on this app — do not pass ?redirect= or portal will bounce back. */
function redirectToPortalHome(
  request: NextRequest,
  portalLoginUrl?: string,
  sessionResponse?: NextResponse,
): NextResponse {
  const configuredOrigin = portalLoginUrl
    ? normalizePortalOrigin(portalLoginUrl)
    : null;
  const portalOrigin =
    configuredOrigin && configuredOrigin !== request.nextUrl.origin
      ? configuredOrigin
      : resolvePortalLoginOrigin(request.nextUrl.origin);

  const redirect = NextResponse.redirect(new URL("/login", portalOrigin));
  return sessionResponse ? withSessionCookies(redirect, sessionResponse) : redirect;
}

async function isUserAuthenticated(
  supabase: SupabaseClient,
  user: User | null,
): Promise<boolean> {
  if (!user) return false;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return !isMfaSecondFactorPending(user, session?.access_token);
}

async function userHasAppAccess(
  supabase: SupabaseClient,
  userId: string,
  appSlug: string,
): Promise<boolean> {
  const { data: appRow, error: appError } = await supabase
    .from("apps")
    .select("id")
    .eq("is_active", true)
    .eq("slug", appSlug)
    .maybeSingle();

  if (appError || !appRow?.id) {
    return true;
  }

  const { data: accessRow, error: accessError } = await supabase
    .from("user_app_access")
    .select("id")
    .eq("user_id", userId)
    .eq("app_id", appRow.id)
    .maybeSingle();

  if (accessError) {
    console.error("[auth] Error checking user_app_access:", accessError);
    return false;
  }

  if (accessRow) {
    return true;
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("account_users")
    .select("account_id")
    .eq("user_id", userId);

  if (membershipError) {
    console.error("[auth] Error checking account_users:", membershipError);
    return false;
  }

  const accountIds = (memberships ?? [])
    .map((row) => row.account_id)
    .filter((id): id is string => !!id);

  if (accountIds.length === 0) {
    return false;
  }

  const { data: accountAccessRows, error: accountAccessError } = await supabase
    .from("account_app_access")
    .select("id")
    .eq("app_id", appRow.id)
    .in("account_id", accountIds)
    .limit(1);

  if (accountAccessError) {
    console.error("[auth] Error checking account_app_access:", accountAccessError);
    return false;
  }

  return (accountAccessRows?.length ?? 0) > 0;
}

/**
 * Middleware handler for internal apps (AdPilot, etc.).
 * Unauthenticated users are sent to the portal login with a return URL.
 */
export async function handleProtectedAppRequest(
  request: NextRequest,
  options: ProtectedAppMiddlewareOptions = {},
): Promise<NextResponse> {
  const publicPaths = options.publicPaths ?? [];
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname, publicPaths)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const { supabase, user, error: userError } = await refreshMiddlewareSession(
      request,
      response,
    );

    const authenticated = !userError && (await isUserAuthenticated(supabase, user));

    if (!authenticated) {
      return redirectToPortalLogin(request, options.portalLoginUrl, response);
    }

    const { data: userRow, error: statusError } = await supabase
      .from("users")
      .select("status, is_admin")
      .eq("id", user!.id)
      .maybeSingle();

    if (statusError) {
      console.error("[auth] Error fetching user status:", statusError);
    }

    if (userRow?.status && userRow.status !== "active") {
      await supabase.auth.signOut();
      return redirectToPortalLogin(request, options.portalLoginUrl, response);
    }

    if (options.requireAdmin && userRow?.is_admin !== true) {
      return redirectToPortalHome(request, options.portalLoginUrl, response);
    }

    if (options.appSlug) {
      const hasAccess = await userHasAppAccess(supabase, user!.id, options.appSlug);
      if (!hasAccess) {
        console.warn(
          `[auth] User ${user!.id} lacks access to app slug "${options.appSlug}"`,
        );
        return redirectToPortalHome(request, options.portalLoginUrl, response);
      }
    }

    return response;
  } catch (error) {
    console.error("[auth] Protected app middleware error:", error);
    return redirectToPortalLogin(request, options.portalLoginUrl, response);
  }
}
