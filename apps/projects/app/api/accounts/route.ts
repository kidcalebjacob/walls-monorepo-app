import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  PROJECTS_ACCOUNT_COOKIE,
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

  const cookieStore = await cookies();
  cookieStore.set(PROJECTS_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, activeAccountId: accountId });
}
