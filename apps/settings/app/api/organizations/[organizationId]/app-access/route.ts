import { NextResponse } from "next/server";

import {
  grantAccountAppAccess,
  grantAccountUserAppAccess,
  listAccountAppIds,
  listManagedApps,
  listMemberAppIdsForAccount,
  revokeAccountAppAccess,
  revokeAccountUserAppAccess,
} from "@/lib/app-access";
import {
  canManageAccountMembers,
  getAccountMembershipForUser,
  listAccountMembers,
} from "@/lib/accounts";
import { canEditOrganization, getOrganizationForUser } from "@/lib/organizations";
import { getCurrentUserId } from "@/lib/session";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId: accountId } = await context.params;
  const organization = await getOrganizationForUser(userId, accountId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const members = await listAccountMembers(accountId);
    const memberUserIds = members.map((member) => member.userId);
    const [apps, organizationAppIds, memberAppIds] = await Promise.all([
      listManagedApps(),
      listAccountAppIds(accountId),
      listMemberAppIdsForAccount(accountId, memberUserIds),
    ]);

    return NextResponse.json({
      apps,
      organizationAppIds,
      memberAppIds,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load app access",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const actorUserId = await getCurrentUserId();
  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId: accountId } = await context.params;
  const organization = await getOrganizationForUser(actorUserId, accountId);

  if (!organization || !canEditOrganization(organization.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorMembership = await getAccountMembershipForUser(
    actorUserId,
    accountId,
  );
  if (!actorMembership || !canManageAccountMembers(actorMembership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    appId?: string;
    enabled?: boolean;
    /** When set, toggle this member's access instead of the org catalog. */
    userId?: string;
  };

  if (!body.appId || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "appId and enabled are required" },
      { status: 400 },
    );
  }

  const targetUserId = body.userId?.trim() || null;

  if (targetUserId) {
    const targetMembership = await getAccountMembershipForUser(
      targetUserId,
      accountId,
    );
    if (!targetMembership) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 404 },
      );
    }
    if (
      actorMembership.role !== "owner" &&
      targetMembership.role === "owner"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = body.enabled
      ? await grantAccountUserAppAccess({
          accountId,
          userId: targetUserId,
          appId: body.appId,
        })
      : await revokeAccountUserAppAccess({
          accountId,
          userId: targetUserId,
          appId: body.appId,
        });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } else {
    const result = body.enabled
      ? await grantAccountAppAccess({ accountId, appId: body.appId })
      : await revokeAccountAppAccess({ accountId, appId: body.appId });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }

  const members = await listAccountMembers(accountId);
  const [apps, organizationAppIds, memberAppIds] = await Promise.all([
    listManagedApps(),
    listAccountAppIds(accountId),
    listMemberAppIdsForAccount(
      accountId,
      members.map((member) => member.userId),
    ),
  ]);

  return NextResponse.json({ apps, organizationAppIds, memberAppIds });
}
