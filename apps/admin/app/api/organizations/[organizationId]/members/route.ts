import { NextResponse } from "next/server";

import {
  addAccountMember,
  inviteOrAddAccountMember,
  listAccountMembers,
  removeAccountMember,
  updateAccountMemberRole,
  type AccountRole,
} from "@/lib/accounts";
import { getOrganizationById } from "@/lib/organizations";
import { requireAdminCaller } from "@/lib/require-admin";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { organizationId: accountId } = await context.params;
  const organization = await getOrganizationById(accountId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const members = await listAccountMembers(accountId);
  return NextResponse.json({ members, accountId });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { organizationId: accountId } = await context.params;
  const organization = await getOrganizationById(accountId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    email?: string;
    userId?: string;
    role?: AccountRole;
    firstName?: string;
    lastName?: string;
  };

  const role = body.role ?? "member";

  if (body.userId) {
    const result = await addAccountMember({
      accountId,
      userId: body.userId,
      role,
    });

    if (!result.ok) {
      const status = result.error.includes("already") ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    const members = await listAccountMembers(accountId);
    return NextResponse.json({ members, invited: false, created: false });
  }

  if (!body.email?.trim()) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 },
    );
  }

  const result = await inviteOrAddAccountMember({
    accountId,
    email: body.email,
    role,
    firstName: body.firstName,
    lastName: body.lastName,
    inviterUserId: auth.user.id,
  });

  if (!result.ok) {
    const status = result.error.includes("already") ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const members = await listAccountMembers(accountId);
  return NextResponse.json({
    members,
    invited: result.invited,
    created: result.created,
    emailSent: result.emailSent,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { organizationId: accountId } = await context.params;
  const organization = await getOrganizationById(accountId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    userId?: string;
    role?: AccountRole;
  };

  const targetUserId = body.userId?.trim();
  if (!targetUserId || !body.role) {
    return NextResponse.json(
      { error: "userId and role are required" },
      { status: 400 },
    );
  }

  const result = await updateAccountMemberRole({
    accountId,
    userId: targetUserId,
    role: body.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const members = await listAccountMembers(accountId);
  return NextResponse.json({ members });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { organizationId: accountId } = await context.params;
  const organization = await getOrganizationById(accountId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
  };
  const targetUserId = body.userId?.trim();
  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const result = await removeAccountMember({
    accountId,
    userId: targetUserId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const members = await listAccountMembers(accountId);
  return NextResponse.json({ members });
}
