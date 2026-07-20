import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  ACTIVE_ACCOUNT_COOKIE,
  getActiveAccountCookieOptions,
  userHasAppAccessForAccount,
} from "@walls/auth/active-account";
import { createClient } from "@walls/supabase/server";
import {
  ADPILOT_ACCOUNT_COOKIE,
  ADPILOT_APP_SLUG,
  getAccountMembership,
  getCurrentUserId,
  listAccountsForUser,
  resolveActiveAccountId,
} from "@/lib/account-context";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [accounts, activeAccountId] = await Promise.all([
    listAccountsForUser(userId),
    resolveActiveAccountId(userId),
  ]);

  return NextResponse.json({ accounts, activeAccountId });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    accountId?: string;
  };

  const accountId = body.accountId?.trim();
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  const membership = await getAccountMembership(userId, accountId);
  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this account" },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const hasAppAccess = await userHasAppAccessForAccount(
    supabase,
    userId,
    accountId,
    ADPILOT_APP_SLUG,
  );
  if (!hasAppAccess) {
    return NextResponse.json(
      { error: "This account does not have access to AdPilot" },
      { status: 403 },
    );
  }

  const headerStore = await headers();
  const hostname = headerStore.get("host")?.split(":")[0];
  const sharedOptions = getActiveAccountCookieOptions(hostname);
  const cookieStore = await cookies();

  cookieStore.set(ADPILOT_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, accountId, sharedOptions);

  return NextResponse.json({ ok: true, activeAccountId: accountId });
}
