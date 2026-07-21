import { NextResponse } from "next/server";

import {
  createOrganizationForUser,
  getOrganizationById,
} from "@/lib/organizations";
import { getAdminDataScope } from "@/lib/admin-scope";
import { requireAdminCaller } from "@/lib/require-admin";

export async function GET() {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = await getAdminDataScope();
  if (!scope) {
    return NextResponse.json({ organizations: [], activeAccountId: null });
  }

  if (scope.account.accountType === "personal") {
    return NextResponse.json({
      organizations: [],
      activeAccountId: scope.accountId,
      accountType: "personal" as const,
    });
  }

  const organization = await getOrganizationById(scope.accountId);
  return NextResponse.json({
    organizations: organization ? [organization] : [],
    activeAccountId: scope.accountId,
    accountType: "organization" as const,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as {
    name?: string;
    iconUrl?: string | null;
    website?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 },
    );
  }

  const result = await createOrganizationForUser({
    userId: auth.user.id,
    name: body.name.trim(),
    iconUrl: body.iconUrl ?? null,
    website: body.website ?? null,
  });

  if ("error" in result && result.error) {
    const status = result.error.includes("taken") ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (!result.organization) {
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }

  return NextResponse.json({ organization: result.organization });
}
