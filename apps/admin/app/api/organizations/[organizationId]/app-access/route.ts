import { NextResponse } from "next/server";

import {
  grantAccountUserAppAccess,
  listAccountAppIds,
  listManagedApps,
  listMemberAppIdsForAccount,
  revokeAccountUserAppAccess,
} from "@/lib/app-access";
import { listAccountMembers } from "@/lib/accounts";
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
    appId?: string;
    enabled?: boolean;
    userId?: string;
  };

  if (!body.appId || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "appId and enabled are required" },
      { status: 400 },
    );
  }

  const targetUserId = body.userId?.trim() || null;

  // Organization catalog (account_app_access) is Console-only.
  // Admin may only assign apps the org already has to members.
  if (!targetUserId) {
    return NextResponse.json(
      {
        error:
          "Organization app catalog is managed in Console. Assign apps to members instead.",
      },
      { status: 403 },
    );
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
